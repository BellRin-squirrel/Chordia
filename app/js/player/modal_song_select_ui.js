(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;
    const m = window.ModalSongSelect;

    Object.assign(m, {
        isRendered: false, 
        advSearchTags:[], 

        textOps:[
            {val: 'contains', label: 'を含む'},
            {val: 'not_contains', label: 'を含まない'},
            {val: 'equals', label: 'である'},
            {val: 'not_equals', label: 'ではない'},
            {val: 'startswith', label: 'で始まる'},
            {val: 'endswith', label: 'で終わる'}
        ],
        numOps:[
            {val: 'equals', label: 'である'},
            {val: 'not_equals', label: 'ではない'},
            {val: 'greater', label: 'より大きい'},
            {val: 'less', label: 'より小さい'},
            {val: 'range', label: 'の範囲内'}
        ],

        init: function() {
            const playlistList = document.getElementById('playlistList');
            if (playlistList) {
                playlistList.addEventListener('mousedown', (e) => {
                    if (e.button === 2) {
                        const item = e.target.closest('.playlist-item');
                        if (item) {
                            const nameEl = item.querySelector('span');
                            if (nameEl) {
                                const name = nameEl.textContent.trim();
                                const found = s.playlists.find(p => p.playlistName === name);
                                if (found) this._tempContextId = found.id;
                            }
                        }
                    }
                });
            }

            const menuEditSongs = document.getElementById('menuEditSongs');
            if (menuEditSongs) {
                menuEditSongs.addEventListener('click', () => {
                    const itemMenu = document.getElementById('playlistItemMenu');
                    if (itemMenu) itemMenu.style.display = 'none';
                    const targetId = this.findTargetPlaylistId();
                    if (targetId) this.open(targetId);
                    else u.showToast("対象のプレイリストが見つかりません。", true);
                });
            }

            document.getElementById('btnCancelSelect').addEventListener('click', () => this.close());
            document.getElementById('btnSaveSelect').addEventListener('click', () => this.save());

            const searchInput = document.getElementById('songSelectSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => this.filterData(e.target.value));
            }

            document.getElementById('btnSongSelectAdvSearch').addEventListener('click', () => this.openAdvancedSearch());
            document.getElementById('btnCloseAdvSearchModal').addEventListener('click', () => document.getElementById('advancedSearchModal').classList.remove('show'));
            document.getElementById('btnApplyAdvSearch').addEventListener('click', () => this.applyAdvancedSearch());
            document.getElementById('btnClearAdvSearch').addEventListener('click', () => this.clearAdvancedSearch());

            this.initMarqueeSelection();
        },

        open: async function(pl_id) {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const modal = document.getElementById('songSelectModal');

            if (!this.isRendered) {
                const overlay = document.getElementById('savingOverlay');
                overlay.style.display = 'flex';
                const head = overlay.querySelector('.loading-header-text');
                const org = head.textContent;
                head.textContent = "編集画面を準備中...";

                try {
                    const settings = await invoke("get_app_settings");
                    const allTags = await invoke("get_available_tags");
                    this.activeTags = allTags.filter(t => settings.active_tags.includes(t.key));
                    
                    this.advSearchTags = this.activeTags.map(t => ({val: t.key, label: t.label}));
                    this.advSearchTags.push({val: 'lyric', label: '歌詞'});

                    this.renderHeader();
                    this.libraryData = s.fullLibrary || [];
                    this.filteredData = [...this.libraryData];
                    
                    this.renderList();
                    this.isRendered = true;
                } finally {
                    overlay.style.display = 'none';
                    head.textContent = org;
                }
            }

            this.currentPlaylistId = pl_id;
            const pl = s.playlists.find(p => p.id === pl_id);
            this.selectedFilenames = new Set();
            if (pl && pl.music) {
                pl.music.forEach(fname => this.selectedFilenames.add(fname));
            }

            this.syncSelectedUI();
            modal.classList.add('show');
        },

        close: function() {
            const modal = document.getElementById('songSelectModal');
            if (modal) modal.classList.remove('show');
            this._tempContextId = null;
            const searchInput = document.getElementById('songSelectSearch');
            if (searchInput) {
                searchInput.value = '';
                this.filterData('');
            }
        },

        openAdvancedSearch: async function() {
            const container = document.getElementById('advSearchRootContainer');
            if (container.children.length === 0) {
                container.appendChild(this.createConditionGroup(true));
                this.updateAllMinusButtons();
            }
            document.getElementById('advancedSearchModal').classList.add('show');
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

        createConditionGroup: function(isRoot, matchVal = 'all') {
            const groupWrap = document.createElement('div');
            groupWrap.className = 'smart-group-wrapper';
            groupWrap.style.marginBottom = '12px';
            groupWrap.dataset.match = matchVal;

            const groupHeader = document.createElement('div');
            groupHeader.className = 'smart-group-header';

            const matchSelector = this.createDynamicCustomSelector([{val:'all', label:'すべての'}, {val:'any', label:'いずれかの'}],
                matchVal,
                (val) => { groupWrap.dataset.match = val; }
            );

            const textSpan = document.createElement('span');
            textSpan.className = 'smart-text'; textSpan.textContent = 'ルールに一致';
            const spacer = document.createElement('div'); spacer.style.flex = "1";

            groupHeader.appendChild(matchSelector);
            groupHeader.appendChild(textSpan);
            groupHeader.appendChild(spacer);

            const btnContainer = document.createElement('div');
            btnContainer.className = 'smart-btn-container';
            const btnMinus = document.createElement('button');
            btnMinus.className = 'smart-row-btn minus group-minus';
            btnMinus.innerHTML = `<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19.5 12h-15" /></svg>`;
            const btnPlus = document.createElement('button');
            btnPlus.className = 'smart-row-btn plus';
            btnPlus.innerHTML = `<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
            const btnMore = document.createElement('button');
            btnMore.className = 'smart-row-btn more';
            btnMore.innerHTML = '●●●';

            if (isRoot) {
                btnMinus.disabled = btnPlus.disabled = btnMore.disabled = true;
                btnMinus.classList.add('disabled'); btnPlus.classList.add('disabled'); btnMore.classList.add('disabled');
            } else {
                btnMinus.onclick = () => { groupWrap.remove(); this.updateAllMinusButtons(); };
                btnPlus.onclick = () => { groupWrap.parentElement.insertBefore(this.createFilterRow(), groupWrap.nextSibling); this.updateAllMinusButtons(); };
                btnMore.onclick = () => { groupWrap.parentElement.insertBefore(this.createConditionGroup(false), groupWrap.nextSibling); this.updateAllMinusButtons(); };
            }
            btnContainer.appendChild(btnMinus); btnContainer.appendChild(btnPlus); btnContainer.appendChild(btnMore);
            groupHeader.appendChild(btnContainer);

            const groupBody = document.createElement('div');
            groupBody.className = 'smart-group-body';
            groupBody.style.paddingLeft = '24px';
            groupBody.style.borderLeft = '2px solid rgba(128,128,128,0.2)';
            groupBody.appendChild(this.createFilterRow());

            groupWrap.appendChild(groupHeader);
            groupWrap.appendChild(groupBody);
            return groupWrap;
        },

        createFilterRow: function(initTag = null, initOp = null, initVal = null) {
            const row = document.createElement('div');
            row.className = 'smart-condition-row';
            const defaultTag = initTag || 'title';
            row.dataset.tag = defaultTag;
            row.dataset.op = initOp || 'contains';

            const inputContainer = document.createElement('div');
            inputContainer.className = 'smart-input-container';
            const opContainer = document.createElement('div');
            opContainer.className = 'custom-select-wrapper';

            const updateInputs = (tag, op, val = null) => {
                inputContainer.innerHTML = '';
                const isNum =['track', 'year', 'disc', 'bpm'].includes(tag);
                if (isNum) {
                    if (op === 'range') {
                        const i1 = document.createElement('input'); i1.type = 'number'; i1.className = 'smart-input'; i1.placeholder = '0';
                        const i2 = document.createElement('input'); i2.type = 'number'; i2.className = 'smart-input'; i2.placeholder = '0';
                        if (Array.isArray(val)) { i1.value = val[0]; i2.value = val[1]; }
                        inputContainer.appendChild(i1);
                        inputContainer.innerHTML += '<span class="smart-text">と</span>';
                        inputContainer.appendChild(i2);
                    } else {
                        const i = document.createElement('input'); i.type = 'number'; i.className = 'smart-input'; i.placeholder = '数字...';
                        if (val) i.value = val;
                        inputContainer.appendChild(i);
                    }
                } else {
                    const i = document.createElement('input'); i.type = 'text'; i.className = 'smart-input'; i.placeholder = '検索ワード...';
                    if (val) i.value = val;
                    inputContainer.appendChild(i);
                }
            };

            const tagSelector = this.createDynamicCustomSelector(this.advSearchTags, row.dataset.tag, (newTag) => {
                row.dataset.tag = newTag;
                const isNum =['track', 'year', 'disc', 'bpm'].includes(newTag);
                const newOps = isNum ? this.numOps : this.textOps;
                const newOp = newOps[0].val;
                row.dataset.op = newOp;
                
                const newOpSelector = this.createDynamicCustomSelector(newOps, newOp, (o) => {
                    row.dataset.op = o;
                    updateInputs(newTag, o);
                });
                opContainer.innerHTML = '';
                opContainer.appendChild(newOpSelector);
                updateInputs(newTag, newOp);
            });

            const initialOps =['track', 'year', 'disc', 'bpm'].includes(row.dataset.tag) ? this.numOps : this.textOps;
            const opSelector = this.createDynamicCustomSelector(initialOps, row.dataset.op, (newOp) => {
                row.dataset.op = newOp;
                updateInputs(row.dataset.tag, newOp);
            });
            opContainer.appendChild(opSelector);

            const textSpan = document.createElement('span');
            textSpan.className = 'smart-text'; textSpan.textContent = 'が';

            const btnContainer = document.createElement('div');
            btnContainer.className = 'smart-btn-container';
            const btnMinus = document.createElement('button');
            btnMinus.className = 'smart-row-btn minus filter-minus';
            btnMinus.innerHTML = `<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19.5 12h-15" /></svg>`;
            btnMinus.onclick = () => { row.remove(); this.updateAllMinusButtons(); };
            const btnPlus = document.createElement('button');
            btnPlus.className = 'smart-row-btn plus';
            btnPlus.innerHTML = `<svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
            btnPlus.onclick = () => { row.parentElement.insertBefore(this.createFilterRow(), row.nextSibling); this.updateAllMinusButtons(); };
            const btnMore = document.createElement('button');
            btnMore.className = 'smart-row-btn more';
            btnMore.innerHTML = '●●●';
            btnMore.onclick = () => { row.parentElement.insertBefore(this.createConditionGroup(false), row.nextSibling); this.updateAllMinusButtons(); };

            btnContainer.appendChild(btnMinus);
            btnContainer.appendChild(btnPlus);
            btnContainer.appendChild(btnMore);
            
            row.appendChild(tagSelector);
            row.appendChild(textSpan);
            row.appendChild(inputContainer);
            row.appendChild(opContainer);
            row.appendChild(btnContainer);

            updateInputs(row.dataset.tag, row.dataset.op, initVal);
            return row;
        },

        updateAllMinusButtons: function() {
            const root = document.getElementById('advSearchRootContainer');
            if (!root) return;
            root.querySelectorAll('.smart-group-body').forEach(body => {
                const children = Array.from(body.children).filter(c => c.classList.contains('smart-condition-row') || c.classList.contains('smart-group-wrapper'));
                const isSingle = (children.length <= 1);
                children.forEach(child => {
                    let btn = child.classList.contains('smart-condition-row') ? child.querySelector('.filter-minus') : child.querySelector('.smart-group-header .group-minus');
                    if (btn) { btn.disabled = isSingle; btn.style.opacity = isSingle ? "0.3" : "1"; }
                });
            });
        },

        applyAdvancedSearch: function() {
            const rootElement = document.querySelector('#advSearchRootContainer > .smart-group-wrapper');
            if (!rootElement) return;

            const parseGroup = (groupWrap) => {
                const match = groupWrap.dataset.match || 'all';
                const items =[];
                Array.from(groupWrap.querySelector('.smart-group-body').children).forEach(child => {
                    if (child.classList.contains('smart-condition-row')) {
                        const tag = child.dataset.tag;
                        const op = child.dataset.op;
                        const inputs = child.querySelectorAll('.smart-input');
                        const val = inputs.length > 1 ? [inputs[0].value, inputs[1].value] : inputs[0].value;
                        items.push({ type: 'filter', tag, op, val });
                    } else if (child.classList.contains('smart-group-wrapper')) {
                        items.push(parseGroup(child));
                    }
                });
                return { type: 'group', match, items };
            };

            this.advancedConditions = parseGroup(rootElement);
            document.getElementById('advancedSearchModal').classList.remove('show');
            
            const searchInput = document.getElementById('songSelectSearch');
            this.filterData(searchInput ? searchInput.value : '');
            
            const btnAdv = document.getElementById('btnSongSelectAdvSearch');
            if (btnAdv) btnAdv.classList.add('active');
        },

        clearAdvancedSearch: function() {
            document.getElementById('advSearchRootContainer').innerHTML = '';
            document.getElementById('advancedSearchModal').classList.remove('show');
            this.advancedConditions = null;
            
            const searchInput = document.getElementById('songSelectSearch');
            this.filterData(searchInput ? searchInput.value : '');

            const btnAdv = document.getElementById('btnSongSelectAdvSearch');
            if (btnAdv) btnAdv.classList.remove('active');
        },

        renderHeader: function() {
            const head = document.getElementById('selectTableHeader');
            if (!head) return;
            let html = `<tr><th class="chk-cell"><input type="checkbox" id="checkAllSongs" class="col-check-box"></th><th class="col-art-small"></th>`;
            this.activeTags.forEach(tag => {
                html += `<th class="sortable col-${tag.key}">${tag.label}</th>`;
            });
            html += `</tr>`;
            head.innerHTML = html;
            const checkAllBtn = document.getElementById('checkAllSongs');
            if (checkAllBtn) {
                checkAllBtn.closest('th').addEventListener('click', (e) => {
                    if (e.target !== checkAllBtn) e.preventDefault();
                    this.toggleAllSelection();
                });
            }
        },

        syncSelectedUI: function() {
            const rows = document.querySelectorAll('#selectTableBody tr');
            rows.forEach(tr => {
                const fname = tr.dataset.fname;
                const isSelected = this.selectedFilenames.has(fname);
                const cb = tr.querySelector('.col-check-box');
                if (isSelected) {
                    tr.classList.add('selected');
                    if(cb) cb.checked = true;
                } else {
                    tr.classList.remove('selected');
                    if(cb) cb.checked = false;
                }
            });
            this.updateHeaderCheckboxState();
        },

        renderList: function() {
            const tbody = document.getElementById('selectTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            const fragment = document.createDocumentFragment();

            this.filteredData.forEach((item, index) => {
                const fname = item.musicFilename.split(/[\\/]/).pop();
                const tr = document.createElement('tr');
                tr.className = `select-row`;
                tr.dataset.fname = fname;
                tr.onclick = (e) => { if (e.target.tagName !== 'INPUT') this.handleRowClick(index, e); };

                const artSrc = item.imageData || s.DEFAULT_ICON;
                let cellsHtml = `<td class="chk-cell"><input type="checkbox" class="col-check-box" onchange="window.ModalSongSelect.handleRowClick(${index}, event)"></td><td class="col-art-small"><img src="${artSrc}"></td>`;
                this.activeTags.forEach(tag => {
                    const val = u.escapeHtml(item[tag.key] || '');
                    cellsHtml += `<td class="col-${tag.key}">${val}</td>`;
                });
                tr.innerHTML = cellsHtml;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
        },

        handleRowClick: function(index, event) {
            const item = this.filteredData[index];
            const fname = item.musicFilename.split(/[\\/]/).pop();

            if (event.shiftKey && this.lastClickedIndex !== null) {
                const start = Math.min(this.lastClickedIndex, index);
                const end = Math.max(this.lastClickedIndex, index);
                const startItem = this.filteredData[this.lastClickedIndex];
                const startFname = startItem.musicFilename.split(/[\\/]/).pop();
                const shouldSelect = this.selectedFilenames.has(startFname);
                for (let i = start; i <= end; i++) {
                    const targetFname = this.filteredData[i].musicFilename.split(/[\\/]/).pop();
                    if (shouldSelect) this.selectedFilenames.add(targetFname);
                    else this.selectedFilenames.delete(targetFname);
                }
            } else {
                if (this.selectedFilenames.has(fname)) this.selectedFilenames.delete(fname);
                else this.selectedFilenames.add(fname);
                this.lastClickedIndex = index;
            }
            this.syncSelectedUI();
        },

        updateHeaderCheckboxState: function() {
            const checkAllBtn = document.getElementById('checkAllSongs');
            if (!checkAllBtn) return;
            const rows = Array.from(document.querySelectorAll('#selectTableBody tr')).filter(r => r.style.display !== 'none');
            if (rows.length === 0) { checkAllBtn.checked = false; checkAllBtn.indeterminate = false; return; }
            let checkedCount = 0;
            rows.forEach(tr => { if (this.selectedFilenames.has(tr.dataset.fname)) checkedCount++; });
            if (checkedCount === 0) { checkAllBtn.checked = false; checkAllBtn.indeterminate = false; }
            else if (checkedCount === rows.length) { checkAllBtn.checked = true; checkAllBtn.indeterminate = false; }
            else { checkAllBtn.checked = false; checkAllBtn.indeterminate = true; }
        },

        toggleAllSelection: function() {
            const checkAllBtn = document.getElementById('checkAllSongs');
            const rows = Array.from(document.querySelectorAll('#selectTableBody tr')).filter(r => r.style.display !== 'none');
            const shouldSelectAll = !checkAllBtn.checked || checkAllBtn.indeterminate;
            rows.forEach(tr => {
                const fname = tr.dataset.fname;
                if (shouldSelectAll) this.selectedFilenames.add(fname);
                else this.selectedFilenames.delete(fname);
            });
            this.syncSelectedUI();
        },

        initMarqueeSelection: function() {
            const container = document.getElementById('songSelectListContainer');
            const marquee = document.getElementById('selectionMarquee');
            if (!container || !marquee) return;
            let isSelecting = false; let startX = 0; let startY = 0;
            container.onmousedown = (e) => {
                if (e.button !== 0 || e.target.closest('tr') || e.target.tagName === 'INPUT') return;
                isSelecting = true;
                const rect = container.getBoundingClientRect();
                startX = e.clientX - rect.left; startY = e.clientY - rect.top + container.scrollTop;
                marquee.style.display = 'block'; marquee.style.width = '0'; marquee.style.height = '0';
                e.preventDefault();
            };
            window.onmousemove = (e) => {
                if (!isSelecting) return;
                const rect = container.getBoundingClientRect();
                const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height)) + container.scrollTop;
                const x = Math.min(startX, curX); const y = Math.min(startY, curY);
                const w = Math.abs(curX - startX); const h = Math.abs(curY - startY);
                marquee.style.left = x + 'px'; marquee.style.top = (y - container.scrollTop) + 'px';
                marquee.style.width = w + 'px'; marquee.style.height = h + 'px';
                this.selectRowsInMarquee(x, y, w, h, rect, container.scrollTop);
            };
            window.onmouseup = () => { isSelecting = false; marquee.style.display = 'none'; };
        },

        selectRowsInMarquee: function(x, y, w, h, containerRect, scrollY) {
            const rows = Array.from(document.querySelectorAll('#selectTableBody tr')).filter(r => r.style.display !== 'none');
            rows.forEach(row => {
                const r = row.getBoundingClientRect();
                const rTop = r.top - containerRect.top + scrollY;
                const rBot = r.bottom - containerRect.top + scrollY;
                if (!(rBot < y || rTop > y + h)) {
                    const fname = row.dataset.fname;
                    if (!this.selectedFilenames.has(fname)) {
                        this.selectedFilenames.add(fname);
                        row.classList.add('selected');
                        const c = row.querySelector('input'); if(c) c.checked = true;
                    }
                }
            });
            this.updateHeaderCheckboxState();
        }
    });
})();