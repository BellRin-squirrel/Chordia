window.LyricController = {
    currentSelectedLyric: "",

    init: function() {
        const u = window.AddMusicUtils;
        if (!u) { console.error("AddMusicUtils not loaded"); return; }

        const btnAuto = document.getElementById('btnAutoLyric');
        const modal = document.getElementById('lyricSearchModal');
        
        if (btnAuto) btnAuto.addEventListener('click', () => this.searchLyrics());

        const btnCancel = document.getElementById('btnCancelLyricSearch');
        if(btnCancel) btnCancel.onclick = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        };

        const btnBack = document.getElementById('btnBackToResult');
        if(btnBack) btnBack.onclick = () => {
            document.getElementById('lyricSearchDetailView').style.display = 'none';
            document.getElementById('lyricSearchListView').style.display = 'flex';
        };

        const btnApply = document.getElementById('btnApplyLyric');
        if(btnApply) btnApply.onclick = () => {
            const input = document.getElementById('lyric');
            if(input) input.value = this.currentSelectedLyric;
            
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
            u.showToast("歌詞を適用しました", false);
        };
    },

    searchLyrics: async function() {
        const u = window.AddMusicUtils;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        
        const titleEl = document.getElementById('tag_title');
        const artistEl = document.getElementById('tag_artist');
        const btn = document.getElementById('btnAutoLyric');

        const title = titleEl ? titleEl.value.trim() : "";
        const artist = artistEl ? artistEl.value.trim() : "";

        if (!title || !artist) { 
            u.showToast("タイトルとアーティストを入力してください", true); 
            return; 
        }

        const orgText = btn.textContent;
        btn.textContent = "検索中...";
        btn.disabled = true;

        try {
            // ★ 修正：Rustのコマンドを経由して安全にAPIアクセスを行う
            const data = await invoke("search_lyrics_online", { title: title, artist: artist });
            
            // API側で「見つからない(404)」等のエラーレスポンスが返ってきた場合
            if (data.statusCode === 404 || data.error) {
                u.showToast("見つかりませんでした", true);
                return;
            }

            // 配列でないか、空っぽの場合
            if (!Array.isArray(data) || data.length === 0) {
                u.showToast("見つかりませんでした", true);
                return;
            }

            const validData = data.filter(item => item.plainLyrics);
            
            if (validData.length === 0) {
                u.showToast("見つかりませんでした", true);
            } else {
                this.renderResults(validData);
                const modal = document.getElementById('lyricSearchModal');
                document.getElementById('lyricSearchListView').style.display = 'flex';
                document.getElementById('lyricSearchDetailView').style.display = 'none';
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            }
        } catch (e) {
            console.error(e);
            u.showToast("通信エラーが発生しました", true);
        } finally {
            btn.textContent = orgText;
            btn.disabled = false;
        }
    },

    renderResults: function(results) {
        const u = window.AddMusicUtils;
        const list = document.getElementById('lyricResultList');
        list.innerHTML = '';
        results.forEach(item => {
            const li = document.createElement('li');
            li.className = 'lyric-result-item';
            li.innerHTML = `
                <div class="lyric-item-title">${u.escapeHtml(item.trackName)}</div>
                <div class="lyric-item-artist">${u.escapeHtml(item.artistName)}</div>
            `;
            li.onclick = () => {
                this.currentSelectedLyric = item.plainLyrics;
                document.getElementById('lyricPreviewText').textContent = item.plainLyrics;
                document.getElementById('lyricSearchListView').style.display = 'none';
                document.getElementById('lyricSearchDetailView').style.display = 'flex';
            };
            list.appendChild(li);
        });
    }
};