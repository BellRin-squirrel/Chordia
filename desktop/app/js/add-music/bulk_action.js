(function() {
    const u = window.AddMusicUtils;

    Object.assign(window.BulkController, {
        fetchPlaylist: async function() {
            const url = document.getElementById('bulkPlaylistUrl').value.trim();
            if (!url) { u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください", true); return; }

            const btn = document.getElementById('btnFetchBulk');
            const orgText = btn.textContent;
            btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
            btn.disabled = true;

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

            try {
                const toolsStatus = await invoke("check_tools_status");
                if (!toolsStatus['yt-dlp'] || !toolsStatus['ffmpeg'] || !toolsStatus['deno']) {
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_ext_needed_bulk') : "動画機能を利用するには拡張機能（yt-dlp, ffmpeg, deno）をインストールしてください", true);
                    return;
                }

                const settings = await invoke("get_app_settings");
                const allTags = await invoke("get_available_tags");
                this.activeTags = allTags.filter(t => settings.active_tags.includes(t.key));

                const res = await invoke("fetch_youtube_playlist", { url: url });
                if (res.status === 'success') {
                    this.scannedData = res.videos.map((v, idx) => {
                        const item = { id: idx + 1, url: v.url, title: v.title, artist: v.uploader, thumbnail: v.thumbnail, lyric: '', artwork_base64: '' };
                        this.activeTags.forEach(t => { if(t.key !== 'title' && t.key !== 'artist') item[t.key] = ''; });
                        return item;
                    });
                    
                    document.getElementById('bulkResultArea').style.display = 'block';
                    this.renderTable();
                    this.processThumbnailsBackground();
                } else {
                    u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", res.message);
                }
            } catch(e) {
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラーが発生しました", true);
            } finally {
                btn.textContent = orgText;
                btn.disabled = false;
            }
        },

        processThumbnailsBackground: async function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            for (let i = 0; i < this.scannedData.length; i++) {
                if (this.scannedData[i].thumbnail && !this.scannedData[i].artwork_base64) {
                    try {
                        const b64 = await invoke("fetch_and_crop_thumbnail", { url: this.scannedData[i].thumbnail });
                        if (b64) {
                            this.scannedData[i].artwork_base64 = b64;
                            const imgEl = document.getElementById(`bulk-art-${i}`);
                            if (imgEl) imgEl.src = b64;
                        }
                    } catch(e) {}
                }
            }
        },

        showBulkDuplicatePrompt: function(item, isExisting) {
            return new Promise((resolve) => {
                const modal = document.getElementById('bulkDuplicateModal');
                const msgEl = document.getElementById('bulkDupMessage');
                const manageBtnArea = document.getElementById('bulkDupManageBtnArea');
                const btnManage = document.getElementById('btnBulkDupManage');
                const btnCancel = document.getElementById('btnBulkDupCancel');
                const btnSkip = document.getElementById('btnBulkDupSkip');
                const btnContinue = document.getElementById('btnBulkDupContinue');

                const title = window.AddMusicUtils.escapeHtml(item.title);
                const artist = window.AddMusicUtils.escapeHtml(item.artist);

                if (isExisting) {
                    msgEl.innerHTML = window.i18n ? window.i18n.t('AddMusic.dup_existing_msg', { title: title, artist: artist }) : `「${title}」（${artist}）の楽曲はすでに追加されています。`;
                    manageBtnArea.style.display = 'block';
                    btnManage.onclick = async () => {
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        const label = `manage_window_${Date.now()}`;
                        const targetUrl = new URL(`manage.html?mode=window&adv_title=${encodeURIComponent(item.title)}&adv_artist=${encodeURIComponent(item.artist)}`, window.location.href).href;
                        // ★ ウィンドウサイズを幅1250px・高さ880pxで開く
                        await invoke("open_new_window", {
                            label: label,
                            url: targetUrl,
                            title: "データベース管理 - Chordia",
                            width: 1250.0,
                            height: 880.0
                        });
                    };
                } else {
                    msgEl.innerHTML = window.i18n ? window.i18n.t('AddMusic.dup_bulk_msg', { title: title, artist: artist }) : `「${title}」（${artist}）の楽曲は一括追加の項目内で重複しています。`;
                    manageBtnArea.style.display = 'none';
                }

                const cleanup = () => {
                    modal.classList.remove('show');
                    setTimeout(() => modal.style.display = 'none', 300);
                    btnManage.onclick = null;
                    btnCancel.onclick = null;
                    btnSkip.onclick = null;
                    btnContinue.onclick = null;
                };

                btnCancel.onclick = () => { cleanup(); resolve('cancel'); };
                btnSkip.onclick = () => { cleanup(); resolve('skip'); };
                btnContinue.onclick = () => { cleanup(); resolve('continue'); };

                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            });
        },

        executeBulkImport: async function() {
            const btn = document.getElementById('btnSubmitBulk');
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            
            let validItems = [];
            let addedSignatures = new Set();
            
            for (let i = 0; i < this.scannedData.length; i++) {
                const item = this.scannedData[i];
                const title = (item.title || "").trim().toLowerCase();
                const artist = (item.artist || "").trim().toLowerCase();
                const sig = `${title}|${artist}`;
                
                let isExistingDup = false;
                let isPlaylistDup = false;

                if (title && artist) {
                    const duplicates = await invoke("check_duplicate_songs", { title: item.title, artist: item.artist });
                    if (duplicates.length > 0) isExistingDup = true;
                }
                
                if (!isExistingDup && addedSignatures.has(sig)) {
                    isPlaylistDup = true;
                }

                if (isExistingDup || isPlaylistDup) {
                    const action = await this.showBulkDuplicatePrompt(item, isExistingDup);
                    if (action === 'cancel') {
                        return;
                    } else if (action === 'skip') {
                        continue;
                    }
                }

                addedSignatures.add(sig);
                validItems.push(item);
            }

            if (validItems.length === 0) {
                u.showAlert(window.i18n ? window.i18n.t('Common.notice') : "お知らせ", window.i18n ? window.i18n.t('AddMusic.msg_no_songs_to_import') : "追加する楽曲がありません。");
                return;
            }

            const overlay = document.getElementById('loadingOverlay');
            const text = document.getElementById('loadingText');
            overlay.style.display = 'flex';
            btn.disabled = true;

            let successCount = 0;
            let failCount = 0;
            const total = validItems.length;

            for (let i = 0; i < total; i++) {
                const item = validItems[i];
                text.textContent = window.i18n ? window.i18n.t('AddMusic.loading_bulk_importing', { current: i + 1, total: total }) : `一括追加中... ${i + 1} / ${total}`;
                
                let cleanUrl = item.url;
                const match = item.url.match(/[?&]v=([^&]+)/) || item.url.match(/youtu\.be\/([^?]+)/) || item.url.match(/youtube\.com\/shorts\/([^?]+)/);
                if (match && match[1]) {
                    cleanUrl = `https://www.youtube.com/watch?v=${match[1]}`;
                }
                
                const payload = {
                    video_url: cleanUrl,
                    artwork_data: item.artwork_base64,
                    lyric: item.lyric,
                    title: item.title,
                    artist: item.artist
                };
                this.activeTags.forEach(t => {
                    if (t.key !== 'title' && t.key !== 'artist') {
                        payload[t.key] = item[t.key] || "";
                    }
                });

                try {
                    const res = await invoke("download_and_save_music", { data: payload });
                    if (res) successCount++;
                    else failCount++;
                } catch(e) {
                    failCount++;
                }
            }

            overlay.style.display = 'none';
            btn.disabled = false;

            u.showAlert(window.i18n ? window.i18n.t('Common.complete') : "追加完了", window.i18n ? window.i18n.t('AddMusic.alert_bulk_complete', { success: successCount, fail: failCount }) : `${successCount}曲の追加が完了しました。\n(失敗: ${failCount}曲)`);
            if (successCount > 0) {
                this.scannedData =[];
                document.getElementById('bulkResultArea').style.display = 'none';
                document.getElementById('bulkPlaylistUrl').value = '';
            }
        }
    });
})();
