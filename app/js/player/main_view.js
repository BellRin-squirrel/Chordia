(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.MainViewController = {
        playerSettings: null,
        selectedTrackIndices: new Set(), 
        lastTrackClickedIndex: null,    

        init: function() {
            const setClick = (id, fn) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', fn);
            };

            setClick('btnPlayAll', () => window.PlayerController.startPlaybackSession('normal'));
            setClick('btnShuffleAll', () => window.PlayerController.startPlaybackSession('shuffle'));
            
            document.addEventListener('click', (e) => {
                const isClickInTable = e.target.closest('.song-table tr');
                const isClickInMenu = e.target.closest('.context-menu');
                if (!isClickInTable && !isClickInMenu) this.clearSelection();

                const trackMenu = document.getElementById('trackContextMenu');
                if (trackMenu) trackMenu.style.display = 'none';

                document.querySelectorAll('.ph-sort-container .custom-select-dropdown').forEach(d => {
                    if (!e.target.closest('.custom-select-wrapper')) d.classList.remove('show');
                });
            });

            const searchBox = document.getElementById('playlistLocalSearch');
            if (searchBox) {
                searchBox.addEventListener('input', () => this.renderMainView());
            }

            this.initInfoModal();
            this.initTrackMenuEvents();
            this.initSmartRemoveModal();
        },

        initInfoModal: function() {
            const modal = document.getElementById('songInfoModal');
            if (!modal) return;
            const btnClose = document.getElementById('btnCloseInfo');
            if (btnClose) btnClose.onclick = () => modal.classList.remove('show');

            const tabs = modal.querySelectorAll('.tab-btn');
            tabs.forEach(btn => {
                btn.onclick = () => {
                    tabs.forEach(b => b.classList.remove('active'));
                    modal.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                    btn.classList.add('active');
                    const pane = document.getElementById(btn.dataset.target);
                    if (pane) pane.classList.add('active');
                };
            });
        },

        initTrackMenuEvents: function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const setClick = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

            setClick('menuSongInfo', () => this.openSongInfoModal());
            setClick('menuEditSmartRules', () => window.SidebarController.openSmartPlaylistModal(s.playlists[s.currentPlaylistIndex]));
            
            setClick('menuShowInExplorer', async () => {
                const songs = this.getSelectedSongs();
                if (songs.length > 0) {
                    try {
                        let path = songs[0].musicFilename;
                        // すべてのスラッシュをバックスラッシュに変換する
                        path = path.replace(/\//g, "\\");
                        await invoke("show_in_explorer", { path: path });
                    } catch(e) {
                        u.showToast("エクスプローラーの起動に失敗しました", true);
                    }
                }
            });
            
            setClick('menuRemoveFromPlaylist', async () => {
                const pl = s.playlists[s.currentPlaylistIndex];
                if (!pl) return;
                const songs = this.getSelectedSongs().map(song => song.musicFilename.split(/[\\/]/).pop());
                if (pl.type === 'smart') {
                    this.openSmartRemoveConfirmModal(pl.id, songs);
                } else {
                    const res = await invoke("remove_songs_from_playlist", { plId: pl.id, filenames: songs });
                    if (res) { 
                        s.playlists[s.currentPlaylistIndex] = res; 
                        this.renderMainView(); 
                        u.showToast("削除しました", false); 
                    }
                }
            });
        },

        initSmartRemoveModal: function() {
            const modal = document.getElementById('smartRemoveConfirmModal');
            if (!modal) return;
            const btnCancel = document.getElementById('btnCancelSmartRemove');
            const btnExec = document.getElementById('btnExecSmartRemove');
            if (btnCancel) btnCancel.onclick = () => modal.classList.remove('show');
            if (btnExec) {
                btnExec.onclick = async () => {
                    modal.classList.remove('show');
                    const plId = modal.dataset.plId;
                    const songs = JSON.parse(modal.dataset.songs);
                    try {
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        const res = await invoke("convert_smart_to_normal_and_remove_songs", { plId: plId, filenames: songs });
                        if (res) {
                            await window.SidebarController.loadPlaylists();
                            const newIdx = s.playlists.findIndex(p => p.id === plId);
                            if (newIdx !== -1) window.MainViewController.selectPlaylist(newIdx);
                            u.showToast("通常プレイリストに変換し削除しました", false);
                        }
                    } catch (e) { u.showToast("処理に失敗しました", true); }
                };
            }
        },

        openSmartRemoveConfirmModal: function(plId, songs) {
            const modal = document.getElementById('smartRemoveConfirmModal');
            if (!modal) return;
            modal.dataset.plId = plId;
            modal.dataset.songs = JSON.stringify(songs);
            modal.classList.add('show');
        },

        selectPlaylist: async function(index) {
            if (index === -1 || !s.playlists[index]) return;

            document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
            s.currentPlaylistIndex = index;
            s.currentPlaylistType = 'normal';
            this.clearSelection(); 
            window.SidebarController.renderSidebar(); 

            const searchBox = document.getElementById('playlistLocalSearch');
            if (searchBox) searchBox.value = '';

            const pl = s.playlists[index];
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

            try {
                const details = await invoke("get_playlist_details", { plId: pl.id });
                if (details) {
                    s.playlists[index] = details; 
                }
            } catch (e) {
                console.error(e);
            }

            await this.renderMainView();
        },

        clearSelection: function() {
            this.selectedTrackIndices.clear();
            this.lastTrackClickedIndex = null;
            this.updateSelectionUI();
        },

        updateSelectionUI: function() {
            const rows = document.querySelectorAll('.song-table tbody tr');
            rows.forEach((tr, idx) => {
                if (this.selectedTrackIndices.has(idx)) tr.classList.add('selected');
                else tr.classList.remove('selected');
            });
        },

        handleRowClick: function(index, event) {
            if (event.shiftKey && this.lastTrackClickedIndex !== null) {
                const start = Math.min(this.lastTrackClickedIndex, index);
                const end = Math.max(this.lastTrackClickedIndex, index);
                this.selectedTrackIndices.clear();
                for (let i = start; i <= end; i++) this.selectedTrackIndices.add(i);
            } else if (event.ctrlKey || event.metaKey) {
                if (this.selectedTrackIndices.has(index)) {
                    this.selectedTrackIndices.delete(index);
                } else {
                    this.selectedTrackIndices.add(index);
                }
                this.lastTrackClickedIndex = index;
            } else {
                this.selectedTrackIndices.clear();
                this.selectedTrackIndices.add(index);
                this.lastTrackClickedIndex = index;
            }
            this.updateSelectionUI();
        },

        getSelectedSongs: function() {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
            if (!targetPl || !targetPl.songs) return [];

            const sortedSongs = u.sortSongs(targetPl.songs, targetPl.sortBy, targetPl.sortDesc);
            return Array.from(this.selectedTrackIndices).map(idx => sortedSongs[idx]);
        },

        showTrackContextMenu: function(e) {
            const menu = document.getElementById('trackContextMenu');
            if (!menu) return;

            const isVirtual = s.currentPlaylistType === 'virtual';
            const pl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
            if (!pl) return;
            
            document.getElementById('menuRemoveFromPlaylist').style.display = isVirtual ? 'none' : 'block';
            document.getElementById('menuEditSmartRules').style.display = (pl.type === 'smart' && !isVirtual) ? 'block' : 'none';

            this.renderPlaylistSubmenu();

            menu.style.position = 'fixed'; 
            menu.style.display = 'block';
            menu.style.visibility = 'hidden';
            
            const mw = 220; const mh = menu.offsetHeight;
            let x = e.clientX; let y = e.clientY;
            if (x + mw > window.innerWidth) x -= mw;
            if (y + mh > window.innerHeight) y -= mh;
            
            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.visibility = 'visible';

            const submenu = document.getElementById('playlistSubmenu');
            if (submenu) {
                if (x + mw + 180 > window.innerWidth) submenu.classList.add('left-side');
                else submenu.classList.remove('left-side');
            }
        },

        renderPlaylistSubmenu: function() {
            const container = document.getElementById('playlistSubmenu');
            if (!container) return;
            container.innerHTML = '<ul><li id="subNewPlaylist">新規プレイリスト</li><li class="menu-divider"></li></ul>';
            const ul = container.querySelector('ul');
            s.playlists.forEach(p => {
                if (p.type !== 'smart') {
                    const li = document.createElement('li'); li.textContent = p.playlistName;
                    li.onclick = async () => {
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        const songs = this.getSelectedSongs().map(song => song.musicFilename.split(/[\\/]/).pop());
                        let targetPl = s.playlists.find(pl => pl.id === p.id);
                        if (!targetPl.music) targetPl = await invoke("get_playlist_details", { plId: p.id });
                        
                        const existingMusic = targetPl.music ||[];
                        const newSongs = songs.filter(fname => !existingMusic.includes(fname));
                        if (newSongs.length === 0) { u.showToast(`すでに追加されています`, true); return; }

                        const res = await invoke("add_songs_to_playlist", { plId: p.id, filenames: newSongs });
                        if (res) {
                            const idx = s.playlists.findIndex(pl => pl.id === res.id);
                            if (idx !== -1) s.playlists[idx] = res; 
                            u.showToast(`追加しました`, false);
                        }
                    };
                    ul.appendChild(li);
                }
            });
            const btnSubNew = document.getElementById('subNewPlaylist');
            if (btnSubNew) {
                btnSubNew.onclick = async () => {
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    const songs = this.getSelectedSongs();
                    const filenames = songs.map(song => song.musicFilename.split(/[\\/]/).pop());
                    const defaultName = songs.length === 1 ? songs[0].title : `${songs.length}個の楽曲`;
                    
                    const newPl = await invoke("create_playlist", { name: defaultName, plType: 'normal' });
                    if (filenames.length > 0 && newPl) {
                        await invoke("add_songs_to_playlist", { plId: newPl.id, filenames: filenames });
                    }
                    await window.SidebarController.loadPlaylists();
                    if (newPl) window.SidebarController.startRenameById(newPl.id);
                };
            }
        },

        openSongInfoModal: async function() {
            const selectedSongs = this.getSelectedSongs();
            if (selectedSongs.length === 0) return;
            const modal = document.getElementById('songInfoModal');
            if (!modal) return;

            const isVirtual = s.currentPlaylistType === 'virtual';
            const plName = isVirtual ? s.currentVirtualName : (s.playlists[s.currentPlaylistIndex] ? s.playlists[s.currentPlaylistIndex].playlistName : "Unknown");

            const imgEl = document.getElementById('infoArt');
            const largeImgEl = document.getElementById('largeArt');
            const titleEl = document.getElementById('infoTitle');
            const artistEl = document.getElementById('infoArtist');
            const albumEl = document.getElementById('infoAlbum');

            if (selectedSongs.length === 1) {
                const song = selectedSongs[0]; 
                if (imgEl) imgEl.src = song.imageData || s.DEFAULT_ICON;
                if (largeImgEl) largeImgEl.src = song.imageData || s.DEFAULT_ICON;
                if (titleEl) titleEl.textContent = song.title || "Unknown Title"; 
                if (artistEl) artistEl.textContent = song.artist || "Unknown Artist";
                if (albumEl) {
                    albumEl.textContent = song.album || ""; 
                    albumEl.style.display = song.album ? "block" : "none";
                }
                const lyrView = document.getElementById('infoLyrics');
                if (lyrView) lyrView.textContent = song.lyric || "歌詞情報はありません。";
            } else {
                const artworks = new Set(selectedSongs.map(song => song.imageData));
                const commonArt = (artworks.size === 1) ? Array.from(artworks)[0] : s.DEFAULT_ICON;
                if (imgEl) imgEl.src = commonArt;
                if (largeImgEl) largeImgEl.src = commonArt;
                if (titleEl) titleEl.textContent = `${selectedSongs.length}個の楽曲を選択中`; 
                if (artistEl) artistEl.textContent = `選択元: ${plName}`;
                if (albumEl) albumEl.style.display = "none"; 
                const lyrView = document.getElementById('infoLyrics');
                if (lyrView) lyrView.textContent = "複数選択時は歌詞を表示できません。";
            }
            const detailsList = document.getElementById('detailsList'); 
            if (detailsList) {
                detailsList.innerHTML = '';
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                if (!this.playerSettings) this.playerSettings = await invoke("get_app_settings");
                const allTags = await invoke("get_available_tags");
                const dbTags = allTags.filter(t => this.playerSettings.active_tags.includes(t.key));
                dbTags.forEach(tag => {
                    const row = document.createElement('div'); row.className = 'detail-item';
                    let valText = (selectedSongs.length === 1) ? (selectedSongs[0][tag.key] || "-") : 
                        (new Set(selectedSongs.map(s => s[tag.key] || ""))).size === 1 ? Array.from(new Set(selectedSongs.map(s => s[tag.key] || "")))[0] : "< 複数の値 >";
                    row.innerHTML = `<div class="detail-label">${tag.label}</div><div class="detail-value">${u.escapeHtml(valText)}</div>`;
                    detailsList.appendChild(row);
                });
            }
            const firstTab = modal.querySelector('.tab-btn[data-target="tab-details"]');
            if (firstTab) firstTab.click(); 
            modal.classList.add('show');
        },

        createCustomSelector: function(id, options, currentValue, onSelect) {
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            wrapper.id = `wrapper_${id}`;

            const trigger = document.createElement('button');
            trigger.className = 'custom-select-trigger';
            const currentLabel = options.find(o => o.value === currentValue)?.label || currentValue;
            trigger.innerHTML = `<span>${currentLabel}</span><svg class="custom-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>`;
            
            const dropdown = document.createElement('div');
            dropdown.className = 'custom-select-dropdown';

            options.forEach(opt => {
                const item = document.createElement('div');
                item.className = 'custom-option' + (opt.value === currentValue ? ' active' : '');
                item.innerHTML = `<svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4.5 12.75l6 6 9-13.5" /></svg><span>${opt.label}</span>`;
                item.onclick = (e) => {
                    e.stopPropagation();
                    trigger.querySelector('span').textContent = opt.label;
                    dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                    item.classList.add('active');
                    onSelect(opt.value);
                    dropdown.classList.remove('show');
                };
                dropdown.appendChild(item);
            });

            trigger.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            };

            wrapper.appendChild(trigger);
            wrapper.appendChild(dropdown);
            return wrapper;
        },

        renderMainView: async function() {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const target = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            if (!target || target.songs === null) return;
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            if (!this.playerSettings) this.playerSettings = await invoke("get_app_settings");

            const plData = target;
            const isDesc = plData.sortDesc === true;
            const sortedSongs = u.sortSongs(plData.songs, plData.sortBy, isDesc);
            
            const searchInput = document.getElementById('playlistLocalSearch');
            const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
            
            let songs = sortedSongs;
            if (query) {
                songs = sortedSongs.filter(song => {
                    return ['title', 'artist', 'album', 'genre', 'year', 'composer', 'comment'].some(key => {
                        return song[key] && String(song[key]).toLowerCase().includes(query);
                    });
                });
            }

            const visibleTags = this.playerSettings.player_visible_tags || ['title', 'artist', 'album'];
            
            document.getElementById('currentPlaylistTitle').textContent = plData.playlistName;
            document.getElementById('currentPlaylistCount').textContent = `${songs.length} 曲`;
            
            let totalSec = 0;
            songs.forEach(song => {
                if(song.duration && song.duration!=="--:--") {
                    const p = song.duration.split(':');
                    if(p.length===2) totalSec += parseInt(p[0])*60 + parseInt(p[1]);
                }
            });
            document.getElementById('currentPlaylistDuration').textContent = u.formatTotalDuration(totalSec);

            const cover = document.getElementById('playlistCoverArt');
            if (cover) {
                cover.removeAttribute('src');
                const targetImg = (songs.length > 0 && songs[0].imageData) ? songs[0].imageData : s.DEFAULT_ICON;
                cover.src = targetImg;
            }

            const sortArea = document.getElementById('phSortArea');
            if (sortArea) {
                sortArea.innerHTML = '';
                
                if (!isVirtual) {
                    let btnEdit = document.createElement('button');
                    btnEdit.className = 'btn-edit-rules';
                    btnEdit.id = 'btnEditRules';
                    btnEdit.textContent = 'ルールを編集';
                    btnEdit.style.display = (plData.type === 'smart') ? 'inline-block' : 'none';
                    btnEdit.onclick = () => window.SidebarController.openSmartPlaylistModal(plData);
                    sortArea.appendChild(btnEdit);
                }

                const sortLabel = document.createElement('span');
                sortLabel.className = 'ph-sort-label';
                sortLabel.textContent = '並び替え:';
                sortArea.appendChild(sortLabel);

                const allTags = await invoke("get_available_tags");
                const sortOptions = allTags.filter(t => this.playerSettings.active_tags.includes(t.key)).map(t => ({value: t.key, label: t.label}));
                
                const sortKeySelector = this.createCustomSelector('sortKey', sortOptions, plData.sortBy, async (val) => {
                    plData.sortBy = val;
                    if (!isVirtual) await invoke("update_playlist_by_id", { plId: plData.id, field: 'sortBy', value: val });
                    if (window.PlayerController && window.PlayerController.handleSortChanged) {
                        window.PlayerController.handleSortChanged(plData.songs, plData.sortBy, plData.sortDesc);
                    }
                    this.renderMainView();
                });
                sortArea.appendChild(sortKeySelector);

                const orderOptions =[{ value: 'asc', label: '昇順' }, { value: 'desc', label: '降順' }];
                const currentOrder = isDesc ? 'desc' : 'asc';
                const orderSelector = this.createCustomSelector('sortOrder', orderOptions, currentOrder, async (val) => {
                    const isDescending = (val === 'desc');
                    plData.sortDesc = isDescending;
                    if (!isVirtual) await invoke("update_playlist_by_id", { plId: plData.id, field: 'sortDesc', value: isDescending });
                    if (window.PlayerController && window.PlayerController.handleSortChanged) {
                        window.PlayerController.handleSortChanged(plData.songs, plData.sortBy, plData.sortDesc);
                    }
                    this.renderMainView();
                });
                sortArea.appendChild(orderSelector);
            }

            document.getElementById('playlistActions').style.display = 'flex';
            const tbody = document.getElementById('songListBody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            const fragment = document.createDocumentFragment();
            
            songs.forEach((song, idx) => {
                const tr = document.createElement('tr');
                const isPlaying = window.PlayerController && window.PlayerController.isSongPlaying(song);
                if (isPlaying) tr.classList.add('current-playing');
                if (this.selectedTrackIndices.has(idx)) tr.classList.add('selected');
                const artSrc = song.imageData || s.DEFAULT_ICON;
                let rowHtml = `
                    <td class="col-status">${isPlaying ? s.ICON_PLAYING : ''}</td>
                    <td class="col-art">
                        <div class="art-container">
                            <img src="${artSrc}">
                            <div class="art-overlay" onclick="event.stopPropagation(); window.MainViewController.playTrackAtIndex(${idx})">${s.SVG_PLAY}</div>
                        </div>
                    </td>
                `;
                visibleTags.forEach(tagKey => {
                    const val = u.escapeHtml(song[tagKey] || '');
                    rowHtml += `<td class="col-${tagKey}" title="${val}">${val}</td>`;
                });
                rowHtml += `<td class="col-time">${song.duration}</td>`;
                tr.innerHTML = rowHtml;

                tr.onclick = (e) => this.handleRowClick(idx, e);
                tr.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (!this.selectedTrackIndices.has(idx)) this.handleRowClick(idx, e);
                    this.showTrackContextMenu(e);
                };
                tr.ondblclick = (e) => {
                    if (e.target.closest('.art-container')) return;
                    window.PlayerController.startPlaybackSession('normal', idx);
                };
                fragment.appendChild(tr);
            });
            
            tbody.appendChild(fragment);
        },

        playTrackAtIndex: function(idx) {
            window.PlayerController.startPlaybackSession('normal', idx);
        }
    };
})();