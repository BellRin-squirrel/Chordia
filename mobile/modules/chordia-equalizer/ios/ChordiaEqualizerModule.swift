import ExpoModulesCore
import AVFoundation
import MediaPlayer
import UIKit

public class ChordiaEqualizerModule: Module {
  private var isEQEnabled: Bool = false
  private var currentPreamp: Float = 0.0
  private var currentGains: [Float] = Array(repeating: 0.0, count: 10)
  private var soundCheckGain: Float = 0.0
  private var appVolumeMultiplier: Float = 1.0
  private var fadeVolume: Float = 1.0
  private var engineMode: String = "rntp"

  private let centerFrequencies: [Float] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

  private let audioEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let equalizerUnit = AVAudioUnitEQ(numberOfBands: 10)
  private let alarmPlayerNode = AVAudioPlayerNode()
  private let alarmFormat = AVAudioFormat(standardFormatWithSampleRate: 44100.0, channels: 2)!
  private var currentAudioFile: AVAudioFile?

  private var fileSampleRate: Double = 44100.0
  private var fileTotalFrames: AVAudioFramePosition = 0
  private var seekOffsetSeconds: Double = 0.0
  private var lastValidPositionSeconds: Double = 0.0

  private var isNodePlaying: Bool = false
  private var isNodesAttached: Bool = false
  private var isManualStop: Bool = false
  private var isInternalReconfiguring: Bool = false
  private var ignoreConfigChangeUntil: TimeInterval = 0
  private var currentScheduleToken: Int = 0

  private var isNativePlayerActive: Bool = false
  private var isFocusModeActive: Bool = false

  private var focusQueuePaths: [String] = []
  private var focusSoundCheckMap: [String: Double] = [:]
  private var focusQueueIndex: Int = 0
  private var focusLoopMode: String = "ALL"
  private var focusShuffle: Bool = false

  private var wasPlayingBeforeInterruption: Bool = false
  private var observersRegistered: Bool = false

  private var lastErrorMessage: String = "None"
  private var lastResolvedPath: String = "None"
  private var debugDiagnostics: [String: Any] = [:]

  private var currentTrackTitle: String = ""
  private var currentTrackArtist: String = ""
  private var currentTrackAlbum: String = ""
  private var currentArtworkUri: String? = nil
  private var currentDuration: Double = 0.0
  private var currentISRC: String? = nil

  private var playTarget: Any?
  private var pauseTarget: Any?
  private var toggleTarget: Any?
  private var nextTarget: Any?
  private var prevTarget: Any?
  private var seekTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("ChordiaEqualizer")

    Events("onRemoteCommand", "onPlaybackEnded", "onFocusTrackChanged")

    OnCreate {
      self.setupAudioEngineNodes()
      self.registerAudioNotifications()
      DispatchQueue.main.async {
        UIApplication.shared.beginReceivingRemoteControlEvents()
      }
    }

    OnDestroy {
      self.unregisterAudioNotifications()
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

    Function("setSoundCheckGain") { (gainDb: Double) in
      self.soundCheckGain = Float(max(-24.0, min(24.0, gainDb)))
      self.updateEqualizerHardware()
    }

    Function("setAppVolumeMultiplier") { (multiplier: Double) in
      self.appVolumeMultiplier = Float(max(0.01, min(10.0, multiplier)))
      self.updateEqualizerHardware()
    }

    Function("setFocusFadeVolume") { (volume: Double) in
      self.fadeVolume = Float(max(0.0, min(1.0, volume)))
      self.updateEqualizerHardware()
    }

    Function("playAlarmBeep") { (dataUriOrBase64: String) -> Bool in
      return self.playAlarmBeepInternal(dataUriOrBase64: dataUriOrBase64)
    }

    AsyncFunction("analyzeAudioLoudness") { (source: String) throws -> Double in
      return try self.analyzeAudioLoudness(source: source)
    }

    Function("setEngineMode") { (mode: String) in
      self.engineMode = mode
      if self.isFocusModeActive {
        self.applyAudioSessionCategory(activate: true, forceExclusive: true)
        self.disableAllRemoteCommandsAndNowPlaying()
        return
      }
      if self.isNativePlayerActive {
        self.applyAudioSessionCategory(activate: false, forceExclusive: false)
        self.updateRemoteCommandsState()
        self.refreshNowPlayingInfo()
      }
    }

    Function("updateNowPlaying") { (title: String, artist: String, album: String, artworkUri: String?, duration: Double, position: Double, isPlaying: Bool) in
      if self.isFocusModeActive { return }
      self.currentTrackTitle = title
      self.currentTrackArtist = artist
      self.currentTrackAlbum = album
      self.currentArtworkUri = artworkUri
      self.currentDuration = duration
      self.updateNowPlayingInfoCenter(duration: duration, position: position, isPlaying: isPlaying)
      self.updateRemoteCommandsState()
    }

    Function("setTrackISRC") { (isrc: String?) in
      if self.isFocusModeActive { return }
      self.currentISRC = isrc
    }

    Function("loadAndPlay") { (filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool in
      self.isFocusModeActive = false
      self.isNativePlayerActive = true
      self.fadeVolume = 1.0
      return self.loadAndPlayFile(filePath: filePath, startSeconds: startSeconds, autoPlay: autoPlay)
    }

    Function("startFocusQueue") { (filePaths: [String], initialGains: [Double], startIndex: Int, startSeconds: Double, loopMode: String, shuffle: Bool) -> Bool in
      guard !filePaths.isEmpty else { return false }

      self.isFocusModeActive = true
      self.isNativePlayerActive = true
      self.fadeVolume = 1.0
      self.focusQueuePaths = filePaths
      self.focusLoopMode = loopMode
      self.focusShuffle = shuffle
      self.focusSoundCheckMap = [:]

      for (idx, path) in filePaths.enumerated() {
        let gain = idx < initialGains.count ? initialGains[idx] : 0.0
        self.focusSoundCheckMap[path] = gain
      }

      self.focusQueueIndex = max(0, min(startIndex, filePaths.count - 1))
      self.currentTrackTitle = ""
      self.currentTrackArtist = ""
      self.currentTrackAlbum = ""
      self.currentArtworkUri = nil
      self.currentISRC = nil

      self.disableAllRemoteCommandsAndNowPlaying()
      self.applyAudioSessionCategory(activate: true, forceExclusive: true)

      return self.playFocusTrack(at: self.focusQueueIndex, startSeconds: max(0.0, startSeconds))
    }

    Function("getFocusState") { () -> [String: Any] in
      return [
        "index": self.focusQueueIndex,
        "position": self.getCurrentPosition(),
        "paths": self.focusQueuePaths
      ]
    }

    Function("updateFocusTrackSoundCheck") { (filePath: String, gainDb: Double) in
      let clamped = max(-24.0, min(24.0, gainDb))
      self.focusSoundCheckMap[filePath] = clamped
      if self.isFocusModeActive,
         self.focusQueueIndex >= 0,
         self.focusQueueIndex < self.focusQueuePaths.count,
         self.focusQueuePaths[self.focusQueueIndex] == filePath {
        self.soundCheckGain = Float(clamped)
        self.updateEqualizerHardware()
      }
    }

    Function("stopFocusMode") { () -> Bool in
      self.alarmPlayerNode.stop()
      self.currentScheduleToken += 1
      self.isManualStop = true
      self.playerNode.stop()
      self.isManualStop = false
      self.isNodePlaying = false
      self.isFocusModeActive = false
      self.isNativePlayerActive = false
      self.currentAudioFile = nil
      self.focusQueuePaths = []
      self.focusSoundCheckMap = [:]
      self.fadeVolume = 1.0
      self.soundCheckGain = 0.0
      self.currentTrackTitle = ""
      self.currentTrackArtist = ""
      self.currentTrackAlbum = ""
      self.currentArtworkUri = nil
      self.currentISRC = nil
      self.disableAllRemoteCommandsAndNowPlaying()
      return true
    }

    Function("pause") { () -> Bool in
      return self.pauseInternal()
    }

    Function("play") { () -> Bool in
      return self.playInternal()
    }

    Function("stop") { () -> Bool in
      _ = self.getCurrentPosition()
      self.alarmPlayerNode.stop()
      self.currentScheduleToken += 1
      self.isManualStop = true
      self.playerNode.stop()
      self.isManualStop = false
      self.isNodePlaying = false
      self.isNativePlayerActive = false
      self.isFocusModeActive = false
      self.currentAudioFile = nil
      self.focusQueuePaths = []
      self.focusSoundCheckMap = [:]
      self.fadeVolume = 1.0
      self.currentTrackTitle = ""
      self.currentTrackArtist = ""
      self.currentTrackAlbum = ""
      self.currentArtworkUri = nil
      self.currentISRC = nil
      self.disableAllRemoteCommandsAndNowPlaying()
      return true
    }

    Function("seekTo") { (seconds: Double) -> Bool in
      let res = self.seek(to: seconds)
      if !self.isFocusModeActive {
        self.updateNowPlayingPosition(seconds: seconds)
      }
      return res
    }

    Function("getPosition") { () -> Double in
      return self.getCurrentPosition()
    }

    Function("getDuration") { () -> Double in
      if self.fileSampleRate > 0 && self.fileTotalFrames > 0 {
        return Double(self.fileTotalFrames) / self.fileSampleRate
      }
      return self.currentDuration
    }

    Function("isPlaying") { () -> Bool in
      return self.isNodePlaying
    }

    Function("getDebugInfo") { () -> [String: Any] in
      let session = AVAudioSession.sharedInstance()
      return [
        "platform": "iOS",
        "isNativeConnected": true,
        "engineMode": self.engineMode,
        "isNativePlayerActive": self.isNativePlayerActive,
        "isFocusModeActive": self.isFocusModeActive,
        "isEngineRunning": self.audioEngine.isRunning,
        "isPlayerPlaying": self.playerNode.isPlaying,
        "isEQEnabled": self.isEQEnabled,
        "preamp": Double(self.currentPreamp),
        "gains": self.currentGains.map { Double($0) },
        "appVolumeMultiplier": Double(self.appVolumeMultiplier),
        "fadeVolume": Double(self.fadeVolume),
        "hasAudioFile": self.currentAudioFile != nil,
        "resolvedPath": self.lastResolvedPath,
        "sampleRate": self.fileSampleRate,
        "totalFrames": Double(self.fileTotalFrames),
        "currentSessionCategory": session.category.rawValue,
        "currentSessionMode": session.mode.rawValue,
        "currentSessionOptions": session.categoryOptions.rawValue,
        "diagnostics": self.debugDiagnostics,
        "lastError": self.lastErrorMessage
      ]
    }
  }

  private func makeAlarmBeepBuffer() -> AVAudioPCMBuffer? {
    let sampleRate = 44100.0
    let totalDuration = 1.12
    let frameCount = AVAudioFrameCount(sampleRate * totalDuration)
    guard let buffer = AVAudioPCMBuffer(pcmFormat: alarmFormat, frameCapacity: frameCount) else {
      return nil
    }
    buffer.frameLength = frameCount
    guard let channels = buffer.floatChannelData else {
      return nil
    }

    let left = channels[0]
    let right = channels[1]

    // 目覚まし時計風の電子音「ピピピピ、ピピピピ」
    let beepDuration = 0.065
    let beepStarts: [Double] = [
      0.00, 0.11, 0.22, 0.33,
      0.62, 0.73, 0.84, 0.95
    ]
    let baseFreq = 2048.0

    for i in 0..<Int(frameCount) {
      let t = Double(i) / sampleRate
      var sample: Double = 0.0

      for start in beepStarts {
        if t >= start && t < start + beepDuration {
          let localT = t - start
          let fadeIn = min(1.0, localT / 0.004)
          let fadeOut = min(1.0, (beepDuration - localT) / 0.008)
          let env = fadeIn * fadeOut
          let tone = sin(2.0 * Double.pi * baseFreq * localT)
            + 0.25 * sin(2.0 * Double.pi * (baseFreq * 3.0) * localT)
            + 0.10 * sin(2.0 * Double.pi * (baseFreq * 5.0) * localT)
          sample = tone * 0.28 * env
          break
        }
      }

      let f = Float(sample)
      left[i] = f
      right[i] = f
    }

    return buffer
  }

  private func playAlarmBeepInternal(dataUriOrBase64: String) -> Bool {
    setupAudioEngineNodes()
    applyAudioSessionCategory(activate: true, forceExclusive: true)

    if audioEngine.outputConnectionPoints(for: alarmPlayerNode, outputBus: 0).isEmpty {
      ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      audioEngine.connect(alarmPlayerNode, to: audioEngine.mainMixerNode, format: alarmFormat)
    }

    if !audioEngine.isRunning {
      do {
        ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
        audioEngine.prepare()
        try audioEngine.start()
      } catch {
        self.lastErrorMessage = "Alarm AudioEngine start error: \(error.localizedDescription)"
        return false
      }
    }

    guard let buffer = makeAlarmBeepBuffer() else {
      return false
    }

    alarmPlayerNode.stop()
    alarmPlayerNode.volume = 0.85
    alarmPlayerNode.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
    alarmPlayerNode.play()
    return true
  }

  private func setupAudioEngineNodes() {
    if isNodesAttached { return }

    for i in 0..<10 {
      let band = equalizerUnit.bands[i]
      band.frequency = centerFrequencies[i]
      band.bandwidth = (i == 0 || i == 9) ? 1.0 : 1.3
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

    ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
    audioEngine.attach(playerNode)
    audioEngine.attach(equalizerUnit)
    audioEngine.attach(alarmPlayerNode)
    audioEngine.connect(alarmPlayerNode, to: audioEngine.mainMixerNode, format: alarmFormat)
    isNodesAttached = true
  }

  private func registerAudioNotifications() {
    if observersRegistered { return }
    observersRegistered = true

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAudioInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleEngineConfigurationChange(_:)),
      name: .AVAudioEngineConfigurationChange,
      object: audioEngine
    )
  }

  private func unregisterAudioNotifications() {
    if !observersRegistered { return }
    observersRegistered = false
    NotificationCenter.default.removeObserver(self, name: AVAudioSession.interruptionNotification, object: nil)
    NotificationCenter.default.removeObserver(self, name: .AVAudioEngineConfigurationChange, object: audioEngine)
  }

  @objc private func handleAudioInterruption(_ notification: Notification) {
    guard isNativePlayerActive,
          let userInfo = notification.userInfo,
          let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self = self, self.isNativePlayerActive else { return }
      if type == .began {
        self.wasPlayingBeforeInterruption = self.isNodePlaying
        if self.isNodePlaying {
          _ = self.pauseInternal()
        }
      } else if type == .ended {
        let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
        if self.wasPlayingBeforeInterruption && options.contains(.shouldResume) {
          self.wasPlayingBeforeInterruption = false
          _ = self.playInternal()
        } else {
          self.wasPlayingBeforeInterruption = false
        }
      }
    }
  }

  @objc private func handleEngineConfigurationChange(_ notification: Notification) {
    let now = Date().timeIntervalSince1970
    if isInternalReconfiguring || now < ignoreConfigChangeUntil {
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self = self,
            !self.isInternalReconfiguring,
            Date().timeIntervalSince1970 >= self.ignoreConfigChangeUntil,
            self.isNativePlayerActive,
            !self.audioEngine.isRunning,
            let file = self.currentAudioFile else {
        return
      }

      let resumePos = self.getCurrentPosition()
      let shouldResumePlay = self.isNodePlaying

      self.isInternalReconfiguring = true
      self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      self.currentScheduleToken += 1
      self.isManualStop = true
      self.playerNode.stop()
      if self.audioEngine.isRunning {
        self.audioEngine.stop()
      }
      self.isManualStop = false

      self.audioEngine.disconnectNodeOutput(self.playerNode)
      self.audioEngine.disconnectNodeOutput(self.equalizerUnit)

      if self.audioEngine.outputConnectionPoints(for: self.alarmPlayerNode, outputBus: 0).isEmpty {
        self.audioEngine.connect(self.alarmPlayerNode, to: self.audioEngine.mainMixerNode, format: self.alarmFormat)
      }

      let fileFormat = file.processingFormat
      do {
        self.audioEngine.connect(self.playerNode, to: self.equalizerUnit, format: fileFormat)
        self.audioEngine.connect(self.equalizerUnit, to: self.audioEngine.mainMixerNode, format: fileFormat)
        self.audioEngine.prepare()
        try self.audioEngine.start()
      } catch {
        self.audioEngine.disconnectNodeOutput(self.playerNode)
        self.audioEngine.disconnectNodeOutput(self.equalizerUnit)
        self.audioEngine.connect(self.playerNode, to: self.equalizerUnit, format: nil)
        self.audioEngine.connect(self.equalizerUnit, to: self.audioEngine.mainMixerNode, format: nil)
        self.audioEngine.prepare()
        try? self.audioEngine.start()
      }

      self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      self.isInternalReconfiguring = false
      self.updateEqualizerHardware()
      self.scheduleAudioSegment(fromSeconds: resumePos)

      if shouldResumePlay {
        self.applyAudioSessionCategory(activate: true, forceExclusive: self.isFocusModeActive)
        self.playerNode.play()
        self.isNodePlaying = true
        self.updateNowPlayingPlaybackRate(isPlaying: true)
      }
    }
  }

  private func applyAudioSessionCategory(activate: Bool = false, forceExclusive: Bool = false) {
    do {
      let session = AVAudioSession.sharedInstance()
      if !forceExclusive && engineMode == "expo-av" {
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      } else {
        try session.setCategory(.playback, mode: .default, options: [])
      }
      if activate {
        try session.setActive(true)
      }
      self.lastErrorMessage = "None (AudioSession configured: \(forceExclusive ? "exclusive-focus" : engineMode))"
    } catch let err as NSError {
      self.lastErrorMessage = "AudioSession error: \(err.localizedDescription)"
    }
  }

  private func playInternal() -> Bool {
    applyAudioSessionCategory(activate: true, forceExclusive: isFocusModeActive)
    if !audioEngine.isRunning {
      do {
        ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
        try audioEngine.start()
      } catch {
        self.lastErrorMessage = "AudioEngine start error: \(error.localizedDescription)"
        return false
      }
    }
    playerNode.play()
    isNodePlaying = true
    updateNowPlayingPlaybackRate(isPlaying: true)
    return true
  }

  private func pauseInternal() -> Bool {
    _ = getCurrentPosition()
    playerNode.pause()
    isNodePlaying = false
    updateNowPlayingPlaybackRate(isPlaying: false)
    return true
  }

  private func setupRemoteCommands() {
    if isFocusModeActive {
      disableAllRemoteCommandsAndNowPlaying()
      return
    }
    clearRemoteCommandTargets()

    let commandCenter = MPRemoteCommandCenter.shared()

    playTarget = commandCenter.playCommand.addTarget { [weak self] _ in
      guard let self = self, self.isIOSEQActive() else { return .commandFailed }
      _ = self.playInternal()
      self.sendEvent("onRemoteCommand", ["action": "play"])
      return .success
    }

    pauseTarget = commandCenter.pauseCommand.addTarget { [weak self] _ in
      guard let self = self, self.isIOSEQActive() else { return .commandFailed }
      _ = self.pauseInternal()
      self.sendEvent("onRemoteCommand", ["action": "pause"])
      return .success
    }

    toggleTarget = commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self = self, self.isIOSEQActive() else { return .commandFailed }
      if self.isNodePlaying {
        _ = self.pauseInternal()
        self.sendEvent("onRemoteCommand", ["action": "pause"])
      } else {
        _ = self.playInternal()
        self.sendEvent("onRemoteCommand", ["action": "play"])
      }
      return .success
    }

    nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
      guard let self = self, self.isIOSEQActive() else { return .commandFailed }
      self.sendEvent("onRemoteCommand", ["action": "next"])
      return .success
    }

    prevTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
      guard let self = self, self.isIOSEQActive() else { return .commandFailed }
      self.sendEvent("onRemoteCommand", ["action": "prev"])
      return .success
    }

    seekTarget = commandCenter.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let self = self, self.isIOSEQActive(),
            let posEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      _ = self.seek(to: posEvent.positionTime)
      self.updateNowPlayingPosition(seconds: posEvent.positionTime)
      self.sendEvent("onRemoteCommand", ["action": "seek", "position": posEvent.positionTime])
      return .success
    }

    updateRemoteCommandsState()
  }

  private func clearRemoteCommandTargets() {
    let commandCenter = MPRemoteCommandCenter.shared()
    if let t = playTarget { commandCenter.playCommand.removeTarget(t); playTarget = nil }
    if let t = pauseTarget { commandCenter.pauseCommand.removeTarget(t); pauseTarget = nil }
    if let t = toggleTarget { commandCenter.togglePlayPauseCommand.removeTarget(t); toggleTarget = nil }
    if let t = nextTarget { commandCenter.nextTrackCommand.removeTarget(t); nextTarget = nil }
    if let t = prevTarget { commandCenter.previousTrackCommand.removeTarget(t); prevTarget = nil }
    if let t = seekTarget { commandCenter.changePlaybackPositionCommand.removeTarget(t); seekTarget = nil }
  }

  private func disableAllRemoteCommandsAndNowPlaying() {
    clearRemoteCommandTargets()
    let commandCenter = MPRemoteCommandCenter.shared()
    commandCenter.playCommand.isEnabled = false
    commandCenter.pauseCommand.isEnabled = false
    commandCenter.togglePlayPauseCommand.isEnabled = false
    commandCenter.nextTrackCommand.isEnabled = false
    commandCenter.previousTrackCommand.isEnabled = false
    commandCenter.changePlaybackPositionCommand.isEnabled = false
    commandCenter.skipForwardCommand.isEnabled = false
    commandCenter.skipBackwardCommand.isEnabled = false
    commandCenter.stopCommand.isEnabled = false
    DispatchQueue.main.async {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
  }

  private func isIOSEQActive() -> Bool {
    return isNativePlayerActive && !isFocusModeActive && currentAudioFile != nil
  }

  private func updateRemoteCommandsState() {
    if isFocusModeActive {
      disableAllRemoteCommandsAndNowPlaying()
      return
    }
    guard isNativePlayerActive else {
      return
    }

    let commandCenter = MPRemoteCommandCenter.shared()
    let isRntp = (engineMode == "rntp")
    let hasTrack = (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil)
    commandCenter.playCommand.isEnabled = isRntp && hasTrack
    commandCenter.pauseCommand.isEnabled = isRntp && hasTrack
    commandCenter.togglePlayPauseCommand.isEnabled = isRntp && hasTrack
    commandCenter.nextTrackCommand.isEnabled = isRntp && hasTrack
    commandCenter.previousTrackCommand.isEnabled = isRntp && hasTrack
    commandCenter.changePlaybackPositionCommand.isEnabled = isRntp && hasTrack
  }

  private func updateNowPlayingInfoCenter(duration: Double, position: Double, isPlaying: Bool) {
    if isFocusModeActive || !isNativePlayerActive { return }

    DispatchQueue.main.async {
      if self.isFocusModeActive || !self.isNativePlayerActive {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        return
      }
      guard self.engineMode == "rntp" else {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        return
      }

      guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        return
      }

      var info: [String: Any] = [
        MPMediaItemPropertyTitle: self.currentTrackTitle,
        MPMediaItemPropertyArtist: self.currentTrackArtist,
        MPMediaItemPropertyAlbumTitle: self.currentTrackAlbum,
        MPMediaItemPropertyPlaybackDuration: duration,
        MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
        MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        MPNowPlayingInfoPropertyDefaultPlaybackRate: 1.0
      ]

      if #available(iOS 18.0, *) {
        if let isrc = self.currentISRC, !isrc.isEmpty {
          info[MPNowPlayingInfoPropertyInternationalStandardRecordingCode] = isrc
        }
      }

      var loadedImage: UIImage? = nil
      if let artPath = self.currentArtworkUri,
         let url = self.resolveFileURL(filePath: artPath),
         let img = UIImage(contentsOfFile: url.path) {
        loadedImage = img
      }

      if let originalImage = loadedImage {
        let screenSize = UIScreen.main.bounds.size
        let screenScale = UIScreen.main.scale
        let maxScreenDimension = max(screenSize.width, screenSize.height) * screenScale
        let targetDimension = max(originalImage.size.width, originalImage.size.height, maxScreenDimension, 1024.0)
        let artworkBounds = CGSize(width: targetDimension, height: targetDimension)

        info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: artworkBounds) { requestedSize in
          let renderWidth = requestedSize.width > 0 ? requestedSize.width : targetDimension
          let renderHeight = requestedSize.height > 0 ? requestedSize.height : targetDimension
          let renderSize = CGSize(width: renderWidth, height: renderHeight)

          let renderer = UIGraphicsImageRenderer(size: renderSize)
          return renderer.image { _ in
            let aspect = originalImage.size.width / max(originalImage.size.height, 1.0)
            var drawRect = CGRect(origin: .zero, size: renderSize)

            if aspect > 1.0 {
              let h = renderSize.width / aspect
              drawRect = CGRect(x: 0, y: (renderSize.height - h) / 2.0, width: renderSize.width, height: h)
            } else if aspect < 1.0 {
              let w = renderSize.height * aspect
              drawRect = CGRect(x: (renderSize.width - w) / 2.0, y: 0, width: w, height: renderSize.height)
            }

            originalImage.draw(in: drawRect)
          }
        }
      }

      MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
  }

  private func updateNowPlayingPlaybackRate(isPlaying: Bool) {
    guard isNativePlayerActive, !isFocusModeActive, engineMode == "rntp" else { return }
    guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    DispatchQueue.main.async {
      if self.isFocusModeActive || !self.isNativePlayerActive { return }
      if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = self.getCurrentPosition()
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
  }

  private func updateNowPlayingPosition(seconds: Double) {
    guard isNativePlayerActive, !isFocusModeActive, engineMode == "rntp" else { return }
    guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    DispatchQueue.main.async {
      if self.isFocusModeActive || !self.isNativePlayerActive { return }
      if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = seconds
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
  }

  private func refreshNowPlayingInfo() {
    if isFocusModeActive {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    guard isNativePlayerActive else { return }
    guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    let dur = self.fileSampleRate > 0 ? Double(self.fileTotalFrames) / self.fileSampleRate : self.currentDuration
    updateNowPlayingInfoCenter(duration: dur, position: getCurrentPosition(), isPlaying: isNodePlaying)
  }

  private func updateEqualizerHardware() {
    let attenVolume: Float = appVolumeMultiplier < 1.0 ? appVolumeMultiplier : 1.0
    playerNode.volume = max(0.0, min(1.0, attenVolume * fadeVolume))

    let boostGainDb: Float = appVolumeMultiplier > 1.0 ? Float(20.0 * log10(Double(appVolumeMultiplier))) : 0.0
    let totalGlobalGain = (isEQEnabled ? currentPreamp : 0.0) + soundCheckGain + boostGainDb

    equalizerUnit.bypass = !isEQEnabled && soundCheckGain == 0.0 && boostGainDb == 0.0
    equalizerUnit.globalGain = max(-96.0, min(24.0, totalGlobalGain))

    let maxAllowedFreq = Float(fileSampleRate / 2.0) - 200.0

    for i in 0..<min(equalizerUnit.bands.count, currentGains.count) {
      let band = equalizerUnit.bands[i]
      band.frequency = maxAllowedFreq > 1000.0 ? min(centerFrequencies[i], maxAllowedFreq) : centerFrequencies[i]
      band.gain = isEQEnabled ? currentGains[i] : 0.0
      band.bypass = !isEQEnabled
    }
  }

  private func analyzeAudioLoudness(source: String) throws -> Double {
    let url: URL
    if let parsed = URL(string: source), parsed.isFileURL {
      url = parsed
    } else {
      url = URL(fileURLWithPath: source)
    }

    let file = try AVAudioFile(forReading: url)
    let format = file.processingFormat
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 8192),
          let channels = buffer.floatChannelData else {
      throw NSError(domain: "ChordiaSoundCheck", code: 1, userInfo: [NSLocalizedDescriptionKey: "Audio format cannot be analyzed."])
    }

    var sumSquares = 0.0
    var sampleCount = 0
    var peak = 0.0

    while file.framePosition < file.length {
      try file.read(into: buffer, frameCount: 8192)
      let frameCount = Int(buffer.frameLength)
      if frameCount == 0 { break }

      for channel in 0..<Int(format.channelCount) {
        for frame in 0..<frameCount {
          let sample = Double(channels[channel][frame])
          sumSquares += sample * sample
          peak = max(peak, abs(sample))
          sampleCount += 1
        }
      }
    }

    guard sampleCount > 0, peak > 0 else { return 0 }

    let rms = sqrt(sumSquares / Double(sampleCount))
    guard rms > 0 else { return 0 }
    let rmsDb = 20.0 * log10(rms)
    let peakDb = 20.0 * log10(peak)
    return max(-12.0, min(12.0, min(-16.0 - rmsDb, -1.0 - peakDb)))
  }

  private func resolveFileURL(filePath: String) -> URL? {
    var cleanPath = filePath
    if cleanPath.hasPrefix("file://") {
      cleanPath = String(cleanPath.dropFirst(7))
    }
    if let decoded = cleanPath.removingPercentEncoding {
      cleanPath = decoded
    }

    if FileManager.default.fileExists(atPath: cleanPath) {
      self.lastResolvedPath = cleanPath
      return URL(fileURLWithPath: cleanPath)
    }

    let fname = (cleanPath as NSString).lastPathComponent
    if fname.isEmpty { return nil }

    if let docDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
      let chordiaUrl = docDir.appendingPathComponent("chordia").appendingPathComponent(fname)
      if FileManager.default.fileExists(atPath: chordiaUrl.path) {
        self.lastResolvedPath = chordiaUrl.path
        return chordiaUrl
      }
      let directUrl = docDir.appendingPathComponent(fname)
      if FileManager.default.fileExists(atPath: directUrl.path) {
        self.lastResolvedPath = directUrl.path
        return directUrl
      }
    }

    self.lastResolvedPath = "NOT_FOUND (\(fname))"
    return nil
  }

  private func playFocusTrack(at index: Int, startSeconds: Double = 0.0, skipAttempts: Int = 0) -> Bool {
    guard isFocusModeActive, !focusQueuePaths.isEmpty else { return false }
    let safeIdx = max(0, min(index, focusQueuePaths.count - 1))
    focusQueueIndex = safeIdx
    let filePath = focusQueuePaths[safeIdx]
    soundCheckGain = Float(focusSoundCheckMap[filePath] ?? 0.0)

    let ok = loadAndPlayFile(filePath: filePath, startSeconds: max(0.0, startSeconds), autoPlay: true)
    if ok {
      sendEvent("onFocusTrackChanged", ["index": safeIdx, "uri": filePath])
      return true
    }

    if skipAttempts + 1 < focusQueuePaths.count {
      let nextIdx = (safeIdx + 1) % focusQueuePaths.count
      return playFocusTrack(at: nextIdx, startSeconds: 0.0, skipAttempts: skipAttempts + 1)
    }
    return false
  }

  private func advanceFocusQueueTrack() {
    guard isFocusModeActive, !focusQueuePaths.isEmpty else { return }

    if focusLoopMode == "ONE" {
      _ = playFocusTrack(at: focusQueueIndex, startSeconds: 0.0)
      return
    }

    let nextIdx = focusQueueIndex + 1
    if nextIdx < focusQueuePaths.count {
      _ = playFocusTrack(at: nextIdx, startSeconds: 0.0)
      return
    }

    if focusLoopMode == "ALL" {
      if focusShuffle && focusQueuePaths.count > 1 {
        let lastPlayed = focusQueuePaths[focusQueueIndex]
        focusQueuePaths.shuffle()
        if focusQueuePaths.first == lastPlayed && focusQueuePaths.count > 1 {
          focusQueuePaths.swapAt(0, focusQueuePaths.count - 1)
        }
      }
      _ = playFocusTrack(at: 0, startSeconds: 0.0)
    } else {
      isNodePlaying = false
    }
  }

  private func loadAndPlayFile(filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool {
    setupAudioEngineNodes()

    guard let url = resolveFileURL(filePath: filePath) else {
      self.lastErrorMessage = "File not found: \(filePath)"
      return false
    }

    do {
      applyAudioSessionCategory(activate: true, forceExclusive: isFocusModeActive)

      let file = try AVAudioFile(forReading: url)
      self.currentAudioFile = file
      self.fileSampleRate = file.processingFormat.sampleRate
      self.fileTotalFrames = file.length

      self.isInternalReconfiguring = true
      self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      self.currentScheduleToken += 1
      self.isManualStop = true
      if playerNode.isPlaying {
        playerNode.stop()
      }
      if audioEngine.isRunning {
        audioEngine.stop()
      }
      self.isManualStop = false

      audioEngine.disconnectNodeOutput(playerNode)
      audioEngine.disconnectNodeOutput(equalizerUnit)

      if audioEngine.outputConnectionPoints(for: alarmPlayerNode, outputBus: 0).isEmpty {
        audioEngine.connect(alarmPlayerNode, to: audioEngine.mainMixerNode, format: alarmFormat)
      }

      let fileFormat = file.processingFormat

      var startSuccess = false
      do {
        audioEngine.connect(playerNode, to: equalizerUnit, format: fileFormat)
        audioEngine.connect(equalizerUnit, to: audioEngine.mainMixerNode, format: fileFormat)
        audioEngine.prepare()
        try audioEngine.start()
        startSuccess = true
      } catch {
        audioEngine.disconnectNodeOutput(playerNode)
        audioEngine.disconnectNodeOutput(equalizerUnit)
        audioEngine.connect(playerNode, to: equalizerUnit, format: nil)
        audioEngine.connect(equalizerUnit, to: audioEngine.mainMixerNode, format: nil)
        audioEngine.prepare()
        try audioEngine.start()
        startSuccess = true
      }

      self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      self.isInternalReconfiguring = false

      if !startSuccess {
        self.lastErrorMessage = "Failed to start audio engine"
        return false
      }

      updateEqualizerHardware()

      if isFocusModeActive {
        disableAllRemoteCommandsAndNowPlaying()
      } else if engineMode == "rntp" {
        setupRemoteCommands()
      } else {
        clearRemoteCommandTargets()
      }

      self.lastValidPositionSeconds = startSeconds
      scheduleAudioSegment(fromSeconds: startSeconds)

      if autoPlay {
        playerNode.play()
        self.isNodePlaying = true

        let expectedToken = self.currentScheduleToken
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
          guard let self = self,
                self.isNativePlayerActive,
                self.isNodePlaying,
                self.currentScheduleToken == expectedToken else { return }
          if !self.audioEngine.isRunning || !self.playerNode.isPlaying {
            self.applyAudioSessionCategory(activate: true, forceExclusive: self.isFocusModeActive)
            if !self.audioEngine.isRunning {
              self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
              try? self.audioEngine.start()
            }
            if !self.playerNode.isPlaying {
              self.playerNode.play()
            }
          }
        }
      } else {
        playerNode.pause()
        self.isNodePlaying = false
      }

      if !isFocusModeActive {
        refreshNowPlayingInfo()
      }
      self.lastErrorMessage = "None (Playing successfully: \(url.lastPathComponent), rate=\(fileFormat.sampleRate), ch=\(fileFormat.channelCount))"
      return true
    } catch let err as NSError {
      self.ignoreConfigChangeUntil = Date().timeIntervalSince1970 + 0.5
      self.isInternalReconfiguring = false
      self.lastErrorMessage = "LoadAndPlay Error: \(err.localizedDescription) (code=\(err.code), domain=\(err.domain))"
      return false
    }
  }

  private func scheduleAudioSegment(fromSeconds seconds: Double) {
    guard let file = currentAudioFile else { return }

    self.currentScheduleToken += 1
    let token = self.currentScheduleToken

    self.isManualStop = true
    playerNode.stop()
    self.isManualStop = false

    let sampleRate = file.processingFormat.sampleRate
    let totalFrames = file.length
    let targetFrame = AVAudioFramePosition(max(0.0, seconds) * sampleRate)

    if targetFrame >= totalFrames {
      seekOffsetSeconds = Double(totalFrames) / sampleRate
      lastValidPositionSeconds = seekOffsetSeconds
      DispatchQueue.main.async { [weak self] in
        guard let self = self, self.currentScheduleToken == token else { return }
        if self.isFocusModeActive {
          self.advanceFocusQueueTrack()
        } else {
          self.isNodePlaying = false
          self.updateNowPlayingPlaybackRate(isPlaying: false)
          self.sendEvent("onPlaybackEnded", [:])
        }
      }
      return
    }

    seekOffsetSeconds = Double(targetFrame) / sampleRate
    lastValidPositionSeconds = seekOffsetSeconds

    let rawRemaining = max(0, totalFrames - targetFrame)
    let remainingFrames = AVAudioFrameCount(clamping: rawRemaining)

    playerNode.scheduleSegment(
      file,
      startingFrame: targetFrame,
      frameCount: remainingFrames,
      at: nil,
      completionCallbackType: .dataPlayedBack
    ) { [weak self] _ in
      DispatchQueue.main.async {
        guard let self = self else { return }
        guard self.currentScheduleToken == token, !self.isManualStop else { return }
        if self.isFocusModeActive {
          self.advanceFocusQueueTrack()
        } else {
          self.isNodePlaying = false
          self.updateNowPlayingPlaybackRate(isPlaying: false)
          self.sendEvent("onPlaybackEnded", [:])
        }
      }
    }
  }

  private func seek(to seconds: Double) -> Bool {
    guard currentAudioFile != nil else { return false }
    let wasPlaying = self.isNodePlaying

    lastValidPositionSeconds = seconds
    scheduleAudioSegment(fromSeconds: seconds)
    if wasPlaying {
      playerNode.play()
      self.isNodePlaying = true
      if !isFocusModeActive {
        updateNowPlayingPlaybackRate(isPlaying: true)
      }
    }
    return true
  }

  private func getCurrentPosition() -> Double {
    if isNodePlaying,
       let lastRenderTime = playerNode.lastRenderTime,
       let playerTime = playerNode.playerTime(forNodeTime: lastRenderTime),
       playerTime.sampleRate > 0 {
      let playedSeconds = Double(playerTime.sampleTime) / playerTime.sampleRate
      lastValidPositionSeconds = max(0.0, seekOffsetSeconds + playedSeconds)
    }
    return lastValidPositionSeconds
  }
}
