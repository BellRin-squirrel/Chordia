package com.bellrin.chordia.equalizer

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
      return@Function true
    }

    Function("setEnabled") { enabled: Boolean ->
      isEQEnabled = enabled
      equalizer?.enabled = enabled
      applyGainsToHardware()
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
      equalizer?.enabled = enabled
      applyGainsToHardware()
    }

    Function("getDebugInfo") {
      val eq = equalizer
      mapOf(
        "platform" to "Android",
        "isNativeConnected" to (eq != null),
        "isEQEnabled" to isEQEnabled,
        "numBands" to (eq?.numberOfBands?.toInt() ?: 0),
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

  private fun initHardwareEqualizer(sessionId: Int) {
    try {
      equalizer?.release()
      val sid = if (sessionId > 0) sessionId else 0
      equalizer = Equalizer(1000, sid).apply {
        enabled = isEQEnabled
      }
      applyGainsToHardware()
      lastErrorMessage = "None (Initialized successfully)"
    } catch (e: Exception) {
      lastErrorMessage = e.message ?: "Equalizer init error"
    }
  }

  private fun applyGainsToHardware() {
    val eq = equalizer ?: return
    try {
      eq.enabled = isEQEnabled
      if (!isEQEnabled) return

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
      lastErrorMessage = e.message ?: "Apply gains error"
    }
  }
}