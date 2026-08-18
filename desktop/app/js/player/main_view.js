(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.MainViewController = {
        playerSettings: null,
        selectedTrackIndices: new Set(), 
        lastTrackClickedIndex: null,    
        selectedCoverData: { type: 'keep', val: null },
        currentPlSongsForCover: [],

        init: function() {
            const setClick = (id, fn) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', fn);
            };

            setClick('btnPlayAll', () => window.PlayerController.startPlaybackSession('normal'));
            setClick('btnShuffleAll', () => window.PlayerController.startPlaybackSession('shuffle'));
            setClick('btnEditPlaylistCover', () => this.openPlaylistCoverModal());

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

            const btnEditRules = document.getElementById('btnEditRules');
            if (btnEditRules) {
                btnEditRules.addEventListener('click', () => {
                    if (s.currentPlaylistIndex !== -1 && s.playlists[s.currentPlaylistIndex]) {
                        const pl = s.playlists[s.currentPlaylistIndex];
                        if (pl.type === 'smart' && window.SidebarController && window.SidebarController.openSmartPlaylistModal) {
                            window.SidebarController.openSmartPlaylistModal(pl);
                        }
                    }
                });
            }

            this.initInfoModal();
            this.initTrackMenuEvents();
            this.initSmartRemoveModal();
            this.initCoverModal();
        },

        initCoverModal: function() {
            const modal = document.getElementById('playlistCoverModal');
            if (!modal) return;

            const btnCloseX = document.getElementById('btnClosePlCoverModalX');
            const btnCancel = document.getElementById('btnCancelPlCover');
            const btnSave = document.getElementById('btnSavePlCover');

            const closeModal = () => modal.classList.remove('show');
            if (btnCloseX) btnCloseX.onclick = closeModal;
            if (btnCancel) btnCancel.onclick = closeModal;

            const tabs = modal.querySelectorAll('#plCoverTabsMini .art-mini-tab-btn');
            tabs.forEach(btn => {
                btn.onclick = () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    modal.querySelectorAll('.art-mini-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const content = document.getElementById(btn.dataset.target);
                    if (content) content.classList.add('active');
                };
            });

            const songSearchInput = document.getElementById('plCoverSongSearch');
            if (songSearchInput) {
                songSearchInput.oninput = (e) => {
                    this.filterCoverSongGrid(e.target.value);
                };
            }

            const dropZone = document.getElementById('plCoverDropZone');
            const fileInput = document.getElementById('plCoverFileInput');

            if (dropZone && fileInput) {
                dropZone.onclick = () => fileInput.click();
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) this.handleCoverFile(file);
                };

                ['dragenter', 'dragover'].forEach(ev => {
                    dropZone.addEventListener(ev, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropZone.classList.add('dragover');
                    }, false);
                });
                ['dragleave', 'drop'].forEach(ev => {
                    dropZone.addEventListener(ev, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropZone.classList.remove('dragover');
                    }, false);
                });
                dropZone.addEventListener('drop', (e) => {
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        this.handleCoverFile(e.dataTransfer.files[0]);
                    }
                });
            }

            if (btnSave) {
                btnSave.onclick = async () => {
                    if (s.currentPlaylistIndex === -1 && s.currentPlaylistType === 'virtual') return;
                    const pl = s.playlists[s.currentPlaylistIndex];
                    if (!pl) return;

                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    try {
                        let newUrl = null;
                        if (this.selectedCoverData.type === 'file' && this.selectedCoverData.val) {
                            newUrl = await invoke("save_playlist_cover_image", {
                                plId: pl.id,
                                b64Data: this.selectedCoverData.val
                            });
                        } else if (this.selectedCoverData.type === 'song' && this.selectedCoverData.val) {
                            newUrl = await invoke("set_playlist_cover_from_song", {
                                plId: pl.id,
                                songImagePath: this.selectedCoverData.val
                            });
                        }

                        if (newUrl) {
                            const coverImg = document.getElementById('playlistCoverArt');
                            if (coverImg) coverImg.src = newUrl;
                            u.showToast(window.i18n ? window.i18n.t('Messages.art_updated') : "カバーアートを更新しました", false);
                        }
                        closeModal();
                    } catch (err) {
                        console.error("Cover save error:", err);
                        u.showToast(window.i18n ? window.i18n.t('Common.error') : "保存に失敗しました", true);
                    }
                };
            }
        },

        handleCoverFile: function(file) {
            if (!file) return;
            if (!file.name.toLowerCase().endsWith('.png')) {
                u.showToast(window.i18n ? window.i18n.t('Player.drop_cover_sub') : "PNG画像を選択してください", true);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const b64 = e.target.result;
                this.selectedCoverData = { type: 'file', val: b64 };
                const previewImg = document.getElementById('plCoverPreviewImg');
                if (previewImg) previewImg.src = b64;
                const statusText = document.getElementById('plCoverStatusText');
                if (statusText) statusText.textContent = file.name;
            };
            reader.readAsDataURL(file);
        },

        openPlaylistCoverModal: function() {
            if (s.currentPlaylistType === 'virtual') return;
            const pl = s.playlists[s.currentPlaylistIndex];
            if (!pl) return;

            const modal = document.getElementById('playlistCoverModal');
            if (!modal) return;

            this.selectedCoverData = { type: 'keep', val: null };
            const previewImg = document.getElementById('plCoverPreviewImg');
            const coverImg = document.getElementById('playlistCoverArt');
            if (previewImg && coverImg) previewImg.src = coverImg.src;

            const statusText = document.getElementById('plCoverStatusText');
            if (statusText) statusText.textContent = window.i18n ? window.i18n.t('Player.cover_status_title') : "選択中のカバーアート";

            this.currentPlSongsForCover = pl.songs || [];
            this.renderCoverSongGrid(this.currentPlSongsForCover);

            const defaultTab = modal.querySelector('#plCoverTabsMini .art-mini-tab-btn[data-target="pl-cover-tab-local"]');
            if (defaultTab) defaultTab.click();

            modal.classList.add('show');
        },

        renderCoverSongGrid: function(songs) {
            const grid = document.getElementById('plCoverSongGrid');
            if (!grid) return;
            grid.innerHTML = '';

            const uniqueImages = new Map();
            songs.forEach(song => {
                const imgPath = song.imageFilename;
                if (imgPath && !uniqueImages.has(imgPath)) {
                    uniqueImages.set(imgPath, song);
                }
            });

            if (uniqueImages.size === 0) {
                grid.innerHTML = `<p style="grid-column:1/-1; color:var(--text-sub); font-size:0.85rem;">${window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "楽曲画像がありません"}</p>`;
                return;
            }

            uniqueImages.forEach((song, imgPath) => {
                const item = document.createElement('div');
                item.className = 'cover-song-item';
                item.title = `${song.title || ''} - ${song.artist || ''}`;
                item.innerHTML = `<img src="${song.imageData || s.DEFAULT_ICON}" alt="Song Art">`;
                item.onclick = () => {
                    grid.querySelectorAll('.cover-song-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    this.selectedCoverData = { type: 'song', val: imgPath };
                    const previewImg = document.getElementById('plCoverPreviewImg');
                    if (previewImg) previewImg.src = song.imageData || s.DEFAULT_ICON;
                    const statusText = document.getElementById('plCoverStatusText');
                    if (statusText) statusText.textContent = `${song.title || 'Unknown'} (${song.artist || ''})`;
                };
                grid.appendChild(item);
            });
        },

        filterCoverSongGrid: function(query) {
            const q = query ? query.toLowerCase().trim() : '';
            if (!q) {
                this.renderCoverSongGrid(this.currentPlSongsForCover);
                return;
            }
            const filtered = this.currentPlSongsForCover.filter(s => {
                return (s.title && s.title.toLowerCase().includes(q)) ||
                       (s.artist && s.artist.toLowerCase().includes(q)) ||
                       (s.album && s.album.toLowerCase().includes(q));
            });
            this.renderCoverSongGrid(filtered);
        },

        selectPlaylist: async function(index) {
            if (index < 0 || index >= s.playlists.length) return;
            s.currentPlaylistIndex = index;
            s.currentPlaylistType = 'normal';
            s.currentVirtualPlaylist = null;

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const targetPl = s.playlists[index];

            try {
                const details = await invoke("get_playlist_details", { plId: targetPl.id });
                if (details) {
                    s.playlists[index] = details;
                }
            } catch (e) {
                console.error("Failed to load playlist details:", e);
            }

            if (window.SidebarController) {
                window.SidebarController.renderSidebar();
            }

            await this.updatePlaylistCoverUI(s.playlists[index]);
            this.renderMainView();
        },

        updatePlaylistCoverUI: async function(pl) {
            const coverImg = document.getElementById('playlistCoverArt');
            const btnEditCover = document.getElementById('btnEditPlaylistCover');

            if (!coverImg) return;

            if (s.currentPlaylistType === 'virtual') {
                if (btnEditCover) btnEditCover.style.display = 'none';
                coverImg.src = s.DEFAULT_ICON;
                return;
            }

            if (btnEditCover) btnEditCover.style.display = 'flex';

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const firstSongImg = (pl.songs && pl.songs.length > 0) ? pl.songs[0].imageFilename : null;

            try {
                const coverUrl = await invoke("get_playlist_cover", {
                    plId: pl.id,
                    firstSongImage: firstSongImg
                });
                coverImg.src = coverUrl || s.DEFAULT_ICON;
            } catch (e) {
                coverImg.src = s.DEFAULT_ICON;
            }
        },

        renderMainView: async function() {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            const titleEl = document.getElementById('currentPlaylistTitle');
            const countEl = document.getElementById('currentPlaylistCount');
            const durationEl = document.getElementById('currentPlaylistDuration');
            const actionsEl = document.getElementById('playlistActions');
            const btnEditRules = document.getElementById('btnEditRules');
            const tbody = document.getElementById('songListBody');

            if (!targetPl) {
                if (titleEl) titleEl.textContent = window.i18n ? window.i18n.t('Player.select_playlist_placeholder') : "プレイリストを選択";
                if (countEl) countEl.textContent = "--";
                if (durationEl) durationEl.textContent = "--";
                if (actionsEl) actionsEl.style.display = 'none';
                if (btnEditRules) btnEditRules.style.display = 'none';
                if (tbody) tbody.innerHTML = '';
                return;
            }

            if (titleEl) titleEl.textContent = targetPl.playlistName || 'Untitled';
            if (actionsEl) actionsEl.style.display = 'flex';
            if (btnEditRules) {
                btnEditRules.style.display = (targetPl.type === 'smart') ? 'inline-block' : 'none';
            }

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            if (!this.playerSettings) {
                try {
                    this.playerSettings = await invoke("get_app_settings");
                } catch (e) {
                    console.error(e);
                }
            }

            const visibleTags = (this.playerSettings && this.playerSettings.player_visible_tags)
                ? this.playerSettings.player_visible_tags
                : ['title', 'artist', 'album', 'track'];

            this.renderSortOptions(targetPl, visibleTags);

            let songs = targetPl.songs || [];

            const searchBox = document.getElementById('playlistLocalSearch');
            const query = searchBox ? searchBox.value.toLowerCase().trim() : '';
            if (query) {
                songs = songs.filter(song => {
                    return (song.title && song.title.toLowerCase().includes(query)) ||
                           (song.artist && song.artist.toLowerCase().includes(query)) ||
                           (song.album && song.album.toLowerCase().includes(query)) ||
                           (song.genre && song.genre.toLowerCase().includes(query)) ||
                           (song.composer && song.composer.toLowerCase().includes(query));
                });
            }

            songs = u.sortSongs(songs, targetPl.sortBy || 'title', targetPl.sortDesc || false);

            if (countEl) {
                countEl.textContent = (window.i18n && window.i18n.t)
                    ? window.i18n.t('Player.song_count', { count: songs.length })
                    : `${songs.length} 曲`;
            }

            let totalSecs = 0;
            songs.forEach(song => {
                if (song.duration && song.duration !== '--:--') {
                    const parts = song.duration.split(':').map(Number);
                    if (parts.every(n => !isNaN(n))) {
                        if (parts.length === 2) totalSecs += parts[0] * 60 + parts[1];
                        else if (parts.length === 3) totalSecs += parts[0] * 3600 + parts[1] * 60 + parts[2];
                    }
                }
            });
            if (durationEl) durationEl.textContent = u.formatTotalDuration(totalSecs);

            if (!tbody) return;
            tbody.innerHTML = '';

            if (songs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="100%" style="text-align:center; padding:40px; color:var(--text-sub);">${window.i18n ? window.i18n.t('Manage.no_matching_songs') : "楽曲がありません"}</td></tr>`;
                return;
            }

            const fragment = document.createDocumentFragment();
            songs.forEach((song, idx) => {
                const tr = document.createElement('tr');
                const isPlaying = window.PlayerController ? window.PlayerController.isSongPlaying(song) : false;
                const isSelected = this.selectedTrackIndices.has(idx);

                if (isPlaying) tr.classList.add('current-playing');
                if (isSelected) tr.classList.add('selected');

                tr.onclick = (e) => this.handleTrackClick(idx, e);
                tr.ondblclick = () => {
                    if (window.PlayerController) {
                        window.PlayerController.startPlaybackSession('normal', idx);
                    }
                };
                tr.oncontextmenu = (e) => this.showTrackContextMenu(idx, e);

                let statusCell = `<td class="col-status"></td>`;
                if (isPlaying) {
                    statusCell = `<td class="col-status">${s.ICON_PLAYING}</td>`;
                }

                const artSrc = song.imageData || s.DEFAULT_ICON;
                let html = statusCell +
                    `<td class="col-art">
                        <div class="art-container">
                            <img src="${artSrc}" alt="Art" loading="lazy">
                            <div class="art-overlay" onclick="event.stopPropagation(); window.PlayerController.startPlaybackSession('normal', ${idx})">${s.SVG_PLAY}</div>
                        </div>
                    </td>`;

                visibleTags.forEach(tagKey => {
                    const val = u.escapeHtml(song[tagKey] || '');
                    html += `<td class="col-${tagKey}">${val}</td>`;
                });

                html += `<td class="col-time">${song.duration || '--:--'}</td>`;
                tr.innerHTML = html;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
        },

        renderSortOptions: function(targetPl, visibleTags) {
            const container = document.getElementById('phSortArea');
            if (!container) return;
            container.innerHTML = '';

            const currentSort = targetPl.sortBy || 'title';
            const currentDesc = !!targetPl.sortDesc;

            const sortLabel = document.createElement('span');
            sortLabel.className = 'ph-sort-label';
            sortLabel.textContent = (window.i18n && window.i18n.t)
                ? window.i18n.t('Player.label_sort')
                : "並び順:";
            container.appendChild(sortLabel);

            const options = visibleTags.map(tag => ({
                val: tag,
                label: (window.i18n && window.i18n.t) ? window.i18n.t(`Tags.${tag}`) : tag
            }));

            if (!options.some(o => o.val === 'title')) {
                options.unshift({ val: 'title', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.title') : 'タイトル' });
            }

            const selector = window.SidebarController.createDynamicCustomSelector(
                options,
                currentSort,
                async (newSort) => {
                    targetPl.sortBy = newSort;
                    if (s.currentPlaylistType !== 'virtual') {
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        await invoke("update_playlist_by_id", { plId: targetPl.id, field: 'sortBy', value: newSort });
                    }
                    this.renderMainView();
                    if (window.PlayerController) {
                        window.PlayerController.handleSortChanged(targetPl.songs, targetPl.sortBy, targetPl.sortDesc);
                    }
                }
            );

            container.appendChild(selector);

            const descText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.sort_desc') : "降順";
            const ascText = (window.i18n && window.i18n.t) ? window.i18n.t('Player.sort_asc') : "昇順";

            const btnDirection = document.createElement('button');
            btnDirection.className = 'btn-icon-toggle';
            btnDirection.style.padding = '4px 8px';
            btnDirection.style.fontSize = '0.8rem';
            btnDirection.title = currentDesc ? descText : ascText;
            btnDirection.innerHTML = currentDesc ? `▼ ${descText}` : `▲ ${ascText}`;
            btnDirection.onclick = async () => {
                targetPl.sortDesc = !currentDesc;
                if (s.currentPlaylistType !== 'virtual') {
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    await invoke("update_playlist_by_id", { plId: targetPl.id, field: 'sortDesc', value: targetPl.sortDesc });
                }
                this.renderMainView();
                if (window.PlayerController) {
                    window.PlayerController.handleSortChanged(targetPl.songs, targetPl.sortBy, targetPl.sortDesc);
                }
            };

            container.appendChild(btnDirection);
        },

        handleTrackClick: function(index, event) {
            if (event.shiftKey && this.lastTrackClickedIndex !== null) {
                const start = Math.min(this.lastTrackClickedIndex, index);
                const end = Math.max(this.lastTrackClickedIndex, index);
                for (let i = start; i <= end; i++) this.selectedTrackIndices.add(i);
            } else if (event.ctrlKey || event.metaKey) {
                if (this.selectedTrackIndices.has(index)) this.selectedTrackIndices.delete(index);
                else this.selectedTrackIndices.add(index);
                this.lastTrackClickedIndex = index;
            } else {
                this.selectedTrackIndices.clear();
                this.selectedTrackIndices.add(index);
                this.lastTrackClickedIndex = index;
            }
            this.renderMainView();
        },

        clearSelection: function() {
            if (this.selectedTrackIndices.size > 0) {
                this.selectedTrackIndices.clear();
                this.lastTrackClickedIndex = null;
                this.renderMainView();
            }
        },

        showTrackContextMenu: function(index, e) {
            e.preventDefault();
            e.stopPropagation();

            if (!this.selectedTrackIndices.has(index)) {
                this.selectedTrackIndices.clear();
                this.selectedTrackIndices.add(index);
                this.lastTrackClickedIndex = index;
                this.renderMainView();
            }

            const menu = document.getElementById('trackContextMenu');
            if (!menu) return;

            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];

            const menuEditRules = document.getElementById('menuEditSmartRules');
            const menuRemove = document.getElementById('menuRemoveFromPlaylist');
            const menuShowInExplorer = document.getElementById('menuShowInExplorer');

            if (menuEditRules) {
                menuEditRules.style.display = (targetPl && targetPl.type === 'smart') ? 'block' : 'none';
            }
            if (menuRemove) {
                menuRemove.style.display = isVirtual ? 'none' : 'block';
            }

            if (menuShowInExplorer) {
                const isMac = navigator.userAgent.includes('Mac') || navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                menuShowInExplorer.textContent = isMac 
                    ? (window.i18n ? window.i18n.t('Migration.btn_show_finder') : "Finderで表示") 
                    : (window.i18n ? window.i18n.t('Migration.btn_show_explorer') : "エクスプローラーで表示");
            }

            this.populatePlaylistSubmenu();

            menu.style.position = 'fixed';
            menu.style.display = 'block';
            menu.style.visibility = 'hidden';

            const mw = menu.offsetWidth || 220;
            const mh = menu.offsetHeight || 220;
            let x = e.clientX;
            let y = e.clientY;

            if (x + mw > window.innerWidth) x -= mw;
            if (y + mh > window.innerHeight) y -= mh;

            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.visibility = 'visible';
        },

        // ★ 修正：ホバー時の自動位置調整を実装し、「新規作成」を追加
        populatePlaylistSubmenu: function() {
            const submenu = document.getElementById('playlistSubmenu');
            if (!submenu) return;
            submenu.innerHTML = '';

            const createLi = document.createElement('li');
            createLi.innerHTML = `<span style="font-weight:700;">+ ${window.i18n ? window.i18n.t('Player.menu_new_pl') : "新規プレイリスト"}</span>`;
            createLi.style.borderBottom = '1px solid rgba(128,128,128,0.15)';
            createLi.style.marginBottom = '4px';
            createLi.style.paddingBottom = '6px';
            createLi.onclick = async (e) => {
                e.stopPropagation();
                document.getElementById('trackContextMenu').style.display = 'none';

                const selectedSongs = Array.from(this.selectedTrackIndices).map(idx => {
                    const isVirtual = s.currentPlaylistType === 'virtual';
                    const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
                    return targetPl.songs[idx];
                }).filter(Boolean);

                let plName = window.i18n ? window.i18n.t('Player.menu_new_pl') : "新規プレイリスト";
                if (selectedSongs.length > 0 && selectedSongs[0].title) {
                    plName = selectedSongs[0].title;
                }

                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    const newPl = await invoke("create_playlist", { name: plName, plType: 'normal' });
                    if (newPl) {
                        s.playlists.push(newPl);
                        s.playlists.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                        if (window.SidebarController) await window.SidebarController.renderSidebar();
                        
                        const filenames = selectedSongs.map(song => song.musicFilename);
                        await invoke("add_songs_to_playlist", { plId: newPl.id, filenames: filenames });
                        u.showToast(window.i18n ? window.i18n.t('Messages.saved') : "プレイリストに作成して追加しました", false);
                    }
                } catch(err) {
                    u.showToast(window.i18n ? window.i18n.t('Common.error') : "エラーが発生しました", true);
                }
            };
            submenu.appendChild(createLi);

            if (s.playlists.length > 0) {
                s.playlists.forEach(pl => {
                    const li = document.createElement('li');
                    li.textContent = pl.playlistName;
                    li.onclick = async (e) => {
                        e.stopPropagation();
                        document.getElementById('trackContextMenu').style.display = 'none';
                        
                        if (pl.type === 'smart') {
                            this.showSmartAddConfirmModal(pl.id);
                        } else {
                            await this.addSelectedTracksToPlaylist(pl.id);
                        }
                    };
                    submenu.appendChild(li);
                });
            }
        },

        initTrackMenuEvents: function() {
            const menuSongInfo = document.getElementById('menuSongInfo');
            if (menuSongInfo) {
                menuSongInfo.onclick = () => {
                    const firstIdx = Array.from(this.selectedTrackIndices)[0];
                    if (firstIdx !== undefined) this.openSongInfoModal(firstIdx);
                };
            }

            const menuEditSmartRules = document.getElementById('menuEditSmartRules');
            if (menuEditSmartRules) {
                menuEditSmartRules.onclick = () => {
                    const isVirtual = s.currentPlaylistType === 'virtual';
                    const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
                    if (targetPl && targetPl.type === 'smart' && window.SidebarController && window.SidebarController.openSmartPlaylistModal) {
                        window.SidebarController.openSmartPlaylistModal(targetPl);
                    }
                };
            }

            const menuShowInExplorer = document.getElementById('menuShowInExplorer');
            if (menuShowInExplorer) {
                menuShowInExplorer.onclick = async () => {
                    const isVirtual = s.currentPlaylistType === 'virtual';
                    const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
                    const firstIdx = Array.from(this.selectedTrackIndices)[0];
                    if (targetPl && targetPl.songs && targetPl.songs[firstIdx]) {
                        const song = targetPl.songs[firstIdx];
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        try {
                            await invoke("show_in_explorer", { path: song.musicFilename });
                        } catch (err) {
                            console.error(err);
                        }
                    }
                };
            }

            const menuRemove = document.getElementById('menuRemoveFromPlaylist');
            if (menuRemove) {
                menuRemove.onclick = () => this.handleRemoveFromPlaylist();
            }

            // ★ 修正：サブメニューの左展開自動制御
            const addToPlParent = document.getElementById('menuAddToPlaylistParent');
            const submenu = document.getElementById('playlistSubmenu');
            if (addToPlParent && submenu) {
                addToPlParent.onmouseenter = () => {
                    submenu.style.display = 'block';
                    const rect = submenu.getBoundingClientRect();
                    if (rect.right > window.innerWidth) {
                        submenu.classList.add('left-side');
                    } else {
                        submenu.classList.remove('left-side');
                    }
                };
                addToPlParent.onmouseleave = () => {
                    submenu.style.display = 'none';
                };
            }
        },

        // ★ 新設：スマートプレイリストへの追加時の変換確認モーダル
        showSmartAddConfirmModal: function(targetPlId) {
            const modal = document.getElementById('smartRemoveConfirmModal');
            if (!modal) return;
            
            const msgEl = modal.querySelector('p');
            if (msgEl) {
                msgEl.innerHTML = window.i18n ? window.i18n.t('Player.smart_remove_msg') : "スマートプレイリストから楽曲を追加・削除すると、自動更新ルールが解除され、通常のプレイリストに変更されます。<br><br>よろしいですか？";
            }
            const btnExec = document.getElementById('btnExecSmartRemove');
            if (btnExec) {
                btnExec.textContent = window.i18n ? window.i18n.t('Player.btn_convert_and_remove') : "変換して追加";
                
                btnExec.onclick = async () => {
                    modal.classList.remove('show');
                    await this.convertSmartAndAddTracks(targetPlId);
                };
            }
            modal.classList.add('show');
        },

        // ★ 新設：スマートプレイリストを通常へ変換しつつ楽曲を追加する処理
        convertSmartAndAddTracks: async function(plId) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const sourcePl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
            if (!sourcePl || !sourcePl.songs) return;

            const selectedSongs = Array.from(this.selectedTrackIndices).map(idx => sourcePl.songs[idx]).filter(Boolean);
            const filenames = selectedSongs.map(song => song.musicFilename);

            if (filenames.length === 0) return;

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                const updatedPl = await invoke("convert_smart_to_normal_and_add_songs", {
                    plId: plId,
                    filenames: filenames
                });
                if (updatedPl) {
                    const idx = s.playlists.findIndex(p => p.id === plId);
                    if (idx !== -1) s.playlists[idx] = updatedPl;
                    if (window.SidebarController) window.SidebarController.renderSidebar();
                    u.showToast(window.i18n ? window.i18n.t('Messages.saved') : "プレイリストに変換・追加しました", false);
                }
            } catch (err) {
                console.error(err);
                u.showToast(window.i18n ? window.i18n.t('Common.error') : "処理に失敗しました", true);
            }
        },

        addSelectedTracksToPlaylist: async function(plId) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
            if (!targetPl || !targetPl.songs) return;

            const selectedSongs = Array.from(this.selectedTrackIndices).map(idx => targetPl.songs[idx]).filter(Boolean);
            const filenames = selectedSongs.map(s => s.musicFilename);

            if (filenames.length === 0) return;

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                await invoke("add_songs_to_playlist", { plId: plId, filenames: filenames });
                u.showToast(window.i18n ? window.i18n.t('Messages.saved') : "プレイリストに追加しました", false);
            } catch (err) {
                console.error(err);
                u.showToast(window.i18n ? window.i18n.t('Common.error') : "追加に失敗しました", true);
            }
        },

        handleRemoveFromPlaylist: async function() {
            const isVirtual = s.currentPlaylistType === 'virtual';
            if (isVirtual) return;

            const targetPl = s.playlists[s.currentPlaylistIndex];
            if (!targetPl || !targetPl.songs) return;

            const selectedSongs = Array.from(this.selectedTrackIndices).map(idx => targetPl.songs[idx]).filter(Boolean);
            const filenames = selectedSongs.map(s => s.musicFilename);

            if (filenames.length === 0) return;

            if (targetPl.type === 'smart') {
                const modal = document.getElementById('smartRemoveConfirmModal');
                
                const btnExec = document.getElementById('btnExecSmartRemove');
                if (btnExec) {
                    btnExec.textContent = window.i18n ? window.i18n.t('Player.btn_convert_and_remove') : "削除して変換";
                    btnExec.onclick = async () => {
                        modal.classList.remove('show');
                        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                        try {
                            const updatedPl = await invoke("convert_smart_to_normal_and_remove_songs", {
                                plId: targetPl.id,
                                filenames: filenames
                            });
                            if (updatedPl) {
                                s.playlists[s.currentPlaylistIndex] = updatedPl;
                                await this.selectPlaylist(s.currentPlaylistIndex);
                                this.selectedTrackIndices.clear();
                                u.showToast(window.i18n ? window.i18n.t('Player.smart_remove_msg') : "スマートプレイリストを通常に変換し、削除しました", false);
                            }
                        } catch (err) {
                            u.showToast(window.i18n ? window.i18n.t('Common.error') : "処理に失敗しました", true);
                        }
                    };
                }

                if (modal) modal.classList.add('show');
                return;
            }

            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            try {
                await invoke("remove_songs_from_playlist", { plId: targetPl.id, filenames: filenames });
                await this.selectPlaylist(s.currentPlaylistIndex);
                this.selectedTrackIndices.clear();
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_deleted') : "削除しました", false);
            } catch (err) {
                console.error(err);
                u.showToast(window.i18n ? window.i18n.t('Common.error') : "削除に失敗しました", true);
            }
        },

        initSmartRemoveModal: function() {
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

        openSongInfoModal: function(index) {
            const isVirtual = s.currentPlaylistType === 'virtual';
            const targetPl = isVirtual ? s.currentVirtualPlaylist : s.playlists[s.currentPlaylistIndex];
            if (!targetPl || !targetPl.songs || !targetPl.songs[index]) return;

            const song = targetPl.songs[index];
            const modal = document.getElementById('songInfoModal');
            if (!modal) return;

            const artSrc = song.imageData || s.DEFAULT_ICON;
            document.getElementById('infoArt').src = artSrc;
            document.getElementById('infoTitle').textContent = song.title || "Unknown Title";
            document.getElementById('infoArtist').textContent = song.artist || "Unknown Artist";
            document.getElementById('infoAlbum').textContent = song.album || "";

            const detailsList = document.getElementById('detailsList');
            detailsList.innerHTML = '';

            const detailFields = [
                { key: 'title', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.title') : 'タイトル' },
                { key: 'artist', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.artist') : 'アーティスト' },
                { key: 'album', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.album') : 'アルバム' },
                { key: 'album_artist', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.album_artist') : 'アルバムアーティスト' },
                { key: 'genre', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.genre') : 'ジャンル' },
                { key: 'track', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.track') : 'トラック番号' },
                { key: 'disc', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.disc') : 'ディスク番号' },
                { key: 'year', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.year') : '年/日付' },
                { key: 'bpm', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.bpm') : 'BPM' },
                { key: 'composer', label: (window.i18n && window.i18n.t) ? window.i18n.t('Tags.composer') : '作曲者' },
                { key: 'duration', label: (window.i18n && window.i18n.t) ? window.i18n.t('Manage.th_time') : '時間' },
                { key: 'musicFilename', label: (window.i18n && window.i18n.t) ? window.i18n.t('Integrity.th_file') : 'ファイルパス' }
            ];

            detailFields.forEach(f => {
                const val = song[f.key];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    const item = document.createElement('div');
                    item.className = 'detail-item';
                    item.innerHTML = `<span class="detail-label">${f.label}</span><span class="detail-value">${u.escapeHtml(String(val))}</span>`;
                    detailsList.appendChild(item);
                }
            });

            document.getElementById('largeArt').src = artSrc;
            document.getElementById('infoLyrics').textContent = song.lyric || (window.i18n ? window.i18n.t('AddMusic.art_none_desc') : "歌詞情報はありません。");

            const defaultTab = modal.querySelector('.tab-btn[data-target="tab-details"]');
            if (defaultTab) defaultTab.click();

            modal.classList.add('show');
        }
    };
})();
