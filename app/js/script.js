document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    const btnAddMusic = document.getElementById('btnAddMusic');
    const btnManage = document.getElementById('btnManage');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const btnPlayer = document.getElementById('btnPlayer');
    const btnMobileSync = document.getElementById('btnMobileSync');
    const btnSettings = document.getElementById('btnSettings');
    const btnInfo = document.getElementById('btnInfo');
    const btnExtensions = document.getElementById('btnExtensions'); 

    if (btnAddMusic) btnAddMusic.addEventListener('click', () => window.location.href = 'add_music.html');

    if (btnManage) {
        btnManage.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_manage_new_window) {
                await invoke("open_new_window", {
                    label: "manage_window", 
                    // ★ 修正：現在のURLをベースにした絶対URLとして組み立てる
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

    if (btnExport) btnExport.addEventListener('click', () => window.location.href = 'export.html');
    if (btnImport) btnImport.addEventListener('click', () => window.location.href = 'import.html');

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

    if (btnSettings) btnSettings.addEventListener('click', () => window.location.href = 'settings.html');
    if (btnInfo) btnInfo.addEventListener('click', () => window.location.href = 'info.html');

    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        let targetBtn = null;
        switch(e.key.toUpperCase()) {
            case '1': case 'A': targetBtn = btnAddMusic; break;
            case '2': case 'D': targetBtn = btnManage; break;
            case '3': case 'X': targetBtn = btnExport; break;
            case '4': case 'M': targetBtn = btnImport; break;
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