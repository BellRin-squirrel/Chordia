document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    let isInitialized = false;

    try {
        const isWindowMode = window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow().label === 'settings_window';
        const settings = await invoke("get_app_settings");
        if (isWindowMode || (settings && settings.open_settings_new_window)) {
            const backArea = document.querySelector('.header-left');
            if (backArea) backArea.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
    }

    const navButtons = document.querySelectorAll('.settings-nav-btn');
    const sections = document.querySelectorAll('.settings-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            
            navButtons.forEach(b => {
                if (b.dataset.target === targetId) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            sections.forEach(sec => {
                if (sec.id === targetId) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });
        });
    });

    const artPreview = document.getElementById('defaultArtPreview');
    const artInput = document.getElementById('artInput');
    const btnRestoreArt = document.getElementById('btnRestoreArt');
    
    const chkNewWindow = document.getElementById('openPlayerNewWindow');
    const chkManageNewWindow = document.getElementById('openManageNewWindow');
    const chkExtensionsNewWindow = document.getElementById('openExtensionsNewWindow');
    const chkAddMusicNewWindow = document.getElementById('openAddMusicNewWindow');
    const chkSettingsNewWindow = document.getElementById('openSettingsNewWindow');
    
    const chkNormalizeVolume = document.getElementById('normalizeVolume');

    const itemsPerPage = document.getElementById('itemsPerPage');
    const primaryColor = document.getElementById('primaryColor');

    const langSelectTrigger = document.getElementById('langSelectTrigger');
    const langSelectDropdown = document.getElementById('langSelectDropdown');
    const langSelectValue = document.getElementById('langSelectValue');

    const customSelectTrigger = document.getElementById('themeSelectTrigger');
    const customSelectDropdown = document.getElementById('themeSelectDropdown');
    const customSelectValue = document.getElementById('themeSelectValue');

    const backgroundColor = document.getElementById('backgroundColor');
    const subBackgroundColor = document.getElementById('subBackgroundColor');
    const textColor = document.getElementById('textColor');
    const btnSaveOriginalTheme = document.getElementById('btnSaveOriginalTheme');
    const btnDeleteOriginalTheme = document.getElementById('btnDeleteOriginalTheme');

    const themeModal = document.getElementById('themeModal');
    const newThemeName = document.getElementById('newThemeName');
    const btnConfirmTheme = document.getElementById('btnConfirmTheme');
    const btnCancelTheme = document.getElementById('btnCancelTheme');

    const THEME_PRESETS = {
        light: { bg: '#f3f4f6', subBg: '#ffffff', text: '#1f2937' },
        dark: { bg: '#111827', subBg: '#1f2937', text: '#f9fafb' }
    };

    let customThemes = {};
    let currentSettings = {};
    let selectedThemeMode = 'light'; 
    let selectedLanguage = 'Japanese.ini';

    function hexToRgba(hex, alpha) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    let saveTimeout = null;

    async function saveAllSettings(showNotify = true) {
        if (!isInitialized) return;

        const active_tags = Array.from(document.querySelectorAll('.chk-db:checked')).map(cb => cb.value);
        const player_visible_tags = Array.from(document.querySelectorAll('.chk-player:checked')).map(cb => cb.value);

        const newSettings = {
            items_per_page: parseInt(itemsPerPage.value) || 50,
            open_player_new_window: chkNewWindow ? chkNewWindow.checked : false,
            open_manage_new_window: chkManageNewWindow ? chkManageNewWindow.checked : false,
            open_extensions_new_window: chkExtensionsNewWindow ? chkExtensionsNewWindow.checked : false,
            open_add_music_new_window: chkAddMusicNewWindow ? chkAddMusicNewWindow.checked : false,
            open_settings_new_window: chkSettingsNewWindow ? chkSettingsNewWindow.checked : false,
            normalize_volume: chkNormalizeVolume ? chkNormalizeVolume.checked : false,
            lazy_load_playlists: false, 
            primary_color: primaryColor.value,
            theme_mode: selectedThemeMode,
            background_color: backgroundColor.value,
            sub_background_color: subBackgroundColor.value,
            text_color: textColor.value,
            language: selectedLanguage,
            active_tags: active_tags,
            player_visible_tags: player_visible_tags
        };

        currentSettings = newSettings;
        const success = await invoke("save_app_settings", { settings: newSettings });
        if (success) {
            const root = document.documentElement;
            root.style.setProperty('--primary-color', newSettings.primary_color);
            root.style.setProperty('--bg-color', newSettings.background_color);
            root.style.setProperty('--card-bg', newSettings.sub_background_color);
            root.style.setProperty('--text-main', newSettings.text_color);
            root.style.setProperty('--text-sub', hexToRgba(newSettings.text_color, 0.6));
            
            localStorage.setItem('theme_primary_color', newSettings.primary_color);
            localStorage.setItem('theme_bg_color', newSettings.background_color);
            localStorage.setItem('theme_sub_bg_color', newSettings.sub_background_color);
            localStorage.setItem('theme_text_color', newSettings.text_color);

            if (window.i18n) {
                await window.i18n.init(selectedLanguage);
                rebuildThemeOptions(selectedThemeMode);
                updateThemeUI();
                renderCombinedTagList(); // ★ 言語変更時にタグ名一覧も即時翻訳・再読み込み
            }

            if (showNotify) showToast(window.i18n ? window.i18n.t("Messages.saved") : "設定を保存しました");
        } else {
            if (showNotify) showToast(window.i18n ? window.i18n.t("Messages.save_failed") : "保存に失敗しました", true);
        }
    }

    function handleInput() {
        if (!isInitialized) return;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveAllSettings(false), 150);
    }

    function handleChange() {
        if (!isInitialized) return;
        saveAllSettings(true);
    }

    const settings = await invoke("get_app_settings");
    currentSettings = settings;
    selectedThemeMode = settings.theme_mode || 'light';
    selectedLanguage = settings.language || 'Japanese.ini';

    const availableTags = await invoke("get_available_tags");
    customThemes = await invoke("get_custom_themes");

    itemsPerPage.value = settings.items_per_page;
    if (chkNewWindow) chkNewWindow.checked = settings.open_player_new_window;
    if (chkManageNewWindow) chkManageNewWindow.checked = settings.open_manage_new_window;
    if (chkExtensionsNewWindow) chkExtensionsNewWindow.checked = settings.open_extensions_new_window;
    if (chkAddMusicNewWindow) chkAddMusicNewWindow.checked = settings.open_add_music_new_window;
    if (chkSettingsNewWindow) chkSettingsNewWindow.checked = settings.open_settings_new_window;
    if (chkNormalizeVolume) chkNormalizeVolume.checked = settings.normalize_volume;
    primaryColor.value = settings.primary_color;

    if (langSelectTrigger && langSelectDropdown) {
        langSelectTrigger.onclick = (e) => {
            e.stopPropagation();
            langSelectDropdown.classList.toggle('show');
            if (customSelectDropdown) customSelectDropdown.classList.remove('show');
        };

        const availableLangs = await invoke("get_available_languages");
        langSelectDropdown.innerHTML = '';

        availableLangs.forEach(lang => {
            const item = document.createElement('div');
            const isActive = (lang.file === selectedLanguage);
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
                selectedLanguage = lang.file;
                langSelectValue.textContent = lang.name;
                
                langSelectDropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                item.classList.add('active');
                
                handleChange();
                langSelectDropdown.classList.remove('show');
            };

            langSelectDropdown.appendChild(item);
        });
    }

    customSelectTrigger.onclick = (e) => {
        e.stopPropagation();
        customSelectDropdown.classList.toggle('show');
        if (langSelectDropdown) langSelectDropdown.classList.remove('show');
    };

    document.addEventListener('click', () => {
        if (customSelectDropdown) customSelectDropdown.classList.remove('show');
        if (langSelectDropdown) langSelectDropdown.classList.remove('show');
    });

    function rebuildThemeOptions(activeMode) {
        customSelectDropdown.innerHTML = '';
        
        const labelLight = window.i18n ? window.i18n.t('Settings.theme_light') : 'ライトテーマ';
        const labelDark = window.i18n ? window.i18n.t('Settings.theme_dark') : 'ダークテーマ';
        const labelCustom = window.i18n ? window.i18n.t('Settings.theme_custom') : 'カスタム';

        const options = [
            { val: 'light', label: labelLight },
            { val: 'dark', label: labelDark }
        ];

        for (const name in customThemes) {
            options.push({ val: name, label: name });
        }
        options.push({ val: 'custom', label: labelCustom });

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
                selectedThemeMode = opt.val;
                customSelectValue.textContent = opt.label;
                updateThemeUI();
                handleChange(); 
                customSelectDropdown.classList.remove('show');
            };

            customSelectDropdown.appendChild(item);
            
            if (opt.val === activeMode) {
                customSelectValue.textContent = opt.label;
            }
        });
    }

    rebuildThemeOptions(selectedThemeMode);

    function updateThemeUI() {
        const mode = selectedThemeMode;
        const isCustom = mode === 'custom';
        const isSavedTheme = !isCustom && mode !== 'light' && mode !== 'dark';

        backgroundColor.disabled = !isCustom;
        subBackgroundColor.disabled = !isCustom;
        textColor.disabled = !isCustom;

        btnSaveOriginalTheme.style.display = isCustom ? 'block' : 'none';
        btnDeleteOriginalTheme.style.display = isSavedTheme ? 'block' : 'none';

        if (mode === 'light' || mode === 'dark') {
            const preset = THEME_PRESETS[mode];
            backgroundColor.value = preset.bg;
            subBackgroundColor.value = preset.subBg;
            textColor.value = preset.text;
        } else if (isSavedTheme) {
            const theme = customThemes[mode];
            backgroundColor.value = theme.bg;
            subBackgroundColor.value = theme.subBg;
            textColor.value = theme.text;
        } else {
            backgroundColor.value = currentSettings.background_color;
            subBackgroundColor.value = currentSettings.sub_background_color;
            textColor.value = currentSettings.text_color;
        }

        const options = customSelectDropdown.querySelectorAll('.custom-option');
        options.forEach(opt => {
            const val = (opt.textContent.trim() === 'ライトテーマ' || opt.textContent.trim() === 'Light Theme') ? 'light' : 
                        (opt.textContent.trim() === 'ダークテーマ' || opt.textContent.trim() === 'Dark Theme') ? 'dark' : 
                        (opt.textContent.trim() === 'カスタム' || opt.textContent.trim() === 'Custom') ? 'custom' : opt.textContent.trim();
            if (val === mode) opt.classList.add('active');
            else opt.classList.remove('active');
        });
    }

    updateThemeUI();

    // ★ 修正: 多言語辞書から動的に表示言語のタグ名を取得してレンダリング
    function renderCombinedTagList() {
        const container = document.getElementById('combinedTagsList');
        if (!container) return;
        container.innerHTML = '';
        availableTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-item';
            const isDbChecked = currentSettings.active_tags.includes(tag.key) ? 'checked' : '';
            const isPlayerChecked = currentSettings.player_visible_tags.includes(tag.key) ? 'checked' : '';

            // i18n 辞書から動的に現在の言語のタグ名を取得 (フォールバック: tag.label)
            const labelText = (window.i18n && window.i18n.t) ? window.i18n.t(`Tags.${tag.key}`) : tag.label;

            li.innerHTML = `
                <div class="handle disabled">${labelText}</div>
                <div class="check-container"><label class="toggle-switch"><input type="checkbox" class="chk-db" value="${tag.key}" ${isDbChecked}><span class="slider"></span></label></div>
                <div class="check-container"><label class="toggle-switch"><input type="checkbox" class="chk-player" value="${tag.key}" ${isPlayerChecked}><span class="slider"></span></label></div>
            `;
            container.appendChild(li);
        });
        
        container.querySelectorAll('input').forEach(chk => {
            chk.addEventListener('change', handleChange);
        });
    }
    renderCombinedTagList();

    isInitialized = true;

    const allInputs = [
        itemsPerPage, chkNewWindow, chkManageNewWindow, chkExtensionsNewWindow, 
        chkAddMusicNewWindow, chkSettingsNewWindow,
        primaryColor, backgroundColor, subBackgroundColor, textColor
    ];

    allInputs.forEach(el => {
        if (el) {
            el.addEventListener('change', handleChange);
            if (el.type === 'color' || el.type === 'number') {
                el.addEventListener('input', handleInput);
            }
        }
    });

    if (chkNormalizeVolume) {
        chkNormalizeVolume.addEventListener('click', async (e) => {
            if (chkNormalizeVolume.checked) {
                e.preventDefault(); 
                
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
                } catch(e) {
                    alert("測定ステータスの確認に失敗しました。");
                    chkNormalizeVolume.checked = false;
                    return;
                }

                chkNormalizeVolume.checked = true;
                handleChange();
                showToast(window.i18n ? window.i18n.t("Messages.saved") : "一定音量機能を有効にしました");
            } else {
                handleChange();
            }
        });
    }

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

        const colors = { bg: backgroundColor.value, subBg: subBackgroundColor.value, text: textColor.value };
        const success = await invoke("save_custom_theme", { name: name, colors: colors });
        if (success) {
            customThemes[name] = colors;
            themeModal.style.display = 'none';
            selectedThemeMode = name;
            rebuildThemeOptions(name);
            saveAllSettings(false);
            showToast(window.i18n ? window.i18n.t("Messages.theme_saved", { name: name }) : `テーマ "${name}" を保存しました`);
        }
    });

    btnDeleteOriginalTheme.addEventListener('click', async () => {
        const name = selectedThemeMode;
        if (confirm(`テーマ "${name}" を削除してもよろしいですか？`)) {
            const success = await invoke("delete_custom_theme", { name: name });
            if (success) {
                delete customThemes[name];
                selectedThemeMode = 'custom';
                rebuildThemeOptions('custom');
                updateThemeUI();
                saveAllSettings(false);
                showToast(window.i18n ? window.i18n.t("Messages.theme_deleted", { name: name }) : `テーマ "${name}" を削除しました`);
            }
        }
    });

    const b64Data = await invoke("get_default_art_url");
    if (b64Data) {
        artPreview.src = b64Data;
    } else {
        artPreview.src = 'icon/Chordia.png'; 
    }

    artInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const b64 = event.target.result;
            artPreview.src = b64;
            await invoke("update_default_artwork", { b64Data: b64 });
            showToast(window.i18n ? window.i18n.t("Messages.art_updated") : "初期画像を更新しました");
        };
        reader.readAsDataURL(file);
    });

    btnRestoreArt.addEventListener('click', async () => {
        const success = await invoke("reset_default_artwork");
        if (success) {
            const url = await invoke("get_default_art_url");
            artPreview.src = url || 'icon/Chordia.png';
            showToast(window.i18n ? window.i18n.t("Messages.art_restored") : "初期画像に戻しました");
        }
    });
});

function showToast(msg, isErr = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    if (isErr) toast.style.backgroundColor = "#ef4444"; else toast.style.backgroundColor = "#10b981";
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}