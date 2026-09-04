window.WorkMain = {
    init: function() {
        this.setupWindowControls();
        this.setupNavigation();

        if (window.WorkPicker) window.WorkPicker.init();
        if (window.WorkConfig) window.WorkConfig.init();
        if (window.WorkFocus) window.WorkFocus.init();

        const btnStartFocus = document.getElementById('btnStartFocus');
        if (btnStartFocus) {
            btnStartFocus.addEventListener('click', () => {
                if (window.WorkFocus) window.WorkFocus.start();
            });
        }
    },

    setupWindowControls: function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        
        // ★ Mac環境の場合はシステム標準の枠が付くため、自前のタイトルバーは非表示にする
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.includes('Mac');
        if (isMac) {
            const titlebar = document.getElementById('windowTitlebar');
            if (titlebar) {
                titlebar.style.display = 'none';
            }
        }

        const btnWinClose = document.getElementById('btnWinClose');
        const btnSwitchMode = document.getElementById('btnSwitchMode');

        if (btnWinClose) {
            btnWinClose.onclick = async () => {
                try {
                    await invoke('close_work_window');
                } catch(e) {
                    window.close();
                }
            };
        }

        if (btnSwitchMode) {
            btnSwitchMode.onclick = async () => {
                try {
                    await invoke('toggle_maximize_work_window');
                } catch(e) {
                    console.error("Maximize error:", e);
                }
            };
        }
    },

    setupNavigation: function() {
        const btnReconfigure = document.getElementById('btnReconfigure');
        if (btnReconfigure) {
            btnReconfigure.addEventListener('click', () => this.showConfigView());
        }

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.includes('Mac');
        const osFocusGuideText = document.getElementById('osFocusGuideText');
        const osFocusSupportLink = document.getElementById('osFocusSupportLink');

        let supportUrl = isMac
            ? "https://support.apple.com/ja-jp/102551"
            : "https://support.microsoft.com/en-us/windows/experience/notifications-and-do-not-disturb-in-windows";

        if (osFocusGuideText) {
            osFocusGuideText.textContent = isMac
                ? "設定から集中モードを有効にしましょう。"
                : "タスクバーの時計をクリックして、応答不可モードを有効にします。";
        }

        if (osFocusSupportLink) {
            osFocusSupportLink.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await invoke("open_url", { url: supportUrl });
                } catch(err) {
                    window.open(supportUrl, '_blank');
                }
            });
        }
    },

    showReadyView: function() {
        document.getElementById('workConfigView').style.display = 'none';
        document.getElementById('workReadyView').style.display = 'block';
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = "準備完了";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showConfigView: function() {
        document.getElementById('workReadyView').style.display = 'none';
        document.getElementById('workFocusView').style.display = 'none';
        document.getElementById('configContainer').style.display = 'block';
        document.body.className = 'mode-config';
        document.getElementById('workConfigView').style.display = 'block';

        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) pageTitle.textContent = "作業設定";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast: function(msg, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        if (this._toastTimer) clearTimeout(this._toastTimer);

        toast.textContent = msg;
        toast.className = 'toast ' + (isError ? 'error' : 'success') + ' show';
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.WorkMain.init();
});