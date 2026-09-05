window.SettingsGeneral = {
    isInitialized: false,
    saveTimeout: null,
    toastTimeout: null,
    customThemes: {},
    currentSettings: {},
    selectedThemeMode: 'light',
    selectedLanguage: 'Japanese.ini',

    THEME_PRESETS: {
        light: { bg: '#f3f4f6', subBg: '#ffffff', text: '#1f2937' },
        dark: { bg: '#111827', subBg: '#1f2937', text: '#f9fafb' }
    },

    init: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

        const settings = await invoke("get_app_settings");
        this.currentSettings = settings;
        this.selectedThemeMode = settings.theme_mode || 'light';
        this.selectedLanguage = settings.language || 'Japanese.ini';

        const availableTags = await invoke("get_available_tags");
        this.customThemes = await invoke("get_custom_themes");

        this.initFormElements(settings);
        await this.initLanguageSelector();
        this.initThemeSelector();
        this.renderCombinedTagList(availableTags);
        this.initArtworkRestore();

        this.isInitialized = true;
    },

    hexToRgba: function(hex, alpha) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    initFormElements: function(settings) {
        document.getElementById('itemsPerPage').value = settings.items_per_page;
        document.getElementById('openPlayerNewWindow').checked = settings.open_player_new_window;
        document.getElementById('openManageNewWindow').checked = settings.open_manage_new_window;
        document.getElementById('openExtensionsNewWindow').checked = settings.open_extensions_new_window;
        document.getElementById('openAddMusicNewWindow').checked = settings.open_add_music_new_window;
        document.getElementById('openSettingsNewWindow').checked = settings.open_settings_new_window;
        document.getElementById('normalizeVolume').checked = settings.normalize_volume;
        document.getElementById('primaryColor').value = settings.primary_color;

        const allInputs = [
            document.getElementById('itemsPerPage'),
            document.getElementById('openPlayerNewWindow'),
            document.getElementById('openManageNewWindow'),
            document.getElementById('openExtensionsNewWindow'),
            document.getElementById('openAddMusicNewWindow'),
            document.getElementById('openSettingsNewWindow'),
            document.getElementById('primaryColor'),
            document.getElementById('backgroundColor'),
            document.getElementById('subBackgroundColor'),
            document.getElementById('textColor')
        ];

        allInputs.forEach(el => {
            if (el) {
                el.addEventListener('change', () => this.handleChange());
                if (el.type === 'color' || el.type === 'number') {
                    el.addEventListener('input', () => this.handleInput());
                }
            }
        });

        const chkNormalizeVolume = document.getElementById('normalizeVolume');
        if (chkNormalizeVolume) {
            chkNormalizeVolume.addEventListener('click', async (e) => {
                if (chkNormalizeVolume.checked) {
                    e.preventDefault(); 
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    const status = await invoke("check_tools_status");
                    if (!status['ffmpeg']) {
                        alert("一定音量機能を有効にするには、まず拡張機能画面から FFmpeg をインストールしてください。");
                        chkNormalizeVolume.checked = false;
                        return;
                    }

                    try {
                        const lufsInfo = await invoke("check_lufs_status");
                        if (!lufsInfo.is_completed) {
                            alert(`一定音量機能を有効にするには、事前に拡張機能の画面で測定を完了させておく必要があります。\n\n(未測定の楽曲: ${lufsInfo.uncalculated} 曲)\n\n拡張機能画面から「音量測定」を実行してください。`);
                            chkNormalizeVolume.checked = false;
                            return;
                        }
                    } catch(err) {
                        alert("測定ステータスの確認に失敗しました。");
                        chkNormalizeVolume.checked = false;
                        return;
                    }

                    chkNormalizeVolume.checked = true;
                    this.handleChange();
                    this.showToast("設定を保存しました");
                } else {
                    this.handleChange();
                }
            });
        }
    },

    initLanguageSelector: async function() {
        const langSelectTrigger = document.getElementById('langSelectTrigger');
        const langSelectDropdown = document.getElementById('langSelectDropdown');
        const langSelectValue = document.getElementById('langSelectValue');

        if (!langSelectTrigger || !langSelectDropdown) return;

        langSelectTrigger.onclick = (e) => {
            e.stopPropagation();
            langSelectDropdown.classList.toggle('show');
            const customSelectDropdown = document.getElementById('themeSelectDropdown');
            if (customSelectDropdown) customSelectDropdown.classList.remove('show');
        };

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const availableLangs = await invoke("get_available_languages");
        langSelectDropdown.innerHTML = '';

        availableLangs.forEach(lang => {
            const item = document.createElement('div');
            const isActive = (lang.file === this.selectedLanguage);
            item.className = 'custom-option' + (isActive ? ' active' : '');
            item.innerHTML = `
                <svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>${lang.name}</span>
            `;

            if (isActive) {
                langSelectValue.textContent = lang.name;
            }

            item.onclick = (e) => {
                e.stopPropagation();
                this.selectedLanguage = lang.file;
                langSelectValue.textContent = lang.name;
                
                langSelectDropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                item.classList.add('active');
                
                this.handleChange();
                langSelectDropdown.classList.remove('show');
            };

            langSelectDropdown.appendChild(item);
        });
    },

    initThemeSelector: function() {
        const customSelectTrigger = document.getElementById('themeSelectTrigger');
        const customSelectDropdown = document.getElementById('themeSelectDropdown');

        customSelectTrigger.onclick = (e) => {
            e.stopPropagation();
            customSelectDropdown.classList.toggle('show');
            const langSelectDropdown = document.getElementById('langSelectDropdown');
            if (langSelectDropdown) langSelectDropdown.classList.remove('show');
        };

        document.addEventListener('click', () => {
            if (customSelectDropdown) customSelectDropdown.classList.remove('show');
            const langSelectDropdown = document.getElementById('langSelectDropdown');
            if (langSelectDropdown) langSelectDropdown.classList.remove('show');
        });

        this.rebuildThemeOptions(this.selectedThemeMode);
        this.updateThemeUI();

        const btnSaveOriginalTheme = document.getElementById('btnSaveOriginalTheme');
        const btnDeleteOriginalTheme = document.getElementById('btnDeleteOriginalTheme');
        const themeModal = document.getElementById('themeModal');
        const newThemeName = document.getElementById('newThemeName');
        const btnConfirmTheme = document.getElementById('btnConfirmTheme');
        const btnCancelTheme = document.getElementById('btnCancelTheme');

        btnSaveOriginalTheme.addEventListener('click', () => {
            newThemeName.value = "";
            themeModal.style.display = 'flex';
        });

        btnCancelTheme.addEventListener('click', () => themeModal.style.display = 'none');

        btnConfirmTheme.addEventListener('click', async () => {
            const name = newThemeName.value.trim();
            if (!name) return;
            if (['light', 'dark', 'custom'].includes(name)) {
                alert("その名前は使用できません。");
                return;
            }

            const colors = { 
                bg: document.getElementById('backgroundColor').value, 
                subBg: document.getElementById('subBackgroundColor').value, 
                text: document.getElementById('textColor').value 
            };
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const success = await invoke("save_custom_theme", { name: name, colors: colors });
            if (success) {
                this.customThemes[name] = colors;
                themeModal.style.display = 'none';
                this.selectedThemeMode = name;
                this.rebuildThemeOptions(name);
                this.saveAllSettings(false);
                this.showToast(`テーマ "${name}" を保存しました`);
            }
        });

        btnDeleteOriginalTheme.addEventListener('click', async () => {
            const name = this.selectedThemeMode;
            if (confirm(`テーマ "${name}" を削除してもよろしいですか？`)) {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const success = await invoke("delete_custom_theme", { name: name });
                if (success) {
                    delete this.customThemes[name];
                    this.selectedThemeMode = 'custom';
                    this.rebuildThemeOptions('custom');
                    this.updateThemeUI();
                    this.saveAllSettings(false);
                    this.showToast(`テーマ "${name}" を削除しました`);
                }
            }
        });
    },

    rebuildThemeOptions: function(activeMode) {
        const customSelectDropdown = document.getElementById('themeSelectDropdown');
        const customSelectValue = document.getElementById('themeSelectValue');
        customSelectDropdown.innerHTML = '';
        const options = [
            { val: 'light', label: 'ライトテーマ' },
            { val: 'dark', label: 'ダークテーマ' }
        ];

        for (const name in this.customThemes) {
            options.push({ val: name, label: name });
        }
        options.push({ val: 'custom', label: 'カスタム' });

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'custom-option' + (opt.val === activeMode ? ' active' : '');
            item.innerHTML = `
                <svg class="custom-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>${opt.label}</span>
            `;
            
            item.onclick = (e) => {
                e.stopPropagation();
                this.selectedThemeMode = opt.val;
                customSelectValue.textContent = opt.label;
                this.updateThemeUI();
                this.handleChange(); 
                customSelectDropdown.classList.remove('show');
            };

            customSelectDropdown.appendChild(item);
            
            if (opt.val === activeMode) {
                customSelectValue.textContent = opt.label;
            }
        });
    },

    updateThemeUI: function() {
        const mode = this.selectedThemeMode;
        const isCustom = mode === 'custom';
        const isSavedTheme = !isCustom && mode !== 'light' && mode !== 'dark';

        const backgroundColor = document.getElementById('backgroundColor');
        const subBackgroundColor = document.getElementById('subBackgroundColor');
        const textColor = document.getElementById('textColor');
        const btnSaveOriginalTheme = document.getElementById('btnSaveOriginalTheme');
        const btnDeleteOriginalTheme = document.getElementById('btnDeleteOriginalTheme');

        backgroundColor.disabled = !isCustom;
        subBackgroundColor.disabled = !isCustom;
        textColor.disabled = !isCustom;

        btnSaveOriginalTheme.style.display = isCustom ? 'block' : 'none';
        btnDeleteOriginalTheme.style.display = isSavedTheme ? 'block' : 'none';

        if (mode === 'light' || mode === 'dark') {
            const preset = this.THEME_PRESETS[mode];
            backgroundColor.value = preset.bg;
            subBackgroundColor.value = preset.subBg;
            textColor.value = preset.text;
        } else if (isSavedTheme) {
            const theme = this.customThemes[mode];
            backgroundColor.value = theme.bg;
            subBackgroundColor.value = theme.subBg;
            textColor.value = theme.text;
        } else {
            backgroundColor.value = this.currentSettings.background_color;
            subBackgroundColor.value = this.currentSettings.sub_background_color;
            textColor.value = this.currentSettings.text_color;
        }

        const options = document.querySelectorAll('#themeSelectDropdown .custom-option');
        options.forEach(opt => {
            const val = (opt.textContent.trim() === 'ライトテーマ') ? 'light' : 
                        (opt.textContent.trim() === 'ダークテーマ') ? 'dark' : 
                        (opt.textContent.trim() === 'カスタム') ? 'custom' : opt.textContent.trim();
            if (val === mode) opt.classList.add('active');
            else opt.classList.remove('active');
        });
    },

    renderCombinedTagList: function(availableTags) {
        const container = document.getElementById('combinedTagsList');
        if (!container) return;
        container.innerHTML = '';
        availableTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-item';
            const isDbChecked = this.currentSettings.active_tags.includes(tag.key) ? 'checked' : '';
            const isPlayerChecked = this.currentSettings.player_visible_tags.includes(tag.key) ? 'checked' : '';

            li.innerHTML = `
                <div class="handle disabled">${tag.label}</div>
                <div class="check-container"><label class="toggle-switch"><input type="checkbox" class="chk-db" value="${tag.key}" ${isDbChecked}><span class="slider"></span></label></div>
                <div class="check-container"><label class="toggle-switch"><input type="checkbox" class="chk-player" value="${tag.key}" ${isPlayerChecked}><span class="slider"></span></label></div>
            `;
            container.appendChild(li);
        });
        
        container.querySelectorAll('input').forEach(chk => {
            chk.addEventListener('change', () => this.handleChange());
        });
    },

    initArtworkRestore: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const artPreview = document.getElementById('defaultArtPreview');
        const artInput = document.getElementById('artInput');
        const btnRestoreArt = document.getElementById('btnRestoreArt');

        const b64Data = await invoke("get_default_art_url");
        artPreview.src = b64Data || 'icon/Chordia.png';

        artInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const b64 = event.target.result;
                artPreview.src = b64;
                await invoke("update_default_artwork", { b64Data: b64 });
                this.showToast("初期画像を更新しました");
            };
            reader.readAsDataURL(file);
        });

        btnRestoreArt.addEventListener('click', async () => {
            const success = await invoke("reset_default_artwork");
            if (success) {
                const url = await invoke("get_default_art_url");
                artPreview.src = url || 'icon/Chordia.png';
                this.showToast("初期画像に戻しました");
            }
        });
    },

    handleInput: function() {
        if (!this.isInitialized) return;
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveAllSettings(false), 150);
    },

    handleChange: function() {
        if (!this.isInitialized) return;
        this.saveAllSettings(true);
    },

    saveAllSettings: async function(showNotify = true) {
        if (!this.isInitialized) return;

        const active_tags = Array.from(document.querySelectorAll('.chk-db:checked')).map(cb => cb.value);
        const player_visible_tags = Array.from(document.querySelectorAll('.chk-player:checked')).map(cb => cb.value);

        const newSettings = {
            items_per_page: parseInt(document.getElementById('itemsPerPage').value) || 50,
            open_player_new_window: document.getElementById('openPlayerNewWindow').checked,
            open_manage_new_window: document.getElementById('openManageNewWindow').checked,
            open_extensions_new_window: document.getElementById('openExtensionsNewWindow').checked,
            open_add_music_new_window: document.getElementById('openAddMusicNewWindow').checked,
            open_settings_new_window: document.getElementById('openSettingsNewWindow').checked,
            normalize_volume: document.getElementById('normalizeVolume').checked,
            lazy_load_playlists: false, 
            primary_color: document.getElementById('primaryColor').value,
            theme_mode: this.selectedThemeMode,
            background_color: document.getElementById('backgroundColor').value,
            sub_background_color: document.getElementById('subBackgroundColor').value,
            text_color: document.getElementById('textColor').value,
            language: this.selectedLanguage,
            active_tags: active_tags,
            player_visible_tags: player_visible_tags
        };

        this.currentSettings = newSettings;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const success = await invoke("save_app_settings", { settings: newSettings });
        if (success) {
            const root = document.documentElement;
            root.style.setProperty('--primary-color', newSettings.primary_color);
            root.style.setProperty('--bg-color', newSettings.background_color);
            root.style.setProperty('--card-bg', newSettings.sub_background_color);
            root.style.setProperty('--text-main', newSettings.text_color);
            root.style.setProperty('--text-sub', this.hexToRgba(newSettings.text_color, 0.6));
            
            localStorage.setItem('theme_primary_color', newSettings.primary_color);
            localStorage.setItem('theme_bg_color', newSettings.background_color);
            localStorage.setItem('theme_sub_bg_color', newSettings.sub_background_color);
            localStorage.setItem('theme_text_color', newSettings.text_color);

            if (window.i18n) {
                await window.i18n.init(this.selectedLanguage);
                this.rebuildThemeOptions(this.selectedThemeMode);
                this.updateThemeUI();
                const availableTags = await invoke("get_available_tags");
                this.renderCombinedTagList(availableTags);
            }

            if (showNotify) this.showToast("設定を保存しました");
        } else {
            if (showNotify) this.showToast("保存に失敗しました", true);
        }
    },

    showToast: function(msg, isErr = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        toast.textContent = msg;
        toast.className = 'toast ' + (isErr ? 'error' : 'success');
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
};
