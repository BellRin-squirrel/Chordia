window.BulkController = {
    scannedData:[],
    activeTags:[],
    currentEditIndex: -1,
    
    init: async function() {
        const u = window.AddMusicUtils;
        
        // タブ切り替えの設定
        document.querySelectorAll('.tab-menu .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-menu .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).style.display = 'block';
            });
        });

        // 取得ボタン
        document.getElementById('btnFetchBulk').addEventListener('click', () => this.fetchPlaylist());
        
        // 一括追加ボタン
        document.getElementById('btnSubmitBulk').addEventListener('click', () => this.executeBulkImport());

        // モーダルの閉じるボタン
        const closeModals = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
        };
        
        const setClose = (id) => { const el = document.getElementById(id); if(el) el.onclick = closeModals; };
        setClose('btnCloseYoutube');
        setClose('btnCancelBulkLyric');
        setClose('btnCloseBulkLyricModalX');
        setClose('btnCancelBulkArt');
        setClose('btnCloseBulkArtModalX');
        setClose('btnCancelBulkDelete');
        
        // 歌詞保存
        document.getElementById('btnSaveBulkLyric').onclick = () => {
            this.scannedData[this.currentEditIndex].lyric = document.getElementById('bulkLyricTextArea').value;
            closeModals();
            u.showToast("反映しました", false);
        };
        
        // 自動歌詞取得 (LRCLIB)
        document.getElementById('btnAutoBulkLyric').onclick = async () => {
            const item = this.scannedData[this.currentEditIndex];
            if(!item.title || !item.artist) { u.showToast("タイトルとアーティストが必要です", true); return; }
            const btn = document.getElementById('btnAutoBulkLyric');
            btn.textContent = "検索中..."; btn.disabled = true;
            try {
                const res = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(item.title)}&artist_name=${encodeURIComponent(item.artist)}`);
                const data = await res.json();
                const filtered = data.filter(d => d.plainLyrics);
                if(filtered.length > 0) {
                    // 簡単のため、最初に見つかったものを直接セットする（より高度にする場合は別モーダル）
                    document.getElementById('bulkLyricTextArea').value = filtered[0].plainLyrics;
                    u.showToast("歌詞を取得しました", false);
                } else { u.showToast("見つかりませんでした", true); }
            } catch(e) { u.showToast("エラー", true); } finally { btn.textContent = "自動取得 (LRCLIB)"; btn.disabled = false; }
        };

        // アートワーク関連
        const artPreview = document.getElementById('currentBulkArtPreview');
        document.getElementById('newBulkArtInput').onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => artPreview.src = ev.target.result;
            reader.readAsDataURL(file);
        };
        document.getElementById('btnSaveBulkArt').onclick = () => {
            this.scannedData[this.currentEditIndex].artwork_base64 = artPreview.src;
            closeModals();
            this.renderTable();
            u.showToast("反映しました", false);
        };
    },

    fetchPlaylist: async function() {
        const u = window.AddMusicUtils;
        const url = document.getElementById('bulkPlaylistUrl').value.trim();
        if (!url) { u.showToast("URLを入力してください", true); return; }

        const btn = document.getElementById('btnFetchBulk');
        btn.textContent = "取得中...";
        btn.disabled = true;

        try {
            const settings = await eel.get_app_settings()();
            const allTags = await eel.get_available_tags()();
            this.activeTags = allTags.filter(t => settings.active_tags.includes(t.key));

            const res = await eel.fetch_youtube_playlist(url)();
            if (res.status === 'success') {
                this.scannedData = res.videos.map((v, idx) => {
                    const item = { id: idx + 1, url: v.url, title: v.title, artist: v.uploader, thumbnail: v.thumbnail, lyric: '', artwork_base64: '' };
                    this.activeTags.forEach(t => { if(t.key !== 'title' && t.key !== 'artist') item[t.key] = ''; });
                    return item;
                });
                
                document.getElementById('bulkResultArea').style.display = 'block';
                this.renderTable();
                this.processThumbnailsBackground(); // 裏でサムネをクロップ
            } else {
                u.showAlert(res.message);
            }
        } catch(e) {
            u.showToast("通信エラーが発生しました", true);
        } finally {
            btn.textContent = "取得";
            btn.disabled = false;
        }
    },

    renderTable: function() {
        const thead = document.getElementById('bulkTableHeader');
        const tbody = document.getElementById('bulkTableBody');
        
        let h = `<tr><th>No.</th><th>アート</th><th>タイトル *</th><th>アーティスト *</th>`;
        this.activeTags.forEach(t => { if(t.key !== 'title' && t.key !== 'artist') h += `<th>${t.label}</th>`; });
        h += `<th>URL</th><th>操作</th></tr>`;
        thead.innerHTML = h;

        tbody.innerHTML = '';
        this.scannedData.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const artSrc = item.artwork_base64 || item.thumbnail || 'icon/Chordia.png';
            
            let row = `<td>${item.id}</td>
                <td class="col-art-thumb"><img id="bulk-art-${idx}" src="${artSrc}"></td>
                <td><input type="text" value="${window.AddMusicUtils.escapeHtml(item.title)}" onchange="window.BulkController.updateData(${idx}, 'title', this.value)"></td>
                <td><input type="text" value="${window.AddMusicUtils.escapeHtml(item.artist)}" onchange="window.BulkController.updateData(${idx}, 'artist', this.value)"></td>`;
            
            this.activeTags.forEach(t => { 
                if(t.key !== 'title' && t.key !== 'artist') {
                    row += `<td><input type="text" value="${window.AddMusicUtils.escapeHtml(item[t.key]||'')}" onchange="window.BulkController.updateData(${idx}, '${t.key}', this.value)"></td>`; 
                }
            });
            
            row += `<td><span class="yt-link" onclick="window.BulkController.openYoutube('${item.url}')">動画を見る</span></td>
                <td class="col-action">
                    <button class="btn-icon-action" onclick="window.BulkController.openLyricModal(${idx})" title="歌詞を編集"><svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                    <button class="btn-icon-action" onclick="window.BulkController.openArtModal(${idx})" title="アートワークを変更"><svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></button>
                    <button class="btn-del-row" onclick="window.BulkController.openDeleteModal(${idx})">削除</button>
                </td>`;
            tr.innerHTML = row;
            tbody.appendChild(tr);
        });
    },

    updateData: function(idx, key, val) {
        this.scannedData[idx][key] = val;
    },

    processThumbnailsBackground: async function() {
        for (let i = 0; i < this.scannedData.length; i++) {
            if (this.scannedData[i].thumbnail && !this.scannedData[i].artwork_base64) {
                try {
                    const b64 = await eel.fetch_and_crop_thumbnail(this.scannedData[i].thumbnail)();
                    if (b64) {
                        this.scannedData[i].artwork_base64 = b64;
                        const imgEl = document.getElementById(`bulk-art-${i}`);
                        if (imgEl) imgEl.src = b64;
                    }
                } catch(e) {}
            }
        }
    },

    openYoutube: function(url) {
        let videoId = "";
        if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        
        if (videoId) {
            document.getElementById('youtubeIframe').src = `https://www.youtube.com/embed/${videoId}`;
            document.getElementById('youtubeModal').classList.add('show');
        } else {
            window.AddMusicUtils.showToast("動画IDが解析できません", true);
        }
    },

    openLyricModal: function(idx) {
        this.currentEditIndex = idx;
        const item = this.scannedData[idx];
        document.getElementById('bulkLyricTargetTitle').textContent = `${item.title} / ${item.artist}`;
        document.getElementById('bulkLyricTextArea').value = item.lyric || "";
        document.getElementById('bulkLyricModal').classList.add('show');
    },

    openArtModal: function(idx) {
        this.currentEditIndex = idx;
        const item = this.scannedData[idx];
        document.getElementById('currentBulkArtPreview').src = item.artwork_base64 || item.thumbnail || 'icon/Chordia.png';
        document.getElementById('bulkArtModal').classList.add('show');
    },

    openDeleteModal: function(idx) {
        this.currentEditIndex = idx;
        document.getElementById('bulkDeleteTargetName').textContent = this.scannedData[idx].title;
        document.getElementById('btnExecBulkDelete').onclick = () => {
            this.scannedData.splice(this.currentEditIndex, 1);
            document.getElementById('bulkDeleteModal').classList.remove('show');
            this.renderTable();
        };
        document.getElementById('bulkDeleteModal').classList.add('show');
    },

    executeBulkImport: async function() {
        const u = window.AddMusicUtils;
        const btn = document.getElementById('btnSubmitBulk');
        
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        overlay.style.display = 'flex';
        btn.disabled = true;

        let successCount = 0;
        let failCount = 0;
        const total = this.scannedData.length;

        for (let i = 0; i < total; i++) {
            const item = this.scannedData[i];
            text.textContent = `一括追加中... ${i + 1} / ${total}`;
            
            const payload = {
                video_url: item.url,
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
                const res = await eel.download_and_save_music(payload)();
                if (res) successCount++;
                else failCount++;
            } catch(e) {
                failCount++;
            }
        }

        overlay.style.display = 'none';
        btn.disabled = false;

        u.showAlert(`${successCount}曲の追加が完了しました。\n(失敗: ${failCount}曲)`);
        if (successCount > 0) {
            this.scannedData =[];
            document.getElementById('bulkResultArea').style.display = 'none';
            document.getElementById('bulkPlaylistUrl').value = '';
        }
    }
};