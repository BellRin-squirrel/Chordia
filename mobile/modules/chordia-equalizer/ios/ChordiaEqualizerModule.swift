import ExpoModulesCore
import AVFoundation
import MediaPlayer

public class ChordiaEqualizerModule: Module {
  private var isEQEnabled: Bool = false
  private var currentPreamp: Float = 0.0
  private var currentGains: [Float] = Array(repeating: 0.0, count: 10)
  
  // 10バンド中心周波数 (Hz)
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
  private var lastResolvedPath: String = "None"
  private var debugDiagnostics: [String: Any] = [:]

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
        do {
          try self.audioEngine.start()
        } catch {
          self.lastErrorMessage = "AudioEngine start error: \(error.localizedDescription)"
          return false
        }
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
      let session = AVAudioSession.sharedInstance()
      return [
        "platform": "iOS",
        "isNativeConnected": true,
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

    var diagSteps: [String] = []
    let session = AVAudioSession.sharedInstance()
    diagSteps.append("Initial: cat=\(session.category.rawValue), mode=\(session.mode.rawValue), opt=\(session.categoryOptions.rawValue)")

    do {
      try session.setCategory(.playback, mode: .default, options: [])
      diagSteps.append("setCategory(.playback, .default, []): SUCCESS")
    } catch let err as NSError {
      diagSteps.append("setCategory FAILED: code=\(err.code), desc=\(err.localizedDescription)")
    }

    do {
      try session.setActive(true)
      diagSteps.append("setActive(true): SUCCESS")
    } catch let err as NSError {
      diagSteps.append("setActive(true) FAILED: code=\(err.code), desc=\(err.localizedDescription)")
    }

    self.debugDiagnostics["setupSessionSteps"] = diagSteps
    if diagSteps.contains(where: { $0.contains("FAILED") }) {
      self.lastErrorMessage = diagSteps.filter { $0.contains("FAILED") }.joined(separator: " | ")
    } else {
      self.lastErrorMessage = "None (AudioSession initialized successfully)"
    }
  }

  // ★ ハードウェアゲイン更新（ナイキスト周波数を考慮した安全ガード付き）
  private func updateEqualizerHardware() {
    equalizerUnit.bypass = !isEQEnabled
    equalizerUnit.globalGain = isEQEnabled ? currentPreamp : 0.0

    let maxAllowedFreq = Float(fileSampleRate / 2.0) - 200.0

    for i in 0..<min(equalizerUnit.bands.count, currentGains.count) {
      let band = equalizerUnit.bands[i]
      band.frequency = maxAllowedFreq > 1000.0 ? min(centerFrequencies[i], maxAllowedFreq) : centerFrequencies[i]
      band.gain = isEQEnabled ? currentGains[i] : 0.0
      band.bypass = !isEQEnabled
    }
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

  // ★ モノラル・特殊サンプリングレート・全形式対応の完全音源ロード＆イコライザー接続処理
  private func loadAndPlayFile(filePath: String, startSeconds: Double, autoPlay: Bool) -> Bool {
    setupAudioEngineNodes()

    guard let url = resolveFileURL(filePath: filePath) else {
      self.lastErrorMessage = "File not found: \(filePath)"
      return false
    }

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true)

      // 1. ファイルを標準 Float32 non-interleaved でオープン
      let file = try AVAudioFile(
        forReading: url,
        commonFormat: .pcmFormatFloat32,
        interleaved: false
      )
      self.currentAudioFile = file
      self.fileSampleRate = file.processingFormat.sampleRate
      self.fileTotalFrames = file.length

      if playerNode.isPlaying {
        playerNode.stop()
      }
      if audioEngine.isRunning {
        audioEngine.stop()
      }

      audioEngine.disconnectNodeOutput(playerNode)
      audioEngine.disconnectNodeOutput(equalizerUnit)

      // 2. 出力ミキサーのステレオ標準フォーマットを取得
      let mixerOutputFormat = audioEngine.mainMixerNode.outputFormat(forBus: 0)
      let sampleRateToUse = mixerOutputFormat.sampleRate > 0 ? mixerOutputFormat.sampleRate : 44100.0

      // ★ どんな音源（モノラル等）でも確実に EQ が通る標準ステレオ 2ch Float32 パイプラインを生成
      guard let canonicalStereoFormat = AVAudioFormat(
        standardFormatWithSampleRate: sampleRateToUse,
        channels: 2
      ) else {
        self.lastErrorMessage = "Failed to create canonical stereo format"
        return false
      }

      // playerNode -> equalizerUnit -> mainMixerNode を全曲共通の標準ステレオで直結
      // （playerNode が音源フォーマットからこのステレオフォーマットへ自動リサンプリング＆展開）
      audioEngine.connect(playerNode, to: equalizerUnit, format: canonicalStereoFormat)
      audioEngine.connect(equalizerUnit, to: audioEngine.mainMixerNode, format: canonicalStereoFormat)

      audioEngine.prepare()
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

      self.lastErrorMessage = "None (Playing successfully: \(url.lastPathComponent), ch=\(file.processingFormat.channelCount), rate=\(file.processingFormat.sampleRate))"
      return true
    } catch let err as NSError {
      self.lastErrorMessage = "LoadAndPlay Error: \(err.localizedDescription) (code=\(err.code), domain=\(err.domain))"
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