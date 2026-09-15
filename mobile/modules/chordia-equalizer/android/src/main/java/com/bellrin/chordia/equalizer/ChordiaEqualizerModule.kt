package com.bellrin.chordia.equalizer

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.AudioEffect
import android.media.audiofx.Equalizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

public class ChordiaEqualizerModule : Module() {
  private var equalizer: Equalizer? = null
  private var isEQEnabled: Boolean = false
  private var currentPreamp: Double = 0.0
  private var currentGains: List<Double> = List(10) { 0.0 }
  private var lastErrorMessage: String = "None"
  private var activeSessionId: Int = 0

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

    Function("getDebugInfo") {
      val eq = equalizer
      val bandCount = try { eq?.numberOfBands?.toInt() ?: 0 } catch (e: Exception) { 0 }
      mapOf(
        "platform" to "Android",
        "isNativeConnected" to (eq != null),
        "activeSessionId" to activeSessionId,
        "isEQEnabled" to isEQEnabled,
        "numBands" to bandCount,
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

  private fun initHardwareEqualizer(requestedSessionId: Int) {
    try {
      equalizer?.release()
      equalizer = null

      var targetSid = requestedSessionId

      // 1. まず要求されたセッションID (または 0) で試行
      try {
        val eq = Equalizer(1000, targetSid)
        equalizer = eq
        activeSessionId = targetSid
        eq.enabled = isEQEnabled
        applyGainsToHardware()
        lastErrorMessage = "None (Connected to session $targetSid)"
        return
      } catch (e1: Exception) {
        // エミュレーター等で sessionId=0 が拒否された場合
        lastErrorMessage = "Session $targetSid failed: ${e1.message}"
      }

      // 2. フォールバック: AudioManager から新規セッションIDを取得して試行
      val audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      if (audioManager != null) {
        val generatedSid = audioManager.generateAudioSessionId()
        if (generatedSid > 0) {
          try {
            val eq = Equalizer(1000, generatedSid)
            equalizer = eq
            activeSessionId = generatedSid
            eq.enabled = isEQEnabled
            applyGainsToHardware()
            lastErrorMessage = "None (Connected via generated session $generatedSid)"
            return
          } catch (e2: Exception) {
            lastErrorMessage = "Generated session failed: ${e2.message}"
          }
        }
      }

      lastErrorMessage = "Equalizer engine unavailable on this device/emulator"
    } catch (e: Exception) {
      lastErrorMessage = e.message ?: "Equalizer init critical error"
    }
  }

  private fun applyGainsToHardware() {
    val eq = equalizer ?: return
    try {
      if (!isEQEnabled) return
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

        val gainDb = (currentGains.getOrNull(bestIdx) ?: 0.0) + currentPreamp
        val levelMb = (gainDb * 100.0).toInt().coerceIn(minLevel.toInt(), maxLevel.toInt()).toShort()
        eq.setBandLevel(b.toShort(), levelMb)
      }
    } catch (e: Exception) {
      lastErrorMessage = "applyGains error: ${e.message}"
    }
  }
}