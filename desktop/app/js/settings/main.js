document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

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

    // バージョン情報表示
    const appVersionContainer = document.getElementById("infoAppVersion");
    if (appVersionContainer) {
        try {
            const appVersion = await invoke("get_app_version");
            appVersionContainer.textContent = appVersion;
        } catch(e) {
            appVersionContainer.textContent = "v5.0.0";
        }
    }

    // ナビゲーションタブ切り替え
    const navButtons = document.querySelectorAll('.settings-nav-btn');
    const sections = document.querySelectorAll('.settings-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            
            navButtons.forEach(b => {
                if (b.dataset.target === targetId) b.classList.add('active');
                else b.classList.remove('active');
            });

            sections.forEach(sec => {
                if (sec.id === targetId) sec.classList.add('active');
                else sec.classList.remove('active');
            });

            if (targetId === 'sec-music-stats') window.SettingsStats.loadPlayStatistics();
            if (targetId === 'sec-work-stats') window.SettingsStats.loadWorkStatistics();
        });
    });

    // 各コントローラーの初期化
    await window.SettingsGeneral.init();
    await window.SettingsSync.init();

    window.addEventListener('beforeunload', () => {
        if (window.SettingsSync) window.SettingsSync.stopPolling();
    });

    window.addEventListener('focus', () => {
        const activeSec = document.querySelector('.settings-section.active');
        if (activeSec && activeSec.id === 'sec-music-stats') window.SettingsStats.loadPlayStatistics();
        if (activeSec && activeSec.id === 'sec-work-stats') window.SettingsStats.loadWorkStatistics();
    });
});
