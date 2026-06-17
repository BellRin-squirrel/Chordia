(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.PlayerController = {
        lastMiniPushTime: 0, 

        init: function() {
            this.audio = document.getElementById('mainAudio');
            this.seekBar = document.getElementById('hpSeekBar');
            this.volumeBar = document.getElementById('volumeBar');

            if (this.volumeBar) {
                const savedVolume = localStorage.getItem('player_volume');
                const initialVolume = (savedVolume !== null) ? parseFloat(savedVolume) : 100;
                this.volumeBar.value = initialVolume;
                this.setVolume(initialVolume);

                this.volumeBar.oninput = (e) => {
                    const val = parseFloat(e.target.value);
                    this.setVolume(val);
                    localStorage.setItem('player_volume', val);
                };
            }

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
                            if (curEl) curEl.textContent = u.formatTime(curr);
                            if (totEl) totEl.textContent = u.formatTime(dur);
                            
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
                });
                this.updateSeekColor(0);
            }

            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
                    e.preventDefault(); e.stopPropagation();
                    const searchBox = document.getElementById('playlistLocalSearch');
                    if (searchBox) searchBox.focus();
                    return;
                }

                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                
                let handled = true;

                if (e.code === 'Space' || e.code === 'KeyK') {
                    if (e.shiftKey) {
                        this.stopPlayback(); 
                    } else if (s.queue.length > 0) {
                        this.togglePlayPause();
                    }
                } else if (e.code === 'ArrowRight') {
                    this.nextSong();
                } else if (e.code === 'ArrowLeft') {
                    this.prevSong();
                } else if (e.code === 'KeyL') {
                    if (window.HeaderController) window.HeaderController.openQueueLyricsModal('tab-current-lyrics');
                } else if (e.code === 'KeyQ') {
                    if (window.HeaderController) window.HeaderController.openQueueLyricsModal('tab-nextup');
                } else if (e.code === 'KeyH') {
                    if (window.HeaderController) window.HeaderController.openQueueLyricsModal('tab-history');
                } else if (e.code === 'KeyR') {
                    const btn = document.getElementById('btnLoopToggle');
                    if (btn) btn.click();
                } else if (e.code === 'KeyS') {
                    const btn = document.getElementById('btnShuffleToggle');
                    if (btn) btn.click();
                } else if (e.code === 'KeyV') {
                    if (e.shiftKey) {
                        const btn = document.getElementById('btnShuffleAll');
                        if (btn) btn.click();
                    } else {
                        const btn = document.getElementById('btnPlayAll');
                        if (btn) btn.click();
                    }
                } else if (e.code === 'KeyE') {
                    const btn = document.getElementById('btnEditRules');
                    if (btn && btn.style.display !== 'none') btn.click();
                } else if (e.altKey && e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                    if (window.SidebarController) {
                        const views = ['playlist', 'album', 'artist'];
                        let idx = views.indexOf(window.SidebarController.currentView);
                        if (e.code === 'ArrowUp') idx = (idx - 1 + views.length) % views.length;
                        else idx = (idx + 1) % views.length;
                        const opt = document.querySelector(`.custom-option[data-value="${views[idx]}"]`);
                        if (opt) opt.click();
                    }
                } else if (e.altKey && !e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                    const items = Array.from(document.querySelectorAll('#playlistList .playlist-item'));
                    const activeIdx = items.findIndex(item => item.classList.contains('active'));
                    if (items.length > 0) {
                        let nextIdx = 0;
                        if (activeIdx !== -1) {
                            if (e.code === 'ArrowUp') nextIdx = (activeIdx - 1 + items.length) % items.length;
                            else nextIdx = (activeIdx + 1) % items.length;
                        }
                        items[nextIdx].click();
                        items[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }
                } else {
                    handled = false;
                }

                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (document.activeElement) document.activeElement.blur();
                }
            });

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
                        }
                    } catch(err) { console.error(err); }
                }
            });
        },

        generateSection: function(isShuffle) {
            if (isShuffle) {
                return u.shuffleArray([...s.originalList]);
            } else {
                return [...s.originalList];
            }
        },

        handleSortChanged: function(songs, sortBy, sortDesc) {
            s.originalList = [...u.sortSongs(songs, sortBy, sortDesc)];
            if (!s.isShuffle && s.queue.length > 0 && s.currentIndex >= 0) {
                const currentSong = s.queue[s.currentIndex];
                s.queue = [...s.originalList];
                const newIndex = s.queue.findIndex(song => song.musicFilename === currentSong.musicFilename);
                if (newIndex !== -1) {
                    s.currentIndex = newIndex;
                } else {
                    s.currentIndex = 0; 
                }
                this.pushStateToMini(true);
            }
        },

        pushStateToMini: function(force = false) {
            if (!this.audio) return;
            let displayQueue = [];
            if (s.loopMode !== 'one') {
                displayQueue = s.queue.slice(s.currentIndex + 1, s.currentIndex + 52);
            }
            const state = {
                song: s.queue[s.currentIndex] || null,
                isPlaying: s.isPlaying,
                currentTime: this.audio.currentTime,
                duration: this.audio.duration,
                queue: displayQueue
            };
            localStorage.setItem('mini_player_state', JSON.stringify(state));
        },

        setVolume: function(val) {
            if (this.audio) {
                const normalized = val / 100;
                this.audio.volume = normalized;
                if (this.volumeBar) {
                    this.volumeBar.style.background = `linear-gradient(to right, var(--primary-color) ${val}%, rgba(128,128,128,0.2) ${val}%)`;
                }
            }
        },

        startPlaybackSession: function(mode, startIndex = 0) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            if (!targetPl || !targetPl.songs) return;

            document.getElementById('headerLogo').style.display = 'none';
            document.getElementById('headerPlayerInfo').style.display = 'flex';
            document.getElementById('headerControls').style.display = 'flex';

            const sortedList = u.sortSongs(targetPl.songs, targetPl.sortBy, targetPl.sortDesc);
            s.originalList = [...sortedList];

            if (mode === 'shuffle') {
                s.isShuffle = true;
                s.queue = this.generateSection(true);
                s.currentIndex = 0;
            } else {
                s.isShuffle = false;
                s.queue = this.generateSection(false);
                s.currentIndex = startIndex;
            }
            
            if (window.HeaderController) {
                window.HeaderController.updateToggleButtons();
            }
            
            this.playCurrentIndex();
        },

        playCurrentIndex: function() {
            if (s.queue.length === 0 || s.currentIndex < 0) return;
            const song = s.queue[s.currentIndex];
            
            if (!song || !song.streamUrl) {
                u.showToast("再生可能なファイルが見つかりません", true);
                return;
            }

            this.audio.pause();
            this.audio.src = song.streamUrl;
            this.audio.load();

            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    s.isPlaying = true;
                    if (window.HeaderController) window.HeaderController.updatePlayIcons(true);
                    this.afterPlayStarted(song);
                }).catch(e => {
                    console.error("Playback failed:", e);
                    s.isPlaying = false;
                    if (window.HeaderController) window.HeaderController.updatePlayIcons(false);
                    u.showToast("再生に失敗しました", true);
                });
            }
        },

        // ★ 修正: キューから直接飛ぶ関数
        skipToQueueIndex: function(index) {
            if (index >= 0 && index < s.queue.length) {
                s.currentIndex = index;
                this.playCurrentIndex();
            }
        },

        afterPlayStarted: function(song) {
            if (window.HeaderController) window.HeaderController.updateHeaderUI(song);
            if (window.MainViewController) window.MainViewController.renderMainView(); 
            
            setTimeout(async () => {
                try {
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    await invoke("record_playback", { song: song });
                } catch(e) { console.error("History record failed:", e); }

                this.pushStateToMini(true);
            }, 10);
        },

        togglePlayPause: function() {
            if (s.queue.length === 0 || !this.audio || !this.audio.src) return;
            if (this.audio.paused) {
                this.audio.play().then(() => {
                    s.isPlaying = true;
                    if (window.HeaderController) window.HeaderController.updatePlayIcons(true);
                    this.pushStateToMini(true);
                });
            } else {
                this.audio.pause();
                s.isPlaying = false;
                if (window.HeaderController) window.HeaderController.updatePlayIcons(false);
                this.pushStateToMini(true);
            }
            if (window.MainViewController) window.MainViewController.renderMainView();
        },

        stopPlayback: function() {
            if (!this.audio) return;
            this.audio.pause();
            this.audio.src = ""; 
            this.audio.currentTime = 0;
            s.isPlaying = false;
            
            s.queue = [];
            s.currentIndex = -1;

            const info = document.getElementById('headerPlayerInfo');
            const ctrl = document.getElementById('headerControls');
            const logo = document.getElementById('headerLogo');
            if (info) info.style.display = 'none';
            if (ctrl) ctrl.style.display = 'none';
            if (logo) logo.style.display = 'flex';

            if (window.HeaderController) window.HeaderController.updatePlayIcons(false);
            if (window.MainViewController) window.MainViewController.renderMainView();
            this.pushStateToMini(true); 
        },

        nextSong: function() {
            if (!this.audio) return;
            if (s.loopMode === 'one') {
                this.audio.currentTime = 0;
                this.audio.play();
                return;
            }
            if (s.currentIndex >= s.queue.length - 1) {
                if (s.loopMode === 'all') {
                    s.queue = this.generateSection(s.isShuffle);
                    s.currentIndex = 0;
                    this.playCurrentIndex();
                } else {
                    this.stopPlayback();
                }
            } else {
                s.currentIndex++;
                this.playCurrentIndex();
            }
        },

        prevSong: function() {
            if (!this.audio) return;
            if (this.audio.currentTime > 3) {
                this.audio.currentTime = 0;
                this.pushStateToMini(true); 
                return;
            }
            if (s.loopMode === 'one') {
                this.audio.currentTime = 0;
                this.pushStateToMini(true);
                return;
            }
            if (s.currentIndex > 0) {
                s.currentIndex--;
                this.playCurrentIndex();
            } else {
                if (s.loopMode === 'all') {
                    s.queue = this.generateSection(s.isShuffle);
                    s.currentIndex = s.queue.length - 1;
                    this.playCurrentIndex();
                } else {
                    this.audio.currentTime = 0;
                    this.pushStateToMini(true);
                }
            }
        },

        isSongPlaying: function(song) {
            if (s.queue.length === 0 || s.currentIndex < 0) return false;
            const currentSong = s.queue[s.currentIndex];
            if (!currentSong) return false;
            return currentSong.musicFilename === song.musicFilename;
        },
        
        syncShuffle: function() {},
        
        updateSeekColor: function(p) {
            if (this.seekBar) {
                this.seekBar.style.background = `linear-gradient(to right, var(--primary-color) ${p}%, rgba(128,128,128,0.2) ${p}%)`;
            }
        }
    };
})();