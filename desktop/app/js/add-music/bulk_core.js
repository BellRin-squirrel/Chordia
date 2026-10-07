window.BulkController = {
    scannedData:[],
    activeTags:[],
    currentEditIndex: -1,
    
    init: async function() {
        const u = window.AddMusicUtils;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        
        document.querySelectorAll('.tab-menu .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-menu .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).style.display = 'block';
            });
        });

        const btnFetchBulk = document.getElementById('btnFetchBulk');
        btnFetchBulk.addEventListener('click', () => this.fetchPlaylist());
        
        const bulkInput = document.getElementById('bulkPlaylistUrl');
        if (bulkInput) {
            bulkInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.fetchPlaylist();
                }
            });
        }

        document.getElementById('btnSubmitBulk').addEventListener('click', () => this.executeBulkImport());

        const closeModals = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => {
                if (m.classList.contains('show')) {
                    m.classList.remove('show');
                    setTimeout(() => m.style.display = 'none', 300);
                    if (m.id === 'youtubeModal') {
                        document.getElementById('youtubeIframe').src = "";
                    }
                }
            });
        };
        
        const setClose = (id) => { const el = document.getElementById(id); if(el) el.onclick = closeModals; };
        setClose('btnCloseYoutube');
        setClose('btnCancelBulkLyric');
        setClose('btnCloseBulkLyricModalX');
        setClose('btnCancelBulkArt');
        setClose('btnCloseBulkArtModalX');
        setClose('btnCancelBulkDelete');
        
        document.getElementById('btnSaveBulkLyric').onclick = () => {
            this.scannedData[this.currentEditIndex].lyric = document.getElementById('bulkLyricTextArea').value;
            closeModals();
            u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_applied') : "反映しました", false);
        };
        
        document.getElementById('btnAutoBulkLyric').onclick = async () => {
            const item = this.scannedData[this.currentEditIndex];
            if(!item.title || !item.artist) { u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_title_artist_required') : "タイトルとアーティストが必要です", true); return; }
            const btn = document.getElementById('btnAutoBulkLyric');
            const orgText = btn.textContent;
            btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "検索中..."; 
            btn.disabled = true;
            try {
                const data = await invoke("search_lyrics_online", { title: item.title, artist: item.artist });
                
                if (data.statusCode === 404 || data.error) {
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true);
                    return;
                }
                
                if (!Array.isArray(data) || data.length === 0) {
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true);
                    return;
                }

                const filtered = data.filter(d => d.plainLyrics);
                if(filtered.length > 0) {
                    document.getElementById('bulkLyricTextArea').value = filtered[0].plainLyrics;
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_lyric_applied') : "歌詞を取得しました", false);
                } else { 
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true); 
                }
            } catch(e) { 
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラーが発生しました", true); 
            } finally { 
                btn.textContent = orgText; btn.disabled = false; 
            }
        };

        const bulkArtMiniTabs = document.querySelectorAll('#bulkArtTabsMini .art-mini-tab-btn');
        bulkArtMiniTabs.forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.target;
                bulkArtMiniTabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.art-mini-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const targetContent = document.getElementById(target);
                if (targetContent) targetContent.classList.add('active');
                showBulkArtError("");
            };
        });

        const artPreview = document.getElementById('currentBulkArtPreview');
        document.getElementById('newBulkArtInput').onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                artPreview.src = ev.target.result;
                document.getElementById('bulkArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_new') : "新しい画像 (反映前)";
                showBulkArtError("");
            };
            reader.readAsDataURL(file);
        };

        const bulkMiniVideoUrl = document.getElementById('bulkMiniVideoUrl');
        const btnFetchBulkVideoArt = document.getElementById('btnFetchBulkVideoArt');

        btnFetchBulkVideoArt.onclick = async () => {
            const url = bulkMiniVideoUrl.value.trim();
            showBulkArtError("");
            if (!url) { showBulkArtError(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください"); return; }

            const orgText = btnFetchBulkVideoArt.textContent;
            btnFetchBulkVideoArt.disabled = true; btnFetchBulkVideoArt.textContent = window.i18n ? window.i18n.t('Common.loading') : "確認中...";

            try {
                const status = await invoke("check_tools_status");
                if (!status['yt-dlp'] || !status['ffmpeg']) {
                    showBulkArtError(window.i18n ? window.i18n.t('AddMusic.msg_ext_needed') : "拡張機能が不足しています");
                    return;
                }

                btnFetchBulkVideoArt.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
                const info = await invoke("fetch_video_info", { url: url });
                if (info.status === 'success' && info.thumbnail) {
                    btnFetchBulkVideoArt.textContent = window.i18n ? window.i18n.t('AddMusic.loading_processing_thumb') : "画像を変換中...";
                    const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                    if (b64) {
                        artPreview.src = b64;
                        document.getElementById('bulkArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_thumb') : "動画サムネイル (反映前)";
                        u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_fetch_success') : "サムネイルを取得しました");
                    } else { showBulkArtError("画像の加工に失敗しました"); }
                } else { showBulkArtError(info.message || "動画情報の取得に失敗しました"); }
            } catch(e) { showBulkArtError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "エラーが発生しました"); }
            finally { btnFetchBulkVideoArt.disabled = false; btnFetchBulkVideoArt.textContent = orgText; }
        };

        // ★ YouTube一括追加モーダルの動画URL入力欄でのEnterキー対応
        if (bulkMiniVideoUrl) {
            bulkMiniVideoUrl.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btnFetchBulkVideoArt.click();
                }
            });
        }

        const bulkMiniImageUrl = document.getElementById('bulkMiniImageUrl');
        const btnFetchBulkDirectArt = document.getElementById('btnFetchBulkDirectArt');

        btnFetchBulkDirectArt.onclick = async () => {
            const url = bulkMiniImageUrl.value.trim();
            showBulkArtError("");
            if (!url) { showBulkArtError(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください"); return; }

            const orgText = btnFetchBulkDirectArt.textContent;
            btnFetchBulkDirectArt.disabled = true; btnFetchBulkDirectArt.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";

            try {
                const res = await invoke("fetch_and_crop_image_url", { url: url });
                if (res.status === 'success') {
                    artPreview.src = res.data;
                    document.getElementById('bulkArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_url') : "画像URL (反映前)";
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_fetch_success') : "画像を取得しました");
                } else { showBulkArtError("取得失敗: " + res.message); }
            } catch(e) { showBulkArtError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラーが発生しました"); }
            finally { btnFetchBulkDirectArt.disabled = false; btnFetchBulkDirectArt.textContent = orgText; }
        };

        // ★ YouTube一括追加モーダルの画像URL入力欄でのEnterキー対応
        if (bulkMiniImageUrl) {
            bulkMiniImageUrl.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    btnFetchBulkDirectArt.click();
                }
            });
        }

        document.getElementById('btnExecBulkRemoveArt').onclick = () => {
            artPreview.src = "REMOVE";
            document.getElementById('bulkArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_remove') : "削除予定 (反映前)";
            showBulkArtError("");
        };

        document.getElementById('btnSaveBulkArt').onclick = async () => {
            const isRemove = (artPreview.src === "REMOVE" || artPreview.src.includes("REMOVE"));
            const defaultArt = await invoke("get_default_art_url");
            const src = isRemove ? defaultArt : artPreview.src;
            
            this.scannedData[this.currentEditIndex].artwork_base64 = src;
            closeModals();
            this.renderTable();
            u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_applied') : "反映しました", false);
        };

        function showBulkArtError(msg) {
            const errEl = document.getElementById('bulkArtErrorDisplay');
            if (!errEl) return;
            if (msg) {
                errEl.textContent = "⚠️ " + msg;
                errEl.style.display = 'block';
            } else {
                errEl.style.display = 'none';
                errEl.textContent = "";
            }
        }
    },

    updateData: function(idx, key, val) {
        if (this.scannedData[idx]) {
            this.scannedData[idx][key] = val;
        }
    }
};
