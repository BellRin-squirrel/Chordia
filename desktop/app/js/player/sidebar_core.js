(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.SidebarController = {
        deleteTargetIndex: -1,
        smartTags: [],
        editingSmartId: null, 
        currentView: 'playlist',

        init: function() {
            this.sidebar = document.getElementById('sidebar');
            this.playlistList = document.getElementById('playlistList');
            this.initCustomSelector();

            document.addEventListener('click', (e) => {
                const bg = document.getElementById('playlistBackgroundMenu');
                const it = document.getElementById('playlistItemMenu');
                const tr = document.getElementById('trackContextMenu');
                const customDropdown = document.getElementById('customSelectDropdown');

                if(bg) bg.style.display='none';
                if(it) it.style.display='none';
                if(tr) tr.style.display='none';
                
                if (customDropdown && !e.target.closest('#sidebarSelectorWrapper')) {
                    customDropdown.classList.remove('show');
                }
            });
            
            if (this.playlistList) {
                this.playlistList.addEventListener('contextmenu', (e) => {
                    if (window.SidebarController.currentView === 'playlist') {
                        if (e.target.closest('.playlist-item')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const menu = document.getElementById('playlistBackgroundMenu');
                        if (menu) window.SidebarController.showContextMenu(menu, e.clientX, e.clientY);
                    }
                });
            }

            const setClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

            setClick('menuNewPlaylist', () => { s.editingPlaylistIndex = 'new'; window.SidebarController.renderSidebar(); });
            setClick('menuNewSmartPlaylist', () => window.SidebarController.openSmartPlaylistModal());
            setClick('btnCancelSmart', () => document.getElementById('smartPlaylistModal').classList.remove('show'));
            setClick('btnCreateSmart', () => window.SidebarController.finishCreateSmart());

            setClick('menuPlayPlaylist', () => { window.MainViewController.selectPlaylist(s.contextTargetIndex); window.PlayerController.startPlaybackSession('normal'); });
            setClick('menuShufflePlaylist', () => { window.MainViewController.selectPlaylist(s.contextTargetIndex); window.PlayerController.startPlaybackSession('shuffle'); });
            setClick('menuRenamePlaylist', () => { s.editingPlaylistIndex = s.contextTargetIndex; window.SidebarController.renderSidebar(); });
            
            setClick('menuDuplicatePlaylist', async () => {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const plId = s.playlists[s.contextTargetIndex].id;
                const newPl = await invoke("duplicate_playlist_by_id", { plId: plId });
                if (newPl) {
                    s.playlists.push(newPl);
                    s.playlists.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                    window.SidebarController.renderSidebar();
                }
                u.showToast("複製しました", false);
            });

            setClick('menuDeletePlaylist', () => window.SidebarController.openDeleteModal(s.contextTargetIndex));
            setClick('btnCancelDelPl', () => document.getElementById('playlistDeleteModal').classList.remove('show'));
            setClick('btnExecDelPl', () => window.SidebarController.executeDelete());
            setClick('btnCancelSmartRemove', () => document.getElementById('smartRemoveConfirmModal').classList.remove('show'));

            document.addEventListener('keydown', (e) => {
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
                if (e.key === 'F2' && s.currentPlaylistIndex !== -1 && this.currentView === 'playlist') { 
                    e.preventDefault(); s.editingPlaylistIndex = s.currentPlaylistIndex; window.SidebarController.renderSidebar(); 
                }
                if (e.key === 'Delete' && s.currentPlaylistIndex !== -1 && this.currentView === 'playlist') { 
                    e.preventDefault(); window.SidebarController.openDeleteModal(s.currentPlaylistIndex); 
                }
            });
        },

        initCustomSelector: function() {
            const trigger = document.getElementById('customSelectTrigger');
            const dropdown = document.getElementById('customSelectDropdown');
            const options = document.querySelectorAll('.custom-option');
            const displayVal = document.getElementById('customSelectValue');

            if (!trigger || !dropdown) return;

            trigger.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
                dropdown.classList.toggle('show');
            };

            options.forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    const val = opt.dataset.value;
                    const label = opt.querySelector('span').textContent;
                    this.currentView = val;
                    displayVal.textContent = label;
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    dropdown.classList.remove('show');
                    this.renderSidebar();
                };
            });
        },

        createDynamicCustomSelector: function(options, currentValue, onSelect) {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'custom-select-trigger';
            const currentLabel = options.find(o => o.val === currentValue)?.label || currentValue;
            trigger.innerHTML = `<span>${currentLabel}</span><svg class="custom-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>`;
            
            const dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';
            options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'custom-option' + (opt.val === currentValue ? ' active' : '');
                item.innerHTML = `<svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4.5 12.75l6 6 9-13.5" /></svg><span>${opt.label}</span>`;
                item.onclick = (e) => {
                    e.stopPropagation();
                    trigger.querySelector('span').textContent = opt.label;
                    dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                    item.classList.add('active');
                    onSelect(opt.val);
                    dropdown.classList.remove('show');
                };
                dropdown.appendChild(item);
            });
            trigger.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
                dropdown.classList.toggle('show');
            };
            wrapper.appendChild(trigger);
            wrapper.appendChild(dropdown);
            return wrapper;
        },

        startRenameById: function(plId) {
            const idx = s.playlists.findIndex(p => p.id === plId);
            if (idx !== -1) {
                s.editingPlaylistIndex = idx;
                this.renderSidebar();
            }
        },

        loadPlaylists: async function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                // ★ 修正: 楽曲選択モーダル等で使うための全楽曲リストを最初に取得しておく
                s.fullLibrary = await invoke("get_library_chunk", {
                    page: 1, limit: 0, sortField: null, sortDesc: false, searchQuery: "", advancedConditions: null
                });

                const summaries = await invoke("get_playlist_summaries");
                summaries.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                
                s.playlists = summaries;
                this.renderSidebar();
                
                if (s.playlists.length > 0 && s.currentPlaylistIndex === -1) {
                    window.MainViewController.selectPlaylist(0);
                }
            } catch (e) { 
                console.error("Load Error:", e); 
                u.showToast("データの読み込みに失敗しました", true);
            }
        },

        renderSidebar: async function() {
            if(!this.playlistList) return;
            this.playlistList.innerHTML = '';
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            
            if (this.currentView === 'playlist') {
                s.playlists.forEach((pl, index) => {
                    const li = this.createSidebarItem(
                        pl.type === 'smart' ? 'smart' : 'playlist',
                        pl.playlistName,
                        index === s.editingPlaylistIndex,
                        s.currentPlaylistIndex === index && s.currentPlaylistType !== 'virtual',
                        (newName) => this.finishRename(index, newName),
                        () => window.MainViewController.selectPlaylist(index),
                        (e) => {
                            e.preventDefault(); e.stopPropagation(); s.contextTargetIndex = index;
                            const menu = document.getElementById('playlistItemMenu');
                            if (menu) window.SidebarController.showContextMenu(menu, e.clientX, e.clientY);
                        }
                    );
                    this.playlistList.appendChild(li);
                });
                if (s.editingPlaylistIndex === 'new') this.createTemporaryInput('normal');
            } 
            else if (this.currentView === 'album' || this.currentView === 'artist') {
                const list = (this.currentView === 'album') ? await invoke("get_album_list") : await invoke("get_artist_list");
                list.forEach(name => {
                    const isActive = s.currentVirtualName === name && s.currentPlaylistType === 'virtual' && s.currentVirtualField === this.currentView;
                    const li = this.createSidebarItem(
                        this.currentView,
                        name,
                        false,
                        isActive,
                        null,
                        () => this.selectVirtualPlaylist(this.currentView, name),
                        null 
                    );
                    this.playlistList.appendChild(li);
                });
            }
        },

        createSidebarItem: function(type, name, isEditing, isActive, onRename, onClick, onContext) {
            const li = document.createElement('li');
            li.className = 'playlist-item' + (isActive ? ' active' : '');
            
            let iconSvg = "";
            if (type === 'smart') iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>`;
            else if (type === 'album') iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>`;
            else if (type === 'artist') iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>`;
            else iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163z" /></svg>`;

            if (isEditing) {
                li.innerHTML = iconSvg;
                const input = document.createElement('input');
                input.type = 'text'; input.value = name; input.className = 'playlist-name-input';
                let cancelled = false;
                input.onblur = () => { if(!cancelled) onRename(input.value); };
                input.onkeydown = (e) => {
                    if(e.key === 'Enter') input.blur();
                    else if(e.key === 'Escape') { cancelled = true; s.editingPlaylistIndex = -1; this.renderSidebar(); }
                };
                li.appendChild(input); setTimeout(()=>input.select(), 0);
            } else {
                li.innerHTML = `${iconSvg}<span>${window.PlayerUtils.escapeHtml(name)}</span>`;
                li.onclick = onClick;
                if (onContext) li.addEventListener('contextmenu', onContext);
            }
            return li;
        },

        selectVirtualPlaylist: async function(field, value) {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                const virtualPl = await invoke("get_virtual_playlist_details", { field: field, value: value });
                if (virtualPl) {
                    s.currentVirtualPlaylist = virtualPl;
                    s.currentPlaylistType = 'virtual';
                    s.currentVirtualName = value;
                    s.currentVirtualField = field;
                    s.currentPlaylistIndex = -1; 
                    
                    this.renderSidebar();
                    window.MainViewController.renderMainView();
                }
            } catch(e) {
                console.error(e);
            }
        },

        createTemporaryInput: function(type = 'normal') {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            const iconSvg = type === 'smart' ? 
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>` :
                `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:20px;height:20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163z" /></svg>`;
            
            li.innerHTML = iconSvg;
            const input = document.createElement('input');
            input.type='text'; 
            input.value = type === 'smart' ? "新規スマートプレイリスト" : "新規プレイリスト"; 
            input.className='playlist-name-input';
            let cancelled=false;
            input.onblur=()=>{ if(!cancelled) window.SidebarController.finishCreate(input.value, type); };
            input.onkeydown=(e)=>{ 
                if(e.key==='Enter') input.blur(); 
                else if(e.key==='Escape') { cancelled=true; s.editingPlaylistIndex=-1; window.SidebarController.renderSidebar(); }
            };
            li.appendChild(input); this.playlistList.appendChild(li); setTimeout(()=>input.select(), 0);
        },

        finishCreate: async function(name, type) {
            s.editingPlaylistIndex = -1;
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const newPl = await invoke("create_playlist", { name: name, plType: type }); 
            if (newPl) {
                s.playlists.push(newPl);
                s.playlists.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                this.renderSidebar();
                window.MainViewController.selectPlaylist(s.playlists.findIndex(p => p.id === newPl.id));
            }
            u.showToast("作成しました", false);
        },

        finishRename: async function(index, newName) {
            s.editingPlaylistIndex = -1;
            if(!newName.trim()) { this.renderSidebar(); return; }
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const plId = s.playlists[index].id;
            const updatedPl = await invoke("update_playlist_by_id", { plId: plId, field: 'playlistName', value: newName }); 
            if (updatedPl) {
                s.playlists[index].playlistName = updatedPl.playlistName; 
                s.playlists.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                this.renderSidebar();
                const newIdx = s.playlists.findIndex(p => p.id === plId);
                s.currentPlaylistIndex = newIdx;
                this.renderSidebar();
            }
            u.showToast("更新しました", false);
        },

        showContextMenu: function(menu, x, y) {
            document.getElementById('playlistBackgroundMenu').style.display='none';
            document.getElementById('playlistItemMenu').style.display='none';
            document.getElementById('trackContextMenu').style.display='none';
            menu.style.position = 'fixed'; 
            menu.style.display = 'block'; 
            menu.style.visibility = 'hidden'; 
            const mw = menu.offsetWidth || 220; const mh = menu.offsetHeight || 220; 
            if (x + mw > window.innerWidth) x -= mw;
            if (y + mh > window.innerHeight) y -= mh;
            menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.style.visibility = 'visible'; 
        },

        openDeleteModal: function(index) {
            this.deleteTargetIndex = index;
            const pl = s.playlists[index];
            const nameEl = document.getElementById('delPlaylistName');
            const modal = document.getElementById('playlistDeleteModal');
            if(nameEl) nameEl.textContent = pl.playlistName;
            if(modal) modal.classList.add('show');
        },

        executeDelete: async function() {
            const modal = document.getElementById('playlistDeleteModal');
            if(modal) modal.classList.remove('show');
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const plId = s.playlists[this.deleteTargetIndex].id;
            await invoke("delete_playlist_by_id", { plId: plId });
            if (this.deleteTargetIndex === s.currentPlaylistIndex) s.currentPlaylistIndex = -1;
            s.playlists.splice(this.deleteTargetIndex, 1);
            this.renderSidebar();
            u.showToast("削除しました", false);
        }
    };
})();