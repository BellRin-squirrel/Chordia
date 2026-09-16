(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.PlayerController = {
        audio: null,
        seekBar: null,
        volumeBar: null,
        userVolume: 1.0,

        // 楽曲セッションの開始（通常 / シャッフル）
        startPlaybackSession: function(mode, startIndex = 0) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            if (!targetPl || !targetPl.songs) return;

            s.activeSessionInfo = {
                playlistID: isVirtual ? (s.currentVirtualField || "album") : (targetPl.id || "normal"),
                playlistName: isVirtual ? (s.currentVirtualName || "Untitled") : (targetPl.playlistName || "Untitled")
            };

            const headerLogo = document.getElementById('headerLogo');
            const headerPlayerInfo = document.getElementById('headerPlayerInfo');
            const headerControls = document.getElementById('headerControls');
            if (headerLogo) headerLogo.style.display = 'none';
            if (headerPlayerInfo) headerPlayerInfo.style.display = 'flex';
            if (headerControls) headerControls.style.display = 'flex';

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

        // 現在インデックスの楽曲を再生
        playCurrentIndex: async function() {
            if (s.queue.length === 0 || s.currentIndex < 0) return;
            const song = s.queue[s.currentIndex];
            
            if (!song || !song.streamUrl) {
                u.showToast("再生可能なファイルが見つかりません", true);
                return;
            }

            // Web Audio イコライザーグラフをアクティブ化
            await this.ensureAudioContextReady();

            this.audio.pause();

            // Blob URL 変換による CORS 遮断防止
            const playSrc = await this.prepareAudioSource(song.streamUrl);
            this.audio.src = playSrc;
            this.audio.load();

            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.applyVolume();
                    this.applyEqualizerSettings();

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

        togglePlayPause: async function() {
            if (s.queue.length === 0 || !this.audio || !this.audio.src) return;

            await this.ensureAudioContextReady();

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

            if (this._currentBlobUrl) {
                URL.revokeObjectURL(this._currentBlobUrl);
                this._currentBlobUrl = null;
            }
            
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

        generateSection: function(isShuffle) {
            if (isShuffle) {
                return u.shuffleArray([...s.originalList]);
            } else {
                return [...s.originalList];
            }
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
        }
    };
})();