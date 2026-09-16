(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    Object.assign(window.PlayerController, {
        lastMiniPushTime: 0,
        _nowPlayingTimer: null,
        _isSendingNowPlaying: false,

        // ミニプレイヤーへの状態プッシュ
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

        // Chordia Sync クラウドへの再生位置定期送信
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

        // Chordia Relay 引き継ぎ再生ハンドラ
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

            if (!s.fullLibrary) {
                try {
                    s.fullLibrary = await invoke("get_library_chunk", {
                        page: 1, limit: 0, sortField: null, sortDesc: false, searchQuery: "", advancedConditions: null
                    });
                } catch(e) {}
            }

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

            const isVirtual = s.currentPlaylistType === 'virtual';
            const currentPl = isVirtual ? s.currentVirtualPlaylist : (targetPlIndex !== -1 ? s.playlists[targetPlIndex] : null);
            let poolSongs = currentPl && currentPl.songs && currentPl.songs.length > 0 ? currentPl.songs : (s.fullLibrary || []);
            const sortedOriginal = currentPl ? u.sortSongs(poolSongs, currentPl.sortBy || 'title', currentPl.sortDesc || false) : [...poolSongs];
            s.originalList = [...sortedOriginal];

            const findSongObject = (mItem) => {
                if (!mItem) return null;
                const t = (mItem.title || "").trim().toLowerCase();
                const a = (mItem.artist || "").trim().toLowerCase();
                const al = (mItem.album || "").trim().toLowerCase();

                let found = poolSongs.find(song => {
                    const sT = (song.title || "").trim().toLowerCase();
                    const sA = (song.artist || "").trim().toLowerCase();
                    const sAl = (song.album || "").trim().toLowerCase();
                    return sT === t && (!a || sA === a) && (!al || sAl === al);
                });
                if (found) return found;

                found = poolSongs.find(song => {
                    const sT = (song.title || "").trim().toLowerCase();
                    const sA = (song.artist || "").trim().toLowerCase();
                    return sT === t && (!a || sA === a);
                });
                if (found) return found;

                found = poolSongs.find(song => (song.title || "").trim().toLowerCase() === t);
                if (found) return found;

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

            let handoverQueue = [];
            if (Array.isArray(now.musiclist) && now.musiclist.length > 0) {
                handoverQueue = now.musiclist.map(mItem => findSongObject(mItem)).filter(Boolean);
            }

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
    });
})();