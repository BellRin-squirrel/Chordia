document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    try {
        const isHealthy = await invoke("check_language_packs_status");
        if (isHealthy === false) {
            showToast(window.i18n ? window.i18n.t('Messages.lang_pack_corrupted') : "一部の言語パックを正しく読み込めませんでした。", true);
        }
    } catch(e) {
        console.error("Language health check error:", e);
    }

    const btnAddMusic = document.getElementById('btnAddMusic');
    const btnManage = document.getElementById('btnManage');
    const btnMigration = document.getElementById('btnMigration'); 
    const btnPlayer = document.getElementById('btnPlayer');
    const btnMobileSync = document.getElementById('btnMobileSync');
    const btnExtensions = document.getElementById('btnExtensions'); 
    const btnIntegrity = document.getElementById('btnIntegrity');
    const btnWork = document.getElementById('btnWork');
    const btnInfo = document.getElementById('btnInfo');

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

    if (btnWork) {
        btnWork.addEventListener('click', async () => {
            try {
                await invoke("open_new_window", {
                    label: "work_window", 
                    url: new URL("work.html", window.location.href).href,
                    title: "Chordia Focus",
                    width: 1020.0,
                    height: 720.0
                });
            } catch(e) {
                console.error("Failed to open work window:", e);
                window.location.href = 'work.html';
            }
        });
    }

    if (btnInfo) {
        btnInfo.addEventListener('click', async () => {
            const settings = await invoke("get_app_settings");
            if (settings.open_settings_new_window) {
                await invoke("open_new_window", {
                    label: "settings_window", 
                    url: new URL("settings.html", window.location.href).href,
                    title: "情報・設定 - Chordia",
                    width: 1050.0,
                    height: 800.0
                });
            } else {
                window.location.href = 'settings.html';
            }
        });
    }

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
            case '8': case 'W': targetBtn = btnWork; break;
            case '9': case 'I': case 'S': targetBtn = btnInfo; break;
        }

        if (targetBtn) {
            e.preventDefault();       
            e.stopPropagation();      
            if (document.activeElement) document.activeElement.blur(); 
            targetBtn.click();
        }
    });

    let toastTimeout = null;

    function showToast(message, isError = false) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }

        if (toastTimeout) {
            clearTimeout(toastTimeout);
        }

        toast.textContent = message;
        toast.className = 'toast ' + (isError ? 'error' : 'success');
        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // ========================================================
    // ★ Chordia Relay (トップ画面右上 雲アイコン & ポーリング)
    // ========================================================
    const btnRelay = document.getElementById('btnRelay');
    const relayBadge = document.getElementById('relayBadge');
    const relayModal = document.getElementById('relayModal');
    const btnCloseRelayModalX = document.getElementById('btnCloseRelayModalX');
    const relayListContainer = document.getElementById('relayListContainer');

    let relayDevices = [];
    let relayPollingTimer = null;

    const escapeHtml = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

    // モーダルを閉じる処理
    const closeRelayModal = () => {
        if (relayModal) {
            relayModal.classList.remove('show');
            setTimeout(() => {
                if (!relayModal.classList.contains('show')) {
                    relayModal.style.display = 'none';
                }
            }, 200);
        }
    };

    if (btnCloseRelayModalX) {
        btnCloseRelayModalX.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeRelayModal();
        });
    }

    if (relayModal) {
        relayModal.addEventListener('click', (e) => {
            if (e.target === relayModal) {
                closeRelayModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && relayModal && relayModal.classList.contains('show')) {
            closeRelayModal();
        }
    });

    // デバイス一覧を描画する関数
    function renderRelayDevices() {
        if (!relayListContainer) return;
        relayListContainer.innerHTML = '';

        if (!Array.isArray(relayDevices) || relayDevices.length === 0) {
            relayListContainer.innerHTML = `
                <div class="relay-empty-msg">
                    現在、再生を引き継げるデバイスはありません。<br>
                    他のデバイスで楽曲を再生するとここに表示されます。
                </div>
            `;
            return;
        }

        relayDevices.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'relay-device-card';
            card.dataset.index = index;

            const now = item.nowPlaying || {};
            const plId = now.playlistID || "";
            const plName = now.playlistName || "Untitled";

            let typeLabel = "プレイリスト";
            let typeClass = "";
            if (plId === "album") {
                typeLabel = "アルバム";
                typeClass = "album";
            } else if (plId === "artist") {
                typeLabel = "アーティスト";
                typeClass = "artist";
            }

            const title = now.nowPlayingTitle || "楽曲未再生";
            const artist = now.nowPlayingArtist || "";
            const songSubtitle = artist ? `${title} - ${artist}` : title;

            card.innerHTML = `
                <div class="relay-card-top">
                    <span class="relay-device-name">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Z"/>
                            <path d="M12 6a1 1 0 0 0-1 1v5.586l-2.707-2.707a1 1 0 0 0-1.414 1.414l4.414 4.414a1 1 0 0 0 1.414 0l4.414-4.414a1 1 0 0 0-1.414-1.414L13 12.586V7a1 1 0 0 0-1-1Z"/>
                        </svg>
                        ${escapeHtml(item.name || "不明なデバイス")}
                    </span>
                    <span class="relay-type-badge ${typeClass}">${escapeHtml(typeLabel)}</span>
                </div>
                <div class="relay-card-body">
                    <div class="relay-playlist-name">${escapeHtml(plName)}</div>
                    <div class="relay-song-info">${escapeHtml(songSubtitle)}</div>
                </div>
            `;

            card.onclick = () => {
                console.log("[Chordia Relay] Selected device for handover:", item);
            };

            relayListContainer.appendChild(card);
        });
    }

    // ポーリング処理
    async function pollRelayDevices() {
        try {
            const authInfo = await invoke("get_cloud_auth_info");
            const isLoggedIn = (authInfo && authInfo.logged_in);

            if (!isLoggedIn) {
                if (relayBadge) relayBadge.style.display = 'none';
                return;
            }

            const devices = await invoke("fetch_relay_devices_from_cloud");
            if (Array.isArray(devices)) {
                relayDevices = devices;
                if (relayBadge) {
                    relayBadge.style.display = (devices.length > 0) ? 'block' : 'none';
                }
                if (relayModal && relayModal.classList.contains('show')) {
                    renderRelayDevices();
                }
            }
        } catch (e) {
            console.warn("[Chordia Relay] Polling error:", e);
        }
    }

    if (btnRelay) {
        btnRelay.addEventListener('click', async () => {
            const authInfo = await invoke("get_cloud_auth_info");
            const isLoggedIn = (authInfo && authInfo.logged_in);

            if (!isLoggedIn) {
                showToast("Chordia Sync にログインしていません。設定画面からログインしてください。", true);
                return;
            }

            await pollRelayDevices();
            renderRelayDevices();
            if (relayModal) {
                relayModal.style.display = 'flex';
                requestAnimationFrame(() => relayModal.classList.add('show'));
            }
        });
    }

    await pollRelayDevices();
    relayPollingTimer = setInterval(pollRelayDevices, 5000);

    window.addEventListener('focus', () => {
        pollRelayDevices();
    });

    window.addEventListener('beforeunload', () => {
        if (relayPollingTimer) clearInterval(relayPollingTimer);
    });
});