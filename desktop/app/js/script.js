document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    const btnAddMusic = document.getElementById('btnAddMusic');
    const btnManage = document.getElementById('btnManage');
    const btnMigration = document.getElementById('btnMigration'); 
    const btnPlayer = document.getElementById('btnPlayer');
    const btnMobileSync = document.getElementById('btnMobileSync');
    const btnSettings = document.getElementById('btnSettings');
    const btnInfo = document.getElementById('btnInfo');
    const btnExtensions = document.getElementById('btnExtensions'); 
    const btnIntegrity = document.getElementById('btnIntegrity');

    if (btnAddMusic) {
        btnAddMusic.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_add_music_new_window) {
                await invoke("open_new_window", {
                    label: "add_music_window", 
                    url: new URL("add_music.html", window.location.href).href,
                    title: "曲を追加 - Chordia",
                    width: 1200.0,
                    height: 850.0
                });
            } else {
                window.location.href = 'add_music.html';
            }
        });
    }

    if (btnManage) {
        btnManage.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_manage_new_window) {
                await invoke("open_new_window", {
                    label: "manage_window", 
                    url: new URL("manage.html", window.location.href).href,
                    title: "データベース管理 - Chordia",
                    width: 1200.0,
                    height: 900.0
                });
            } else {
                window.location.href = 'manage.html';
            }
        });
    }

    if (btnMigration) btnMigration.addEventListener('click', () => window.location.href = 'migration.html');

    if (btnPlayer) {
        btnPlayer.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_player_new_window) {
                await invoke("open_new_window", {
                    label: "player_window",
                    url: new URL("player.html", window.location.href).href,
                    title: "音楽を再生 - Chordia",
                    width: 1200.0,
                    height: 900.0
                });
            } else {
                window.location.href = 'player.html';
            }
        });
    }

    if (btnMobileSync) {
        let isSyncOpening = false; 
        btnMobileSync.addEventListener('click', async () => {
            if (isSyncOpening) return;
            isSyncOpening = true;
            btnMobileSync.disabled = true; 
            
            try {
                await invoke("open_new_window", {
                    label: "sync_window", 
                    url: new URL("api.html", window.location.href).href,
                    title: "モバイル同期 - Chordia",
                    width: 1000.0,
                    height: 650.0
                });
            } catch(e) {
                console.error(e);
            } finally {
                setTimeout(() => {
                    isSyncOpening = false;
                    btnMobileSync.disabled = false;
                }, 1000);
            }
        });
    }

    if (btnExtensions) {
        btnExtensions.removeAttribute('onclick');
        btnExtensions.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_extensions_new_window) {
                await invoke("open_new_window", {
                    label: "extensions_window", 
                    url: new URL("extensions.html", window.location.href).href,
                    title: "拡張機能 - Chordia",
                    width: 850.0,
                    height: 700.0
                });
            } else {
                window.location.href = 'extensions.html';
            }
        });
    }

    if (btnIntegrity) {
        btnIntegrity.addEventListener('click', () => window.location.href = 'integrity.html');
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_settings_new_window) {
                await invoke("open_new_window", {
                    label: "settings_window", 
                    url: new URL("settings.html", window.location.href).href,
                    title: "設定 - Chordia",
                    width: 1000.0,
                    height: 750.0
                });
            } else {
                window.location.href = 'settings.html';
            }
        });
    }

    if (btnInfo) btnInfo.addEventListener('click', () => window.location.href = 'info.html');

    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        let targetBtn = null;
        switch(e.key.toUpperCase()) {
            case '1': case 'A': targetBtn = btnAddMusic; break;
            case '2': case 'D': targetBtn = btnManage; break;
            case '3': case 'M': targetBtn = btnMigration; break; 
            case '4': case 'V': targetBtn = btnIntegrity; break;
            case '5': case 'P': targetBtn = btnPlayer; break;
            case '6': case 'C': targetBtn = btnMobileSync; break;
            case '7': case 'E': targetBtn = btnExtensions; break;
            case '8': case 'S': targetBtn = btnSettings; break;
            case '9': case 'I': targetBtn = btnInfo; break;
        }

        if (targetBtn) {
            e.preventDefault();       
            e.stopPropagation();      
            if (document.activeElement) document.activeElement.blur(); 
            targetBtn.click();
        }
    });
});