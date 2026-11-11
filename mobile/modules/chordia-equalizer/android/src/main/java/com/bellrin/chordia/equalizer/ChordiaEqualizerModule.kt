package com.bellrin.chordia.equalizer

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.audiofx.AudioEffect
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

public class ChordiaEqualizerModule : Module() {
  private var equalizer: Equalizer? = null
  private var isEQEnabled: Boolean = false
  private var currentPreamp: Double = 0.0
  private var currentGains: List<Double> = List(10) { 0.0 }
  private var lastErrorMessage: String = "None"
  private var activeSessionId: Int = 0
  private var loudnessEnhancer: LoudnessEnhancer? = null
  private var soundCheckGainDb: Double = 0.0

  private val targetFrequencies = intArrayOf(
    32000, 64000, 125000, 250000, 500000,
    1000000, 2000000, 4000000, 8000000, 16000000
  )

  override fun definition() = ModuleDefinition {
    Name("ChordiaEqualizer")

    OnCreate {
      initHardwareEqualizer(0)
    }

    Function("initEqualizer") { audioSessionId: Int ->
      initHardwareEqualizer(audioSessionId)
      return@Function (equalizer != null)
    }

    Function("setEnabled") { enabled: Boolean ->
      isEQEnabled = enabled
      try {
        equalizer?.enabled = enabled
        if (enabled) {
          applyGainsToHardware()
        }
      } catch (e: Exception) {
        lastErrorMessage = "setEnabled error: ${e.message}"
      }
    }

    Function("setBands") { gains: List<Double>, preamp: Double ->
      currentGains = gains
      currentPreamp = preamp
      applyGainsToHardware()
    }

    Function("applySettings") { enabled: Boolean, preamp: Double, gains: List<Double> ->
      isEQEnabled = enabled
      currentPreamp = preamp
      currentGains = gains
      try {
        equalizer?.enabled = enabled
        if (enabled) {
          applyGainsToHardware()
        }
      } catch (e: Exception) {
        lastErrorMessage = "applySettings error: ${e.message}"
      }
    }

    Function("setSoundCheckGain") { gainDb: Double ->
      soundCheckGainDb = gainDb.coerceIn(-12.0, 12.0)
      applySoundCheckGain()
    }

    AsyncFunction("analyzeAudioLoudness") { source: String ->
      analyzeAudioLoudness(source)
    }

    Function("getDebugInfo") {
      val eq = equalizer
      val bandCount = try { eq?.numberOfBands?.toInt() ?: 0 } catch (e: Exception) { 0 }
      val hasCtrl = try { eq?.hasControl() ?: false } catch (e: Exception) { false }
      val range = try { eq?.bandLevelRange?.map { it.toInt() } ?: listOf(0, 0) } catch (e: Exception) { listOf(0, 0) }

      val currentHwLevels = mutableListOf<Int>()
      if (eq != null && bandCount > 0) {
        for (b in 0 until bandCount) {
          try {
            currentHwLevels.add(eq.getBandLevel(b.toShort()).toInt())
          } catch (e: Exception) {}
        }
      }

      mapOf(
        "platform" to "Android",
        "isNativeConnected" to (eq != null),
        "activeSessionId" to activeSessionId,
        "isEQEnabled" to isEQEnabled,
        "hasControl" to hasCtrl,
        "numBands" to bandCount,
        "bandRangeMb" to range,
        "hardwareLevelsMb" to currentHwLevels,
        "preamp" to currentPreamp,
        "gains" to currentGains,
        "lastError" to lastErrorMessage
      )
    }

    Function("loadAndPlay") { _: String, _: Double, _: Boolean -> false }
    Function("pause") { false }
    Function("play") { false }
    Function("stop") { false }
    Function("seekTo") { _: Double -> false }
    Function("getPosition") { 0.0 }
    Function("getDuration") { 0.0 }
    Function("isPlaying") { false }
  }

  private fun notifyAudioEffectSessionOpen(sessionId: Int) {
    try {
      val ctx = appContext.reactContext ?: return
      val intent = Intent(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION)
      intent.putExtra(AudioEffect.EXTRA_AUDIO_SESSION, sessionId)
      intent.putExtra(AudioEffect.EXTRA_PACKAGE_NAME, ctx.packageName)
      intent.putExtra(AudioEffect.EXTRA_CONTENT_TYPE, AudioEffect.CONTENT_TYPE_MUSIC)
      ctx.sendBroadcast(intent)
    } catch (e: Exception) {}
  }

  private fun applySoundCheckGain() {
    try {
      if (activeSessionId <= 0) return
      val enhancer = loudnessEnhancer ?: LoudnessEnhancer(activeSessionId).also { loudnessEnhancer = it }
      enhancer.setTargetGain((max(0.0, soundCheckGainDb) * 1000.0).toInt())
      enhancer.enabled = soundCheckGainDb > 0.0
    } catch (e: Exception) {
      lastErrorMessage = "Sound Check effect unavailable: ${e.message}"
    }
  }

  private fun analyzeAudioLoudness(source: String): Double {
    val context = appContext.reactContext ?: throw IllegalStateException("Application context is unavailable.")
    val extractor = MediaExtractor()
    var decoder: MediaCodec? = null

    try {
      val uri = Uri.parse(source)
      if (uri.scheme == null) {
        extractor.setDataSource(source)
      } else {
        extractor.setDataSource(context, uri, null)
      }

      var audioTrack = -1
      var inputFormat: MediaFormat? = null
      for (index in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(index)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          audioTrack = index
          inputFormat = format
          break
        }
      }
      val format = inputFormat ?: throw IllegalArgumentException("The selected file has no audio stream.")
      val mime = format.getString(MediaFormat.KEY_MIME) ?: throw IllegalArgumentException("Audio codec is unavailable.")
      extractor.selectTrack(audioTrack)
      decoder = MediaCodec.createDecoderByType(mime)
      decoder.configure(format, null, null, 0)
      decoder.start()

      val info = MediaCodec.BufferInfo()
      var inputEnded = false
      var outputEnded = false
      var sumSquares = 0.0
      var sampleCount = 0L
      var peak = 0.0
      var pcmEncoding = AudioFormat.ENCODING_PCM_16BIT

      while (!outputEnded) {
        if (!inputEnded) {
          val inputIndex = decoder.dequeueInputBuffer(10000)
          if (inputIndex >= 0) {
            val inputBuffer = decoder.getInputBuffer(inputIndex) ?: throw IllegalStateException("Audio decoder input buffer is unavailable.")
            val sampleSize = extractor.readSampleData(inputBuffer, 0)
            if (sampleSize < 0) {
              decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputEnded = true
            } else {
              decoder.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        when (val outputIndex = decoder.dequeueOutputBuffer(info, 10000)) {
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val outputFormat = decoder.outputFormat
            if (outputFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
              pcmEncoding = outputFormat.getInteger(MediaFormat.KEY_PCM_ENCODING)
            }
          }
          else -> if (outputIndex >= 0) {
            val outputBuffer = decoder.getOutputBuffer(outputIndex)
            if (outputBuffer != null && info.size > 0) {
              outputBuffer.order(ByteOrder.LITTLE_ENDIAN)
              outputBuffer.position(info.offset)
              outputBuffer.limit(info.offset + info.size)
              if (pcmEncoding == AudioFormat.ENCODING_PCM_FLOAT) {
                while (outputBuffer.remaining() >= 4) {
                  val sample = outputBuffer.float.toDouble()
                  sumSquares += sample * sample
                  peak = max(peak, abs(sample))
                  sampleCount++
                }
              } else {
                while (outputBuffer.remaining() >= 2) {
                  val sample = outputBuffer.short.toDouble() / Short.MAX_VALUE
                  sumSquares += sample * sample
                  peak = max(peak, abs(sample))
                  sampleCount++
                }
              }
            }
            outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            decoder.releaseOutputBuffer(outputIndex, false)
          }
        }
      }

      if (sampleCount == 0L || peak <= 0.0) return 0.0
      val rms = sqrt(sumSquares / sampleCount.toDouble())
      if (rms <= 0.0) return 0.0
      val rmsDb = 20.0 * log10(rms)
      val peakDb = 20.0 * log10(peak)
      return min(-16.0 - rmsDb, -1.0 - peakDb).coerceIn(-12.0, 12.0)
    } finally {
      try { decoder?.stop() } catch (_: Exception) {}
      try { decoder?.release() } catch (_: Exception) {}
      extractor.release()
    }
  }

  private fun initHardwareEqualizer(requestedSessionId: Int) {
    try {
      try {
        equalizer?.enabled = false
        equalizer?.release()
      } catch (e: Exception) {}
      equalizer = null
      try {
        loudnessEnhancer?.enabled = false
        loudnessEnhancer?.release()
      } catch (e: Exception) {}
      loudnessEnhancer = null

      var targetSid = requestedSessionId

      // 1. 指定されたセッションID (または 0) で初期化
      if (targetSid > 0) {
        notifyAudioEffectSessionOpen(targetSid)
        try {
          val eq = Equalizer(1000, targetSid)
          equalizer = eq
          activeSessionId = targetSid
          eq.enabled = isEQEnabled
          applyGainsToHardware()
          lastErrorMessage = "None (Connected directly to ExoPlayer session $targetSid, hasControl=${eq.hasControl()})"
          applySoundCheckGain()
          return
        } catch (e: Exception) {
          lastErrorMessage = "Direct session $targetSid failed: ${e.message}"
        }
      }

      // 2. セッション 0 で試行
      try {
        notifyAudioEffectSessionOpen(0)
        val eq = Equalizer(1000, 0)
        equalizer = eq
        activeSessionId = 0
        eq.enabled = isEQEnabled
        applyGainsToHardware()
        lastErrorMessage = "None (Connected to global session 0, hasControl=${eq.hasControl()})"
        applySoundCheckGain()
        return
      } catch (e: Exception) {}

      // 3. フォールバック: AudioManager のセッションID
      val audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (audioManager != null) {
        val generatedSid = audioManager.generateAudioSessionId()
        if (generatedSid > 0) {
          notifyAudioEffectSessionOpen(generatedSid)
          try {
            val eq = Equalizer(1000, generatedSid)
            equalizer = eq
            activeSessionId = generatedSid
            eq.enabled = isEQEnabled
            applyGainsToHardware()
            lastErrorMessage = "None (Connected via generated session $generatedSid, hasControl=${eq.hasControl()})"
            applySoundCheckGain()
            return
          } catch (e: Exception) {}
        }
      }

      lastErrorMessage = "Equalizer engine unavailable on this device"
    } catch (e: Exception) {
      lastErrorMessage = e.message ?: "Equalizer init critical error"
    }
  }

  private fun applyGainsToHardware() {
    val eq = equalizer ?: return
    try {
      if (!isEQEnabled) {
        eq.enabled = false
        return
      }
      eq.enabled = true

      val numBands = eq.numberOfBands.toInt()
      val bandRange = eq.bandLevelRange
      val minLevel = bandRange[0]
      val maxLevel = bandRange[1]

      for (b in 0 until numBands) {
        val centerFreq = eq.getCenterFreq(b.toShort())

        var bestIdx = 0
        var minDiff = abs(centerFreq - targetFrequencies[0])
        for (i in 1 until targetFrequencies.size) {
          val diff = abs(centerFreq - targetFrequencies[i])
          if (diff < minDiff) {
            minDiff = diff
            bestIdx = i
          }
        }

        // dB からミリベル (mB = dB * 100) への確実な変換
        val gainDb = (currentGains.getOrNull(bestIdx) ?: 0.0) + currentPreamp
        val levelMb = (gainDb * 100.0).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort()
        eq.setBandLevel(b.toShort(), levelMb)
      }
    } catch (e: Exception) {
      lastErrorMessage = "applyGains error: ${e.message}"
    }
  }
}