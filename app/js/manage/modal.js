(function() {
    const s = window.ManageState;
    const u = window.ManageUtils;
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    window.ModalController = {
        init: function() {
            // 単体編集用のイベントバインディング
            document.getElementById('btnCancelLyric').onclick = () => document.getElementById('lyricModal').classList.remove('show');
            document.getElementById('btnCloseLyricModalX').onclick = () => document.getElementById('lyricModal').classList.remove('show');
            document.getElementById('btnCancelArt').onclick = () => document.getElementById('artModal').classList.remove('show');
            document.getElementById('btnCloseArtModalX').onclick = () => document.getElementById('artModal').classList.remove('show');
            document.getElementById('btnCancelDelete').onclick = () => document.getElementById('deleteModal').classList.remove('show');

            document.getElementById('btnSaveLyric').onclick = async () => {
                const text = document.getElementById('lyricTextArea').value;
                const item = s.libraryData[s.editingIndex];
                const success = await invoke("update_song_by_id", { 
                    musicFilename: item.musicFilename, 
                    field: 'lyric', 
                    value: text 
                });
                if (success) {
                    item.lyric = text;
                    u.showToast("歌詞を保存しました", false);
                    document.getElementById('lyricModal').classList.remove('show');
                    window.TableController.renderTable();
                }
            };

            document.getElementById('btnAutoLyricManage').onclick = () => this.searchLyrics();
            document.getElementById('btnCancelLyricSearchManage').onclick = () => document.getElementById('lyricSearchModalManage').classList.remove('show');
            document.getElementById('btnBackToResultManage').onclick = () => {
                document.getElementById('lyricSearchDetailViewManage').style.display = 'none';
                document.getElementById('lyricSearchListViewManage').style.display = 'flex';
            };

            const artMiniTabs = document.querySelectorAll('.art-mini-tab-btn');
            artMiniTabs.forEach(btn => {
                btn.onclick = () => {
                    const target = btn.dataset.target;
                    artMiniTabs.forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.art-mini-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const targetContent = document.getElementById(target);
                    if (targetContent) targetContent.classList.add('active');
                    this.showArtError(""); 
                };
            });

            document.getElementById('newArtInput').onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    s.newArtBase64 = ev.target.result;
                    this.updatePreviewImage(ev.target.result, "新しい画像 (反映前)");
                    this.showArtError("");
                };
                reader.readAsDataURL(file);
            };

            document.getElementById('btnFetchVideoArt').onclick = async () => {
                const url = document.getElementById('miniVideoUrl').value.trim();
                this.showArtError("");
                if (!url) { this.showArtError("URLを入力してください"); return; }
                const btn = document.getElementById('btnFetchVideoArt');
                const orgText = btn.textContent;
                btn.disabled = true; btn.textContent = "確認中...";
                try {
                    const status = await invoke("check_tools_status"); 
                    if (!status['yt-dlp'] || !status['ffmpeg']) {
                        this.showArtError("拡張機能が不足しています");
                        return;
                    }
                    btn.textContent = "取得中...";
                    const info = await invoke("fetch_video_info", { url: url });
                    if (info.status === 'success' && info.thumbnail) {
                        btn.textContent = "画像を変換中...";
                        const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                        if (b64) {
                            s.newArtBase64 = b64;
                            this.updatePreviewImage(b64, "動画サムネイル (反映前)");
                            u.showToast("サムネイルを取得しました");
                        } else { this.showArtError("画像の加工に失敗しました"); }
                    } else { this.showArtError(info.message || "動画情報の取得に失敗しました"); }
                } catch(e) { this.showArtError("エラーが発生しました"); }
                finally { btn.disabled = false; btn.textContent = orgText; }
            };

            document.getElementById('btnFetchDirectArt').onclick = async () => {
                const url = document.getElementById('miniImageUrl').value.trim();
                this.showArtError("");
                if (!url) { this.showArtError("URLを入力してください"); return; }
                const btn = document.getElementById('btnFetchDirectArt');
                const orgText = btn.textContent;
                btn.disabled = true; btn.textContent = "取得中...";
                try {
                    const res = await invoke("fetch_and_crop_image_url", { url: url });
                    if (res.status === 'success') {
                        s.newArtBase64 = res.data;
                        this.updatePreviewImage(res.data, "画像URL (反映前)");
                        u.showToast("画像を取得しました");
                    } else { this.showArtError("取得失敗: " + res.message); }
                } catch(e) { this.showArtError("通信エラーが発生しました"); }
                finally { btn.disabled = false; btn.textContent = orgText; }
            };

            document.getElementById('btnExecRemoveArt').onclick = () => {
                s.newArtBase64 = "REMOVE";
                this.updatePreviewImage(s.DEFAULT_ICON, "削除予定 (反映前)");
                this.showArtError("");
            };

            document.getElementById('btnSaveArt').onclick = async () => {
                const btn = document.getElementById('btnSaveArt');
                const originalText = btn.textContent;
                const item = s.libraryData[s.editingIndex];
                if (!item) return;
                if (s.newArtBase64 === null) { u.showToast("画像を選択または取得してください", true); return; }
                btn.disabled = true; btn.textContent = "適用中...";
                try {
                    const isRemove = (s.newArtBase64 === "REMOVE");
                    const b64 = isRemove ? null : s.newArtBase64;
                    const success = await invoke("update_song_artwork_by_id", { 
                        musicFilename: item.musicFilename, 
                        newArtBase64: b64, 
                        remove: isRemove 
                    });
                    if (success) {
                        u.showToast("アートワークを更新しました", false);
                        document.getElementById('artModal').classList.remove('show');
                        await window.TableController.loadTableData();
                    } else { this.showArtError("DB更新に失敗しました"); }
                } catch (e) { this.showArtError("保存中に例外が発生しました"); }
                finally { btn.disabled = false; btn.textContent = originalText; }
            };

            document.getElementById('btnExecDelete').onclick = async () => {
                const item = s.libraryData[s.editingIndex];
                const success = await invoke("delete_song_by_id", { musicFilename: item.musicFilename });
                if (success) {
                    u.showToast("削除しました", false);
                    document.getElementById('deleteModal').classList.remove('show');
                    window.TableController.loadTableData();
                }
            };

            // ★ 修正：分割された高度な検索および一括変更モジュールの初期化を実行
            if (window.AdvancedSearchController) window.AdvancedSearchController.init();
            if (window.BulkEditController) window.BulkEditController.init();
        },

        // ★ 修正：一括変更・一括削除は BulkEditController 側へ移譲 (main.jsなどの互換性維持用のファサード)
        openBulkEditModal: function() {
            if (window.BulkEditController) window.BulkEditController.open();
        },
        openBulkDeleteModal: function() {
            if (window.BulkEditController) window.BulkEditController.openBulkDelete();
        },
        openAdvancedSearch: function() {
            if (window.AdvancedSearchController) window.AdvancedSearchController.open();
        },

        showArtError: function(msg) {
            const errEl = document.getElementById('artErrorDisplay');
            if (!errEl) return;
            if (msg) {
                errEl.textContent = "⚠️ " + msg;
                errEl.style.display = 'block';
            } else {
                errEl.style.display = 'none';
                errEl.textContent = "";
            }
        },

        updatePreviewImage: function(src, statusText) {
            const imgEl = document.getElementById('currentArtPreview');
            const statusEl = document.getElementById('artStatusText');
            if (imgEl) imgEl.src = src;
            if (statusEl) statusEl.textContent = statusText;
        },

        openLyricModal: function(index) {
            s.editingIndex = index;
            const item = s.libraryData[index];
            document.getElementById('lyricTargetTitle').textContent = `${item.title} / ${item.artist}`;
            document.getElementById('lyricTextArea').value = item.lyric || "";
            document.getElementById('lyricModal').classList.add('show');
        },

        openArtModal: function(index) {
            s.editingIndex = index;
            s.newArtBase64 = null; 
            this.showArtError(""); 
            const item = s.libraryData[index];
            this.updatePreviewImage(item.imageData || s.DEFAULT_ICON, "現在の画像");
            document.getElementById('miniVideoUrl').value = '';
            document.getElementById('miniImageUrl').value = '';
            const defaultTab = document.querySelector('.art-mini-tab-btn[data-target="art-mini-local"]');
            if (defaultTab) defaultTab.click();
            document.getElementById('artModal').classList.add('show');
        },

        openDeleteModal: function(index) {
            s.editingIndex = index;
            const item = s.libraryData[index];
            document.getElementById('deleteTargetName').textContent = `${item.title} - ${item.artist}`;
            document.getElementById('deleteModal').classList.add('show');
        },

        searchLyrics: async function() {
            const item = s.libraryData[s.editingIndex];
            if (!item.title || !item.artist) { u.showToast("タイトルとアーティストが必要です", true); return; }
            const btn = document.getElementById('btnAutoLyricManage');
            const originalText = btn.textContent;
            btn.textContent = "検索中..."; btn.disabled = true;
            try {
                const data = await invoke("search_lyrics_online", { title: item.title, artist: item.artist });
                if (data.statusCode === 404 || data.error) { u.showToast("見つかりませんでした", true); return; }
                if (!Array.isArray(data) || data.length === 0) { u.showToast("見つかりませんでした", true); return; }

                const filtered = data.filter(d => d.plainLyrics);
                if (filtered.length === 0) {
                    u.showToast("見つかりませんでした", true);
                } else {
                    const list = document.getElementById('lyricResultListManage');
                    list.innerHTML = '';
                    filtered.forEach(d => {
                        const li = document.createElement('li');
                        li.className = 'lyric-result-item';
                        li.innerHTML = `
                            <div class="lyric-item-title">${u.escapeHtml(d.trackName)}</div>
                            <div class="lyric-item-artist">${u.escapeHtml(d.artistName)}</div>
                        `;
                        li.onclick = () => {
                            document.getElementById('lyricPreviewTextManage').textContent = d.plainLyrics;
                            document.getElementById('lyricSearchListViewManage').style.display = 'none';
                            document.getElementById('lyricSearchDetailViewManage').style.display = 'flex';
                            document.getElementById('btnApplyLyricManage').onclick = () => {
                                document.getElementById('lyricTextArea').value = d.plainLyrics;
                                document.getElementById('lyricSearchModalManage').classList.remove('show');
                            };
                        };
                        list.appendChild(li);
                    });
                    document.getElementById('lyricSearchListViewManage').style.display = 'flex';
                    document.getElementById('lyricSearchDetailViewManage').style.display = 'none';
                    document.getElementById('lyricSearchModalManage').classList.add('show');
                }
            } catch(e) { u.showToast("通信エラーが発生しました", true); }
            finally { btn.textContent = originalText; btn.disabled = false; }
        }
    };
})();