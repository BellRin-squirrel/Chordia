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

        // ★ Chordia Relay 引き継ぎデータの確認・実行ハンドラ
        const checkAndRunRelayHandover = () => {
            const raw = localStorage.getItem('chordia_relay_handover');
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    // 60秒以内の有効データか確認
                    if (data && data.timestamp && (Date.now() - data.timestamp < 60000)) {
                        localStorage.removeItem('chordia_relay_handover');
                        if (window.PlayerController && typeof window.PlayerController.handleRelayHandover === 'function') {
                            window.PlayerController.handleRelayHandover(data);
                        }
                    } else {
                        localStorage.removeItem('chordia_relay_handover');
                    }
                } catch(e) {
                    localStorage.removeItem('chordia_relay_handover');
                }
            }
        };

        // 初期表示時の引き継ぎ実行
        checkAndRunRelayHandover();

        // 既存の再生ウィンドウが開いている場合（他画面からのstorageイベント）
        window.addEventListener('storage', (e) => {
            if (e.key === 'chordia_relay_handover' && e.newValue) {
                checkAndRunRelayHandover();
            }
        });

        // ウィンドウフォーカス復帰時の処理
        window.addEventListener('focus', async () => {
            try {
                if (window.SidebarController) {
                    await window.SidebarController.loadPlaylists();
                }
                checkAndRunRelayHandover();
            } catch (e) {
                console.error("Player refresh error on focus:", e);
            }
        });

    } catch (e) {
        console.error("Initialization Error:", e);
    }
});