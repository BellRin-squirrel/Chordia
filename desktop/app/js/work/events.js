(function() {
    Object.assign(window.WorkFocus, {
        init: function() {
            const audioPlayer = document.getElementById('workAudioPlayer');
            if (audioPlayer) {
                audioPlayer.addEventListener('ended', () => {
                    if (this.cfg && this.cfg.pomodoroMode) {
                        if (this.isSamePlaylist()) {
                            if (this.workQueue.length > 0) {
                                const nextIdx = ((this.pomoPhase === 'WORK' ? this.workIndex : this.breakIndex) + 1) % this.workQueue.length;
                                this.workIndex = nextIdx;
                                this.breakIndex = nextIdx;
                                this.workProgressSec = 0;
                                this.breakProgressSec = 0;
                                this.playCurrentPhaseSong();
                            }
                        } else {
                            if (this.pomoPhase === 'WORK' && this.workQueue.length > 0) {
                                this.workIndex = (this.workIndex + 1) % this.workQueue.length;
                                this.workProgressSec = 0;
                                this.playCurrentPhaseSong();
                            } else if (this.pomoPhase === 'BREAK' && this.breakQueue.length > 0) {
                                this.breakIndex = (this.breakIndex + 1) % this.breakQueue.length;
                                this.breakProgressSec = 0;
                                this.playCurrentPhaseSong();
                            }
                        }
                    } else {
                        if (this.normalQueue.length > 0) {
                            this.normalIndex = (this.normalIndex + 1) % this.normalQueue.length;
                            this.playCurrentPhaseSong();
                        }
                    }
                });
                
                audioPlayer.addEventListener('timeupdate', () => {
                    if (this.cfg && this.cfg.pomodoroMode && !this.isMusicFadingOut) {
                        if (this.isSamePlaylist()) {
                            this.workProgressSec = audioPlayer.currentTime;
                            this.breakProgressSec = audioPlayer.currentTime;
                        } else {
                            if (this.pomoPhase === 'WORK') {
                                this.workProgressSec = audioPlayer.currentTime;
                            } else {
                                this.breakProgressSec = audioPlayer.currentTime;
                            }
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
                    await this.saveWorkSession();
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
                    await this.saveWorkSession();
                    this.stopSession();
                    
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    try {
                        await invoke('close_work_window');
                    } catch (err) {
                        window.close();
                    }
                });
            }

            window.addEventListener('beforeunload', () => {
                this.saveWorkSession();
            });
        },

        saveWorkSession: async function() {
            if (this.hasRecordedWorkSession) return;
            if (this.totalWorkSeconds <= 0) return;
            this.hasRecordedWorkSession = true;

            const seconds = this.totalWorkSeconds;
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;

            let timeStr = "";
            if (hrs > 0) {
                timeStr = (mins > 0) ? `${hrs}時間${mins}分` : `${hrs}時間`;
            } else if (mins > 0) {
                timeStr = `${mins}分`;
            } else {
                timeStr = `${secs}秒`;
            }

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                await invoke("record_work_session", { time: timeStr, seconds: seconds });
            } catch (err) {
                console.error("Failed to record work session:", err);
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
                if (this.currentAlarmAudio) this.currentAlarmAudio.pause();

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
                
                if (this.isAlarmPlaying && this.currentAlarmAudio) {
                    this.currentAlarmAudio.play().catch(() => {});
                } else if (audioPlayer && audioPlayer.src) {
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
            if (this.currentAlarmAudio) this.currentAlarmAudio.pause();
        },

        closeHelpModal: function() {
            this.isHelpOpen = false;
            const modal = document.getElementById('focusHelpModal');
            if (modal) modal.classList.remove('show');
            
            if (this.isAlarmPlaying && this.currentAlarmAudio && !this.isPaused) {
                this.currentAlarmAudio.play().catch(() => {});
            } else {
                const audioPlayer = document.getElementById('workAudioPlayer');
                if (audioPlayer && audioPlayer.src && !this.isPaused) {
                    audioPlayer.play().catch(() => {});
                }
            }
        }
    });
})();
