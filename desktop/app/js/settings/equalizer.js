window.SettingsEqualizer = {
    freqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    freqLabels: ['32 Hz', '64 Hz', '125 Hz', '250 Hz', '500 Hz', '1 kHz', '2 kHz', '4 kHz', '8 kHz', '16 kHz'],
    
    presets: [
        {
            id: "flat",
            name: "Flat",
            gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            preamp: 0
        },
        {
            id: "rock",
            name: "Rock",
            gains: [4.5, 3.0, 1.5, 0, -1.5, -1.0, 1.0, 2.5, 4.0, 4.5],
            preamp: -1.5
        },
        {
            id: "pop",
            name: "Pop",
            gains: [-1.0, 1.0, 2.5, 3.5, 3.0, 1.0, -1.0, -1.5, 1.5, 2.5],
            preamp: -1.0
        },
        {
            id: "bass_boost",
            name: "Bass Boost",
            gains: [6.0, 5.0, 4.0, 2.5, 1.0, 0, 0, 0, 0, 0],
            preamp: -3.0
        },
        {
            id: "vocal",
            name: "Vocal / Podcast",
            gains: [-3.0, -2.0, -1.0, 1.5, 3.5, 4.0, 3.0, 1.5, 0, -1.5],
            preamp: -1.0
        },
        {
            id: "acoustic_jazz",
            name: "Acoustic & Jazz",
            gains: [3.0, 2.5, 1.5, 1.0, 1.5, 1.5, 2.0, 2.5, 3.0, 3.0],
            preamp: -1.0
        },
        {
            id: "electronic",
            name: "Electronic",
            gains: [5.0, 4.0, 2.0, 0, -2.0, 1.5, 2.0, 3.0, 4.5, 5.0],
            preamp: -2.5
        },
        {
            id: "treble_boost",
            name: "Treble Boost",
            gains: [0, 0, 0, 0, 0, 1.0, 2.5, 4.0, 5.5, 6.0],
            preamp: -2.0
        },
        {
            id: "night_mode",
            name: "Night Mode",
            gains: [-4.0, -3.0, -2.0, 0, 1.0, 1.0, 1.0, 0, -2.0, -3.5],
            preamp: 0
        }
    ],

    customAssets: {},
    pendingSaveName: "",

    currentConfig: {
        enabled: false,
        selectedAssetId: "flat",
        isEditing: false,
        preamp: 0,
        gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },

    init: function() {
        this.loadSettings();
        this.renderBands();
        this.initAssetDropdown();
        this.setupEventListeners();
        this.setupCustomAssetModals();
        this.updateUI();
    },

    loadSettings: function() {
        const raw = localStorage.getItem('chordia_equalizer_settings');
        if (raw) {
            try {
                this.currentConfig = Object.assign({}, this.currentConfig, JSON.parse(raw));
                if (this.currentConfig.presetId && !this.currentConfig.selectedAssetId) {
                    this.currentConfig.selectedAssetId = this.currentConfig.presetId;
                }
            } catch(e) {
                console.error("Failed to parse equalizer settings:", e);
            }
        }

        const customRaw = localStorage.getItem('chordia_custom_eq_assets');
        if (customRaw) {
            try {
                this.customAssets = JSON.parse(customRaw) || {};
            } catch(e) {
                this.customAssets = {};
            }
        }
    },

    saveSettings: function() {
        localStorage.setItem('chordia_equalizer_settings', JSON.stringify(this.currentConfig));
        localStorage.setItem('chordia_equalizer_update', String(Date.now()));
    },

    renderBands: function() {
        const grid = document.getElementById('eqBandsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        this.freqs.forEach((freq, idx) => {
            const row = document.createElement('div');
            row.className = 'eq-band-row';
            
            const gainVal = this.currentConfig.gains[idx] || 0;
            const sign = gainVal > 0 ? '+' : '';

            row.innerHTML = `
                <span class="eq-band-label">${this.freqLabels[idx]}</span>
                <div class="eq-slider-horizontal-wrap">
                    <input type="range" class="eq-slider-horizontal" id="eqSlider_${idx}" min="-12" max="12" step="0.5" value="${gainVal}">
                </div>
                <span class="eq-val-badge" id="eqGainVal_${idx}">${sign}${gainVal.toFixed(1)} dB</span>
            `;

            grid.appendChild(row);
        });
    },

    initAssetDropdown: function() {
        const trigger = document.getElementById('eqAssetTrigger');
        const dropdown = document.getElementById('eqAssetDropdown');

        if (!trigger || !dropdown) return;

        trigger.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        };

        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        this.rebuildAssetOptions();
    },

    rebuildAssetOptions: function() {
        const dropdown = document.getElementById('eqAssetDropdown');
        const displayVal = document.getElementById('eqAssetValue');
        if (!dropdown) return;

        dropdown.innerHTML = '';

        // 1. プリセットグループ
        const presetHeader = document.createElement('div');
        presetHeader.className = 'custom-group-header';
        presetHeader.textContent = 'プリセット';
        dropdown.appendChild(presetHeader);

        this.presets.forEach(p => {
            const item = document.createElement('div');
            const isActive = (!this.currentConfig.isEditing && p.id === this.currentConfig.selectedAssetId);
            item.className = 'custom-option' + (isActive ? ' active' : '');
            item.innerHTML = `
                <svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>${p.name}</span>
            `;

            if (isActive && displayVal) {
                displayVal.textContent = p.name;
            }

            item.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.remove('show');
                this.applyAsset(p.id, false);
            };

            dropdown.appendChild(item);
        });

        // 2. カスタムアセットグループ（ユーザー保存アセットが1件以上ある場合のみ表示）
        const customNames = Object.keys(this.customAssets);
        if (customNames.length > 0) {
            const customHeader = document.createElement('div');
            customHeader.className = 'custom-group-header';
            customHeader.textContent = 'カスタムアセット';
            dropdown.appendChild(customHeader);

            customNames.forEach(assetName => {
                const item = document.createElement('div');
                const isCustomActive = (!this.currentConfig.isEditing && assetName === this.currentConfig.selectedAssetId);
                item.className = 'custom-option' + (isCustomActive ? ' active' : '');
                item.innerHTML = `
                    <svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>${assetName}</span>
                `;

                if (isCustomActive && displayVal) {
                    displayVal.textContent = assetName;
                }

                item.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.remove('show');
                    this.applyAsset(assetName, true);
                };

                dropdown.appendChild(item);
            });
        }

        // 編集中（手動変更時）のトリガーラベル表示
        if (this.currentConfig.isEditing && displayVal) {
            displayVal.textContent = "Custom (編集中)";
        }
    },

    applyAsset: function(assetId, isUserCustom = false) {
        this.currentConfig.selectedAssetId = assetId;
        this.currentConfig.isEditing = false;

        if (isUserCustom) {
            const customData = this.customAssets[assetId];
            if (customData) {
                this.currentConfig.gains = [...customData.gains];
                this.currentConfig.preamp = customData.preamp;
            }
        } else {
            const found = this.presets.find(p => p.id === assetId);
            if (found) {
                this.currentConfig.gains = [...found.gains];
                this.currentConfig.preamp = found.preamp;
            }
        }

        this.updateUI();
        this.saveSettings();
        this.rebuildAssetOptions();
    },

    setupEventListeners: function() {
        const toggleEq = document.getElementById('toggleEqualizer');
        if (toggleEq) {
            toggleEq.checked = this.currentConfig.enabled;
            toggleEq.addEventListener('change', (e) => {
                this.currentConfig.enabled = e.target.checked;
                this.updateUI();
                this.saveSettings();
                window.SettingsGeneral.showToast(this.currentConfig.enabled ? "イコライザを有効にしました" : "イコライザを無効にしました");
            });
        }

        const preampSlider = document.getElementById('eqPreampSlider');
        if (preampSlider) {
            preampSlider.value = this.currentConfig.preamp;
            preampSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.currentConfig.preamp = val;
                this.currentConfig.isEditing = true;
                
                const badge = document.getElementById('eqPreampValue');
                if (badge) {
                    const sign = val > 0 ? '+' : '';
                    badge.textContent = `${sign}${val.toFixed(1)} dB`;
                }
                this.updateButtonVisibility();
                this.rebuildAssetOptions();
                this.saveSettings();
            });
        }

        this.freqs.forEach((_, idx) => {
            const slider = document.getElementById(`eqSlider_${idx}`);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.currentConfig.gains[idx] = val;
                    this.currentConfig.isEditing = true;
                    
                    const valDisplay = document.getElementById(`eqGainVal_${idx}`);
                    if (valDisplay) {
                        const sign = val > 0 ? '+' : '';
                        valDisplay.textContent = `${sign}${val.toFixed(1)} dB`;
                    }
                    this.updateButtonVisibility();
                    this.rebuildAssetOptions();
                    this.saveSettings();
                });
            }
        });
    },

    // ★ HTMLモーダルによるポップアップ（Ctrl+Enter / Cmd+Enter で確定）
    setupCustomAssetModals: function() {
        const btnSaveOriginal = document.getElementById('btnSaveOriginalEqAsset');
        const btnDeleteOriginal = document.getElementById('btnDeleteOriginalEqAsset');
        
        const saveModal = document.getElementById('eqAssetModal');
        const newNameInput = document.getElementById('newEqAssetName');
        const btnConfirmSave = document.getElementById('btnConfirmEqAssetModal');
        const btnCancelSave = document.getElementById('btnCancelEqAssetModal');

        const overwriteModal = document.getElementById('eqAssetOverwriteModal');
        const overwriteMsg = document.getElementById('eqAssetOverwriteMessage');
        const btnConfirmOverwrite = document.getElementById('btnConfirmEqAssetOverwrite');
        const btnCancelOverwrite = document.getElementById('btnCancelEqAssetOverwrite');

        const deleteModal = document.getElementById('eqAssetDeleteModal');
        const deleteMsg = document.getElementById('eqAssetDeleteMessage');
        const btnConfirmDelete = document.getElementById('btnConfirmEqAssetDelete');
        const btnCancelDelete = document.getElementById('btnCancelEqAssetDelete');

        const openModal = (m) => {
            if (!m) return;
            m.style.display = 'flex';
            setTimeout(() => m.classList.add('show'), 10);
        };

        const closeModal = (m) => {
            if (!m) return;
            m.classList.remove('show');
            setTimeout(() => { m.style.display = 'none'; }, 200);
        };

        // 1. 保存モーダルを開く
        if (btnSaveOriginal) {
            btnSaveOriginal.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (newNameInput) newNameInput.value = "";
                openModal(saveModal);
                setTimeout(() => {
                    if (newNameInput) newNameInput.focus();
                }, 50);
            });
        }

        if (btnCancelSave && saveModal) {
            btnCancelSave.addEventListener('click', () => closeModal(saveModal));
        }

        const handleSaveExecute = () => {
            const name = (newNameInput ? newNameInput.value.trim() : "");
            if (!name) {
                window.SettingsGeneral.showToast("アセット名を入力してください", true);
                if (newNameInput) newNameInput.focus();
                return;
            }

            if (this.presets.some(p => p.id === name || p.name === name) || name.toLowerCase() === "custom") {
                window.SettingsGeneral.showToast("プリセットと同じ名前は使用できません", true);
                if (newNameInput) newNameInput.focus();
                return;
            }

            // 同名のアセットが既に存在する場合は上書き確認モーダルを表示
            if (this.customAssets[name]) {
                this.pendingSaveName = name;
                closeModal(saveModal);
                if (overwriteMsg) {
                    overwriteMsg.textContent = `アセット「${name}」は既に存在します。上書きしますか？`;
                }
                openModal(overwriteModal);
                return;
            }

            this.commitSaveAsset(name);
            closeModal(saveModal);
        };

        if (btnConfirmSave && saveModal) {
            btnConfirmSave.addEventListener('click', handleSaveExecute);
        }

        // ★ Windows: Ctrl + Enter / Mac: Command(Meta) + Enter でのみ確定
        if (newNameInput) {
            newNameInput.addEventListener('keydown', (e) => {
                // 日本語入力変換中のEnterを確実にスルー
                if (e.isComposing || e.keyCode === 229) return;

                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSaveExecute();
                } else if (e.key === 'Enter') {
                    // 通常のEnter単体では確定させない
                    e.preventDefault();
                } else if (e.key === 'Escape' && saveModal) {
                    closeModal(saveModal);
                }
            });
        }

        // 2. 上書き保存確認
        if (btnConfirmOverwrite && overwriteModal) {
            btnConfirmOverwrite.addEventListener('click', () => {
                if (this.pendingSaveName) {
                    this.commitSaveAsset(this.pendingSaveName);
                    this.pendingSaveName = "";
                }
                closeModal(overwriteModal);
            });
        }

        if (btnCancelOverwrite && overwriteModal) {
            btnCancelOverwrite.addEventListener('click', () => {
                this.pendingSaveName = "";
                closeModal(overwriteModal);
            });
        }

        // 3. 削除確認
        if (btnDeleteOriginal) {
            btnDeleteOriginal.addEventListener('click', () => {
                const currentId = this.currentConfig.selectedAssetId;
                if (!this.customAssets[currentId]) return;

                if (deleteMsg) {
                    deleteMsg.textContent = `カスタムアセット「${currentId}」を削除してもよろしいですか？`;
                }
                openModal(deleteModal);
            });
        }

        if (btnConfirmDelete && deleteModal) {
            btnConfirmDelete.addEventListener('click', () => {
                const currentId = this.currentConfig.selectedAssetId;
                if (this.customAssets[currentId]) {
                    delete this.customAssets[currentId];
                    localStorage.setItem('chordia_custom_eq_assets', JSON.stringify(this.customAssets));

                    this.currentConfig.selectedAssetId = "flat";
                    this.currentConfig.isEditing = false;
                    this.applyAsset("flat", false);
                    this.rebuildAssetOptions();
                    this.updateUI();
                    this.saveSettings();
                    window.SettingsGeneral.showToast(`アセット「${currentId}」を削除しました`);
                }
                closeModal(deleteModal);
            });
        }

        if (btnCancelDelete && deleteModal) {
            btnCancelDelete.addEventListener('click', () => closeModal(deleteModal));
        }
    },

    commitSaveAsset: function(name) {
        this.customAssets[name] = {
            preamp: this.currentConfig.preamp,
            gains: [...this.currentConfig.gains]
        };

        localStorage.setItem('chordia_custom_eq_assets', JSON.stringify(this.customAssets));

        this.currentConfig.selectedAssetId = name;
        this.currentConfig.isEditing = false;

        this.rebuildAssetOptions();
        this.updateUI();
        this.saveSettings();
        window.SettingsGeneral.showToast(`イコライザアセット「${name}」を保存しました`);
    },

    updateButtonVisibility: function() {
        const btnDeleteOriginal = document.getElementById('btnDeleteOriginalEqAsset');
        const currentId = this.currentConfig.selectedAssetId;
        const isSavedUserAsset = !this.currentConfig.isEditing && Boolean(this.customAssets[currentId]);

        if (btnDeleteOriginal) {
            btnDeleteOriginal.style.display = isSavedUserAsset ? 'block' : 'none';
        }
    },

    updateUI: function() {
        const toggleEq = document.getElementById('toggleEqualizer');
        const eqArea = document.getElementById('eqControlArea');
        const preampSlider = document.getElementById('eqPreampSlider');
        const preampVal = document.getElementById('eqPreampValue');

        if (toggleEq) toggleEq.checked = this.currentConfig.enabled;
        if (eqArea) eqArea.classList.toggle('disabled', !this.currentConfig.enabled);

        if (preampSlider) preampSlider.value = this.currentConfig.preamp;
        if (preampVal) {
            const pVal = this.currentConfig.preamp || 0;
            const sign = pVal > 0 ? '+' : '';
            preampVal.textContent = `${sign}${pVal.toFixed(1)} dB`;
        }

        this.freqs.forEach((_, idx) => {
            const slider = document.getElementById(`eqSlider_${idx}`);
            const valDisplay = document.getElementById(`eqGainVal_${idx}`);
            const gVal = this.currentConfig.gains[idx] || 0;

            if (slider) slider.value = gVal;
            if (valDisplay) {
                const sign = gVal > 0 ? '+' : '';
                valDisplay.textContent = `${sign}${gVal.toFixed(1)} dB`;
            }
        });

        this.updateButtonVisibility();
    }
};