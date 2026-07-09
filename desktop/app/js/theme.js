(async function() {
    try {
        // Tauriのinvokeを取得
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        
        // Rustから設定を取得
        const settings = await invoke("get_app_settings");
        const root = document.documentElement;

        // --- グローバルUI保護設定 ---
        // デベロッパーモードが無効な場合のみ制限をかける
        if (!settings.developer_mode) {
            // 全画面での右クリックメニューをブロック
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            }, false);

            // F12キー（デベロッパーツール）をブロック
            document.addEventListener('keydown', (e) => {
                if (e.key === 'F12' || e.keyCode === 123) {
                    e.preventDefault();
                    return false;
                }
            }, false);
        }

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