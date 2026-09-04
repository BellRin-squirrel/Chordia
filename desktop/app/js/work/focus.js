window.WorkFocus = {
    isFocusActive: false,
    isPaused: false,
    isHelpOpen: false, 
    focusTimerInterval: null,
    quoteInterval: null,
    clockInterval: null,
    pauseTimerInterval: null,

    cfg: null, 

    // ポモドーロ＆タイマー用のステータス
    pomoPhase: 'WORK', // 'WORK' or 'BREAK'
    totalWorkSeconds: 0, // 累計の実作業時間（WORKフェーズ中のみ加算される）
    pomoRemaining: 0,    // フェーズの残り時間（秒）
    isMusicFadingOut: false, 
    
    // 音楽再生用のキューと進行状態
    workQueue: [],
    workIndex: 0,
    workProgressSec: 0, 

    breakQueue: [],
    breakIndex: 0,
    breakProgressSec: 0,

    normalQueue: [],
    normalIndex: 0,

    init: function() {
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer) {
            audioPlayer.addEventListener('ended', () => {
                if (this.cfg && this.cfg.pomodoroMode) {
                    if (this.pomoPhase === 'WORK' && this.workQueue.length > 0) {
                        this.workIndex = (this.workIndex + 1) % this.workQueue.length;
                        this.workProgressSec = 0;
                        this.playCurrentPhaseSong();
                    } else if (this.pomoPhase === 'BREAK' && this.breakQueue.length > 0) {
                        this.breakIndex = (this.breakIndex + 1) % this.breakQueue.length;
                        this.breakProgressSec = 0;
                        this.playCurrentPhaseSong();
                    }
                } else {
                    if (this.normalQueue.length > 0) {
                        this.normalIndex = (this.normalIndex + 1) % this.normalQueue.length;
                        this.playCurrentPhaseSong();
                    }
                }
            });
            
            // 再生位置のリアルタイム保持
            audioPlayer.addEventListener('timeupdate', () => {
                if (this.cfg && this.cfg.pomodoroMode && !this.isMusicFadingOut) {
                    if (this.pomoPhase === 'WORK') {
                        this.workProgressSec = audioPlayer.currentTime;
                    } else {
                        this.breakProgressSec = audioPlayer.currentTime;
                    }
                }
            });
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.includes('Mac');
        const shortcutExit = document.getElementById('shortcutExit');
        if (shortcutExit) {
            shortcutExit.innerHTML = isMac ? `<kbd>Control</kbd> + <kbd>Option</kbd> + <kbd>Q</kbd>` : `<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Q</kbd>`;
        }

        document.addEventListener('keydown', async (e) => {
            if (!this.isFocusActive) return;

            if (e.ctrlKey && e.altKey && (e.code === 'KeyQ' || e.key.toLowerCase() === 'q')) {
                e.preventDefault();
                this.closeHelpModal();
                this.stopSession();
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    await invoke('close_work_window');
                } catch (err) {
                    window.close();
                }
                return;
            }

            if (e.key === 'F11' || e.key === 'Escape') {
                e.preventDefault();
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    if (e.key === 'F11') {
                        await invoke('toggle_maximize_work_window');
                    } else if (e.key === 'Escape') {
                        if (window.__TAURI__ && window.__TAURI__.window) {
                            const win = window.__TAURI__.window.getCurrentWindow();
                            const isMax = await win.isMaximized();
                            const isFull = await win.isFullscreen();
                            if (isMax || isFull) {
                                await win.unmaximize();
                                await win.setFullscreen(false);
                            }
                        }
                    }
                } catch(err) {
                    console.error("Window state error:", err);
                }
                return;
            }

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
                
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    await invoke('close_work_window');
                } catch (err) {
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
        this.cfg = defaultConfig;
        try {
            if (raw) this.cfg = Object.assign({}, defaultConfig, JSON.parse(raw));
            if (!this.cfg.slots) this.cfg.slots = defaultConfig.slots;
        } catch(e) {
            this.cfg = defaultConfig;
        }

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

        const windowControls = document.getElementById('windowControlsMac');
        if (windowControls) {
            windowControls.style.display = 'none';
        }

        this.isFocusActive = true;
        this.isPaused = false;
        this.isHelpOpen = false; 
        this.totalWorkSeconds = 0;

        // キュー初期化
        this.workQueue = []; this.workIndex = 0; this.workProgressSec = 0;
        this.breakQueue = []; this.breakIndex = 0; this.breakProgressSec = 0;
        this.normalQueue = []; this.normalIndex = 0;
        await this.loadAllPlaylists();

        // ★ ポモドーロの初期化
        if (this.cfg.pomodoroMode) {
            this.pomoPhase = 'WORK';
            this.pomoRemaining = this.cfg.workDuration * 60;
        } else {
            this.pomoPhase = 'NORMAL';
            this.pomoRemaining = 0; 
        }
        
        this.isMusicFadingOut = false;

        this.applyDisplayFormats();
        this.updateClock();
        this.updateElapsedTimeUI();
        this.updateQuote();

        if (this.quoteInterval) clearInterval(this.quoteInterval);
        this.quoteInterval = setInterval(() => this.updateQuote(), 60000);

        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(() => this.updateClock(), 1000);

        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
        this.focusTimerInterval = setInterval(() => {
            if (!this.isPaused && !this.isHelpOpen) {
                // 1秒進める
                if (this.pomoPhase === 'WORK' || this.pomoPhase === 'NORMAL') {
                    this.totalWorkSeconds++;
                }

                if (this.cfg.pomodoroMode) {
                    this.pomoRemaining--;
                    this.checkPomodoroTransition();
                }

                this.updateElapsedTimeUI();
            }
        }, 1000);

        this.playCurrentPhaseSong();
    },

    loadAllPlaylists: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const loadSlot = async (slotData) => {
            if (!slotData || !slotData.target) return [];
            let songs = [];
            if (slotData.target.type === 'playlist') {
                const details = await invoke("get_playlist_details", { plId: slotData.target.id });
                if (details && details.songs) songs = details.songs;
            } else if (slotData.target.type === 'album') {
                const details = await invoke("get_virtual_playlist_details", { field: "album", value: slotData.target.name });
                if (details && details.songs) songs = details.songs;
            } else if (slotData.target.type === 'artist') {
                const details = await invoke("get_virtual_playlist_details", { field: "artist", value: slotData.target.name });
                if (details && details.songs) songs = details.songs;
            }
            if (songs.length > 0 && slotData.shuffle) {
                for (let i = songs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [songs[i], songs[j]] = [songs[j], songs[i]];
                }
            }
            return songs;
        };

        if (this.cfg.pomodoroMode) {
            this.workQueue = await loadSlot(this.cfg.slots.work);
            this.breakQueue = await loadSlot(this.cfg.slots.break);
        } else {
            this.normalQueue = await loadSlot(this.cfg.slots.normal);
        }
    },

    checkPomodoroTransition: async function() {
        const audioPlayer = document.getElementById('workAudioPlayer');
        
        // 残り6秒: フェードアウト開始
        if (this.pomoRemaining === 6 && !this.isMusicFadingOut && audioPlayer && !audioPlayer.paused) {
            this.isMusicFadingOut = true;
            this.fadeOutAudio(audioPlayer, 4500); 
        }

        // 残り0秒: フェーズ切り替え
        if (this.pomoRemaining <= 0) {
            this.isMusicFadingOut = false;
            if (audioPlayer) audioPlayer.pause();
            
            this.playBeepAndVibrate();

            if (this.pomoPhase === 'WORK') {
                this.pomoPhase = 'BREAK';
                this.pomoRemaining = this.cfg.breakDuration * 60;
            } else {
                this.pomoPhase = 'WORK';
                this.pomoRemaining = this.cfg.workDuration * 60;
            }
            
            this.updateElapsedTimeUI();
            this.playCurrentPhaseSong(true); 
        }
    },

    // ★ Web Audio APIから HTML Audio による再生に変更
    playBeepAndVibrate: function() {
        if ('vibrate' in navigator) {
            navigator.vibrate([500, 200, 500]);
        }
        
        const beepUrl = "https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav";
        const beepAudio = new Audio(beepUrl);
        beepAudio.volume = 1.0;
        beepAudio.play().catch(e => console.error("BeepSound play error:", e));
    },

    fadeOutAudio: function(audio, durationMs) {
        const steps = 10;
        const interval = durationMs / steps;
        let currentVol = audio.volume;
        const stepVol = currentVol / steps;

        const fade = setInterval(() => {
            if (audio.paused || this.pomoRemaining <= 0) {
                clearInterval(fade);
                return;
            }
            currentVol -= stepVol;
            if (currentVol <= 0.05) {
                currentVol = 0;
                clearInterval(fade);
            }
            audio.volume = Math.max(0, currentVol);
        }, interval);
    },

    fadeInAudio: function(audio, targetVolume, durationMs) {
        audio.volume = 0;
        const steps = 10;
        const interval = durationMs / steps;
        const stepVol = targetVolume / steps;
        let currentVol = 0;

        const fade = setInterval(() => {
            if (audio.paused) {
                clearInterval(fade);
                return;
            }
            currentVol += stepVol;
            if (currentVol >= targetVolume) {
                currentVol = targetVolume;
                clearInterval(fade);
            }
            audio.volume = Math.min(targetVolume, currentVol);
        }, interval);
    },

    playCurrentPhaseSong: async function(withFadeIn = false) {
        let song = null;
        let startSec = 0;

        if (this.cfg.pomodoroMode) {
            if (this.pomoPhase === 'WORK') {
                if (this.workQueue.length > 0) {
                    song = this.workQueue[this.workIndex];
                    startSec = this.workProgressSec;
                }
            } else {
                if (this.breakQueue.length > 0) {
                    song = this.breakQueue[this.breakIndex];
                    startSec = this.breakProgressSec;
                }
            }
        } else {
            if (this.normalQueue.length > 0) {
                song = this.normalQueue[this.normalIndex];
            }
        }

        const audioPlayer = document.getElementById('workAudioPlayer');
        const songNameText = document.getElementById('focusSongNameText');

        if (!song || !audioPlayer) {
            if (songNameText) songNameText.textContent = "再生可能な楽曲がありません";
            return;
        }

        const convertFileSrc = window.__TAURI__.core ? window.__TAURI__.core.convertFileSrc : (window.__TAURI__.tauri ? window.__TAURI__.tauri.convertFileSrc : (p => p));
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

        try {
            let streamUrl = song.streamUrl;
            if (!streamUrl && song.musicFilename) {
                const absPath = await invoke("resolve_path", { relPath: song.musicFilename });
                streamUrl = convertFileSrc(absPath);
            }
            if (streamUrl) {
                audioPlayer.src = streamUrl;
                audioPlayer.load();

                audioPlayer.currentTime = startSec;
                
                const savedVol = localStorage.getItem('player_volume') ? (parseFloat(localStorage.getItem('player_volume')) / 100) : 1.0;
                
                if (withFadeIn) {
                    audioPlayer.volume = 0;
                    audioPlayer.play().then(() => {
                        this.fadeInAudio(audioPlayer, savedVol, 2000);
                    }).catch(() => {});
                } else {
                    audioPlayer.volume = savedVol;
                    audioPlayer.play().catch(() => {});
                }
                
                if (songNameText) songNameText.textContent = `${song.title || 'Unknown'} - ${song.artist || 'Unknown'}`;
            }
        } catch(e) {
            console.error("Play error:", e);
        }
    },

    applyDisplayFormats: function() {
        if (!this.cfg) return;
        const focusLeftCol = document.getElementById('focusLeftCol');
        const focusMainArea = document.getElementById('focusMainArea');
        const focusTotalWorkLabel = document.getElementById('focusTotalWorkLabel');
        const focusTotalWorkDisplay = document.getElementById('focusTotalWorkDisplay');
        const focusDateDisplay = document.getElementById('focusDateDisplay');
        const focusClockDisplay = document.getElementById('focusClockDisplay');
        
        const pomoBadgeArea = document.getElementById('pomoBadgeArea');
        const focusPomoTimerDisplay = document.getElementById('focusPomoTimerDisplay');

        const isDateNone = this.cfg.dateFormat === 'none';
        const isDayNone = this.cfg.dayFormat === 'none';
        const isClockNone = this.cfg.clockFormat === 'none';

        // 常に表示されるもの
        if (focusTotalWorkLabel) focusTotalWorkLabel.style.display = 'block';
        if (focusTotalWorkDisplay) focusTotalWorkDisplay.style.display = 'block';

        if (isDateNone && isDayNone && isClockNone) {
            if (focusLeftCol) focusLeftCol.style.display = 'none';
            if (focusMainArea) focusMainArea.classList.add('center-only');
        } else {
            if (focusLeftCol) focusLeftCol.style.display = 'flex';
            if (focusMainArea) focusMainArea.classList.remove('center-only');
        }

        if (focusDateDisplay) focusDateDisplay.style.display = (isDateNone && isDayNone) ? 'none' : 'block';
        if (focusClockDisplay) focusClockDisplay.style.display = isClockNone ? 'none' : 'block';

        // ポモドーロモードON/OFFでの表示切り替え
        if (this.cfg.pomodoroMode) {
            if (pomoBadgeArea) pomoBadgeArea.style.display = 'block';
            if (focusPomoTimerDisplay) focusPomoTimerDisplay.style.display = 'block';
        } else {
            if (pomoBadgeArea) pomoBadgeArea.style.display = 'none';
            if (focusPomoTimerDisplay) focusPomoTimerDisplay.style.display = 'none';
        }
    },

    updateClock: function() {
        if (!this.cfg || this.cfg.clockFormat === 'none') return;
        const clockEl = document.getElementById('focusClockDisplay');
        const dateEl = document.getElementById('focusDateDisplay');

        const now = new Date();
        const hrs = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');

        if (clockEl) {
            clockEl.textContent = (this.cfg.clockFormat === '12h') ? `${hrs % 12 || 12}:${mins}` : `${String(hrs).padStart(2, '0')}:${mins}`;
        }

        if (dateEl && (this.cfg.dateFormat !== 'none' || this.cfg.dayFormat !== 'none')) {
            let dateStr = "";
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const d = now.getDate();

            if (this.cfg.dateFormat === 'ymd') dateStr = `${y}年${m}月${d}日`;
            else if (this.cfg.dateFormat === 'md') dateStr = `${m}月${d}日`;
            else if (this.cfg.dateFormat === 'd') dateStr = `${d}日`;

            const dayShort = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
            const dayFull = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"][now.getDay()];

            let dayStr = "";
            if (this.cfg.dayFormat === 'paren') dayStr = ` (${dayShort})`;
            else if (this.cfg.dayFormat === 'short') dayStr = ` ${dayShort}曜`;
            else if (this.cfg.dayFormat === 'full') dayStr = ` ${dayFull}`;

            dateEl.textContent = `${dateStr}${dayStr}`.trim();
        }
    },

    updateElapsedTimeUI: function() {
        const totalEl = document.getElementById('focusTotalWorkDisplay');
        const pomoEl = document.getElementById('focusPomoTimerDisplay');

        // 累計作業時間の更新
        const tHrs = Math.floor(this.totalWorkSeconds / 3600);
        const tMins = Math.floor((this.totalWorkSeconds % 3600) / 60);
        const tSecs = this.totalWorkSeconds % 60;

        if (totalEl) {
            totalEl.textContent = (tHrs > 0)
                ? `${tHrs}:${String(tMins).padStart(2, '0')}:${String(tSecs).padStart(2, '0')}`
                : `${tMins}:${String(tSecs).padStart(2, '0')}`;
        }

        // ポモドーロタイマーの更新
        if (this.cfg && this.cfg.pomodoroMode) {
            const badge = document.getElementById('pomoStatusBadge');
            const text = document.getElementById('pomoStatusText');
            if (badge && text) {
                if (this.pomoPhase === 'WORK') {
                    badge.className = 'pomo-status-badge focus-mode';
                    text.textContent = 'FOCUSING';
                } else {
                    badge.className = 'pomo-status-badge break-mode';
                    text.textContent = 'BREAK TIME';
                }
            }

            const pMins = Math.floor(this.pomoRemaining / 60);
            const pSecs = this.pomoRemaining % 60;
            if (pomoEl) {
                pomoEl.textContent = `${String(pMins).padStart(2, '0')}:${String(pSecs).padStart(2, '0')}`;
            }
        }
    },

    updateQuote: function() {
        const quoteEl = document.getElementById('focusQuoteDisplay');
        if (!quoteEl) return;
        if (this.cfg && !this.cfg.showQuote) {
            quoteEl.style.display = 'none';
            return;
        }
        quoteEl.style.display = 'block';
        if (window.WorkQuotes) {
            quoteEl.innerHTML = window.WorkQuotes.getRandomFormattedQuote();
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
            if (audioPlayer && audioPlayer.src) {
                const savedVol = localStorage.getItem('player_volume') ? (parseFloat(localStorage.getItem('player_volume')) / 100) : 1.0;
                audioPlayer.volume = savedVol;
                this.isMusicFadingOut = false;
                audioPlayer.play().catch(() => {});
            }
        }
    },

    openHelpModal: function() {
        this.isHelpOpen = true; 
        const modal = document.getElementById('focusHelpModal');
        if (modal) modal.classList.add('show');
        
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer) audioPlayer.pause();
    },

    closeHelpModal: function() {
        this.isHelpOpen = false;
        const modal = document.getElementById('focusHelpModal');
        if (modal) modal.classList.remove('show');
        
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer && audioPlayer.src && !this.isPaused) {
            audioPlayer.play().catch(() => {});
        }
    },

    stopSession: function() {
        this.isFocusActive = false;
        this.isPaused = false;
        this.isHelpOpen = false;
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