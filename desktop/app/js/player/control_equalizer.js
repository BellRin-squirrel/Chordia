(function() {
    const s = window.PlayerState;

    Object.assign(window.PlayerController, {
        audioCtx: null,
        sourceNode: null,
        preampGainNode: null,
        eqFilterNodes: [],
        eqFreqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
        isEqInitialized: false,
        _currentBlobUrl: null,

        // Web Audio API イコライザーグラフの初期化
        ensureAudioContextReady: async function() {
            if (!this.audio) return false;

            try {
                if (!this.audioCtx) {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return false;
                    this.audioCtx = new AudioContextClass();
                }

                if (this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }

                if (!this.isEqInitialized) {
                    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
                    this.preampGainNode = this.audioCtx.createGain();

                    // 10バンド全域をピーク特性（Q=1.414）を持つPeakingフィルタで構築
                    this.eqFilterNodes = this.eqFreqs.map((freq) => {
                        const filter = this.audioCtx.createBiquadFilter();
                        filter.type = 'peaking';
                        filter.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
                        filter.Q.setValueAtTime(1.414, this.audioCtx.currentTime);
                        filter.gain.setValueAtTime(0, this.audioCtx.currentTime);
                        return filter;
                    });

                    // カスケード接続: Source -> Preamp -> Filter[0..9] -> Destination
                    let lastNode = this.sourceNode;
                    lastNode.connect(this.preampGainNode);
                    lastNode = this.preampGainNode;

                    this.eqFilterNodes.forEach(filter => {
                        lastNode.connect(filter);
                        lastNode = filter;
                    });

                    lastNode.connect(this.audioCtx.destination);
                    this.isEqInitialized = true;
                }

                this.applyEqualizerSettings();
                return true;
            } catch(e) {
                console.warn("[Equalizer] Web Audio setup notice:", e);
                return false;
            }
        },

        // イコライザー設定の適用
        applyEqualizerSettings: function() {
            if (!this.audioCtx || !this.isEqInitialized || this.eqFilterNodes.length === 0) return;

            let eqConfig = {
                enabled: false,
                preamp: 0,
                gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            };

            const raw = localStorage.getItem('chordia_equalizer_settings');
            if (raw) {
                try {
                    eqConfig = Object.assign({}, eqConfig, JSON.parse(raw));
                } catch(e) {}
            }

            const currTime = this.audioCtx.currentTime || 0;

            if (eqConfig.enabled) {
                const pDb = parseFloat(eqConfig.preamp) || 0;
                const pGain = Math.pow(10, pDb / 20);
                if (this.preampGainNode) {
                    this.preampGainNode.gain.cancelScheduledValues(currTime);
                    this.preampGainNode.gain.setValueAtTime(pGain, currTime);
                }

                this.eqFilterNodes.forEach((filter, idx) => {
                    const gVal = parseFloat(eqConfig.gains[idx]) || 0;
                    filter.gain.cancelScheduledValues(currTime);
                    filter.gain.setValueAtTime(gVal, currTime);
                });
            } else {
                if (this.preampGainNode) {
                    this.preampGainNode.gain.cancelScheduledValues(currTime);
                    this.preampGainNode.gain.setValueAtTime(1.0, currTime);
                }
                this.eqFilterNodes.forEach(filter => {
                    filter.gain.cancelScheduledValues(currTime);
                    filter.gain.setValueAtTime(0, currTime);
                });
            }
        },

        // 音量・ラウドネスノーマライゼーションの適用
        applyVolume: async function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            let targetGain = this.userVolume;
            
            try {
                const settings = await invoke("get_app_settings");

                if (settings.normalize_volume && s.queue[s.currentIndex]) {
                    const song = s.queue[s.currentIndex];
                    const lufs = await invoke("get_song_lufs", { filename: song.musicFilename });
                    
                    if (lufs !== null && lufs !== undefined) {
                        const TARGET_LUFS = -14.0;
                        let diff = TARGET_LUFS - lufs;
                        diff = Math.max(-15, Math.min(3, diff)); 
                        const factor = Math.pow(10, diff / 20);
                        targetGain = this.userVolume * factor;
                        targetGain = Math.max(0.0, Math.min(1.0, targetGain));
                    }
                }
            } catch (e) {
                console.error("Failed to apply normalize volume:", e);
            }

            if (this.audio) {
                this.audio.volume = targetGain;
            }
        },

        // Blob URL 変換（WebView2 の CORS 遮断を完全防止）
        prepareAudioSource: async function(streamUrl) {
            if (this._currentBlobUrl) {
                URL.revokeObjectURL(this._currentBlobUrl);
                this._currentBlobUrl = null;
            }

            let playSrc = streamUrl;
            try {
                if (playSrc.startsWith('http://asset.localhost') || playSrc.startsWith('asset://') || playSrc.startsWith('http://')) {
                    const response = await fetch(playSrc);
                    const blob = await response.blob();
                    playSrc = URL.createObjectURL(blob);
                    this._currentBlobUrl = playSrc;
                }
            } catch(fetchErr) {
                console.warn("[EQ] Blob conversion fallback notice:", fetchErr);
                playSrc = streamUrl;
            }
            return playSrc;
        }
    });
})();