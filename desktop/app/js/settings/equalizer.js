window.SettingsEqualizer = {
    freqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    freqLabels: ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'],
    
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

    currentConfig: {
        enabled: false,
        selectedAssetId: "flat",
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
            const col = document.createElement('div');
            col.className = 'eq-band-col';
            
            const gainVal = this.currentConfig.gains[idx] || 0;
            const sign = gainVal > 0 ? '+' : '';

            col.innerHTML = `
                <span class="eq-gain-val" id="eqGainVal_${idx}">${sign}${gainVal.toFixed(1)} dB</span>
                <div class="eq-slider-vertical-wrap">
                    <input type="range" class="eq-slider-vertical" id="eqSlider_${idx}" min="-12" max="12" step="0.5" value="${gainVal}">
                </div>
                <span class="eq-freq-label">${this.freqLabels[idx]}</span>
            `;

            grid.appendChild(col);
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
            const isActive = (p.id === this.currentConfig.selectedAssetId);
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

        // 2. カスタムアセットグループ
        const customHeader = document.createElement('div');
        customHeader.className = 'custom-group-header';
        customHeader.textContent = 'カスタムアセット';
        dropdown.appendChild(customHeader);

        // ユーザー保存アセット一覧
        for (const assetName in this.customAssets) {
            const item = document.createElement('div');
            const isCustomActive = (assetName === this.currentConfig.selectedAssetId);
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
        }

        // 手動調整中（未保存カスタム）
        const unSavedItem = document.createElement('div');
        const isUnsavedActive = (this.currentConfig.selectedAssetId === "custom");
        unSavedItem.className = 'custom-option' + (isUnsavedActive ? ' active' : '');
        unSavedItem.innerHTML = `
            <svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>Custom (カスタム)</span>
        `;

        if (isUnsavedActive && displayVal) {
            displayVal.textContent = "Custom (カスタム)";
        }

        unSavedItem.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            this.currentConfig.selectedAssetId = "custom";
            this.updateButtonVisibility();
            this.rebuildAssetOptions();
            this.saveSettings();
        };

        dropdown.appendChild(unSavedItem);
    },

    applyAsset: function(assetId, isUserCustom = false) {
        this.currentConfig.selectedAssetId = assetId;

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
                this.currentConfig.selectedAssetId = "custom";
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
                    this.currentConfig.selectedAssetId = "custom";
                    
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

    // ★ カスタムアセット保存ポップアップと削除処理の管理
    setupCustomAssetModals: function() {
        const btnSaveOriginal = document.getElementById('btnSaveOriginalEqAsset');
        const btnDeleteOriginal = document.getElementById('btnDeleteOriginalEqAsset');
        const modal = document.getElementById('eqAssetModal');
        const newNameInput = document.getElementById('newEqAssetName');
        const btnConfirm = document.getElementById('btnConfirmEqAssetModal');
        const btnCancel = document.getElementById('btnCancelEqAssetModal');

        if (btnSaveOriginal) {
            btnSaveOriginal.addEventListener('click', () => {
                if (newNameInput) newNameInput.value = "";
                if (modal) {
                    modal.style.display = 'flex';
                    setTimeout(() => {
                        if (newNameInput) newNameInput.focus();
                    }, 50);
                }
            });
        }

        if (btnCancel && modal) {
            btnCancel.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        const handleSaveConfirm = () => {
            const name = (newNameInput ? newNameInput.value.trim() : "");
            if (!name) return;

            if (this.presets.some(p => p.id === name || p.name === name) || name === "custom") {
                alert("プリセットと同じ名前は使用できません。");
                return;
            }

            if (this.customAssets[name]) {
                if (!confirm(`カスタムアセット "${name}" は既に存在します。上書きしますか？`)) {
                    return;
                }
            }

            // 現在のプリアンプおよび10バンドゲインをカスタムアセットとして保存
            this.customAssets[name] = {
                preamp: this.currentConfig.preamp,
                gains: [...this.currentConfig.gains]
            };

            localStorage.setItem('chordia_custom_eq_assets', JSON.stringify(this.customAssets));

            this.currentConfig.selectedAssetId = name;
            if (modal) modal.style.display = 'none';
            this.rebuildAssetOptions();
            this.updateUI();
            this.saveSettings();
            window.SettingsGeneral.showToast(`イコライザアセット "${name}" を保存しました`);
        };

        if (btnConfirm && modal) {
            btnConfirm.addEventListener('click', handleSaveConfirm);
        }

        if (newNameInput) {
            newNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveConfirm();
                } else if (e.key === 'Escape' && modal) {
                    modal.style.display = 'none';
                }
            });
        }

        if (btnDeleteOriginal) {
            btnDeleteOriginal.addEventListener('click', () => {
                const currentId = this.currentConfig.selectedAssetId;
                if (!this.customAssets[currentId]) return;

                if (confirm(`カスタムアセット "${currentId}" を削除してもよろしいですか？`)) {
                    delete this.customAssets[currentId];
                    localStorage.setItem('chordia_custom_eq_assets', JSON.stringify(this.customAssets));
                    
                    this.currentConfig.selectedAssetId = "flat";
                    this.applyAsset("flat", false);
                    this.rebuildAssetOptions();
                    this.updateUI();
                    this.saveSettings();
                    window.SettingsGeneral.showToast(`アセット "${currentId}" を削除しました`);
                }
            });
        }
    },

    updateButtonVisibility: function() {
        const btnDeleteOriginal = document.getElementById('btnDeleteOriginalEqAsset');
        const currentId = this.currentConfig.selectedAssetId;
        const isSavedUserAsset = Boolean(this.customAssets[currentId]);

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