import Foundation
import AVFoundation
import MediaPlayer
import React
import ExpoModulesCore

@objc(ChordiaEqualizer)
public class ChordiaEqualizerModule: Module, RCTBridgeModule {
  public static func moduleName() -> String! {
    return "ChordiaEqualizer"
  }

  @objc public static func requiresMainQueueSetup() -> Bool {
    return true
  }

  private var isEQEnabled: Bool = false
  private var currentPreamp: Float = 0.0
  private var currentGains: [Float] = Array(repeating: 0.0, count: 10)
  
  private let centerFrequencies: [Float] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

  private let audioEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let equalizerUnit = AVAudioUnitEQ(numberOfBands: 10)
  private var currentAudioFile: AVAudioFile?
  
  private var fileSampleRate: Double = 44100.0
  private var fileTotalFrames: AVAudioFramePosition = 0
  private var seekOffsetSeconds: Double = 0.0
  private var isNodePlaying: Bool = false
  private var isNodesAttached: Bool = false
  private var lastErrorMessage: String = "None"

  // MARK: - Expo Module Definition (Expo用)
  public func definition() -> ModuleDefinition {
    Name("ChordiaEqualizer")

    OnCreate {
      self.setupAudioEngineNodes()
    }

    Function("initEqualizer") { (audioSessionId: Int) -> Bool in
      self.setupAudioEngineNodes()
      return true
    }

    Function("setEnabled") { (enabled: Bool) in
      self.isEQEnabled = enabled
      self.updateEqualizerHardware()
    }

    Function("setBands") { (gains: [Double], preamp: Double) in
      self.currentPreamp = Float(preamp)
      self.currentGains = gains.map { Float($0) }
      self.updateEqualizerHardware()
    }

    Function("applySettings") { (enabled: Bool, preamp: Double, gains: [Double]) in
      self.isEQEnabled = enabled
      self.currentPreamp = Float(preamp)
      self.currentGains = gains.map { Float($0) }
      self.updateEqualizerHardware()
    }

    Function("loadAndPlay") { (filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool in
      return self.loadAndPlayFile(filePath: filePath, startSeconds: startSeconds, autoPlay: autoPlay)
    }

    Function("pause") { () -> Bool in
      self.playerNode.pause()
      self.isNodePlaying = false
      return true
    }

    Function("play") { () -> Bool in
      if !self.audioEngine.isRunning {
        try? self.audioEngine.start()
      }
      self.playerNode.play()
      self.isNodePlaying = true
      return true
    }

    Function("stop") { () -> Bool in
      self.playerNode.stop()
      self.isNodePlaying = false
      return true
    }

    Function("seekTo") { (seconds: Double) -> Bool in
      return self.seek(to: seconds)
    }

    Function("getPosition") { () -> Double in
      return self.getCurrentPosition()
    }

    Function("getDuration") { () -> Double in
      if self.fileSampleRate > 0 && self.fileTotalFrames > 0 {
        return Double(self.fileTotalFrames) / self.fileSampleRate
      }
      return 0.0
    }

    Function("isPlaying") { () -> Bool in
      return self.isNodePlaying
    }

    Function("getDebugInfo") { () -> [String: Any] in
      return self.getDebugInfoDictionary()
    }
  }

  // MARK: - React Native Bridge Methods (RCTBridgeModule用)
  @objc(initEqualizer:resolve:reject:)
  public func initEqualizerBridge(_ audioSessionId: Int, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    setupAudioEngineNodes()
    resolve(true)
  }

  @objc(setEnabled:)
  public func setEnabledBridge(_ enabled: Bool) {
    self.isEQEnabled = enabled
    self.updateEqualizerHardware()
  }

  @objc(setBands:preamp:)
  public func setBandsBridge(_ gains: [Double], preamp: Double) {
    self.currentPreamp = Float(preamp)
    self.currentGains = gains.map { Float($0) }
    self.updateEqualizerHardware()
  }

  @objc(applySettings:preamp:gains:)
  public func applySettingsBridge(_ enabled: Bool, preamp: Double, gains: [Double]) {
    self.isEQEnabled = enabled
    self.currentPreamp = Float(preamp)
    self.currentGains = gains.map { Float($0) }
    self.updateEqualizerHardware()
  }

  @objc(loadAndPlay:startSeconds:autoPlay:resolve:reject:)
  public func loadAndPlayBridge(_ filePath: String, startSeconds: Double, autoPlay: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = loadAndPlayFile(filePath: filePath, startSeconds: startSeconds, autoPlay: autoPlay)
    resolve(result)
  }

  @objc(pause:reject:)
  public func pauseBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.playerNode.pause()
    self.isNodePlaying = false
    resolve(true)
  }

  @objc(play:reject:)
  public func playBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if !self.audioEngine.isRunning {
      try? self.audioEngine.start()
    }
    self.playerNode.play()
    self.isNodePlaying = true
    resolve(true)
  }

  @objc(stop:reject:)
  public func stopBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    self.playerNode.stop()
    self.isNodePlaying = false
    resolve(true)
  }

  @objc(seekTo:resolve:reject:)
  public func seekToBridge(_ seconds: Double, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = seek(to: seconds)
    resolve(result)
  }

  @objc(getPosition:reject:)
  public func getPositionBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(getCurrentPosition())
  }

  @objc(getDuration:reject:)
  public func getDurationBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    if self.fileSampleRate > 0 && self.fileTotalFrames > 0 {
      resolve(Double(self.fileTotalFrames) / self.fileSampleRate)
    } else {
      resolve(0.0)
    }
  }

  @objc(isPlaying:reject:)
  public func isPlayingBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(self.isNodePlaying)
  }

  @objc(getDebugInfo:reject:)
  public func getDebugInfoBridge(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(getDebugInfoDictionary())
  }

  private func getDebugInfoDictionary() -> [String: Any] {
    return [
      "platform": "iOS",
      "isNativeConnected": true,
      "bridgeType": "RCTBridgeModule & ExpoModule",
      "isEngineRunning": self.audioEngine.isRunning,
      "isPlayerPlaying": self.playerNode.isPlaying,
      "isEQEnabled": self.isEQEnabled,
      "preamp": self.currentPreamp,
      "gains": self.currentGains,
      "hasAudioFile": self.currentAudioFile != nil,
      "sampleRate": self.fileSampleRate,
      "totalFrames": Double(self.fileTotalFrames),
      "lastError": self.lastErrorMessage
    ]
  }

  // MARK: - Internal Audio Engine
  private func setupAudioEngineNodes() {
    if isNodesAttached { return }

    for i in 0..<10 {
      let band = equalizerUnit.bands[i]
      band.frequency = centerFrequencies[i]
      band.bandwidth = 1.0
      band.gain = 0.0
      band.bypass = false
      if i == 0 {
        band.filterType = .lowShelf
      } else if i == 9 {
        band.filterType = .highShelf
      } else {
        band.filterType = .parametric
      }
    }
    equalizerUnit.globalGain = 0.0
    equalizerUnit.bypass = !isEQEnabled

    audioEngine.attach(playerNode)
    audioEngine.attach(equalizerUnit)
    isNodesAttached = true

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .default, options: [.allowAirPlay, .allowBluetooth])
      try session.setActive(true)
    } catch {
      self.lastErrorMessage = "AudioSession error: \(error.localizedDescription)"
    }
  }

  private func updateEqualizerHardware() {
    equalizerUnit.bypass = !isEQEnabled
    equalizerUnit.globalGain = isEQEnabled ? currentPreamp : 0.0

    for i in 0..<min(equalizerUnit.bands.count, currentGains.count) {
      let band = equalizerUnit.bands[i]
      band.gain = isEQEnabled ? currentGains[i] : 0.0
      band.bypass = !isEQEnabled
    }
  }

  private func resolveFileURL(filePath: String) -> URL? {
    let fname = URL(fileURLWithPath: filePath).lastPathComponent

    if filePath.hasPrefix("file://"), let url = URL(string: filePath), FileManager.default.fileExists(atPath: url.path) {
      return url
    }
    let rawPath = filePath.hasPrefix("file://") ? String(filePath.dropFirst(7)) : filePath
    if let decoded = rawPath.removingPercentEncoding, FileManager.default.fileExists(atPath: decoded) {
      return URL(fileURLWithPath: decoded)
    }
    if FileManager.default.fileExists(atPath: rawPath) {
      return URL(fileURLWithPath: rawPath)
    }

    if let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      let chordiaUrl = docDir.appendingPathComponent("chordia").appendingPathComponent(fname)
      if FileManager.default.fileExists(atPath: chordiaUrl.path) {
        return chordiaUrl
      }
      let directUrl = docDir.appendingPathComponent(fname)
      if FileManager.default.fileExists(atPath: directUrl.path) {
        return directUrl
      }
    }
    return nil
  }

  private func loadAndPlayFile(filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool {
    setupAudioEngineNodes()

    guard let url = resolveFileURL(filePath: filePath) else {
      self.lastErrorMessage = "File not found: \(filePath)"
      return false
    }

    do {
      let file = try AVAudioFile(forReading: url)
      self.currentAudioFile = file
      self.fileSampleRate = file.processingFormat.sampleRate
      self.fileTotalFrames = file.length

      if playerNode.isPlaying {
        playerNode.stop()
      }
      if audioEngine.isRunning {
        audioEngine.stop()
      }

      guard let processingFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: file.processingFormat.sampleRate,
        channels: file.processingFormat.channelCount,
        interleaved: false
      ) else {
        self.lastErrorMessage = "Invalid processing format"
        return false
      }

      audioEngine.disconnectNodeOutput(playerNode)
      audioEngine.disconnectNodeOutput(equalizerUnit)

      audioEngine.connect(playerNode, to: equalizerUnit, format: processingFormat)
      audioEngine.connect(equalizerUnit, to: audioEngine.mainMixerNode, format: processingFormat)

      try audioEngine.start()
      updateEqualizerHardware()

      scheduleAudioSegment(fromSeconds: startSeconds)

      if autoPlay {
        playerNode.play()
        self.isNodePlaying = true
      } else {
        playerNode.pause()
        self.isNodePlaying = false
      }

      self.lastErrorMessage = "None (Playing successfully)"
      return true
    } catch {
      self.lastErrorMessage = error.localizedDescription
      return false
    }
  }

  private func scheduleAudioSegment(fromSeconds seconds: Double) {
    guard let file = currentAudioFile else { return }
    playerNode.stop()

    let sampleRate = file.processingFormat.sampleRate
    let totalFrames = file.length
    let targetFrame = AVAudioFramePosition(max(0.0, seconds) * sampleRate)

    if targetFrame >= totalFrames {
      seekOffsetSeconds = Double(totalFrames) / sampleRate
      return
    }

    seekOffsetSeconds = Double(targetFrame) / sampleRate
    
    let rawRemaining = max(0, totalFrames - targetFrame)
    let remainingFrames = AVAudioFrameCount(clamping: rawRemaining)

    playerNode.scheduleSegment(file, startingFrame: targetFrame, frameCount: remainingFrames, at: nil) { [weak self] in
      DispatchQueue.main.async {
        if let self = self, self.isNodePlaying {
          self.isNodePlaying = false
        }
      }
    }
  }

  private func seek(to seconds: Double) -> Bool {
    guard currentAudioFile != nil else { return false }
    let wasPlaying = self.isNodePlaying

    scheduleAudioSegment(fromSeconds: seconds)
    if wasPlaying {
      playerNode.play()
      self.isNodePlaying = true
    }
    return true
  }

  private func getCurrentPosition() -> Double {
    guard let lastRenderTime = playerNode.lastRenderTime,
          let playerTime = playerNode.playerTime(forNodeTime: lastRenderTime) else {
      return seekOffsetSeconds
    }
    let playedSeconds = Double(playerTime.sampleTime) / playerTime.sampleRate
    return max(0.0, seekOffsetSeconds + playedSeconds)
  }
}