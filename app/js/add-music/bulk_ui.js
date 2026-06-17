(function() {
    const u = window.AddMusicUtils;

    Object.assign(window.BulkController, {
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
                    <td><input type="text" value="${u.escapeHtml(item.title)}" onchange="window.BulkController.updateData(${idx}, 'title', this.value)"></td>
                    <td><input type="text" value="${u.escapeHtml(item.artist)}" onchange="window.BulkController.updateData(${idx}, 'artist', this.value)"></td>`;
                
                this.activeTags.forEach(t => { 
                    if(t.key !== 'title' && t.key !== 'artist') {
                        row += `<td><input type="text" value="${u.escapeHtml(item[t.key]||'')}" onchange="window.BulkController.updateData(${idx}, '${t.key}', this.value)"></td>`; 
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

        openYoutube: function(url) {
            const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/) || url.match(/youtube\.com\/shorts\/([^?]+)/);
            if (match && match[1]) {
                const modal = document.getElementById('youtubeModal');
                document.getElementById('youtubeIframe').src = `https://www.youtube.com/embed/${match[1]}`;
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            } else {
                u.showToast("動画IDが解析できません", true);
            }
        },

        openLyricModal: function(idx) {
            this.currentEditIndex = idx;
            const item = this.scannedData[idx];
            document.getElementById('bulkLyricTargetTitle').textContent = `${item.title} / ${item.artist}`;
            document.getElementById('bulkLyricTextArea').value = item.lyric || "";
            const modal = document.getElementById('bulkLyricModal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        },

        // 修正：モーダルオープン時、入力状態やエラー表示、初期タブを綺麗にリセット
        openArtModal: function(idx) {
            this.currentEditIndex = idx;
            const item = this.scannedData[idx];
            
            const artPreview = document.getElementById('currentBulkArtPreview');
            artPreview.src = item.artwork_base64 || item.thumbnail || 'icon/Chordia.png';
            
            document.getElementById('bulkMiniVideoUrl').value = '';
            document.getElementById('bulkMiniImageUrl').value = '';
            document.getElementById('bulkArtStatusText').textContent = "現在の画像";
            
            const errEl = document.getElementById('bulkArtErrorDisplay');
            if (errEl) errEl.style.display = 'none';

            // 初期タブとして「ローカル」をアクティブ化
            const defaultTab = document.querySelector('#bulkArtTabsMini .art-mini-tab-btn[data-target="bulk-art-mini-local"]');
            if (defaultTab) defaultTab.click();

            const modal = document.getElementById('bulkArtModal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        },

        openDeleteModal: function(idx) {
            this.currentEditIndex = idx;
            document.getElementById('bulkDeleteTargetName').textContent = this.scannedData[idx].title;
            const modal = document.getElementById('bulkDeleteModal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    });
})();