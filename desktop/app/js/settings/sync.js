window.SettingsSync = {
    syncPollingTimer: null,

    init: async function() {
        const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : null;

        if (listen) {
            listen("sync_history_progress", (event) => {
                const data = event.payload;
                const syncHistoryProgressBar = document.getElementById('syncHistoryProgressBar');
                const syncHistoryProgressText = document.getElementById('syncHistoryProgressText');
                if (data && syncHistoryProgressBar && syncHistoryProgressText) {
                    const percent = Math.floor((data.current / data.total) * 100);
                    syncHistoryProgressBar.style.width = `${percent}%`;
                    syncHistoryProgressText.textContent = `${data.current} / ${data.total} 曲 (${percent}%)`;
                }
            });
        }

        this.setupEventListeners();
        await this.initCloudSyncStatus();
    },

    setupEventListeners: function() {
        const btnStartSyncAuth = document.getElementById('btnStartSyncAuth');
        const btnCancelSyncForm = document.getElementById('btnCancelSyncForm');
        const btnSubmitSyncWeb = document.getElementById('btnSubmitSyncWeb');
        const btnCopyAuthCode = document.getElementById('btnCopyAuthCode');
        const btnResetSyncAuth = document.getElementById('btnResetSyncAuth');
        const btnLogoutCloud = document.getElementById('btnLogoutCloud');
        const btnCancelLogoutModal = document.getElementById('btnCancelLogoutModal');
        const btnExecLogoutModal = document.getElementById('btnExecLogoutModal');
        const syncUsername = document.getElementById('syncUsername');
        const syncDeviceName = document.getElementById('syncDeviceName');
        const logoutConfirmModal = document.getElementById('logoutConfirmModal');

        if (btnStartSyncAuth) {
            btnStartSyncAuth.addEventListener('click', () => {
                document.getElementById('syncInitArea').style.display = 'none';
                document.getElementById('syncFormArea').style.display = 'block';
                document.getElementById('syncCodeArea').style.display = 'none';
                this.checkSyncInputs();
                syncUsername.focus();
            });
        }

        if (btnCancelSyncForm) {
            btnCancelSyncForm.addEventListener('click', () => {
                document.getElementById('syncFormArea').style.display = 'none';
                document.getElementById('syncInitArea').style.display = 'block';
                syncUsername.value = '';
                syncDeviceName.value = '';
            });
        }

        if (syncUsername && syncDeviceName) {
            syncUsername.addEventListener('input', () => this.checkSyncInputs());
            syncDeviceName.addEventListener('input', () => this.checkSyncInputs());
        }

        if (btnSubmitSyncWeb) {
            btnSubmitSyncWeb.addEventListener('click', async () => {
                const uVal = syncUsername.value.trim();
                const dVal = syncDeviceName.value.trim();
                if (!uVal || !dVal) return;

                const originalText = btnSubmitSyncWeb.textContent;
                btnSubmitSyncWeb.disabled = true;
                btnSubmitSyncWeb.textContent = "コード登録中...";

                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    const generatedCode = await invoke("register_auth_code_to_cloud", {
                        username: uVal,
                        device: dVal
                    });

                    document.getElementById('generatedAuthCodeDisplay').textContent = generatedCode;
                    document.getElementById('syncFormArea').style.display = 'none';
                    document.getElementById('syncCodeArea').style.display = 'block';
                    window.SettingsGeneral.showToast("認証コードを発行しました！");

                    this.startPolling(uVal, dVal);
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
                const code = document.getElementById('generatedAuthCodeDisplay').textContent.trim();
                if (code) {
                    navigator.clipboard.writeText(code).then(() => {
                        window.SettingsGeneral.showToast("認証コードをコピーしました！");
                    }).catch(() => {
                        window.SettingsGeneral.showToast("コピーに失敗しました", true);
                    });
                }
            });
        }

        if (btnResetSyncAuth) {
            btnResetSyncAuth.addEventListener('click', () => {
                this.stopPolling();
                document.getElementById('syncCodeArea').style.display = 'none';
                document.getElementById('syncInitArea').style.display = 'block';
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

                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    await invoke("logout_cloud_auth");
                    this.showLoggedOutView();
                    window.SettingsGeneral.showToast("ログアウトしました");
                } catch(e) {
                    console.error("Logout failed:", e);
                    alert("ログアウト処理中にエラーが発生しました:\n" + e);
                } finally {
                    btnExecLogoutModal.disabled = false;
                    btnExecLogoutModal.textContent = originalText;
                }
            });
        }
    },

    checkSyncInputs: function() {
        const syncUsername = document.getElementById('syncUsername');
        const syncDeviceName = document.getElementById('syncDeviceName');
        const btnSubmitSyncWeb = document.getElementById('btnSubmitSyncWeb');
        const uVal = syncUsername ? syncUsername.value.trim() : "";
        const dVal = syncDeviceName ? syncDeviceName.value.trim() : "";
        if (btnSubmitSyncWeb) {
            btnSubmitSyncWeb.disabled = (uVal === "" || dVal === "");
        }
    },

    initCloudSyncStatus: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        try {
            const authInfo = await invoke("get_cloud_auth_info");
            if (authInfo && authInfo.logged_in) {
                this.showLoggedInView(authInfo.username, authInfo.device);
            } else {
                this.showLoggedOutView();
            }
        } catch(e) {
            console.error("Failed to fetch cloud auth info:", e);
            this.showLoggedOutView();
        }
    },

    showLoggedOutView: function() {
        this.stopPolling();
        const syncHistoryProgressOverlay = document.getElementById('syncHistoryProgressOverlay');
        if (syncHistoryProgressOverlay) syncHistoryProgressOverlay.style.display = 'none';
        document.getElementById('syncLoggedInArea').style.display = 'none';
        document.getElementById('syncFormArea').style.display = 'none';
        document.getElementById('syncCodeArea').style.display = 'none';
        document.getElementById('syncInitArea').style.display = 'block';
    },

    showLoggedInView: function(username, device) {
        this.stopPolling();
        const syncHistoryProgressOverlay = document.getElementById('syncHistoryProgressOverlay');
        if (syncHistoryProgressOverlay) syncHistoryProgressOverlay.style.display = 'none';
        document.getElementById('syncInitArea').style.display = 'none';
        document.getElementById('syncFormArea').style.display = 'none';
        document.getElementById('syncCodeArea').style.display = 'none';
        document.getElementById('syncLoggedInArea').style.display = 'block';

        document.getElementById('loggedInUsernameDisplay').textContent = username || 'User';
        document.getElementById('loggedInDeviceDisplay').textContent = device || 'Desktop';
    },

    stopPolling: function() {
        if (this.syncPollingTimer) {
            clearInterval(this.syncPollingTimer);
            this.syncPollingTimer = null;
        }
    },

    startPolling: function(uVal, dVal) {
        this.stopPolling();
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        this.syncPollingTimer = setInterval(async () => {
            try {
                const status = await invoke("check_cloud_login_status", {
                    username: uVal,
                    device: dVal
                });

                if (status === "authenticated") {
                    this.stopPolling();
                    document.getElementById('syncCodeArea').style.display = 'none';
                    await this.executeInitialHistorySync(uVal, dVal);
                } else if (status === "expired") {
                    this.stopPolling();
                    alert("認証コードの有効期限が切れました。再度認証コードを発行してください。");
                    this.showLoggedOutView();
                }
            } catch(e) {
                console.warn("Polling status check:", e);
            }
        }, 2000);
    },

    executeInitialHistorySync: async function(uVal, dVal) {
        const syncHistoryProgressOverlay = document.getElementById('syncHistoryProgressOverlay');
        const syncHistoryProgressBar = document.getElementById('syncHistoryProgressBar');
        const syncHistoryProgressText = document.getElementById('syncHistoryProgressText');

        if (syncHistoryProgressOverlay) {
            syncHistoryProgressBar.style.width = '0%';
            syncHistoryProgressText.textContent = "準備中...";
            syncHistoryProgressOverlay.style.display = 'flex';
        }

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        try {
            await invoke("sync_all_local_history_to_cloud");
            this.showLoggedInView(uVal, dVal);
            window.SettingsGeneral.showToast("Chordia Sync の認証と履歴の同期が完了しました！");
        } catch(err) {
            console.error("Initial history sync failed:", err);
            this.showLoggedInView(uVal, dVal);
            window.SettingsGeneral.showToast("同期処理の一部でエラーが発生しましたが、ログインは完了しました", true);
        } finally {
            if (syncHistoryProgressOverlay) {
                syncHistoryProgressOverlay.style.display = 'none';
            }
        }
    }
};
