(function() {
    const s = window.PlayerState;

    Object.assign(window.PlayerController, {
        init: function() {
            this.audio = document.getElementById('mainAudio');
            this.seekBar = document.getElementById('hpSeekBar');
            this.volumeBar = document.getElementById('volumeBar');

            if (this.audio) {
                this.audio.crossOrigin = "anonymous";
            }

            // 音量バー初期化
            if (this.volumeBar) {
                const savedVolume = localStorage.getItem('player_volume');
                const initialVolume = (savedVolume !== null) ? parseFloat(savedVolume) : 100;
                this.volumeBar.value = initialVolume;
                this.userVolume = initialVolume / 100;
                this.applyVolume();

                this.volumeBar.style.background = `linear-gradient(to right, var(--primary-color) ${initialVolume}%, rgba(128,128,128,0.2) ${initialVolume}%)`;

                this.volumeBar.oninput = (e) => {
                    const val = parseFloat(e.target.value);
                    this.userVolume = val / 100;
                    this.applyVolume();
                    localStorage.setItem('player_volume', val);
                    this.volumeBar.style.background = `linear-gradient(to right, var(--primary-color) ${val}%, rgba(128,128,128,0.2) ${val}%)`;
                };
            }

            this.initAirPlay();
            this.initControlsAndAudioListeners();
            this.initKeyboardShortcuts();
            this.initStorageListeners();
        },

        initControlsAndAudioListeners: function() {
            const btnPlayPause = document.getElementById('hdrBtnPlayPause');
            if (btnPlayPause) btnPlayPause.addEventListener('click', () => this.togglePlayPause());
            
            const btnNext = document.getElementById('hdrBtnNext');
            if (btnNext) btnNext.addEventListener('click', () => this.nextSong());
            
            const btnPrev = document.getElementById('hdrBtnPrev');
            if (btnPrev) btnPrev.addEventListener('click', () => this.prevSong());
            
            const btnStop = document.getElementById('hdrBtnStop');
            if (btnStop) btnStop.addEventListener('click', () => this.stopPlayback());

            if (this.audio) {
                this.audio.addEventListener('ended', () => this.nextSong());
                this.audio.addEventListener('timeupdate', () => {
                    if (!s.isSeeking) {
                        const curr = this.audio.currentTime;
                        const dur = this.audio.duration;
                        if (dur) {
                            const ratio = curr / dur;
                            if (this.seekBar) {
                                this.seekBar.value = ratio * 1000;
                                this.updateSeekColor(ratio * 100);
                            }
                            const curEl = document.getElementById('hpTimeCurrent');
                            const totEl = document.getElementById('hpTimeTotal');
                            if (curEl) curEl.textContent = window.PlayerUtils.formatTime(curr);
                            if (totEl) totEl.textContent = window.PlayerUtils.formatTime(dur);
                            
                            const now = Date.now();
                            if (now - this.lastMiniPushTime > 500) {
                                this.pushStateToMini();
                                this.lastMiniPushTime = now;
                            }
                        }
                    }
                });
            }

            if (this.seekBar) {
                this.seekBar.addEventListener('mousedown', () => s.isSeeking = true);
                this.seekBar.addEventListener('input', () => this.updateSeekColor(this.seekBar.value / 10));
                this.seekBar.addEventListener('change', () => {
                    if (this.audio && this.audio.duration) {
                        this.audio.currentTime = (this.seekBar.value / 1000) * this.audio.duration;
                    }
                    s.isSeeking = false;
                    this.pushStateToMini(true); 
                    this.sendNowPlayingUpdate();
                });
                this.updateSeekColor(0);
            }

            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.setActionHandler('play', () => this.togglePlayPause());
                    navigator.mediaSession.setActionHandler('pause', () => this.togglePlayPause());
                    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevSong());
                    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSong());
                    navigator.mediaSession.setActionHandler('stop', () => this.stopPlayback());
                } catch (e) {
                    console.error("MediaSession handler error:", e);
                }
            }
        },

        initKeyboardShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
                    e.preventDefault(); e.stopPropagation();
                    const searchBox = document.getElementById('playlistLocalSearch');
                    if (searchBox) searchBox.focus();
                    return;
                }

                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                
                let handled = true;
                switch (e.code) {
                    case 'Space':
                        e.preventDefault();
                        if (e.shiftKey) this.stopPlayback();
                        else this.togglePlayPause();
                        break;
                    case 'KeyS':
                        s.isShuffle = !s.isShuffle;
                        this.syncShuffle();
                        if (window.HeaderController) window.HeaderController.updateToggleButtons();
                        this.sendNowPlayingUpdate();
                        break;
                    case 'KeyR':
                        if (s.loopMode === 'off') s.loopMode = 'all';
                        else if (s.loopMode === 'all') s.loopMode = 'one';
                        else s.loopMode = 'off';
                        if (window.HeaderController) window.HeaderController.updateToggleButtons();
                        this.sendNowPlayingUpdate();
                        break;
                    case 'ArrowRight':
                        this.nextSong();
                        break;
                    case 'ArrowLeft':
                        this.prevSong();
                        break;
                    default:
                        handled = false;
                }
                if (handled) {
                    e.preventDefault(); e.stopPropagation();
                    if (document.activeElement) document.activeElement.blur();
                }
            });
        },

        initStorageListeners: function() {
            window.addEventListener('storage', (e) => {
                if (e.key === 'mini_player_command' && e.newValue) {
                    try {
                        const cmd = JSON.parse(e.newValue);
                        if (cmd.action === 'togglePlayPause') this.togglePlayPause();
                        else if (cmd.action === 'nextSong') this.nextSong();
                        else if (cmd.action === 'prevSong') this.prevSong();
                        else if (cmd.action === 'stopPlayback') this.stopPlayback();
                        else if (cmd.action === 'seek' && this.audio && this.audio.duration) {
                            this.audio.currentTime = cmd.value * this.audio.duration;
                            this.pushStateToMini(true);
                            this.sendNowPlayingUpdate();
                        }
                    } catch(err) { console.error(err); }
                } else if (e.key === 'chordia_equalizer_update' || e.key === 'chordia_equalizer_settings') {
                    this.applyEqualizerSettings();
                }
            });

            window.addEventListener('beforeunload', () => {
                this.stopNowPlayingSyncTimer();
            });
        },

        updateSeekColor: function(p) {
            if (this.seekBar) {
                this.seekBar.style.background = `linear-gradient(to right, var(--primary-color) ${p}%, rgba(128,128,128,0.2) ${p}%)`;
            }
        }
    });
})();