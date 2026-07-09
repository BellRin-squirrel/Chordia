window.DuplicateController = {
    duplicateMatches:[],

    init: function() {
        const btnShowExisting = document.getElementById('btnShowExisting');
        if (btnShowExisting) {
            btnShowExisting.onclick = () => this.showExistingSongs();
        }

        const btnCloseExisting = document.getElementById('btnCloseExisting');
        if (btnCloseExisting) {
            btnCloseExisting.onclick = () => {
                const modal = document.getElementById('existingSongsModal');
                if(modal) {
                    modal.querySelectorAll('.ex-audio').forEach(a => a.pause());
                    modal.classList.remove('show');
                    setTimeout(() => modal.style.display = 'none', 300);
                }
            };
        }
    },

    checkDuplicates: async function() {
        const title = document.getElementById('tag_title')?.value.trim();
        const artist = document.getElementById('tag_artist')?.value.trim();
        const warningBox = document.getElementById('duplicateWarning');

        if (!title || !artist) {
            if(warningBox) warningBox.style.display = 'none';
            this.duplicateMatches =[];
            return;
        }

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        this.duplicateMatches = await invoke("check_duplicate_songs", { title: title, artist: artist });
        
        if (warningBox) {
            if (this.duplicateMatches.length > 0) {
                warningBox.style.display = 'flex';
            } else {
                warningBox.style.display = 'none';
            }
        }
    },

    showExistingSongs: function() {
        const list = document.getElementById('existingSongsList');
        const modal = document.getElementById('existingSongsModal');
        if(!list || !modal) return;

        list.innerHTML = '';
        
        this.duplicateMatches.forEach(song => {
            const item = document.createElement('div');
            item.className = 'existing-song-item';
            // Tauriではローカルファイルの再生に工夫が必要なため、プレビュー再生機能は一旦見送ります
            item.innerHTML = `
                <img src="${song.imageData || 'icon/Chordia.png'}">
                <div class="existing-song-info">
                    <div style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${window.AddMusicUtils.escapeHtml(song.title)}</div>
                    <div style="font-size:0.8rem; color:var(--text-sub);">${window.AddMusicUtils.escapeHtml(song.album || 'Unknown Album')}</div>
                </div>
            `;
            list.appendChild(item);
        });
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    },

    hasDuplicates: function() {
        return this.duplicateMatches.length > 0;
    },

    reset: function() {
        this.duplicateMatches =[];
        const warningBox = document.getElementById('duplicateWarning');
        if(warningBox) warningBox.style.display = 'none';
    }
};