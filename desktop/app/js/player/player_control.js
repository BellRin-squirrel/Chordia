(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.PlayerController = {
        lastMiniPushTime: 0,
        userVolume: 1.0,
        _nowPlayingTimer: null,
        _isSendingNowPlaying: false,

        init: function() {
            this.audio = document.getElementById('mainAudio');
            this.seekBar = document.getElementById('hpSeekBar');
            this.volumeBar = document.getElementById('volumeBar');

            if (this.audio) {
                this.audio.crossOrigin = "anonymous";
            }

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
                }
            });

            window.addEventListener('beforeunload', () => {
                this.stopNowPlayingSyncTimer();
            });
        },

        initAirPlay: function() {
            const btnAirPlay = document.getElementById('btnAirPlay');
            const audio = document.getElementById('mainAudio');
            const menu = document.getElementById('airplayDeviceMenu');

            if (!btnAirPlay || !audio) return;

            document.addEventListener('click', (e) => {
                if (menu && !e.target.closest('#btnAirPlay') && !e.target.closest('#airplayDeviceMenu')) {
                    menu.style.display = 'none';
                }
            });

            btnAirPlay.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (menu && menu.style.display === 'block') {
                    menu.style.display = 'none';
                    return;
                }

                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const isMac = navigator.userAgent.includes('Mac');
                const list = menu.querySelector('ul');
                if (!list) return;

                list.innerHTML = '';

                const liSound = document.createElement('li');
                liSound.innerHTML = `<span>サウンド設定を開く</span>`;
                liSound.onclick = async (ev) => {
                    ev.stopPropagation();
                    try {
                        await invoke("open_sound_settings");
                    } catch(err) {
                        console.error(err);
                    }
                    menu.style.display = 'none';
                };
                list.appendChild(liSound);

                const liDevices = document.createElement('li');
                if (isMac) {
                    liDevices.innerHTML = `<span>AirPlay対応機器一覧</span>`;
                } else {
                    liDevices.innerHTML = `<span>出力デバイスを変更</span>`;
                }
                
                liDevices.onclick = async (ev) => {
                    ev.stopPropagation();
                    
                    const hadNoSrc = !audio.src;
                    if (hadNoSrc) {
                        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
                    }

                    if (typeof audio.webkitShowPlaybackTargetPicker === 'function') {
                        try {
                            audio.webkitShowPlaybackTargetPicker();
                        } catch (err) {
                            console.warn("webkitShowPlaybackTargetPicker failed:", err);
                        }
                        menu.style.display = 'none';
                        return;
                    }

                    if (navigator.mediaDevices && typeof navigator.mediaDevices.selectAudioOutput === 'function') {
                        try {
                            const device = await navigator.mediaDevices.selectAudioOutput();
                            if (device && typeof audio.setSinkId === 'function') {
                                await audio.setSinkId(device.deviceId);
                                u.showToast(`出力先: ${device.label || '選択されたデバイス'}`);
                                btnAirPlay.classList.add('active');
                                if (hadNoSrc && !s.isPlaying) audio.src = "";
                            }
                        } catch (err) {
                            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                                console.warn("selectAudioOutput error:", err);
                            }
                        }
                        menu.style.display = 'none';
                        return;
                    }

                    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
                        try {
                            let devices = await navigator.mediaDevices.enumerateDevices();
                            let audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                            if (audioOutputs.length > 0 && !audioOutputs[0].label) {
                                try {
                                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                    stream.getTracks().forEach(track => track.stop());
                                    devices = await navigator.mediaDevices.enumerateDevices();
                                    audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                                } catch(e) {}
                            }

                            if (audioOutputs.length > 0) {
                                window.PlayerController.showAudioDeviceMenu(audioOutputs, btnAirPlay, menu, audio);
                                return;
                            }
                        } catch (err) {
                            console.error("enumerateDevices error:", err);
                        }
                    }

                    window.PlayerController.showAudioDeviceMenu([
                        { deviceId: 'default', label: 'システム既定のスピーカー / 出力' }
                    ], btnAirPlay, menu, audio);
                };
                list.appendChild(liDevices);

                menu.style.display = 'block';
            });
        },

        showAudioDeviceMenu: function(devices, btn, menu, audio) {
            if (!menu) return;
            const list = menu.querySelector('ul');
            if (!list) return;

            list.innerHTML = '';
            const currentSinkId = (typeof audio.sinkId === 'string') ? audio.sinkId : 'default';

            devices.forEach((dev, idx) => {
                const li = document.createElement('li');
                const label = dev.label || `オーディオ出力 ${idx + 1}`;
                const isSelected = (dev.deviceId === currentSinkId) || (currentSinkId === '' && idx === 0) || (currentSinkId === 'default' && dev.deviceId === 'default');
                
                if (isSelected) li.classList.add('selected');
                
                li.innerHTML = `
                    <span>${u.escapeHtml(label)}</span>
                    ${isSelected ? '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                `;

                li.onclick = async () => {
                    try {
                        if (typeof audio.setSinkId === 'function') {
                            await audio.setSinkId(dev.deviceId);
                            u.showToast(`出力先を変更しました: ${label}`);
                            btn.classList.add('active');
                        } else {
                            u.showToast(`出力先を選択しました: ${label}`);
                        }
                    } catch (err) {
                        console.error("setSinkId error:", err);
                        u.showToast("出力先の変更に失敗しました", true);
                    }
                    menu.style.display = 'none';
                };

                list.appendChild(li);
            });

            menu.style.display = 'block';
        },

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
                this.sendNowPlayingUpdate();
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

        startPlaybackSession: function(mode, startIndex = 0) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            if (!targetPl || !targetPl.songs) return;

            s.activeSessionInfo = {
                playlistID: isVirtual ? (s.currentVirtualField || "album") : (targetPl.id || "normal"),
                playlistName: isVirtual ? (s.currentVirtualName || "Untitled") : (targetPl.playlistName || "Untitled")
            };

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
                    this.applyVolume();

                    s.isPlaying = true;
                    if (window.HeaderController) window.HeaderController.updatePlayIcons(true);
                    this.afterPlayStarted(song);
                    this.startNowPlayingSyncTimer();
                }).catch(e => {
                    console.error("Playback failed:", e);
                    s.isPlaying = false;
                    if (window.HeaderController) window.HeaderController.updatePlayIcons(false);
                    this.stopNowPlayingSyncTimer();
                    u.showToast("再生に失敗しました", true);
                });
            }
        },

        skipToQueueIndex: function(index) {
            if (index >= 0 && index < s.queue.length) {
                s.currentIndex = index;
                this.playCurrentIndex();
            }
        },

        afterPlayStarted: function(song) {
            if (window.HeaderController) window.HeaderController.updateHeaderUI(song);
            if (window.MainViewController) window.MainViewController.renderMainView(); 
            
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.title || 'Unknown Title',
                    artist: song.artist || 'Unknown Artist',
                    album: song.album || '',
                    artwork: [
                        { src: song.imageData || s.DEFAULT_ICON, sizes: '256x256', type: 'image/png' }
                    ]
                });
                navigator.mediaSession.playbackState = 'playing';
            }

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
                    this.startNowPlayingSyncTimer();
                    
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = 'playing';
                    }
                });
            } else {
                this.audio.pause();
                s.isPlaying = false;
                if (window.HeaderController) window.HeaderController.updatePlayIcons(false);
                this.pushStateToMini(true);
                this.stopNowPlayingSyncTimer();
                
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = 'paused';
                }
            }
            if (window.MainViewController) window.MainViewController.renderMainView();
        },

        stopPlayback: function() {
            this.stopNowPlayingSyncTimer();
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
            
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'none';
            }
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
        
        syncShuffle: function() {
            if (s.originalList.length === 0) return;
            if (s.isShuffle) {
                const currentSong = s.queue[s.currentIndex];
                const rest = s.originalList.filter(song => !currentSong || song.musicFilename !== currentSong.musicFilename);
                const shuffledRest = u.shuffleArray([...rest]);
                if (currentSong) {
                    s.queue = [currentSong, ...shuffledRest];
                    s.currentIndex = 0;
                } else {
                    s.queue = u.shuffleArray([...s.originalList]);
                    s.currentIndex = 0;
                }
            } else {
                const currentSong = s.queue[s.currentIndex];
                s.queue = [...s.originalList];
                if (currentSong) {
                    const newIdx = s.queue.findIndex(song => song.musicFilename === currentSong.musicFilename);
                    s.currentIndex = (newIdx !== -1) ? newIdx : 0;
                }
            }
            this.pushStateToMini(true);
        },

        startNowPlayingSyncTimer: function() {
            this.stopNowPlayingSyncTimer();
            this.sendNowPlayingUpdate();

            this._nowPlayingTimer = setInterval(() => {
                if (s.isPlaying && this.audio && !this.audio.paused && s.currentIndex >= 0) {
                    this.sendNowPlayingUpdate();
                }
            }, 1000);
        },

        stopNowPlayingSyncTimer: function() {
            if (this._nowPlayingTimer) {
                clearInterval(this._nowPlayingTimer);
                this._nowPlayingTimer = null;
            }
            this._isSendingNowPlaying = false;
        },

        sendNowPlayingUpdate: async function() {
            if (this._isSendingNowPlaying) return;
            if (!s.isPlaying || !this.audio || this.audio.paused || s.currentIndex < 0) return;
            const currentSong = s.queue[s.currentIndex];
            if (!currentSong) return;

            const sessionInfo = s.activeSessionInfo || {
                playlistID: "normal",
                playlistName: "Untitled"
            };

            const musiclist = s.queue.map(song => ({
                title: song.title || "Unknown",
                artist: song.artist || "Unknown",
                album: song.album || ""
            }));

            const payload = {
                playlistID: sessionInfo.playlistID,
                playlistName: sessionInfo.playlistName,
                shuffle: Boolean(s.isShuffle),
                loop: Boolean(s.loopMode !== 'off'),
                musiclist: musiclist,
                nowPlayingTitle: currentSong.title || "Unknown",
                nowPlayingArtist: currentSong.artist || "Unknown",
                nowPlayingAlbum: currentSong.album || "",
                nowPlayingTime: Math.floor(this.audio.currentTime || 0)
            };

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            this._isSendingNowPlaying = true;

            try {
                await invoke("send_now_playing_to_cloud", { payload: payload });
            } catch(e) {
                console.warn("[Chordia Sync] sendNowPlayingUpdate error:", e);
            } finally {
                this._isSendingNowPlaying = false;
            }
        },
        
        updateSeekColor: function(p) {
            if (this.seekBar) {
                this.seekBar.style.background = `linear-gradient(to right, var(--primary-color) ${p}%, rgba(128,128,128,0.2) ${p}%)`;
            }
        },

        // ========================================================
        // ★ Chordia Relay 引き継ぎ再生ハンドラ
        // ========================================================
        handleRelayHandover: async function(relayData) {
            if (!relayData || !relayData.handover) return;
            const now = relayData.handover;
            const targetTitle = (now.nowPlayingTitle || "").trim().toLowerCase();
            const targetArtist = (now.nowPlayingArtist || "").trim().toLowerCase();
            const targetAlbum = (now.nowPlayingAlbum || "").trim().toLowerCase();
            const plId = now.playlistID || "";
            const plName = (now.playlistName || "").trim();
            const startTime = parseFloat(now.nowPlayingTime) || 0;

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

            // 1. 全ライブラリがロードされていなければロード
            if (!s.fullLibrary) {
                try {
                    s.fullLibrary = await invoke("get_library_chunk", {
                        page: 1, limit: 0, sortField: null, sortDesc: false, searchQuery: "", advancedConditions: null
                    });
                } catch(e) {}
            }

            // 2. プレイリスト / アルバム / アーティストの特定と選択
            let targetPlIndex = -1;
            if (plId === "album") {
                if (window.SidebarController) {
                    window.SidebarController.currentView = 'album';
                    const displayVal = document.getElementById('customSelectValue');
                    if (displayVal) displayVal.textContent = window.i18n ? window.i18n.t('Player.select_album') : "アルバム";
                    await window.SidebarController.selectVirtualPlaylist('album', plName);
                }
            } else if (plId === "artist") {
                if (window.SidebarController) {
                    window.SidebarController.currentView = 'artist';
                    const displayVal = document.getElementById('customSelectValue');
                    if (displayVal) displayVal.textContent = window.i18n ? window.i18n.t('Player.select_artist') : "アーティスト";
                    await window.SidebarController.selectVirtualPlaylist('artist', plName);
                }
            } else {
                targetPlIndex = s.playlists.findIndex(p => p.id === plId || (p.playlistName && p.playlistName.trim() === plName));
                if (targetPlIndex !== -1 && window.MainViewController) {
                    if (window.SidebarController) {
                        window.SidebarController.currentView = 'playlist';
                        const displayVal = document.getElementById('customSelectValue');
                        if (displayVal) displayVal.textContent = window.i18n ? window.i18n.t('Player.select_playlist') : "プレイリスト";
                    }
                    await window.MainViewController.selectPlaylist(targetPlIndex);
                }
            }

            // 3. 対象プレイリストの楽曲リストを取得し、元の全曲ソート順リスト（originalList）を保持
            const isVirtual = s.currentPlaylistType === 'virtual';
            const currentPl = isVirtual ? s.currentVirtualPlaylist : (targetPlIndex !== -1 ? s.playlists[targetPlIndex] : null);
            let poolSongs = currentPl && currentPl.songs && currentPl.songs.length > 0 ? currentPl.songs : (s.fullLibrary || []);
            const sortedOriginal = currentPl ? u.sortSongs(poolSongs, currentPl.sortBy || 'title', currentPl.sortDesc || false) : [...poolSongs];
            s.originalList = [...sortedOriginal];

            // 4. ローカル楽曲プールからタイトル・アーティスト・アルバムで楽曲オブジェクトを探す関数
            const findSongObject = (mItem) => {
                if (!mItem) return null;
                const t = (mItem.title || "").trim().toLowerCase();
                const a = (mItem.artist || "").trim().toLowerCase();
                const al = (mItem.album || "").trim().toLowerCase();

                // 優先度1: タイトル + アーティスト + アルバム
                let found = poolSongs.find(song => {
                    const sT = (song.title || "").trim().toLowerCase();
                    const sA = (song.artist || "").trim().toLowerCase();
                    const sAl = (song.album || "").trim().toLowerCase();
                    return sT === t && (!a || sA === a) && (!al || sAl === al);
                });
                if (found) return found;

                // 優先度2: タイトル + アーティスト
                found = poolSongs.find(song => {
                    const sT = (song.title || "").trim().toLowerCase();
                    const sA = (song.artist || "").trim().toLowerCase();
                    return sT === t && (!a || sA === a);
                });
                if (found) return found;

                // 優先度3: タイトルのみ
                found = poolSongs.find(song => (song.title || "").trim().toLowerCase() === t);
                if (found) return found;

                // 優先度4: fullLibrary 全体からフォールバック検索
                if (poolSongs !== s.fullLibrary && s.fullLibrary) {
                    found = s.fullLibrary.find(song => {
                        const sT = (song.title || "").trim().toLowerCase();
                        const sA = (song.artist || "").trim().toLowerCase();
                        const sAl = (song.album || "").trim().toLowerCase();
                        return sT === t && (!a || sA === a) && (!al || sAl === al);
                    });
                    if (found) return found;
                    found = s.fullLibrary.find(song => {
                        const sT = (song.title || "").trim().toLowerCase();
                        const sA = (song.artist || "").trim().toLowerCase();
                        return sT === t && (!a || sA === a);
                    });
                    if (found) return found;
                    found = s.fullLibrary.find(song => (song.title || "").trim().toLowerCase() === t);
                    if (found) return found;
                }

                return null;
            };

            // 5. ★ 渡された musiclist の順序通りに再生キュー（s.queue）を構築
            let handoverQueue = [];
            if (Array.isArray(now.musiclist) && now.musiclist.length > 0) {
                handoverQueue = now.musiclist.map(mItem => findSongObject(mItem)).filter(Boolean);
            }

            // 6. nowPlayingTitle, nowPlayingArtist, nowPlayingAlbum に合致する楽曲を特定
            const targetNowItem = {
                title: now.nowPlayingTitle,
                artist: now.nowPlayingArtist,
                album: now.nowPlayingAlbum
            };
            let targetSong = findSongObject(targetNowItem);

            if (!targetSong && handoverQueue.length > 0) {
                targetSong = handoverQueue[0];
            }

            if (!targetSong) {
                u.showToast("引き継ぎ対象の楽曲がライブラリに見つかりませんでした", true);
                return;
            }

            // 7. handoverQueue 内での対象楽曲の位置（currentIndex）を特定
            let currentIdxInQueue = -1;
            if (handoverQueue.length > 0) {
                currentIdxInQueue = handoverQueue.findIndex(song => song.musicFilename === targetSong.musicFilename);
                if (currentIdxInQueue === -1) {
                    currentIdxInQueue = handoverQueue.findIndex(song => {
                        const sT = (song.title || "").trim().toLowerCase();
                        const sA = (song.artist || "").trim().toLowerCase();
                        return sT === targetTitle && (!targetArtist || sA === targetArtist);
                    });
                }
            }

            if (handoverQueue.length === 0) {
                handoverQueue = [targetSong];
                currentIdxInQueue = 0;
            } else if (currentIdxInQueue === -1) {
                handoverQueue.unshift(targetSong);
                currentIdxInQueue = 0;
            }

            // 8. セッション情報とキュー・シャッフル・ループ設定の確定
            s.activeSessionInfo = {
                playlistID: isVirtual ? (s.currentVirtualField || "album") : (currentPl ? currentPl.id : "normal"),
                playlistName: isVirtual ? (s.currentVirtualName || "Untitled") : (currentPl ? currentPl.playlistName : "Untitled")
            };

            const headerLogo = document.getElementById('headerLogo');
            const headerPlayerInfo = document.getElementById('headerPlayerInfo');
            const headerControls = document.getElementById('headerControls');
            if (headerLogo) headerLogo.style.display = 'none';
            if (headerPlayerInfo) headerPlayerInfo.style.display = 'flex';
            if (headerControls) headerControls.style.display = 'flex';

            s.queue = handoverQueue;
            s.currentIndex = currentIdxInQueue;
            s.isShuffle = Boolean(now.shuffle);
            s.loopMode = now.loop ? 'all' : 'off';

            if (window.HeaderController) {
                window.HeaderController.updateToggleButtons();
            }

            // 9. 再生開始と秒数シーク
            this.playCurrentIndex();

            if (startTime > 0) {
                const applySeek = () => {
                    if (this.audio) {
                        this.audio.currentTime = startTime;
                    }
                };
                setTimeout(applySeek, 150);
                setTimeout(applySeek, 400);
            }

            const devName = relayData.deviceName || "他デバイス";
            u.showToast(`${devName} から「${targetSong.title || targetTitle}」を引き継ぎました`);
        }
    };
})();