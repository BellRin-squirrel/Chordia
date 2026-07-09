(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.HeaderController = {
        init: function() {
            this.hpTitleContainer = document.getElementById('hpTitleContainer');
            this.hpSubContainer = document.getElementById('hpSubContainer');
            this.hpArtImg = document.getElementById('hpArtImg');
            this.btnShuffleToggle = document.getElementById('btnShuffleToggle');
            this.btnLoopToggle = document.getElementById('btnLoopToggle');
            this.hdrBtnPlayPause = document.getElementById('hdrBtnPlayPause');
            
            const artWrapper = document.querySelector('.hp-art');
            if (artWrapper) {
                artWrapper.style.cursor = 'pointer';
                artWrapper.title = 'ミニプレイヤーを開く';
                artWrapper.addEventListener('click', () => {
                    this.launchMiniPlayer();
                });
            }

            this.btnShuffleToggle.addEventListener('click', () => {
                s.isShuffle = !s.isShuffle;
                window.PlayerController.syncShuffle();
                this.updateToggleButtons();
            });

            this.btnLoopToggle.addEventListener('click', () => {
                if (s.loopMode === 'off') s.loopMode = 'all';
                else if (s.loopMode === 'all') s.loopMode = 'one';
                else s.loopMode = 'off';
                this.updateToggleButtons();
            });

            const btnMore = document.getElementById('btnHeaderMore');
            if (btnMore) {
                btnMore.addEventListener('click', () => this.openQueueLyricsModal());
            }

            this.initModalTabs();
            this.updateToggleButtons();
        },

        launchMiniPlayer: async function() {
            try {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                await invoke("open_new_window", {
                    label: "mini_player_window",
                    // ★ 修正：現在のURLをベースにした絶対URLとして組み立てる
                    url: new URL("mini_player.html", window.location.href).href,
                    title: "Mini Player",
                    width: 256.0, 
                    height: 750.0 
                });
            } catch(e) {
                console.error("Mini Player Launch Error:", e);
            }
        },

        initModalTabs: function() {
            const modal = document.getElementById('queueLyricsModal');
            if (!modal) return;
            const btnClose = document.getElementById('btnCloseQueueLyrics');
            if (btnClose) btnClose.onclick = () => modal.classList.remove('show');

            const tabs = modal.querySelectorAll('.tab-btn');
            tabs.forEach(btn => {
                btn.onclick = () => {
                    tabs.forEach(b => b.classList.remove('active'));
                    modal.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    btn.classList.add('active');
                    const pane = document.getElementById(btn.dataset.target);
                    if (pane) pane.classList.add('active');
                };
            });
        },

        openQueueLyricsModal: async function(targetTab = 'tab-nextup') {
            const modal = document.getElementById('queueLyricsModal');
            if (!modal) return;

            const currentSong = s.queue[s.currentIndex];
            if (!currentSong) return;

            document.getElementById('qlModalArt').src = currentSong.imageData || s.DEFAULT_ICON;
            document.getElementById('qlModalTitle').textContent = currentSong.title || "Unknown Title";
            document.getElementById('qlModalArtist').textContent = currentSong.artist || "Unknown Artist";
            const albumEl = document.getElementById('qlModalAlbum');
            if (albumEl) {
                albumEl.textContent = currentSong.album || "";
                albumEl.style.display = currentSong.album ? "block" : "none";
            }

            const queueList = document.getElementById('modalQueueList');
            queueList.innerHTML = '';
            
            let nextSongsRaw = [];
            if (s.loopMode !== 'one') {
                nextSongsRaw = s.queue.slice(s.currentIndex + 1, s.currentIndex + 52);
            }

            if (nextSongsRaw.length > 0) {
                const displaySongs = nextSongsRaw.slice(0, 50);
                displaySongs.forEach((song, idx) => {
                    const item = document.createElement('div');
                    item.className = 'detail-item';
                    const artSrc = song.imageData || s.DEFAULT_ICON;
                    item.innerHTML = `
                        <img src="${artSrc}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; margin-right: 12px;">
                        <div class="detail-value" style="display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                            <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1rem;">${u.escapeHtml(song.title)}</strong>
                            <small style="opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem;">${u.escapeHtml(song.artist)}</small>
                        </div>
                    `;
                    item.onclick = () => {
                        if (window.PlayerController) {
                            window.PlayerController.skipToQueueIndex(s.currentIndex + 1 + idx);
                        }
                        modal.classList.remove('show');
                    };
                    queueList.appendChild(item);
                });

                if (nextSongsRaw.length > 50) {
                    const moreMsg = document.createElement('div');
                    moreMsg.className = 'no-lyrics';
                    moreMsg.style.marginTop = '10px';
                    moreMsg.style.padding = '20px 0';
                    moreMsg.style.borderTop = '1px dashed rgba(128,128,128,0.2)';
                    moreMsg.textContent = "再生はまだ続きます";
                    queueList.appendChild(moreMsg);
                }
            } else {
                queueList.innerHTML = '<div class="no-lyrics">次に再生される曲はありません</div>';
            }

            const lyricsView = document.getElementById('modalLyricsView');
            lyricsView.textContent = currentSong.lyric || "歌詞情報はありません。";

            const historyList = document.getElementById('modalHistoryList');
            historyList.innerHTML = '<div class="no-lyrics">履歴を読み込み中...</div>';
            try {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const historyData = await invoke("get_playback_history");
                historyList.innerHTML = '';
                if (historyData && historyData.length > 0) {
                    historyData.forEach(h => {
                        const item = document.createElement('div');
                        item.className = 'detail-item';
                        const artSrc = h.imageData || s.DEFAULT_ICON;
                        item.innerHTML = `
                            <img src="${artSrc}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0; margin-right: 12px;">
                            <div class="detail-value" style="display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                                <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem;">${u.escapeHtml(h.title)}</strong>
                                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 2px;">
                                    <small style="opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.escapeHtml(h.artist)}</small>
                                    <small style="opacity: 0.5; font-family: monospace; white-space: nowrap;">${h.timestamp}</small>
                                </div>
                            </div>
                        `;
                        historyList.appendChild(item);
                    });
                } else {
                    historyList.innerHTML = '<div class="no-lyrics">再生履歴はありません</div>';
                }
            } catch (e) {
                historyList.innerHTML = '<div class="no-lyrics">履歴の取得に失敗しました</div>';
            }

            const tabBtn = modal.querySelector(`.tab-btn[data-target="${targetTab}"]`);
            if (tabBtn) tabBtn.click();
            
            modal.classList.add('show');
        },

        updateHeaderUI: function(song) {
            this.setTextWithMarquee(this.hpTitleContainer, song.title || 'Unknown', 'hp-title');
            
            const album = song.album || ''; 
            const artist = song.artist || '';
            let subText = "";
            if(album && artist) subText = `${album} - ${artist}`;
            else subText = album || artist;
            this.setTextWithMarquee(this.hpSubContainer, subText, 'hp-sub');

            const artSrc = song.imageData || s.DEFAULT_ICON;
            this.hpArtImg.src = artSrc;
        },

        setTextWithMarquee: function(container, text, className) {
            container.innerHTML = `<div class="${className}">${u.escapeHtml(text)}</div>`;
            const element = container.firstElementChild;
            if (element && element.scrollWidth > container.clientWidth) {
                const escaped = u.escapeHtml(text);
                container.innerHTML = `<div class="marquee-wrapper"><span class="marquee-content">${escaped}</span><span class="marquee-content">${escaped}</span></div>`;
            }
        },

        updatePlayIcons: function(isPlaying) {
            if (this.hdrBtnPlayPause) {
                if (isPlaying) {
                    this.hdrBtnPlayPause.innerHTML = s.SVG_PAUSE;
                    this.hdrBtnPlayPause.title = "一時停止 (Space)";
                } else {
                    this.hdrBtnPlayPause.innerHTML = s.SVG_PLAY;
                    this.hdrBtnPlayPause.title = "再生 (Space)";
                }
            }
        },

        updateToggleButtons: function() {
            if (this.btnShuffleToggle) {
                if (s.isShuffle) this.btnShuffleToggle.classList.add('active');
                else this.btnShuffleToggle.classList.remove('active');
            }

            if (this.btnLoopToggle) {
                this.btnLoopToggle.className = 'btn-icon-toggle';
                if (s.loopMode === 'all') this.btnLoopToggle.classList.add('active');
                else if (s.loopMode === 'one') this.btnLoopToggle.classList.add('active-one');
            }
        }
    };
})();