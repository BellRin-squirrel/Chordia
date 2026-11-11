import ExpoModulesCore
import AVFoundation
import MediaPlayer
import UIKit

public class ChordiaEqualizerModule: Module {
  private var isEQEnabled: Bool = false
  private var currentPreamp: Float = 0.0
  private var currentGains: [Float] = Array(repeating: 0.0, count: 10)
  private var soundCheckGain: Float = 0.0
  private var engineMode: String = "rntp"
  
  private let centerFrequencies: [Float] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

  private let audioEngine = AVAudioEngine()
  private let playerNode = AVAudioPlayerNode()
  private let equalizerUnit = AVAudioUnitEQ(numberOfBands: 10)
  private var currentAudioFile: AVAudioFile?
  
  private var fileSampleRate: Double = 44100.0
  private var fileTotalFrames: AVAudioFramePosition = 0
  private var seekOffsetSeconds: Double = 0.0
  private var lastValidPositionSeconds: Double = 0.0
  
  private var isNodePlaying: Bool = false
  private var isNodesAttached: Bool = false
  private var isManualStop: Bool = false
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

    Events("onRemoteCommand", "onPlaybackEnded")

    OnCreate {
      self.setupAudioEngineNodes()
      DispatchQueue.main.async {
        UIApplication.shared.beginReceivingRemoteControlEvents()
      }
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
      self.soundCheckGain = Float(max(-12.0, min(12.0, gainDb)))
      self.updateEqualizerHardware()
    }

    AsyncFunction("analyzeAudioLoudness") { (source: String) throws -> Double in
      return try self.analyzeAudioLoudness(source: source)
    }

    Function("setEngineMode") { (mode: String) in
      self.engineMode = mode
      self.applyAudioSessionCategory(activate: false)
      self.updateRemoteCommandsState()
      self.refreshNowPlayingInfo()
    }

    Function("updateNowPlaying") { (title: String, artist: String, album: String, artworkUri: String?, duration: Double, position: Double, isPlaying: Bool) in
      self.currentTrackTitle = title
      self.currentTrackArtist = artist
      self.currentTrackAlbum = album
      self.currentArtworkUri = artworkUri
      self.currentDuration = duration
      self.updateNowPlayingInfoCenter(duration: duration, position: position, isPlaying: isPlaying)
      self.updateRemoteCommandsState()
    }

    Function("setTrackISRC") { (isrc: String?) in
      self.currentISRC = isrc
    }

    Function("loadAndPlay") { (filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool in
      return self.loadAndPlayFile(filePath: filePath, startSeconds: startSeconds, autoPlay: autoPlay)
    }

    Function("pause") { () -> Bool in
      return self.pauseInternal()
    }

    Function("play") { () -> Bool in
      return self.playInternal()
    }

    Function("stop") { () -> Bool in
      _ = self.getCurrentPosition()
      self.isManualStop = true
      self.playerNode.stop()
      self.isManualStop = false
      self.isNodePlaying = false
      self.currentAudioFile = nil
      self.currentTrackTitle = ""
      self.currentTrackArtist = ""
      self.currentTrackAlbum = ""
      self.currentArtworkUri = nil
      self.currentISRC = nil
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      self.updateRemoteCommandsState()
      return true
    }

    Function("seekTo") { (seconds: Double) -> Bool in
      let res = self.seek(to: seconds)
      self.updateNowPlayingPosition(seconds: seconds)
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
        "isEngineRunning": self.audioEngine.isRunning,
        "isPlayerPlaying": self.playerNode.isPlaying,
        "isEQEnabled": self.isEQEnabled,
        "preamp": Double(self.currentPreamp),
        "gains": self.currentGains.map { Double($0) },
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

    audioEngine.attach(playerNode)
    audioEngine.attach(equalizerUnit)
    isNodesAttached = true

    applyAudioSessionCategory(activate: false)
  }

  private func applyAudioSessionCategory(activate: Bool = false) {
    do {
      let session = AVAudioSession.sharedInstance()
      if engineMode == "expo-av" {
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
      } else {
        try session.setCategory(.playback, mode: .default, options: [])
      }
      if activate {
        try session.setActive(true)
      }
      self.lastErrorMessage = "None (AudioSession configured: \(engineMode))"
    } catch let err as NSError {
      self.lastErrorMessage = "AudioSession error: \(err.localizedDescription)"
    }
  }

  private func playInternal() -> Bool {
    applyAudioSessionCategory(activate: true)
    if !audioEngine.isRunning {
      do {
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

  private func isIOSEQActive() -> Bool {
    return isEQEnabled && currentAudioFile != nil
  }

  private func updateRemoteCommandsState() {
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
    DispatchQueue.main.async {
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
    guard engineMode == "rntp" else { return }
    guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    DispatchQueue.main.async {
      if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = self.getCurrentPosition()
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
  }

  private func updateNowPlayingPosition(seconds: Double) {
    guard engineMode == "rntp" else { return }
    guard (!self.currentTrackTitle.isEmpty || self.currentAudioFile != nil) else {
      DispatchQueue.main.async {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }
    DispatchQueue.main.async {
      if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = seconds
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
      }
    }
  }

  private func refreshNowPlayingInfo() {
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
    equalizerUnit.bypass = !isEQEnabled && soundCheckGain == 0.0
    equalizerUnit.globalGain = (isEQEnabled ? currentPreamp : 0.0) + soundCheckGain

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

  private func loadAndPlayFile(filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool {
    setupAudioEngineNodes()

    guard let url = resolveFileURL(filePath: filePath) else {
      self.lastErrorMessage = "File not found: \(filePath)"
      return false
    }

    do {
      applyAudioSessionCategory(activate: true)

      let file = try AVAudioFile(forReading: url)
      self.currentAudioFile = file
      self.fileSampleRate = file.processingFormat.sampleRate
      self.fileTotalFrames = file.length

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

      if !startSuccess {
        self.lastErrorMessage = "Failed to start audio engine"
        return false
      }

      updateEqualizerHardware()

      if engineMode == "rntp" {
        setupRemoteCommands()
      } else {
        clearRemoteCommandTargets()
      }

      self.lastValidPositionSeconds = startSeconds
      scheduleAudioSegment(fromSeconds: startSeconds)

      if autoPlay {
        playerNode.play()
        self.isNodePlaying = true
      } else {
        playerNode.pause()
        self.isNodePlaying = false
      }

      refreshNowPlayingInfo()
      self.lastErrorMessage = "None (Playing successfully: \(url.lastPathComponent), rate=\(fileFormat.sampleRate), ch=\(fileFormat.channelCount))"
      return true
    } catch let err as NSError {
      self.lastErrorMessage = "LoadAndPlay Error: \(err.localizedDescription) (code=\(err.code), domain=\(err.domain))"
      return false
    }
  }

  private func scheduleAudioSegment(fromSeconds seconds: Double) {
    guard let file = currentAudioFile else { return }
    
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
        self?.sendEvent("onPlaybackEnded", [:])
      }
      return
    }

    seekOffsetSeconds = Double(targetFrame) / sampleRate
    lastValidPositionSeconds = seekOffsetSeconds

    let rawRemaining = max(0, totalFrames - targetFrame)
    let remainingFrames = AVAudioFrameCount(clamping: rawRemaining)

    playerNode.scheduleSegment(file, startingFrame: targetFrame, frameCount: remainingFrames, at: nil) { [weak self] in
      DispatchQueue.main.async {
        guard let self = self else { return }
        if !self.isManualStop {
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
      updateNowPlayingPlaybackRate(isPlaying: true)
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