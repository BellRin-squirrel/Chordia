(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    // ★ 修正: ドロップダウンの外側をクリックしたら閉じる処理をグローバルに追加
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.smart-group-wrapper .custom-select-dropdown').forEach(d => {
            if (!e.target.closest('.custom-select-wrapper')) {
                d.classList.remove('show');
            }
        });
    });

    Object.assign(window.SidebarController, {
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

        openSmartPlaylistModal: async function(existingPl = null) {
            try {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const settings = await invoke("get_app_settings");
                const allTags = await invoke("get_available_tags");
                const activeTags = settings.active_tags; 
                this.smartTags = allTags.filter(t => activeTags.includes(t.key)).map(t => ({val: t.key, label: t.label}));
                this.smartTags.push({val: 'lyric', label: '歌詞'});

                const modalTitle = document.querySelector('#smartPlaylistModal h3');
                const nameInput = document.getElementById('smartPlaylistName');
                const nameContainer = document.getElementById('smartPlaylistNameContainer');
                const btnCreate = document.getElementById('btnCreateSmart');
                const rootContainer = document.getElementById('smartConditionRoot');
                rootContainer.innerHTML = '';
                nameInput.classList.remove('input-error');

                if (existingPl) {
                    this.editingSmartId = existingPl.id;
                    modalTitle.textContent = "スマートプレイリストを編集";
                    nameContainer.style.display = 'none'; 
                    nameInput.value = existingPl.playlistName;
                    btnCreate.textContent = "保存";
                    const buildUI = (rules, container, isRoot) => {
                        if (rules.type === 'group') {
                            const groupWrap = window.SidebarController.createConditionGroup(isRoot, rules.match);
                            const groupBody = groupWrap.querySelector('.smart-group-body');
                            groupBody.innerHTML = ''; 
                            rules.items.forEach(item => buildUI(item, groupBody, false));
                            container.appendChild(groupWrap);
                        } else {
                            const filterRow = window.SidebarController.createFilterRow(rules.tag, rules.op, rules.val);
                            container.appendChild(filterRow);
                        }
                    };
                    buildUI(existingPl.conditions, rootContainer, true);
                } else {
                    this.editingSmartId = null;
                    modalTitle.textContent = "スマートプレイリストを新規作成";
                    nameContainer.style.display = 'block'; 
                    nameInput.value = "";
                    btnCreate.textContent = "作成";
                    rootContainer.appendChild(window.SidebarController.createConditionGroup(true, 'all'));
                }
                window.SidebarController.updateAllMinusButtons();
                const modal = document.getElementById('smartPlaylistModal');
                if(modal) modal.classList.add('show');
            } catch(e) { 
                console.error("Open Smart Modal Error:", e);
                u.showToast("設定の読み込みに失敗しました", true); 
            }
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
            textSpan.className = 'smart-text';
            textSpan.textContent = 'ルールに一致';
            
            const spacer = document.createElement('div');
            spacer.style.flex = "1";
            
            groupHeader.appendChild(matchSelector);
            groupHeader.appendChild(textSpan);
            groupHeader.appendChild(spacer);
            
            const btnContainer = document.createElement('div');
            btnContainer.className = 'smart-btn-container';
            const btnMinus = document.createElement('button');
            btnMinus.className = 'smart-row-btn minus group-minus';
            btnMinus.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" /></svg>`;
            const btnPlus = document.createElement('button');
            btnPlus.className = 'smart-row-btn plus';
            btnPlus.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
            const btnMore = document.createElement('button');
            btnMore.className = 'smart-row-btn more';
            btnMore.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>`;
            
            if (isRoot) {
                btnMinus.disabled = btnPlus.disabled = btnMore.disabled = true;
                btnMinus.classList.add('disabled'); btnPlus.classList.add('disabled'); btnMore.classList.add('disabled');
            } else {
                btnMinus.onclick = () => { groupWrap.remove(); window.SidebarController.updateAllMinusButtons(); };
                btnPlus.onclick = () => { groupWrap.parentElement.insertBefore(window.SidebarController.createFilterRow(), groupWrap.nextSibling); window.SidebarController.updateAllMinusButtons(); };
                btnMore.onclick = () => { groupWrap.parentElement.insertBefore(window.SidebarController.createConditionGroup(false, 'all'), groupWrap.nextSibling); window.SidebarController.updateAllMinusButtons(); };
            }
            btnContainer.appendChild(btnMinus); btnContainer.appendChild(btnPlus); btnContainer.appendChild(btnMore);
            groupHeader.appendChild(btnContainer);
            
            const groupBody = document.createElement('div');
            groupBody.className = 'smart-group-body';
            groupBody.style.paddingLeft = '24px'; groupBody.style.borderLeft = '2px solid rgba(128,128,128,0.2)';
            groupBody.appendChild(this.createFilterRow());
            
            groupWrap.appendChild(groupHeader); groupWrap.appendChild(groupBody);
            return groupWrap;
        },

        createFilterRow: function(initTag = null, initOp = null, initVal = null) {
            const row = document.createElement('div');
            row.className = 'smart-condition-row';
            const defaultTag = initTag || (this.smartTags.some(t => t.val === 'artist') ? 'artist' : this.smartTags[0].val);
            row.dataset.tag = defaultTag;
            row.dataset.op = initOp || 'contains';

            const inputContainer = document.createElement('div');
            inputContainer.className = 'smart-input-container';
            const opContainer = document.createElement('div');
            opContainer.className = 'custom-select-wrapper';

            const updateInputs = (tag, op, val = null) => {
                inputContainer.innerHTML = '';
                const isNum = ['track', 'year', 'disc', 'bpm'].includes(tag);
                if (isNum) {
                    if (op === 'range') {
                        const i1 = document.createElement('input'); i1.type = 'number'; i1.className = 'smart-input'; i1.placeholder = '0';
                        const i2 = document.createElement('input'); i2.type = 'number'; i2.className = 'smart-input'; i2.placeholder = '0';
                        if (Array.isArray(val)) { i1.value = val[0]; i2.value = val[1]; }
                        inputContainer.appendChild(i1);
                        inputContainer.insertAdjacentHTML('beforeend', '<span class="smart-text">と</span>');
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

            const tagSelector = this.createDynamicCustomSelector(this.smartTags, row.dataset.tag, (newTag) => {
                row.dataset.tag = newTag;
                const isNum = ['track', 'year', 'disc', 'bpm'].includes(newTag);
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

            const initialOps = ['track', 'year', 'disc', 'bpm'].includes(row.dataset.tag) ? this.numOps : this.textOps;
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
            btnMinus.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15" /></svg>`;
            btnMinus.onclick = () => { row.remove(); window.SidebarController.updateAllMinusButtons(); };
            
            const btnPlus = document.createElement('button');
            btnPlus.className = 'smart-row-btn plus';
            btnPlus.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
            btnPlus.onclick = () => { row.parentElement.insertBefore(this.createFilterRow(), row.nextSibling); window.SidebarController.updateAllMinusButtons(); };
            
            const btnMore = document.createElement('button');
            btnMore.className = 'smart-row-btn more';
            btnMore.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>`;
            btnMore.onclick = () => { row.parentElement.insertBefore(this.createConditionGroup(false, 'all'), row.nextSibling); window.SidebarController.updateAllMinusButtons(); };

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
            const root = document.getElementById('smartConditionRoot');
            if (!root) return;
            root.querySelectorAll('.smart-group-body').forEach(body => {
                const children = Array.from(body.children).filter(c => c.classList.contains('smart-condition-row') || c.classList.contains('smart-group-wrapper'));
                const isSingle = (children.length <= 1);
                children.forEach(child => {
                    let btn = child.classList.contains('smart-condition-row') ? child.querySelector('.filter-minus') : child.querySelector('.smart-group-header .group-minus');
                    if (btn) { btn.disabled = isSingle; if (isSingle) btn.classList.add('disabled'); else btn.classList.remove('disabled'); }
                });
            });
        },

        finishCreateSmart: async function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const nameInput = document.getElementById('smartPlaylistName');
            let name = nameInput.value.trim();
            if (!this.editingSmartId && !name) {
                nameInput.classList.add('input-error'); nameInput.focus();
                u.showToast("プレイリスト名を入力してください", true);
                nameInput.addEventListener('input', () => nameInput.classList.remove('input-error'), { once: true }); return;
            }
            if (this.editingSmartId) {
                const currentPl = s.playlists.find(p => p.id === this.editingSmartId);
                if (currentPl) name = currentPl.playlistName;
            }
            const rootElement = document.querySelector('#smartConditionRoot > .smart-group-wrapper');
            if (!rootElement) return;
            const parseGroup = (groupWrap) => {
                const match = groupWrap.querySelector('.smart-group-match').value;
                const items = [];
                Array.from(groupWrap.querySelector('.smart-group-body').children).forEach(child => {
                    if (child.classList.contains('smart-condition-row')) {
                        const tag = child.querySelector('.smart-filter-tag').value;
                        const op = child.querySelector('.smart-filter-op').value;
                        const inputs = child.querySelectorAll('.smart-input');
                        const val = inputs.length > 1 ? [inputs[0].value, inputs[1].value] : inputs[0].value;
                        items.push({ type: 'filter', tag, op, val });
                    } else if (child.classList.contains('smart-group-wrapper')) items.push(parseGroup(child));
                });
                return { type: 'group', match, items };
            };
            const rules = parseGroup(rootElement);
            document.getElementById('smartPlaylistModal').classList.remove('show');
            try {
                let resultPl;
                if (this.editingSmartId) {
                    resultPl = await invoke("update_smart_playlist", { plId: this.editingSmartId, name: name, conditions: rules });
                    const idx = s.playlists.findIndex(p => p.id === this.editingSmartId);
                    if (idx !== -1) s.playlists[idx] = resultPl;
                    u.showToast("更新しました", false);
                } else {
                    resultPl = await invoke("create_smart_playlist", { name: name, conditions: rules });
                    s.playlists.push(resultPl);
                    u.showToast("作成しました", false);
                }
                s.playlists.sort((a, b) => (a.playlistName||"").toLowerCase().localeCompare((b.playlistName||"").toLowerCase(), 'ja'));
                this.renderSidebar();
                window.MainViewController.selectPlaylist(s.playlists.findIndex(p => p.id === resultPl.id));
            } catch(e) { u.showToast("処理に失敗しました", true); }
        }
    });
})();