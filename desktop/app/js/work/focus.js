window.WorkFocus = {
    isFocusActive: false,
    isPaused: false,
    focusTimerInterval: null,
    quoteInterval: null,
    clockInterval: null,
    pauseTimerInterval: null,

    totalWorkSeconds: 0,
    currentSessionSeconds: 0,
    pausedSeconds: 0,

    playbackQueue: [],
    currentQueueIndex: 0,

    init: function() {
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer) {
            audioPlayer.addEventListener('ended', () => {
                if (this.playbackQueue.length > 0) {
                    this.currentQueueIndex = (this.currentQueueIndex + 1) % this.playbackQueue.length;
                    this.playSongFromQueue();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (!this.isFocusActive) return;
            const helpModal = document.getElementById('focusHelpModal');
            if (helpModal && helpModal.classList.contains('show')) return;

            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePauseState();
            }
        });

        const workFocusView = document.getElementById('workFocusView');
        if (workFocusView) {
            workFocusView.addEventListener('click', (e) => {
                if (!this.isFocusActive) return;
                if (this.isPaused) return; 
                if (e.target.closest('#focusHelpModal') || e.target.closest('#pauseOverlay')) return;
                this.openHelpModal();
            });
        }

        const btnResumeFocus = document.getElementById('btnResumeFocus');
        const btnExitFocus = document.getElementById('btnExitFocus');

        if (btnResumeFocus) {
            btnResumeFocus.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeHelpModal();
            });
        }

        if (btnExitFocus) {
            btnExitFocus.addEventListener('click', async (e) => {
                e.stopPropagation();
                this.closeHelpModal();
                this.stopSession();
                
                // ★ ウィンドウ自体を完全に閉じる
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    await invoke('close_work_window');
                } catch (e) {
                    window.close();
                }
            });
        }
    },

    start: async function() {
        const defaultConfig = {
            dateFormat: 'ymd',
            dayFormat: 'paren',
            clockFormat: '24h',
            showQuote: true,
            pomodoroMode: false,
            workDuration: 25,
            breakDuration: 5,
            slots: {
                normal: { target: null, shuffle: true },
                work: { target: null, shuffle: true },
                break: { target: null, shuffle: true }
            }
        };

        let raw = localStorage.getItem('chordia_work_config');
        let cfg = defaultConfig;
        try {
            if (raw) cfg = Object.assign({}, defaultConfig, JSON.parse(raw));
            if (!cfg.slots) cfg.slots = defaultConfig.slots;
        } catch(e) {
            cfg = defaultConfig;
        }

        // 表示の確実な切り替え
        const configContainer = document.getElementById('configContainer');
        const workReadyView = document.getElementById('workReadyView');
        const workFocusView = document.getElementById('workFocusView');

        if (configContainer) configContainer.style.display = 'none';
        if (workReadyView) workReadyView.style.display = 'none';
        
        if (workFocusView) {
            workFocusView.style.display = 'flex';
            workFocusView.style.visibility = 'visible';
            workFocusView.style.opacity = '1';
        }
        document.body.className = 'mode-focus';

        // ★ 作業モード（黒画面）に入ったら、ウィンドウ左上のボタンコントロールを完全に非表示にする
        const windowControls = document.getElementById('windowControlsMac');
        if (windowControls) {
            windowControls.style.display = 'none';
        }

        this.isFocusActive = true;
        this.isPaused = false;
        this.totalWorkSeconds = 0;
        this.currentSessionSeconds = 0;

        // 即座に初期同期描画
        this.applyDisplayFormats(cfg);
        this.updateClock(cfg);
        this.updateElapsedTime();
        this.updateQuote(cfg);

        // 定期タイマーの起動
        if (this.quoteInterval) clearInterval(this.quoteInterval);
        this.quoteInterval = setInterval(() => this.updateQuote(cfg), 60000);

        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(() => this.updateClock(cfg), 1000);

        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
        this.focusTimerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.totalWorkSeconds++;
                this.currentSessionSeconds++;
                this.updateElapsedTime();
            }
        }, 1000);

        // 音楽再生の開始（非ブロッキング）
        this.startMusic(cfg).catch(err => console.error("Music playback err:", err));
    },

    applyDisplayFormats: function(cfg) {
        const focusLeftCol = document.getElementById('focusLeftCol');
        const focusMainArea = document.getElementById('focusMainArea');
        const focusTotalWorkLabel = document.getElementById('focusTotalWorkLabel');
        const focusDateDisplay = document.getElementById('focusDateDisplay');
        const focusClockDisplay = document.getElementById('focusClockDisplay');

        const isDateNone = cfg.dateFormat === 'none';
        const isDayNone = cfg.dayFormat === 'none';
        const isClockNone = cfg.clockFormat === 'none';

        if (isDateNone && isDayNone && isClockNone) {
            if (focusLeftCol) focusLeftCol.style.display = 'none';
            if (focusMainArea) focusMainArea.classList.add('center-only');
            if (focusTotalWorkLabel) focusTotalWorkLabel.style.display = 'block';
        } else {
            if (focusLeftCol) focusLeftCol.style.display = 'flex';
            if (focusMainArea) focusMainArea.classList.remove('center-only');
            if (focusTotalWorkLabel) focusTotalWorkLabel.style.display = 'none';
        }

        if (focusDateDisplay) focusDateDisplay.style.display = (isDateNone && isDayNone) ? 'none' : 'block';
        if (focusClockDisplay) focusClockDisplay.style.display = isClockNone ? 'none' : 'block';
    },

    updateClock: function(cfg) {
        if (!cfg) return;
        const clockEl = document.getElementById('focusClockDisplay');
        const dateEl = document.getElementById('focusDateDisplay');

        const now = new Date();
        const hrs = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');

        if (clockEl && cfg.clockFormat !== 'none') {
            clockEl.textContent = (cfg.clockFormat === '12h') ? `${hrs % 12 || 12}:${mins}` : `${String(hrs).padStart(2, '0')}:${mins}`;
        }

        if (dateEl && (cfg.dateFormat !== 'none' || cfg.dayFormat !== 'none')) {
            let dateStr = "";
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const d = now.getDate();

            if (cfg.dateFormat === 'ymd') dateStr = `${y}年${m}月${d}日`;
            else if (cfg.dateFormat === 'md') dateStr = `${m}月${d}日`;
            else if (cfg.dateFormat === 'd') dateStr = `${d}日`;

            const dayShort = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
            const dayFull = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"][now.getDay()];

            let dayStr = "";
            if (cfg.dayFormat === 'paren') dayStr = ` (${dayShort})`;
            else if (cfg.dayFormat === 'short') dayStr = ` ${dayShort}曜`;
            else if (cfg.dayFormat === 'full') dayStr = ` ${dayFull}`;

            dateEl.textContent = `${dateStr}${dayStr}`.trim();
        }
    },

    updateElapsedTime: function() {
        const el = document.getElementById('focusElapsedDisplay');
        if (!el) return;

        const hrs = Math.floor(this.totalWorkSeconds / 3600);
        const mins = Math.floor((this.totalWorkSeconds % 3600) / 60);
        const secs = this.totalWorkSeconds % 60;

        el.textContent = (hrs > 0)
            ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            : `${mins}:${String(secs).padStart(2, '0')}`;
    },

    updateQuote: function(cfg) {
        const quoteEl = document.getElementById('focusQuoteDisplay');
        if (!quoteEl) return;
        if (cfg && !cfg.showQuote) {
            quoteEl.style.display = 'none';
            return;
        }
        quoteEl.style.display = 'block';
        if (window.WorkQuotes) {
            quoteEl.innerHTML = window.WorkQuotes.getRandomFormattedQuote();
        }
    },

    startMusic: async function(cfg) {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        if (!cfg || !cfg.slots) return;
        const slot = cfg.pomodoroMode ? cfg.slots.work : cfg.slots.normal;
        if (!slot || !slot.target) return;

        try {
            let songs = [];
            if (slot.target.type === 'playlist') {
                const details = await invoke("get_playlist_details", { plId: slot.target.id });
                if (details && details.songs) songs = details.songs;
            } else if (slot.target.type === 'album') {
                const details = await invoke("get_virtual_playlist_details", { field: "album", value: slot.target.name });
                if (details && details.songs) songs = details.songs;
            } else if (slot.target.type === 'artist') {
                const details = await invoke("get_virtual_playlist_details", { field: "artist", value: slot.target.name });
                if (details && details.songs) songs = details.songs;
            }

            if (songs.length > 0) {
                if (slot.shuffle) {
                    for (let i = songs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [songs[i], songs[j]] = [songs[j], songs[i]];
                    }
                }
                this.playbackQueue = songs;
                this.currentQueueIndex = 0;
                this.playSongFromQueue();
            }
        } catch(e) {
            console.error("Focus music load error:", e);
        }
    },

    playSongFromQueue: async function() {
        if (this.playbackQueue.length === 0 || this.currentQueueIndex >= this.playbackQueue.length) return;
        const song = this.playbackQueue[this.currentQueueIndex];
        const audioPlayer = document.getElementById('workAudioPlayer');
        const songNameText = document.getElementById('focusSongNameText');
        const convertFileSrc = window.__TAURI__.core ? window.__TAURI__.core.convertFileSrc : (window.__TAURI__.tauri ? window.__TAURI__.tauri.convertFileSrc : (p => p));
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

        if (song && audioPlayer) {
            try {
                let streamUrl = song.streamUrl;
                if (!streamUrl && song.musicFilename) {
                    const absPath = await invoke("resolve_path", { relPath: song.musicFilename });
                    streamUrl = convertFileSrc(absPath);
                }
                if (streamUrl) {
                    audioPlayer.src = streamUrl;
                    audioPlayer.play().catch(() => {});
                    if (songNameText) songNameText.textContent = `${song.title || 'Unknown'} - ${song.artist || 'Unknown'}`;
                }
            } catch(e) {
                console.error("Play error:", e);
            }
        }
    },

    togglePauseState: function() {
        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pauseOverlay');
        const pausedTimeDisplay = document.getElementById('pausedTimeDisplay');
        const audioPlayer = document.getElementById('workAudioPlayer');

        if (this.isPaused) {
            if (pauseOverlay) pauseOverlay.style.display = 'flex';
            if (audioPlayer) audioPlayer.pause();
            this.pausedSeconds = 0;
            if (pausedTimeDisplay) pausedTimeDisplay.textContent = "0:00";
            if (this.pauseTimerInterval) clearInterval(this.pauseTimerInterval);
            this.pauseTimerInterval = setInterval(() => {
                this.pausedSeconds++;
                const m = Math.floor(this.pausedSeconds / 60);
                const s = this.pausedSeconds % 60;
                if (pausedTimeDisplay) pausedTimeDisplay.textContent = `${m}:${String(s).padStart(2, '0')}`;
            }, 1000);
        } else {
            if (pauseOverlay) pauseOverlay.style.display = 'none';
            if (this.pauseTimerInterval) clearInterval(this.pauseTimerInterval);
            if (audioPlayer && audioPlayer.src) audioPlayer.play().catch(() => {});
        }
    },

    openHelpModal: function() {
        const modal = document.getElementById('focusHelpModal');
        if (modal) modal.classList.add('show');
    },

    closeHelpModal: function() {
        const modal = document.getElementById('focusHelpModal');
        if (modal) modal.classList.remove('show');
    },

    stopSession: function() {
        this.isFocusActive = false;
        this.isPaused = false;
        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
        if (this.quoteInterval) clearInterval(this.quoteInterval);
        if (this.clockInterval) clearInterval(this.clockInterval);
        if (this.pauseTimerInterval) clearInterval(this.pauseTimerInterval);
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = "";
        }
    }
};