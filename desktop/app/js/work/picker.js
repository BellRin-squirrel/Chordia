window.WorkPicker = {
    activeSlot: null,
    currentPickerType: 'playlist',
    rawPlaylists: [],
    rawAlbums: [],
    rawArtists: [],

    init: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const pickerTabs = document.getElementById('pickerTabs');
        const pickerSearchInput = document.getElementById('pickerSearchInput');
        const btnCloseModal = document.getElementById('btnCloseModal');
        const playlistSelectModal = document.getElementById('playlistSelectModal');

        try {
            this.rawPlaylists = await invoke("get_playlist_summaries");
            this.rawAlbums = await invoke("get_album_list");
            this.rawArtists = await invoke("get_artist_list");
        } catch(e) {
            console.error("Picker data load error:", e);
        }

        if (pickerTabs) {
            pickerTabs.querySelectorAll('.picker-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.type));
            });
        }

        if (pickerSearchInput) {
            pickerSearchInput.addEventListener('input', () => this.renderList());
        }

        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', () => this.close());
        }

        window.addEventListener('click', (e) => {
            if (e.target === playlistSelectModal) this.close();
        });
    },

    open: function(slotName) {
        this.activeSlot = slotName;
        const searchInput = document.getElementById('pickerSearchInput');
        if (searchInput) searchInput.value = '';
        this.switchTab('playlist');
        const modal = document.getElementById('playlistSelectModal');
        if (modal) modal.classList.add('show');
    },

    close: function() {
        const modal = document.getElementById('playlistSelectModal');
        if (modal) modal.classList.remove('show');
        this.activeSlot = null;
    },

    switchTab: function(type) {
        this.currentPickerType = type;
        const pickerTabs = document.getElementById('pickerTabs');
        if (pickerTabs) {
            pickerTabs.querySelectorAll('.picker-tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.type === type);
            });
        }
        this.renderList();
    },

    renderList: function() {
        const container = document.getElementById('pickerListContainer');
        const searchInput = document.getElementById('pickerSearchInput');
        if (!container) return;

        container.innerHTML = '';
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

        let items = [];
        let iconSvg = '';

        if (this.currentPickerType === 'playlist') {
            iconSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
            items = this.rawPlaylists
                .filter(p => !query || (p.playlistName && p.playlistName.toLowerCase().includes(query)))
                .map(p => ({ id: p.id, name: p.playlistName, type: 'playlist' }));
        } else if (this.currentPickerType === 'album') {
            iconSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>`;
            items = this.rawAlbums
                .filter(a => !query || (a && a.toLowerCase().includes(query)))
                .map(a => ({ id: a, name: a, type: 'album' }));
        } else if (this.currentPickerType === 'artist') {
            iconSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            items = this.rawArtists
                .filter(ar => !query || (ar && ar.toLowerCase().includes(query)))
                .map(ar => ({ id: ar, name: ar, type: 'artist' }));
        }

        if (items.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-sub); font-size:0.85rem;">該当する項目が見つかりません</div>`;
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'picker-item';
            div.innerHTML = `${iconSvg}<span>${this.escapeHtml(item.name)}</span>`;
            div.onclick = () => {
                if (window.WorkConfig) {
                    window.WorkConfig.setSlotItem(this.activeSlot, item);
                }
                this.close();
            };
            container.appendChild(div);
        });
    },

    escapeHtml: function(str) {
        return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }
};