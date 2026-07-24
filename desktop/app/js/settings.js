document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    const artPreview = document.getElementById('defaultArtPreview');
    const artInput = document.getElementById('artInput');
    const btnRestoreArt = document.getElementById('btnRestoreArt');
    const chkNewWindow = document.getElementById('openPlayerNewWindow');
    const chkManageNewWindow = document.getElementById('openManageNewWindow');
    
    const chkNormalizeVolume = document.getElementById('normalizeVolume');
    const ffmpegWarningText = document.getElementById('ffmpegWarningText');

    const itemsPerPage = document.getElementById('itemsPerPage');
    const primaryColor = document.getElementById('primaryColor');

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

    const ffmpegWarningModal = document.getElementById('ffmpegWarningModal');
    const btnConfirmFfmpeg = document.getElementById('btnConfirmFfmpeg');
    const btnCancelFfmpeg = document.getElementById('btnCancelFfmpeg');

    const THEME_PRESETS = {
        light: { bg: '#f3f4f6', subBg: '#ffffff', text: '#1f2937' },
        dark: { bg: '#111827', subBg: '#1f2937', text: '#f9fafb' }
    };

    let customThemes = {};
    let currentSettings = {};
    let selectedThemeMode = 'light'; 

    function hexToRgba(hex, alpha) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const settings = await invoke("get_app_settings");
    currentSettings = settings;
    selectedThemeMode = settings.theme_mode || 'light';
    const availableTags = await invoke("get_available_tags");
    customThemes = await invoke("get_custom_themes");

    itemsPerPage.value = settings.items_per_page;
    chkNewWindow.checked = settings.open_player_new_window;
    chkManageNewWindow.checked = settings.open_manage_new_window;
    chkNormalizeVolume.checked = settings.normalize_volume;
    primaryColor.value = settings.primary_color;

    const checkFfmpegStatus = async () => {
        const status = await invoke("check_tools_status");
        const hasFfmpeg = status['ffmpeg'];
        if (chkNormalizeVolume.checked && !hasFfmpeg) {
            ffmpegWarningText.style.display = 'block';
        } else {
            ffmpegWarningText.style.display = 'none';
        }
        return hasFfmpeg;
    };
    checkFfmpegStatus();

    customSelectTrigger.onclick = (e) => {
        e.stopPropagation();
        customSelectDropdown.classList.toggle('show');
    };

    document.addEventListener('click', () => {
        customSelectDropdown.classList.remove('show');
    });

    function rebuildThemeOptions(activeMode) {
        customSelectDropdown.innerHTML = '';
        
        const options = [
            { val: 'light', label: 'ライトテーマ' },
            { val: 'dark', label: 'ダークテーマ' }
        ];

        for (const name in customThemes) {
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
            const val = opt.textContent.trim() === 'ライトテーマ' ? 'light' : 
                        opt.textContent.trim() === 'ダークテーマ' ? 'dark' : 
                        opt.textContent.trim() === 'カスタム' ? 'custom' : opt.textContent.trim();
            if (val === mode) opt.classList.add('active');
            else opt.classList.remove('active');
        });
    }

    updateThemeUI();

    let saveTimeout = null;

    async function saveAllSettings(showNotify = false) {
        const active_tags = Array.from(document.querySelectorAll('.chk-db:checked')).map(cb => cb.value);
        const player_visible_tags = Array.from(document.querySelectorAll('.chk-player:checked')).map(cb => cb.value);

        const newSettings = {
            items_per_page: parseInt(itemsPerPage.value) || 50,
            open_player_new_window: chkNewWindow.checked,
            open_manage_new_window: chkManageNewWindow.checked,
            normalize_volume: chkNormalizeVolume.checked,
            lazy_load_playlists: false, 
            primary_color: primaryColor.value,
            theme_mode: selectedThemeMode,
            background_color: backgroundColor.value,
            sub_background_color: subBackgroundColor.value,
            text_color: textColor.value,
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

            if (showNotify) showToast("設定を保存しました");
            checkFfmpegStatus();
        } else {
            if (showNotify) showToast("保存に失敗しました", true);
        }
    }

    function handleInput() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => saveAllSettings(false), 100);
    }

    function handleChange() {
        saveAllSettings(true);
    }

    chkNormalizeVolume.addEventListener('click', async (e) => {
        if (chkNormalizeVolume.checked) {
            e.preventDefault();
            const hasFfmpeg = await checkFfmpegStatus();
            if (!hasFfmpeg) {
                ffmpegWarningModal.style.display = 'flex';
            } else {
                chkNormalizeVolume.checked = true;
                handleChange();
                launchLufsCalcWindow();
            }
        } else {
            handleChange();
        }
    });

    btnConfirmFfmpeg.addEventListener('click', () => {
        chkNormalizeVolume.checked = true;
        ffmpegWarningModal.style.display = 'none';
        handleChange();
        showToast("一定音量機能を有効にしました（FFmpeg導入後に機能します）");
        launchLufsCalcWindow();
    });

    btnCancelFfmpeg.addEventListener('click', () => {
        chkNormalizeVolume.checked = false;
        ffmpegWarningModal.style.display = 'none';
    });

    async function launchLufsCalcWindow() {
        try {
            await invoke("open_new_window", {
                label: "lufs_calc_window",
                url: new URL("lufs_calc.html", window.location.href).href,
                title: "音量解析の実行 - Chordia",
                width: 600.0,
                height: 400.0
            });
        } catch (err) {
            console.error(err);
        }
    }

    [itemsPerPage, chkNewWindow, chkManageNewWindow, primaryColor, backgroundColor, subBackgroundColor, textColor].forEach(el => {
        if (el) {
            el.addEventListener('change', handleChange);
            if (el.type === 'color' || el.type === 'number') {
                el.addEventListener('input', handleInput);
            }
        }
    });

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
            showToast(`テーマ "${name}" を保存しました`);
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
                showToast(`テーマ "${name}" を削除しました`);
            }
        }
    });

    function renderCombinedTagList() {
        const container = document.getElementById('combinedTagsList');
        container.innerHTML = '';
        availableTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-item';
            const isDbChecked = currentSettings.active_tags.includes(tag.key) ? 'checked' : '';
            const isPlayerChecked = currentSettings.player_visible_tags.includes(tag.key) ? 'checked' : '';
            li.innerHTML = `
                <div class="handle disabled">${tag.label}</div>
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
            showToast("初期画像を更新しました");
        };
        reader.readAsDataURL(file);
    });

    btnRestoreArt.addEventListener('click', async () => {
        const success = await invoke("reset_default_artwork");
        if (success) {
            const url = await invoke("get_default_art_url");
            artPreview.src = url || 'icon/Chordia.png';
            showToast("初期画像に戻しました");
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