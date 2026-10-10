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

            listen("sync_work_history_progress", (event) => {
                const data = event.payload;
                const syncHistoryProgressBar = document.getElementById('syncHistoryProgressBar');
                const syncHistoryProgressText = document.getElementById('syncHistoryProgressText');
                const titleEl = document.getElementById('syncHistoryProgressTitle');
                if (titleEl) titleEl.textContent = "クラウドへ作業履歴を同期中...";
                if (data && syncHistoryProgressBar && syncHistoryProgressText) {
                    const percent = Math.floor((data.current / data.total) * 100);
                    syncHistoryProgressBar.style.width = `${percent}%`;
                    syncHistoryProgressText.textContent = `${data.current} / ${data.total} 件 (${percent}%)`;
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
        const btnResyncCloud = document.getElementById('btnResyncCloud');
        const btnLogoutCloud = document.getElementById('btnLogoutCloud');
        const btnCancelLogoutModal = document.getElementById('btnCancelLogoutModal');
        const btnExecLogoutModal = document.getElementById('btnExecLogoutModal');
        const syncUsername = document.getElementById('syncUsername');
        const syncDeviceName = document.getElementById('syncDeviceName');
        const logoutConfirmModal = document.getElementById('logoutConfirmModal');
        const linkOpenSyncWeb = document.getElementById('linkOpenSyncWeb');

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

        if (syncUsername) {
            syncUsername.addEventListener('input', () => this.checkSyncInputs());
            syncUsername.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (syncDeviceName) syncDeviceName.focus();
                }
            });
        }

        if (syncDeviceName) {
            syncDeviceName.addEventListener('input', () => this.checkSyncInputs());
            syncDeviceName.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (btnSubmitSyncWeb && !btnSubmitSyncWeb.disabled) {
                        btnSubmitSyncWeb.click();
                    }
                }
            });
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

        // ★ 既定のWebブラウザで直接承認画面を開くリンク処理
        if (linkOpenSyncWeb) {
            linkOpenSyncWeb.addEventListener('click', async (e) => {
                e.preventDefault();
                const code = document.getElementById('generatedAuthCodeDisplay').textContent.trim();
                if (code && code !== '--------') {
                    const targetUrl = `https://chordia.bellrin.f5.si/mypage/accept.app.login.php?anthenticationCode=${encodeURIComponent(code)}`;
                    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                    try {
                        await invoke("open_url", { url: targetUrl });
                    } catch(err) {
                        console.error("Failed to open URL via backend:", err);
                        window.open(targetUrl, '_blank');
                    }
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

        if (btnResyncCloud) {
            btnResyncCloud.addEventListener('click', async () => {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                try {
                    const authInfo = await invoke("get_cloud_auth_info");
                    const u = authInfo ? authInfo.username : "";
                    const d = authInfo ? authInfo.device : "";
                    await this.executeInitialHistorySync(u, d);
                } catch(e) {
                    console.error("Resync failed:", e);
                }
            });
        }

        if (btnLogoutCloud && logoutConfirmModal) {
            btnLogoutCloud.addEventListener('click', () => {
                logoutConfirmModal.style.display = 'flex';
                setTimeout(() => logoutConfirmModal.classList.add('show'), 10);
            });
        }

        if (btnCancelLogoutModal && logoutConfirmModal) {
            btnCancelLogoutModal.addEventListener('click', () => {
                logoutConfirmModal.classList.remove('show');
                setTimeout(() => { logoutConfirmModal.style.display = 'none'; }, 200);
            });
        }

        if (logoutConfirmModal) {
            logoutConfirmModal.addEventListener('click', (e) => {
                if (e.target === logoutConfirmModal) {
                    logoutConfirmModal.classList.remove('show');
                    setTimeout(() => { logoutConfirmModal.style.display = 'none'; }, 200);
                }
            });
        }

        if (btnExecLogoutModal && logoutConfirmModal) {
            btnExecLogoutModal.addEventListener('click', async () => {
                logoutConfirmModal.classList.remove('show');
                setTimeout(() => { logoutConfirmModal.style.display = 'none'; }, 200);

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
                const isValid = await invoke("verify_current_cloud_session");
                if (isValid) {
                    this.showLoggedInView(authInfo.username, authInfo.device);
                } else {
                    this.showLoggedOutView();
                    window.SettingsGeneral.showToast("Chordia Sync の認証に失敗しました", true);
                }
            } else {
                this.showLoggedOutView();
            }
        } catch(e) {
            console.error("Failed to verify cloud auth info:", e);
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
        const titleEl = document.getElementById('syncHistoryProgressTitle');

        if (syncHistoryProgressOverlay) {
            if (titleEl) titleEl.textContent = "クラウドへ再生履歴を同期中...";
            syncHistoryProgressBar.style.width = '0%';
            syncHistoryProgressText.textContent = "準備中...";
            syncHistoryProgressOverlay.style.display = 'flex';
        }

        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        try {
            // 1. 再生履歴の同期
            await invoke("sync_all_local_history_to_cloud");

            // 2. 作業履歴の同期
            if (titleEl) titleEl.textContent = "クラウドへ作業履歴を同期中...";
            if (syncHistoryProgressBar) syncHistoryProgressBar.style.width = '0%';
            if (syncHistoryProgressText) syncHistoryProgressText.textContent = "準備中...";
            await invoke("sync_all_local_work_history_to_cloud");

            // 3. 曲一覧の送信 (registerMusicList)
            if (titleEl) titleEl.textContent = "クラウドへ曲一覧を送信中...";
            if (syncHistoryProgressBar) syncHistoryProgressBar.style.width = '50%';
            if (syncHistoryProgressText) syncHistoryProgressText.textContent = "ライブラリデータを送信中...";
            await invoke("sync_all_local_music_list_to_cloud");

            // 4. プレイリスト一覧の送信
            if (titleEl) titleEl.textContent = "クラウドへプレイリスト一覧を送信中...";
            if (syncHistoryProgressBar) syncHistoryProgressBar.style.width = '80%';
            if (syncHistoryProgressText) syncHistoryProgressText.textContent = "プレイリストを送信中...";
            try {
                await invoke("sync_all_local_playlists_to_cloud");
            } catch(plErr) {
                console.warn("Playlist cloud sync skipped:", plErr);
            }

            this.showLoggedInView(uVal, dVal);
            window.SettingsGeneral.showToast("Chordia Sync へのデータ送信が完了しました！");
            
            if (window.SettingsStats) {
                const activeSec = document.querySelector('.settings-section.active');
                if (activeSec && activeSec.id === 'sec-music-stats') window.SettingsStats.loadPlayStatistics();
                if (activeSec && activeSec.id === 'sec-work-stats') window.SettingsStats.loadWorkStatistics();
            }
        } catch(err) {
            console.error("Initial history sync failed:", err);
            this.showLoggedInView(uVal, dVal);
            window.SettingsGeneral.showToast("同期処理の一部でエラーが発生しましたが、処理は完了しました", true);
        } finally {
            if (syncHistoryProgressOverlay) {
                syncHistoryProgressOverlay.style.display = 'none';
            }
        }
    }
};
