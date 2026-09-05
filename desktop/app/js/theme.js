(async function() {
    try {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : null;

        // トースト通知ヘルパー
        function showGlobalToast(msg, isError = true) {
            let toast = document.getElementById('toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.className = 'toast show ' + (isError ? 'error' : 'success');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3500);
        }

        // 認証失効イベントの監視
        if (listen) {
            listen("cloud_auth_expired", () => {
                showGlobalToast("Chordia Sync の認証に失敗しました", true);
            });
        }

        // ★ 全画面で利用できる Chordia Sync ログイン状態確認関数
        window.checkChordiaSyncSession = async function(force = false) {
            if (!window.__TAURI__) return;
            const now = Date.now();
            // 連続クリック等による過剰通信を防止（10秒スロットル。force=trueなら即時実行）
            if (!force && window._lastSyncSessionCheckTime && (now - window._lastSyncSessionCheckTime < 10000)) {
                return;
            }
            window._lastSyncSessionCheckTime = now;

            try {
                const authInfo = await invoke("get_cloud_auth_info");
                if (authInfo && authInfo.logged_in) {
                    const isValid = await invoke("verify_current_cloud_session");
                    if (!isValid) {
                        showGlobalToast("Chordia Sync の認証に失敗しました", true);
                        if (typeof window.onChordiaSyncExpired === 'function') {
                            window.onChordiaSyncExpired();
                        }
                    }
                }
            } catch (e) {
                console.warn("Chordia Sync session check error:", e);
            }
        };

        // 全画面で画面初期表示時およびフォーカス復帰時にセッション状態をチェック
        window.checkChordiaSyncSession();
        window.addEventListener('focus', () => {
            window.checkChordiaSyncSession();
        });
        
        const settings = await invoke("get_app_settings");
        const root = document.documentElement;

        function adjustColorBrightness(hex, amount) {
            let usePound = false;
            if (hex[0] == "#") { hex = hex.slice(1); usePound = true; }
            let num = parseInt(hex, 16);
            let r = (num >> 16) + amount; if (r > 255) r = 255; else if (r < 0) r = 0;
            let b = ((num >> 8) & 0x00FF) + amount; if (b > 255) b = 255; else if (b < 0) b = 0;
            let g = (num & 0x0000FF) + amount; if (g > 255) g = 255; else if (g < 0) g = 0;
            return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
        }

        function hexToRgba(hex, alpha) {
            let h = hex.replace('#', '');
            if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
            let r = parseInt(h.substring(0, 2), 16);
            let g = parseInt(h.substring(2, 4), 16);
            let b = parseInt(h.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        if (settings.primary_color) {
            const primary = settings.primary_color;
            root.style.setProperty('--primary-color', primary);
            const dark = adjustColorBrightness(primary, -20);
            root.style.setProperty('--primary-color-dark', dark);
            localStorage.setItem('theme_primary_color', primary);
        }

        if (settings.background_color) {
            root.style.setProperty('--bg-color', settings.background_color);
            localStorage.setItem('theme_bg_color', settings.background_color);
        }
        
        if (settings.sub_background_color) {
            root.style.setProperty('--card-bg', settings.sub_background_color);
            localStorage.setItem('theme_sub_bg_color', settings.sub_background_color);
        }

        if (settings.text_color) {
            root.style.setProperty('--text-main', settings.text_color);
            root.style.setProperty('--text-sub', hexToRgba(settings.text_color, 0.6));
            localStorage.setItem('theme_text_color', settings.text_color);
        }

    } catch (e) {
        console.error("Theme sync failed", e);
    }
})();