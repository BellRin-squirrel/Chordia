document.addEventListener('DOMContentLoaded', async () => {
    const tauri = window.__TAURI__;
    const invoke = (tauri && tauri.core) ? tauri.core.invoke : (tauri && tauri.tauri ? tauri.tauri.invoke : null);
    
    const getCurrentWindow = () => {
        if (tauri && tauri.window && tauri.window.getCurrentWindow) {
            return tauri.window.getCurrentWindow();
        }
        return null;
    };
    const appWindow = getCurrentWindow();

    document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, .large-content, .btn-ctrl, .tab-btn, .queue-item, .seek-bar')) {
            return;
        }
        if (appWindow && typeof appWindow.startDragging === 'function') {
            appWindow.startDragging().catch(() => {});
        }
    });
    
    const artEl = document.getElementById('art');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const playpauseBtn = document.getElementById('playpause');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const seekEl = document.getElementById('seek');
    
    const queueListEl = document.getElementById('queue-list');
    const lyricTextEl = document.getElementById('lyric-text');
    const historyListEl = document.getElementById('history-list');

    const SVG_PLAY = `<svg viewBox="0 0 24 24"><path d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" /></svg>`;
    const SVG_PAUSE = `<svg viewBox="0 0 24 24"><path d="M6.75 5.25a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 3 0V6.75a1.5 1.5 0 0 0-1.5-1.5Zm10.5 0a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 3 0V6.75a1.5 1.5 0 0 0-1.5-1.5Z" /></svg>`;

    let isSeeking = false;
    let currentMode = 'large';
    let lastRenderedSongFilename = null; 
    let isSystemResizing = false; 

    let lastWidth = window.outerWidth || 256; 
    let lastHeight = window.outerHeight || 750; 

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    const setTextWithMarquee = (el, text, className) => {
        el.innerHTML = `<div class="${className}" style="display:inline-block; max-width:100%; white-space:nowrap;">${text}</div>`;
        requestAnimationFrame(() => {
            const inner = el.firstElementChild;
            if (inner && inner.scrollWidth > el.clientWidth) {
                el.innerHTML = `<div class="marquee-wrapper"><span class="marquee-content">${text}</span><span class="marquee-content">${text}</span></div>`;
            }
        });
    };

    let audioCtx = null;
    const playTickSound = () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.03);
    };

    document.querySelectorAll('.tick-btn').forEach(btn => {
        btn.addEventListener('mouseenter', playTickSound);
    });

    const sendCommand = (action, value = null) => {
        localStorage.setItem('mini_player_command', JSON.stringify({ action, value, t: Date.now() }));
    };

    playpauseBtn.addEventListener('click', () => sendCommand('togglePlayPause'));
    prevBtn.addEventListener('click', () => sendCommand('prevSong'));
    nextBtn.addEventListener('click', () => sendCommand('nextSong'));

    seekEl.addEventListener('mousedown', () => isSeeking = true);
    seekEl.addEventListener('change', () => {
        isSeeking = false;
        sendCommand('seek', seekEl.value / 1000);
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (e.shiftKey) sendCommand('stopPlayback');
            else sendCommand('togglePlayPause');
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            sendCommand('nextSong');
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            sendCommand('prevSong');
        }
    });

    const switchMode = async () => {
        if (currentMode === 'large') currentMode = 'medium';
        else if (currentMode === 'medium') currentMode = 'small';
        else if (currentMode === 'small') currentMode = 'large';

        document.body.className = `mode-${currentMode}`;
        isSystemResizing = true; 

        try {
            if (invoke) {
                await invoke('set_mini_player_mode', { mode: currentMode });
            }
            if (currentMode === 'large') loadHistory();
        } catch(e) { 
            console.error(e); 
        } finally {
            setTimeout(() => {
                lastWidth = window.outerWidth || 256;
                lastHeight = window.outerHeight || 750;
                isSystemResizing = false;
            }, 500);
        }
    };

    const closePlayer = async () => {
        try { 
            if (invoke) await invoke('close_mini_player'); 
            else window.close();
        } catch(e) { 
            window.close(); 
        }
    };

    const minimizePlayer = async () => {
        try { 
            if (invoke) await invoke('minimize_mini_player'); 
        } catch(e) { 
            console.error(e); 
        }
    };

    document.getElementById('btnSwitchMode').addEventListener('click', switchMode);
    document.getElementById('btnSwitchModeSmall').addEventListener('click', switchMode);
    document.getElementById('btnClosePlayer').addEventListener('click', closePlayer);
    document.getElementById('btnCloseSmall').addEventListener('click', closePlayer);
    
    document.getElementById('btnMinimizePlayer').addEventListener('click', minimizePlayer);
    document.getElementById('btnMinimizeSmall').addEventListener('click', minimizePlayer);

    window.addEventListener('resize', () => {
        if (currentMode === 'small' && !isSystemResizing) {
            clearTimeout(window._resizeTimer);
            window._resizeTimer = setTimeout(() => {
                const currentWidth = window.outerWidth || 256;
                const currentHeight = window.outerHeight || 256;

                const diffWidth = Math.abs(currentWidth - lastWidth);
                const diffHeight = Math.abs(currentHeight - lastHeight);

                const widthIsMaster = diffWidth >= diffHeight;

                isSystemResizing = true; 
                if (invoke) {
                    invoke('make_window_square', { widthIsMaster })
                        .then(() => {
                            lastWidth = window.outerWidth || 256;
                            lastHeight = window.outerHeight || 256;
                            setTimeout(() => { isSystemResizing = false; }, 200);
                        })
                        .catch(e => {
                            console.error(e);
                            isSystemResizing = false;
                        });
                }
            }, 100);
        }
    });

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.large-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    const loadHistory = async () => {
        const loadingText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.history_loading') : "読み込み中...";
        historyListEl.innerHTML = `<div class="no-data">${loadingText}</div>`;
        try {
            if (!invoke) return;
            const historyData = await invoke("get_playback_history");
            historyListEl.innerHTML = '';
            if (historyData && historyData.length > 0) {
                historyData.forEach(h => {
                    const item = document.createElement('div');
                    item.className = 'queue-item';
                    const img = h.imageData || 'icon/Chordia.png';
                    item.innerHTML = `
                        <img src="${img}" class="queue-art">
                        <div class="queue-info">
                            <div class="queue-title" style="font-size:0.9rem;">${escapeHtml(h.title)}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="queue-artist" style="font-size:0.75rem;">${escapeHtml(h.artist)}</div>
                                <div style="font-size:0.7rem; color:var(--text-sub); opacity:0.6;">${h.timestamp}</div>
                            </div>
                        </div>
                    `;
                    historyListEl.appendChild(item);
                });
            } else {
                const noHistText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.no_history') : "再生履歴はありません";
                historyListEl.innerHTML = `<div class="no-data">${noHistText}</div>`;
            }
        } catch (e) {
            const failText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.history_failed') : "履歴の取得に失敗しました";
            historyListEl.innerHTML = `<div class="no-data">${failText}</div>`;
        }
    };

    const render = (state) => {
        if (!state) return;
        
        if (state.song) {
            artEl.src = state.song.imageData || 'icon/Chordia.png';
            
            setTextWithMarquee(titleEl, escapeHtml(state.song.title || 'Unknown Title'), 'info-title');
            setTextWithMarquee(artistEl, escapeHtml(state.song.artist || 'Unknown Artist'), 'info-artist');
            
            lyricTextEl.textContent = state.song.lyric || '歌詞情報はありません。';

            if (currentMode === 'large' && lastRenderedSongFilename !== state.song.musicFilename) {
                loadHistory();
                lastRenderedSongFilename = state.song.musicFilename;
            }
        }

        playpauseBtn.innerHTML = state.isPlaying ? SVG_PAUSE : SVG_PLAY;

        if (!isSeeking && state.duration > 0) {
            seekEl.value = (state.currentTime / state.duration) * 1000;
            seekEl.style.background = `linear-gradient(to right, var(--primary-color) ${seekEl.value/10}%, rgba(128,128,128,0.2) ${seekEl.value/10}%)`;
        }

        if (state.queue && queueListEl) {
            queueListEl.innerHTML = '';
            state.queue.slice(0, 20).forEach(song => {
                const item = document.createElement('div');
                item.className = 'queue-item';
                const img = song.imageData || 'icon/Chordia.png';
                item.innerHTML = `
                    <img src="${img}" class="queue-art">
                    <div class="queue-info">
                        <div class="queue-title">${escapeHtml(song.title || 'Unknown')}</div>
                        <div class="queue-artist">${escapeHtml(song.artist || 'Unknown')}</div>
                    </div>
                `;
                queueListEl.appendChild(item);
            });
            if (state.queue.length === 0) {
                const noNextText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.no_next_songs') : "次に再生される曲はありません";
                queueListEl.innerHTML = `<div class="no-data">${noNextText}</div>`;
            }
        }
    };

    window.addEventListener('storage', (e) => {
        if (e.key === 'mini_player_state' && e.newValue) {
            render(JSON.parse(e.newValue));
        }
    });

    const initial = localStorage.getItem('mini_player_state');
    if (initial) render(JSON.parse(initial));
});
