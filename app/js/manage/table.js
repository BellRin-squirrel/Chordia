(function() {
    const s = window.ManageState;
    const u = window.ManageUtils;
    // Tauriのinvokeを取得
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    function showLoading(msg = "データを準備中...") {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay ? overlay.querySelector('.loading-text') : null;
        const detail = document.getElementById('loadingDetail');
        
        if (text) text.textContent = msg;
        if (detail) detail.textContent = "少々お待ちください...";
        if (overlay) overlay.style.display = 'flex';
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    window.TableController = {
        loadTableData: async function() {
            showLoading("データを読み込んでいます..."); 
            try {
                const settings = await invoke("get_app_settings");
                s.itemsPerPage = settings.items_per_page;
                s.activeTags = settings.active_tags || ['title','artist','album','genre','track'];
                
                const avail = await invoke("get_available_tags");
                s.tagLabels = {};
                avail.forEach(t => s.tagLabels[t.key] = t.label);
                
                s.searchQuery = s.searchQuery || "";
                s.advancedConditions = s.advancedConditions || null; 

                // 総件数の取得（高度な検索の条件を引数として正しく渡します）
                const totalItems = await invoke("get_library_count", {
                    searchQuery: s.searchQuery,
                    advancedConditions: s.advancedConditions
                });
                
                s.totalItems = totalItems;
                
                await this.fetchChunk();
                this.updateSearchUI();
            } catch (e) {
                console.error("LOAD ERROR DETAIL:", e);
                u.showToast("読み込み失敗: " + e.message, true);
            } finally {
                hideLoading();
            }
        },

        execSearch: function(query) {
            s.searchQuery = query;
            s.advancedConditions = null; 
            s.currentPage = 1;
            this.loadTableData();
        },

        execAdvancedSearch: function(conditions) {
            s.advancedConditions = conditions;
            s.searchQuery = ""; 
            const searchInput = document.getElementById('searchInputManage');
            if(searchInput) searchInput.value = "";
            
            s.currentPage = 1;
            this.loadTableData();
        },

        updateSearchUI: function() {
            const btnClear = document.getElementById('btnClearSearch');
            const hasFilter = s.searchQuery || (s.advancedConditions && s.advancedConditions.items);
            if (btnClear) {
                btnClear.style.display = hasFilter ? 'inline-block' : 'none';
            }
            
            const btnAdvanced = document.getElementById('btnAdvancedSearch');
            if (btnAdvanced) {
                if (s.advancedConditions && s.advancedConditions.items) {
                    btnAdvanced.classList.add('active');
                } else {
                    btnAdvanced.classList.remove('active');
                }
            }
        },

        fetchChunk: async function() {
            const limit = s.isSelectionMode ? 0 : (s.isShowAll ? 0 : s.itemsPerPage);
            
            try {
                const res = await invoke("get_library_chunk", {
                    page: s.currentPage,
                    limit: limit,
                    sortField: s.sortState.field,
                    sortDesc: s.sortState.direction === 'desc',
                    searchQuery: s.searchQuery,
                    advancedConditions: s.advancedConditions
                });

                s.libraryData = res;

                this.renderHeader();
                this.renderTable();
                this.renderPagination();
                this.updateBulkBar();
            } catch (err) {
                console.error("fetchChunk Error:", err);
                u.showToast("データの取得に失敗しました", true);
            }
        },

        toggleSelectionMode: function() {
            const overlay = document.getElementById('loadingOverlaySimple');
            if (overlay) overlay.style.display = 'flex';

            setTimeout(() => {
                s.isSelectionMode = !s.isSelectionMode;
                if (!s.isSelectionMode) s.selectedIds.clear();
                
                const btn = document.getElementById('btnToggleSelection');
                if(btn) {
                    btn.classList.toggle('active', s.isSelectionMode);
                    btn.textContent = s.isSelectionMode ? "選択を終了" : "楽曲を選択";
                }
                
                this.fetchChunk();
                this.updateBulkBar();
                
                if (overlay) overlay.style.display = 'none';
            }, 10);
        },

        toggleAllSelection: function(checked) {
            s.libraryData.forEach(item => {
                const fname = item.musicFilename.split(/[\\/]/).pop();
                if (checked) s.selectedIds.add(fname);
                else s.selectedIds.delete(fname);
            });
            this.renderTable();
            this.updateBulkBar();
        },

        handleCheck: function(fname, checked) {
            if (checked) s.selectedIds.add(fname);
            else s.selectedIds.delete(fname);
            
            const headerCheck = document.getElementById('headerCheckAll');
            if (headerCheck) this.updateHeaderCheckState(headerCheck);

            const checkbox = document.querySelector(`input[value="${fname}"]`);
            if (checkbox) {
                const tr = checkbox.closest('tr');
                if(tr) tr.classList.toggle('selected', checked);
            }
            this.updateBulkBar();
        },

        updateHeaderCheckState: function(headerCheck) {
            const allChecked = s.libraryData.length > 0 && s.libraryData.every(item => s.selectedIds.has(item.musicFilename.split(/[\\/]/).pop()));
            headerCheck.checked = allChecked;
        },

        updateBulkBar: function() {
            const bar = document.getElementById('bulkActionBar');
            if(bar) {
                if (s.isSelectionMode) bar.classList.add('active');
                else bar.classList.remove('active');
            }
            const countEl = document.getElementById('bulkCount');
            if(countEl) countEl.textContent = s.selectedIds.size;
        },

        renderHeader: function() {
            const headerRow = document.getElementById('tableHeaderRow');
            if (!headerRow) return;
            headerRow.innerHTML = '';
            
            if (s.isSelectionMode) {
                const th = document.createElement('th');
                th.className = 'col-select';
                const checkAll = document.createElement('input');
                checkAll.type = 'checkbox';
                checkAll.id = 'headerCheckAll';
                checkAll.className = 'row-check';
                checkAll.onclick = (e) => this.toggleAllSelection(e.target.checked);
                th.appendChild(checkAll);
                headerRow.appendChild(th);
                this.updateHeaderCheckState(checkAll);
            }

            let th = document.createElement('th');
            th.className = 'col-art'; headerRow.appendChild(th);
            th = document.createElement('th');
            th.className = 'col-play'; th.textContent = '再生'; headerRow.appendChild(th);
            
            s.activeTags.forEach(key => {
                th = document.createElement('th');
                th.className = `sortable col-${key}`; th.textContent = s.tagLabels[key] || key;
                th.onclick = () => this.sortData(key);
                th.innerHTML += ` <span class="sort-icon" id="sort-${key}"></span>`;
                headerRow.appendChild(th);
            });
            
            th = document.createElement('th');
            th.className = 'col-time sortable'; th.textContent = '時間';
            th.onclick = () => this.sortData('duration');
            th.innerHTML += ' <span class="sort-icon" id="sort-duration"></span>';
            headerRow.appendChild(th);
            
            th = document.createElement('th');
            th.className = 'col-action'; th.textContent = '操作';
            headerRow.appendChild(th);
        },

        sortData: function(field) {
            showLoading("データを並び替えています...");
            setTimeout(async () => {
                try {
                    if (s.sortState.field === field) {
                        s.sortState.direction = s.sortState.direction === 'asc' ? 'desc' : 'asc';
                    } else {
                        s.sortState.field = field; 
                        s.sortState.direction = 'asc'; 
                    }
                    s.currentPage = 1;
                    await this.fetchChunk();
                    this.updateHeaderIcons();
                } finally {
                    hideLoading();
                }
            }, 50);
        },

        updateHeaderIcons: function() {
            document.querySelectorAll('.sort-icon').forEach(i => i.textContent = '');
            const icon = document.getElementById('sort-' + s.sortState.field);
            if (icon) icon.textContent = s.sortState.direction === 'asc' ? '▲' : '▼';
        },

        renderTable: function() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            
            if (s.libraryData.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="100%" style="text-align:center; padding: 40px; color: var(--text-sub);">一致する楽曲が見つかりませんでした</td>`;
                tbody.appendChild(tr);
                return;
            }

            const fragment = document.createDocumentFragment();
            s.libraryData.forEach((item, index) => {
                const tr = document.createElement('tr');
                const fname = item.musicFilename.split(/[\\/]/).pop();
                const isSelected = s.selectedIds.has(fname);
                if (isSelected) tr.classList.add('selected');
                
                let html = '';
                if (s.isSelectionMode) {
                    html += `<td class="col-select"><input type="checkbox" class="row-check" value="${fname}" ${isSelected?'checked':''} onclick="window.TableController.handleCheck('${fname}', this.checked)"></td>`;
                }

                html += `<td class="col-art"><img src="${item.imageData || s.DEFAULT_ICON}" class="thumb-art"></td>` +
                        `<td class="col-play"><button class="btn-play" id="btnPlay_${index}" onclick="window.PlayerController.playPreview(${index})">${s.currentPlayingIndex === index ? s.SVG_PAUSE : s.SVG_PLAY}</button></td>`;
                
                s.activeTags.forEach(key => {
                    html += `<td class="editable col-${key}" onclick="window.TableController.showEditHint()" ondblclick="window.TableController.startEdit(this, ${index}, '${key}')">${u.escapeHtml(item[key] || '')}</td>`;
                });

                const hasLyric = item.lyric && item.lyric.trim() !== "";
                const lyricClass = hasLyric ? "has-lyric" : "no-lyric";

                html += `<td>${item.duration || '--:--'}</td>` +
                    `<td class="col-action"><div class="action-btns">` +
                    `<button class="btn-icon lyric-btn ${lyricClass}" title="歌詞編集" onclick="window.ModalController.openLyricModal(${index})"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" /></svg></button>` +
                    `<button class="btn-icon" title="アートワーク編集" onclick="window.ModalController.openArtModal(${index})"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg></button>` +
                    `<button class="btn-icon delete" title="削除" onclick="window.ModalController.openDeleteModal(${index})"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>` +
                    `</div></td>`;
                tr.innerHTML = html; fragment.appendChild(tr);
            });
            tbody.appendChild(fragment);
        },

        renderPagination: function() {
            const container = document.getElementById('paginationControl');
            if (!container) return;
            if (s.isSelectionMode) { container.innerHTML = ''; return; }
            
            container.innerHTML = '';
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'pagination-buttons';
            
            const btnShowAll = document.createElement('button');
            btnShowAll.className = s.isShowAll ? 'btn-page active' : 'btn-page';
            btnShowAll.textContent = s.isShowAll ? 'ページ別表示に戻す' : 'すべて表示';
            btnShowAll.onclick = () => {
                showLoading("データを読み込んでいます...");
                setTimeout(async () => {
                    try { s.isShowAll = !s.isShowAll; s.currentPage = 1; await this.fetchChunk(); }
                    finally { hideLoading(); }
                }, 50);
            };
            controlsDiv.appendChild(btnShowAll);

            if (!s.isShowAll) {
                const totalPages = Math.ceil(s.totalItems / s.itemsPerPage);
                const btnPrev = document.createElement('button');
                btnPrev.className = 'btn-page'; btnPrev.textContent = '前へ'; btnPrev.disabled = s.currentPage === 1;
                btnPrev.onclick = () => {
                    if (s.currentPage > 1) { showLoading(); setTimeout(async () => { try { s.currentPage--; await this.fetchChunk(); } finally { hideLoading(); } }, 50); }
                };
                controlsDiv.appendChild(btnPrev);
                
                const spanInfo = document.createElement('span');
                spanInfo.className = 'page-info'; spanInfo.textContent = `${s.currentPage} / ${totalPages}`;
                controlsDiv.appendChild(spanInfo);
                
                const btnNext = document.createElement('button');
                btnNext.className = 'btn-page'; btnNext.textContent = '次へ'; btnNext.disabled = s.currentPage >= totalPages || totalPages === 0;
                btnNext.onclick = () => {
                    if (s.currentPage < totalPages) { showLoading(); setTimeout(async () => { try { s.currentPage++; await this.fetchChunk(); } finally { hideLoading(); } }, 50); }
                };
                controlsDiv.appendChild(btnNext);
                
                const jumpDiv = document.createElement('div');
                jumpDiv.className = 'page-jump-wrapper';
                const inputJump = document.createElement('input');
                inputJump.type = 'number'; inputJump.className = 'jump-input';
                const btnJump = document.createElement('button');
                btnJump.className = 'btn-jump'; btnJump.textContent = '移動';
                btnJump.onclick = () => {
                    let pageNum = parseInt(inputJump.value, 10);
                    if (!isNaN(pageNum)) {
                        s.currentPage = Math.min(Math.max(pageNum, 1), totalPages);
                        showLoading();
                        setTimeout(async () => { try { await this.fetchChunk(); } finally { hideLoading(); } }, 50);
                    }
                };
                jumpDiv.appendChild(inputJump); jumpDiv.appendChild(btnJump); controlsDiv.appendChild(jumpDiv);
            }
            container.appendChild(controlsDiv);
        },

        showEditHint: function() {
            if (s.isSelectionMode) return;
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            u.showToast("ダブルクリックで編集できます", false);
        },

        startEdit: function(td, index, field) {
            if (s.isSelectionMode) return;
            const originalText = td.textContent.trim();
            // ★修正: ダブルクォーテーションが含まれていても崩れないようエスケープする
            td.innerHTML = `<input type="text" class="inline-input" value="${u.escapeHtml(originalText)}">`;
            const input = td.querySelector('input');
            
            const commitEdit = async () => {
                if (input.value !== originalText) {
                    const item = s.libraryData[index];
                    const success = await invoke("update_song_by_id", {
                        musicFilename: item.musicFilename,
                        field: field,
                        value: input.value
                    });
                    
                    if (success) { 
                        item[field] = input.value; 
                        td.textContent = input.value;
                        if (s.currentPlayingIndex === index) {
                            window.PlayerController.updatePlayerInfo(item);
                        }
                    } else { td.textContent = originalText; }
                } else { td.textContent = originalText; }
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); } 
                else if (e.key === 'Escape') { e.preventDefault(); input.onblur = null; td.textContent = originalText; }
            };
            input.onblur = commitEdit;
            input.focus(); input.select(); 
        }
    };
})();