import ExpoModulesCore
import AVFoundation
import MediaPlayer

public class ChordiaEqualizerModule: Module {
  private var isEQEnabled: Bool = false
  private var currentPreamp: Float = 0.0
  private var currentGains: [Float] = Array(repeating: 0.0, count: 10)
  
  private let centerFrequencies: [Float] = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

  private var audioEngine: AVAudioEngine = AVAudioEngine()
  private var playerNode: AVAudioPlayerNode = AVAudioPlayerNode()
  private var equalizerUnit: AVAudioUnitEQ = AVAudioUnitEQ(numberOfBands: 10)
  private var currentAudioFile: AVAudioFile?
  
  private var fileSampleRate: Double = 44100.0
  private var fileTotalFrames: AVAudioFramePosition = 0
  private var seekOffsetSeconds: Double = 0.0
  private var isNodePlaying: Bool = false
  private var lastErrorMessage: String = "None"

  public func definition() -> ModuleDefinition {
    Name("ChordiaEqualizer")

    OnCreate {
      self.initEqualizerUnit()
    }

    Function("initEqualizer") { (audioSessionId: Int) -> Bool in
      self.initEqualizerUnit()
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

    // ★ デバッグ情報取得関数
    Function("getDebugInfo") { () -> [String: Any] in
      return [
        "platform": "iOS",
        "isNativeConnected": true,
        "isEngineRunning": self.audioEngine.isRunning,
        "isPlayerPlaying": self.playerNode.isPlaying,
        "isEQEnabled": self.isEQEnabled,
        "preamp": self.currentPreamp,
        "gains": self.currentGains,
        "hasAudioFile": self.currentAudioFile != nil,
        "sampleRate": self.fileSampleRate,
        "totalFrames": self.fileTotalFrames,
        "lastError": self.lastErrorMessage
      ]
    }
  }

  private func initEqualizerUnit() {
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

  // ★ アプリ再ビルドに伴うコンテナUUID変更にも対応した最強のファイル解決
  private func resolveFileURL(filePath: String) -> URL? {
    let fname = URL(fileURLWithPath: filePath).lastPathComponent

    // 1. 直のURL指定
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

    // 2. 現在の Documents/chordia/ ディレクトリからファイル名で自動特定
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
    guard let url = resolveFileURL(filePath: filePath) else {
      self.lastErrorMessage = "File not found: \(filePath)"
      return false
    }

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .default, options: [.allowAirPlay, .allowBluetooth])
      try session.setActive(true)

      let file = try AVAudioFile(forReading: url)
      self.currentAudioFile = file
      self.fileSampleRate = file.processingFormat.sampleRate
      self.fileTotalFrames = file.length

      if audioEngine.isRunning {
        audioEngine.stop()
      }
      audioEngine.reset()

      audioEngine = AVAudioEngine()
      playerNode = AVAudioPlayerNode()
      equalizerUnit = AVAudioUnitEQ(numberOfBands: 10)
      initEqualizerUnit()

      audioEngine.attach(playerNode)
      audioEngine.attach(equalizerUnit)

      // Float32 標準フォーマットを作成
      guard let processingFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: file.processingFormat.sampleRate,
        channels: file.processingFormat.channelCount,
        interleaved: false
      ) else {
        self.lastErrorMessage = "Invalid processing format"
        return false
      }

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
    let targetFrame = AVAudioFramePosition(max(0, seconds) * sampleRate)

    if targetFrame >= totalFrames {
      seekOffsetSeconds = Double(totalFrames) / sampleRate
      return
    }

    seekOffsetSeconds = Double(targetFrame) / sampleRate
    let remainingFrames = AVAudioFrameCount(totalFrames - targetFrame)

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
    return max(0, seekOffsetSeconds + playedSeconds)
  }
}