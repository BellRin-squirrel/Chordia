(function() {
    const s = window.ManageState;
    const u = window.ManageUtils;
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const convertFileSrc = window.__TAURI__.core ? window.__TAURI__.core.convertFileSrc : window.__TAURI__.tauri.convertFileSrc;

    window.PlayerController = {
        init: function() {
            const audioPlayer = document.getElementById('previewPlayer');
            const seekBar = document.getElementById('seekBar');
            const barPlayBtn = document.getElementById('barPlayBtn');

            if (!audioPlayer || !seekBar || !barPlayBtn) return;

            audioPlayer.addEventListener('timeupdate', () => {
                if (!s.isSeeking) {
                    const current = audioPlayer.currentTime;
                    const duration = audioPlayer.duration;
                    if (!isNaN(duration) && duration > 0) {
                        const ratio = (current / duration);
                        seekBar.value = ratio * 1000;
                        u.updateSeekColor(ratio * 100);
                        const display = document.getElementById('playerTimeDisplay');
                        if(display) display.textContent = `${u.formatTime(current)} / ${u.formatTime(duration)}`;
                    }
                }
            });

            audioPlayer.addEventListener('ended', () => {
                this.stopPreview();
            });

            seekBar.addEventListener('mousedown', () => s.isSeeking = true);
            seekBar.addEventListener('input', () => u.updateSeekColor(seekBar.value / 10));
            seekBar.addEventListener('change', () => {
                const duration = audioPlayer.duration;
                if (!isNaN(duration)) audioPlayer.currentTime = (seekBar.value / 1000) * duration;
                s.isSeeking = false;
            });

            barPlayBtn.addEventListener('click', () => {
                if (s.currentPlayingIndex === -1) return;
                if (audioPlayer.paused) { 
                    audioPlayer.play(); 
                    this.updatePlayIcons(true); 
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                } 
                else { 
                    audioPlayer.pause(); 
                    this.updatePlayIcons(false); 
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
                }
            });

            if ('mediaSession' in navigator) {
                navigator.mediaSession.setActionHandler('play', () => {
                    if (audioPlayer.paused && s.currentPlayingIndex !== -1) {
                        audioPlayer.play();
                        this.updatePlayIcons(true);
                        navigator.mediaSession.playbackState = 'playing';
                    }
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    if (!audioPlayer.paused && s.currentPlayingIndex !== -1) {
                        audioPlayer.pause();
                        this.updatePlayIcons(false);
                        navigator.mediaSession.playbackState = 'paused';
                    }
                });
            }
        },

        playPreview: async function(index) {
            const item = s.libraryData[index];
            const audioPlayer = document.getElementById('previewPlayer');
            const playerBar = document.getElementById('playerBar');

            if (s.currentPlayingIndex === index) {
                if (audioPlayer.paused) { 
                    audioPlayer.play(); 
                    this.updatePlayIcons(true); 
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                } else { 
                    audioPlayer.pause(); 
                    this.updatePlayIcons(false); 
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
                }
                return;
            }

            if (s.currentPlayingIndex !== -1) {
                const prevBtn = document.getElementById(`btnPlay_${s.currentPlayingIndex}`);
                if (prevBtn) { prevBtn.innerHTML = s.SVG_PLAY; prevBtn.classList.remove('playing'); }
            }

            s.currentPlayingIndex = index;

            if (item.musicFilename) {
                try {
                    const absPath = await invoke("resolve_path", { relPath: item.musicFilename });
                    const assetUrl = convertFileSrc(absPath);
                    
                    audioPlayer.src = assetUrl;
                    audioPlayer.load();
                    await audioPlayer.play();
                    this.updatePlayIcons(true);

                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.metadata = new MediaMetadata({
                            title: item.title || 'Unknown Title',
                            artist: item.artist || 'Unknown Artist',
                            album: item.album || '',
                            artwork: [
                                { src: item.imageData || s.DEFAULT_ICON, sizes: '256x256', type: 'image/png' }
                            ]
                        });
                        navigator.mediaSession.playbackState = 'playing';
                    }
                } catch (e) {
                    console.error("Playback failed:", e);
                    u.showToast(window.i18n ? window.i18n.t('Manage.msg_cannot_play') : "再生できません", true);
                }
            }

            this.updatePlayerInfo(item);
            playerBar.classList.add('active');
        },

        stopPreview: function() {
            const audioPlayer = document.getElementById('previewPlayer');
            audioPlayer.pause();
            audioPlayer.src = "";
            if (s.currentPlayingIndex !== -1) {
                const btn = document.getElementById(`btnPlay_${s.currentPlayingIndex}`);
                if (btn) { btn.innerHTML = s.SVG_PLAY; btn.classList.remove('playing'); }
            }
            document.getElementById('barPlayBtn').innerHTML = s.SVG_PLAY;

            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'none';
            }
        },

        updatePlayIcons: function(isPlaying) {
            const currentBtn = document.getElementById(`btnPlay_${s.currentPlayingIndex}`);
            const barBtn = document.getElementById('barPlayBtn');
            if (isPlaying) {
                if (currentBtn) { currentBtn.innerHTML = s.SVG_PAUSE; currentBtn.classList.add('playing'); }
                barBtn.innerHTML = s.SVG_PAUSE;
            } else {
                if (currentBtn) { currentBtn.innerHTML = s.SVG_PLAY; currentBtn.classList.remove('playing'); }
                barBtn.innerHTML = s.SVG_PLAY;
            }
        },

        updatePlayerInfo: function(item) {
            document.getElementById('playerTitle').textContent = item.title || 'Unknown';
            document.getElementById('playerArtist').textContent = item.artist || 'Unknown';
            const subInfo = document.getElementById('playerSubInfo');
            subInfo.textContent = `${item.album || ''} | Tr. ${item.track || '--'}`;
            document.getElementById('playerArt').src = item.imageData || s.DEFAULT_ICON;
        }
    };
})();
