document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : null;

    let isInitialized = false;
    let syncPollingTimer = null;

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

            // 統計タブが開かれたら自動取得
            if (targetId === 'sec-music-stats') loadPlayStatistics();
            if (targetId === 'sec-work-stats') loadWorkStatistics();
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

    // Chordia Sync 要素
    const syncInitArea = document.getElementById('syncInitArea');
    const syncFormArea = document.getElementById('syncFormArea');
    const syncCodeArea = document.getElementById('syncCodeArea');
    const syncLoggedInArea = document.getElementById('syncLoggedInArea');

    const btnStartSyncAuth = document.getElementById('btnStartSyncAuth');
    const btnCancelSyncForm = document.getElementById('btnCancelSyncForm');
    const btnSubmitSyncWeb = document.getElementById('btnSubmitSyncWeb');
    const syncUsername = document.getElementById('syncUsername');
    const syncDeviceName = document.getElementById('syncDeviceName');
    const generatedAuthCodeDisplay = document.getElementById('generatedAuthCodeDisplay');
    const btnCopyAuthCode = document.getElementById('btnCopyAuthCode');
    const btnResetSyncAuth = document.getElementById('btnResetSyncAuth');

    const loggedInUsernameDisplay = document.getElementById('loggedInUsernameDisplay');
    const loggedInDeviceDisplay = document.getElementById('loggedInDeviceDisplay');
    const btnLogoutCloud = document.getElementById('btnLogoutCloud');

    // ログアウト確認モーダル要素
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    const btnCancelLogoutModal = document.getElementById('btnCancelLogoutModal');
    const btnExecLogoutModal = document.getElementById('btnExecLogoutModal');

    // 既存履歴同期オーバーレイ要素
    const syncHistoryProgressOverlay = document.getElementById('syncHistoryProgressOverlay');
    const syncHistoryProgressBar = document.getElementById('syncHistoryProgressBar');
    const syncHistoryProgressText = document.getElementById('syncHistoryProgressText');

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
                renderCombinedTagList();
            }

            if (showNotify) showToast("設定を保存しました");
        } else {
            if (showNotify) showToast("保存に失敗しました", true);
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
            const val = (opt.textContent.trim() === 'ライトテーマ') ? 'light' : 
                        (opt.textContent.trim() === 'ダークテーマ') ? 'dark' : 
                        (opt.textContent.trim() === 'カスタム') ? 'custom' : opt.textContent.trim();
            if (val === mode) opt.classList.add('active');
            else opt.classList.remove('active');
        });
    }

    updateThemeUI();

    function renderCombinedTagList() {
        const container = document.getElementById('combinedTagsList');
        if (!container) return;
        container.innerHTML = '';
        availableTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'tag-item';
            const isDbChecked = currentSettings.active_tags.includes(tag.key) ? 'checked' : '';
            const isPlayerChecked = currentSettings.player_visible_tags.includes(tag.key) ? 'checked' : '';

            const labelText = tag.label;

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

    // --- Chordia Sync 認証フロー制御 ---
    if (listen) {
        listen("sync_history_progress", (event) => {
            const data = event.payload;
            if (data && syncHistoryProgressBar && syncHistoryProgressText) {
                const percent = Math.floor((data.current / data.total) * 100);
                syncHistoryProgressBar.style.width = `${percent}%`;
                syncHistoryProgressText.textContent = `${data.current} / ${data.total} 曲 (${percent}%)`;
            }
        });
    }

    async function initCloudSyncStatus() {
        try {
            const authInfo = await invoke("get_cloud_auth_info");
            if (authInfo && authInfo.logged_in) {
                showLoggedInView(authInfo.username, authInfo.device);
            } else {
                showLoggedOutView();
            }
        } catch(e) {
            console.error("Failed to fetch cloud auth info:", e);
            showLoggedOutView();
        }
    }

    function showLoggedOutView() {
        stopPolling();
        if (syncHistoryProgressOverlay) syncHistoryProgressOverlay.style.display = 'none';
        syncLoggedInArea.style.display = 'none';
        syncFormArea.style.display = 'none';
        syncCodeArea.style.display = 'none';
        syncInitArea.style.display = 'block';
    }

    function showLoggedInView(username, device) {
        stopPolling();
        if (syncHistoryProgressOverlay) syncHistoryProgressOverlay.style.display = 'none';
        syncInitArea.style.display = 'none';
        syncFormArea.style.display = 'none';
        syncCodeArea.style.display = 'none';
        syncLoggedInArea.style.display = 'block';

        loggedInUsernameDisplay.textContent = username || 'User';
        loggedInDeviceDisplay.textContent = device || 'Desktop';
    }

    function stopPolling() {
        if (syncPollingTimer) {
            clearInterval(syncPollingTimer);
            syncPollingTimer = null;
        }
    }

    function startPolling(uVal, dVal) {
        stopPolling();
        syncPollingTimer = setInterval(async () => {
            try {
                const status = await invoke("check_cloud_login_status", {
                    username: uVal,
                    device: dVal
                });

                if (status === "authenticated") {
                    stopPolling();
                    syncCodeArea.style.display = 'none';
                    await executeInitialHistorySync(uVal, dVal);
                } else if (status === "expired") {
                    stopPolling();
                    alert("認証コードの有効期限が切れました。再度認証コードを発行してください。");
                    showLoggedOutView();
                }
            } catch(e) {
                console.warn("Polling status check:", e);
            }
        }, 2000);
    }

    async function executeInitialHistorySync(uVal, dVal) {
        if (syncHistoryProgressOverlay) {
            syncHistoryProgressBar.style.width = '0%';
            syncHistoryProgressText.textContent = "準備中...";
            syncHistoryProgressOverlay.style.display = 'flex';
        }

        try {
            await invoke("sync_all_local_history_to_cloud");
            showLoggedInView(uVal, dVal);
            showToast("Chordia Sync の認証と履歴の同期が完了しました！");
        } catch(err) {
            console.error("Initial history sync failed:", err);
            showLoggedInView(uVal, dVal);
            showToast("同期処理の一部でエラーが発生しましたが、ログインは完了しました", true);
        } finally {
            if (syncHistoryProgressOverlay) {
                syncHistoryProgressOverlay.style.display = 'none';
            }
        }
    }

    function checkSyncInputs() {
        const uVal = syncUsername.value.trim();
        const dVal = syncDeviceName.value.trim();
        btnSubmitSyncWeb.disabled = (uVal === "" || dVal === "");
    }

    if (btnStartSyncAuth) {
        btnStartSyncAuth.addEventListener('click', () => {
            syncInitArea.style.display = 'none';
            syncFormArea.style.display = 'block';
            syncCodeArea.style.display = 'none';
            checkSyncInputs();
            syncUsername.focus();
        });
    }

    if (btnCancelSyncForm) {
        btnCancelSyncForm.addEventListener('click', () => {
            syncFormArea.style.display = 'none';
            syncInitArea.style.display = 'block';
            syncUsername.value = '';
            syncDeviceName.value = '';
        });
    }

    if (syncUsername && syncDeviceName) {
        syncUsername.addEventListener('input', checkSyncInputs);
        syncDeviceName.addEventListener('input', checkSyncInputs);
    }

    if (btnSubmitSyncWeb) {
        btnSubmitSyncWeb.addEventListener('click', async () => {
            const uVal = syncUsername.value.trim();
            const dVal = syncDeviceName.value.trim();
            if (!uVal || !dVal) return;

            const originalText = btnSubmitSyncWeb.textContent;
            btnSubmitSyncWeb.disabled = true;
            btnSubmitSyncWeb.textContent = "コード登録中...";

            try {
                const generatedCode = await invoke("register_auth_code_to_cloud", {
                    username: uVal,
                    device: dVal
                });

                generatedAuthCodeDisplay.textContent = generatedCode;
                syncFormArea.style.display = 'none';
                syncCodeArea.style.display = 'block';
                showToast("認証コードを発行しました！");

                startPolling(uVal, dVal);
            } catch (err) {
                console.error("register_auth_code_to_cloud failed:", err);
                alert("認証コードの登録に失敗しました:\n" + err);
                btnSubmitSyncWeb.disabled = false;
                btnSubmitSyncWeb.textContent = originalText;
            }
        });
    }

    if (btnCopyAuthCode) {
        btnCopyAuthCode.addEventListener('click', () => {
            const code = generatedAuthCodeDisplay.textContent.trim();
            if (code) {
                navigator.clipboard.writeText(code).then(() => {
                    showToast("認証コードをコピーしました！");
                }).catch(() => {
                    showToast("コピーに失敗しました", true);
                });
            }
        });
    }

    if (btnResetSyncAuth) {
        btnResetSyncAuth.addEventListener('click', () => {
            stopPolling();
            syncCodeArea.style.display = 'none';
            syncInitArea.style.display = 'block';
            syncUsername.value = '';
            syncDeviceName.value = '';
            if (btnSubmitSyncWeb) {
                btnSubmitSyncWeb.disabled = true;
                btnSubmitSyncWeb.textContent = "ウェブで認証";
            }
        });
    }

    if (btnLogoutCloud && logoutConfirmModal) {
        btnLogoutCloud.addEventListener('click', () => {
            logoutConfirmModal.style.display = 'flex';
        });
    }

    if (btnCancelLogoutModal && logoutConfirmModal) {
        btnCancelLogoutModal.addEventListener('click', () => {
            logoutConfirmModal.style.display = 'none';
        });
    }

    if (btnExecLogoutModal && logoutConfirmModal) {
        btnExecLogoutModal.addEventListener('click', async () => {
            logoutConfirmModal.style.display = 'none';
            const originalText = btnExecLogoutModal.textContent;
            btnExecLogoutModal.disabled = true;
            btnExecLogoutModal.textContent = "ログアウト中...";

            try {
                await invoke("logout_cloud_auth");
                showLoggedOutView();
                showToast("ログアウトしました");
            } catch(e) {
                console.error("Logout failed:", e);
                alert("ログアウト処理中にエラーが発生しました:\n" + e);
            } finally {
                btnExecLogoutModal.disabled = false;
                btnExecLogoutModal.textContent = originalText;
            }
        });
    }

    // --- 統計・ライセンス関連 ---
    const appVersionContainer = document.getElementById("infoAppVersion");
    if (appVersionContainer) {
        try {
            const appVersion = await invoke("get_app_version");
            appVersionContainer.textContent = appVersion;
        } catch(e) {
            appVersionContainer.textContent = "v5.0.0";
        }
    }

    const escapeHtml = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

    const deviceMap = new Map();
    function getDeviceClass(deviceName) {
        if (!deviceName) return 'device0';
        if (!deviceMap.has(deviceName)) {
            const idx = (deviceMap.size % 9) + 1;
            deviceMap.set(deviceName, `device${idx}`);
        }
        return deviceMap.get(deviceName);
    }

    function parseDateTime(dateStr) {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('.')) {
            const p = dateStr.split('.').map(Number);
            if (p.length >= 5) {
                return new Date(p[0], p[1] - 1, p[2], p[3], p[4]);
            }
        }
        const dt = new Date(dateStr);
        return isNaN(dt.getTime()) ? new Date(0) : dt;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '--';
        if (dateStr.includes('.')) {
            const p = dateStr.split('.').map(Number);
            if (p.length >= 5) {
                const y = p[0];
                const m = String(p[1]).padStart(2, '0');
                const d = String(p[2]).padStart(2, '0');
                const h = String(p[3]).padStart(2, '0');
                const min = String(p[4]).padStart(2, '0');
                return `${y}/${m}/${d} ${h}:${min}`;
            }
        }
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const h = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');
            return `${y}/${m}/${d} ${h}:${min}`;
        }
        return dateStr;
    }

    async function loadPlayStatistics() {
        const syncBadge = document.getElementById('syncStatusBadgePlay');
        const rankingContainer = document.getElementById('topRankingContainer');
        const historyTbody = document.getElementById('playHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            const isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (isSyncLoggedIn) {
                if (syncBadge) {
                    syncBadge.textContent = "● Chordia Sync オンライン同期中";
                    syncBadge.className = "sync-indicator-badge cloud";
                }

                const cloudHistory = await invoke("fetch_cloud_play_history");
                renderCloudPlayStats(cloudHistory, rankingContainer, historyTbody);
            } else {
                if (syncBadge) {
                    syncBadge.textContent = "● ローカル再生履歴";
                    syncBadge.className = "sync-indicator-badge local";
                }

                const localStats = await invoke("get_local_play_statistics");
                renderLocalPlayStats(localStats, rankingContainer, historyTbody);
            }
        } catch(e) {
            console.error("Failed to load play statistics:", e);
            if (historyTbody) {
                historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${escapeHtml(e)}</td></tr>`;
            }
        }
    }

    function renderCloudPlayStats(history, rankingEl, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
            return;
        }

        const sortedHistory = [...history].sort((a, b) => {
            const dA = parseDateTime(a.date || a.timestamp);
            const dB = parseDateTime(b.date || b.timestamp);
            return dB - dA;
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const countMap = new Map();
        sortedHistory.forEach(item => {
            const itemDate = parseDateTime(item.date || item.timestamp);
            if (itemDate >= sevenDaysAgo) {
                const key = `${item.title || 'Unknown'}___${item.artist || 'Unknown'}`;
                const cur = countMap.get(key) || { title: item.title, artist: item.artist, count: 0 };
                cur.count += 1;
                countMap.set(key, cur);
            }
        });

        const rankingList = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

        if (rankingList.length > 0) {
            rankingEl.innerHTML = '';
            rankingList.forEach((r, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ranking-item';
                const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                itemDiv.innerHTML = `
                    <div class="rank-badge ${rankClass}">${idx + 1}</div>
                    <div class="rank-info">
                        <div class="rank-title">${escapeHtml(r.title)}</div>
                        <div class="rank-artist">${escapeHtml(r.artist)}</div>
                    </div>
                    <div class="rank-count">${r.count} 回</div>
                `;
                rankingEl.appendChild(itemDiv);
            });
        } else {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
        }

        tbody.innerHTML = '';
        sortedHistory.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = getDeviceClass(item.device);
            const dateStr = item.date || item.timestamp;
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong>${escapeHtml(item.title || 'Unknown')}</strong></td>
                <td>${escapeHtml(item.artist || 'Unknown')}</td>
                <td>${escapeHtml(item.album || '--')}</td>
                <td><span class="device-badge ${devClass}">${escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${formatDateTime(dateStr)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderLocalPlayStats(stats, rankingEl, tbody) {
        const ranking = stats.ranking || [];
        const history = stats.history || [];

        if (ranking.length > 0) {
            rankingEl.innerHTML = '';
            ranking.forEach((r, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ranking-item';
                const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                itemDiv.innerHTML = `
                    <div class="rank-badge ${rankClass}">${idx + 1}</div>
                    <div class="rank-info">
                        <div class="rank-title">${escapeHtml(r.title)}</div>
                        <div class="rank-artist">${escapeHtml(r.artist)}</div>
                    </div>
                    <div class="rank-count">${r.count} 回</div>
                `;
                rankingEl.appendChild(itemDiv);
            });
        } else {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">再生データがありません。</p>';
        }

        if (history.length > 0) {
            tbody.innerHTML = '';
            history.forEach((item, idx) => {
                const tr = document.createElement('tr');
                const dateStr = item.timestamp || item.date;
                tr.innerHTML = `
                    <td style="color:var(--text-sub);">${idx + 1}</td>
                    <td><strong>${escapeHtml(item.title || 'Unknown')}</strong></td>
                    <td>${escapeHtml(item.artist || 'Unknown')}</td>
                    <td>${escapeHtml(item.album || '--')}</td>
                    <td><span class="device-badge device1">Desktop (Local)</span></td>
                    <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${formatDateTime(dateStr)}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
        }
    }

    // --- 作業統計の読み込み（ローカル作業履歴の読み込みに対応） ---
    async function loadWorkStatistics() {
        const syncBadge = document.getElementById('syncStatusBadgeWork');
        const notConnectedArea = document.getElementById('workSyncNotConnected');
        const connectedArea = document.getElementById('workSyncConnectedArea');
        const tbody = document.getElementById('workHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            const isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (isSyncLoggedIn) {
                if (syncBadge) {
                    syncBadge.textContent = "● Chordia Sync オンライン同期中";
                    syncBadge.className = "sync-indicator-badge cloud";
                }
                if (notConnectedArea) notConnectedArea.style.display = 'none';
                if (connectedArea) connectedArea.style.display = 'block';

                const workHistory = await invoke("fetch_cloud_work_history");
                renderWorkHistory(workHistory, tbody);
            } else {
                // ★ 未接続時はローカルの userfiles/work_history.json を取得して表示
                const localWorkHistory = await invoke("get_local_work_history");
                if (Array.isArray(localWorkHistory) && localWorkHistory.length > 0) {
                    if (syncBadge) {
                        syncBadge.textContent = "● ローカル作業履歴";
                        syncBadge.className = "sync-indicator-badge local";
                    }
                    if (notConnectedArea) notConnectedArea.style.display = 'none';
                    if (connectedArea) connectedArea.style.display = 'block';
                    renderWorkHistory(localWorkHistory, tbody);
                } else {
                    if (syncBadge) {
                        syncBadge.textContent = "● 未接続";
                        syncBadge.className = "sync-indicator-badge";
                    }
                    if (notConnectedArea) notConnectedArea.style.display = 'block';
                    if (connectedArea) connectedArea.style.display = 'none';
                }
            }
        } catch(e) {
            console.error("Failed to load work statistics:", e);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${escapeHtml(e)}</td></tr>`;
            }
        }
    }

    function renderWorkHistory(history, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-sub); padding:24px;">作業セッション履歴がありません。</td></tr>';
            return;
        }

        const sorted = [...history].sort((a, b) => {
            const dA = parseDateTime(a.end);
            const dB = parseDateTime(b.end);
            return dB - dA;
        });

        tbody.innerHTML = '';
        sorted.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = getDeviceClass(item.device);
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong style="color:var(--primary-color); font-size:0.95rem;">${escapeHtml(item.time || '--')}</strong></td>
                <td><span class="device-badge ${devClass}">${escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${formatDateTime(item.end)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.addEventListener('beforeunload', () => {
        stopPolling();
    });

    await initCloudSyncStatus();

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
                showToast("設定を保存しました");
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

    let toastTimeout = null;

    function showToast(msg, isErr = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        toast.textContent = msg;
        toast.className = 'toast ' + (isErr ? 'error' : 'success');
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    window.addEventListener('focus', () => {
        const activeSec = document.querySelector('.settings-section.active');
        if (activeSec && activeSec.id === 'sec-music-stats') loadPlayStatistics();
        if (activeSec && activeSec.id === 'sec-work-stats') loadWorkStatistics();
    });
});
