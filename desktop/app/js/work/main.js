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
        // ★ マウスホバーで表示される緑ボタンによる最大化/元に戻す制御
        const btnSwitchMode = document.getElementById('btnSwitchMode');

        if (btnSwitchMode) {
            btnSwitchMode.onclick = async () => {
                if (window.__TAURI__ && window.__TAURI__.window) {
                    const win = window.__TAURI__.window.getCurrentWindow();
                    const isMax = await win.isMaximized();
                    const isFull = await win.isFullscreen();
                    if (isMax || isFull) {
                        await win.unmaximize();
                        await win.setFullscreen(false);
                    } else {
                        await win.maximize();
                    }
                }
            };
        }

        // ★ F11 / Esc キーによるウィンドウ最大化・解除のショートカット
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                if (window.__TAURI__ && window.__TAURI__.window) {
                    const win = window.__TAURI__.window.getCurrentWindow();
                    const isMax = await win.isMaximized();
                    const isFull = await win.isFullscreen();
                    if (isMax || isFull) {
                        await win.unmaximize();
                        await win.setFullscreen(false);
                    } else {
                        await win.maximize();
                    }
                }
            } else if (e.key === 'Escape') {
                if (window.__TAURI__ && window.__TAURI__.window) {
                    const win = window.__TAURI__.window.getCurrentWindow();
                    const isMax = await win.isMaximized();
                    const isFull = await win.isFullscreen();
                    if (isMax || isFull) {
                        await win.unmaximize();
                        await win.setFullscreen(false);
                    }
                }
            }
        });
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