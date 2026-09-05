document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.HeaderController) window.HeaderController.init();
        if (window.SidebarController) window.SidebarController.init();
        if (window.MainViewController) window.MainViewController.init();
        if (window.PlayerController) window.PlayerController.init();
        if (window.ModalSongSelect) window.ModalSongSelect.init();

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const settings = await invoke("get_app_settings");
        
        if (settings && settings.open_player_new_window) {
            const backLink = document.querySelector('.back-link');
            if (backLink) {
                backLink.style.display = 'none';
            }
        }
        
        if (window.SidebarController) {
            await window.SidebarController.loadPlaylists();
        }

        // ★ エクスプローラーやFinder等で直接編集した後にウィンドウにフォーカスが戻った場合、自動でライブラリと画面を再同期
        window.addEventListener('focus', async () => {
            try {
                if (window.SidebarController) {
                    await window.SidebarController.loadPlaylists();
                }
            } catch (e) {
                console.error("Player refresh error on focus:", e);
            }
        });

    } catch (e) {
        console.error("Initialization Error:", e);
    }
});