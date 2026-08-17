document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : null;

    try {
        const isWindowMode = window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow().label === 'extensions_window';
        const settings = await invoke("get_app_settings");
        if (isWindowMode || (settings && settings.open_extensions_new_window)) {
            const backArea = document.querySelector('.header-left');
            if (backArea) backArea.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
    }

    const toolsList = document.getElementById('toolsList');
    const actionTitle = document.getElementById('actionTitle');
    const actionDesc = document.getElementById('actionDesc');
    const btnMainAction = document.getElementById('btnMainAction');
    const updateCard = document.getElementById('updateCard');
    const updateResultList = document.getElementById('updateResultList');
    const btnExecUpdate = document.getElementById('btnExecUpdate');
    const progressArea = document.getElementById('progressArea');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const alertModal = document.getElementById('alertModal');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');
    const btnAlertOk = document.getElementById('btnAlertOk');

    const lufsStatusText = document.getElementById('lufsStatusText');
    const lufsCountText = document.getElementById('lufsCountText');
    const btnStartLufsCalc = document.getElementById('btnStartLufsCalc');

    const lufsProgressContainer = document.getElementById('lufsProgressContainer');
    const lufsProgressMessage = document.getElementById('lufsProgressMessage');
    const lufsProgressCount = document.getElementById('lufsProgressCount');
    const lufsProgressBar = document.getElementById('lufsProgressBar');

    let isLufsCalculating = false;

    const getToolDesc = (tool) => {
        if (!window.i18n) return "";
        return window.i18n.t(`Extensions.tool_${tool.replace('-', '')}_desc`);
    };

    let pendingUpdates = [];

    function showAlert(title, message, isError = false) {
        if (!alertModal) return;
        alertTitle.textContent = title;
        alertTitle.style.color = isError ? '#ef4444' : 'var(--text-main)';
        alertMessage.innerText = message;
        
        alertModal.style.display = 'flex';
        setTimeout(() => alertModal.classList.add('show'), 10);

        if (btnAlertOk) {
            btnAlertOk.onclick = () => {
                alertModal.classList.remove('show');
                setTimeout(() => alertModal.style.display = 'none', 300);
            };
        }
    }

    if (listen) {
        listen('update_ext_download_progress', (event) => {
            const { toolName, downloaded, total } = event.payload;
            if (downloaded === "extracting") {
                progressText.textContent = window.i18n ? window.i18n.t('Extensions.msg_extracting', { tool: toolName }) : `${toolName} を解凍中...`;
                progressBar.style.width = '100%';
                return;
            }
            let percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
            progressText.textContent = window.i18n ? window.i18n.t('Extensions.msg_downloading', { tool: toolName, percent: percent }) : `${toolName} をダウンロード中... ${percent}%`;
            progressBar.style.width = `${percent}%`;
        });

        // ★ 音量解析の進捗メッセージを言語設定に応じて動的生成
        listen('lufs_calc_progress', (event) => {
            const data = event.payload;
            if (!data) return;

            if (lufsProgressContainer && lufsProgressContainer.style.display !== 'none') {
                let msg = data.message || "";
                if (window.i18n && data.status_code) {
                    switch (data.status_code) {
                        case "already_completed":
                            msg = window.i18n.t('Extensions.lufs_already_completed');
                            break;
                        case "preparing":
                            msg = window.i18n.t('Extensions.lufs_preparing_analysis');
                            break;
                        case "analyzing":
                            msg = window.i18n.t('Extensions.lufs_analyzing', { title: data.title || "" });
                            break;
                        case "analyzed":
                            msg = window.i18n.t('Extensions.lufs_analyzed', { title: data.title || "" });
                            break;
                        case "completed":
                            msg = window.i18n.t('Extensions.lufs_completed');
                            break;
                    }
                }

                if (lufsProgressMessage) lufsProgressMessage.textContent = msg;
                if (lufsProgressCount) lufsProgressCount.textContent = `${data.current} / ${data.total}`;
                if (lufsProgressBar && data.total > 0) {
                    const percent = (data.current / data.total) * 100;
                    lufsProgressBar.style.width = `${percent}%`;
                }
            }
        });
    }

    async function checkLufsStatus() {
        if (!lufsStatusText || !lufsCountText || !btnStartLufsCalc) return;
        try {
            lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_checking') : "確認中...";
            lufsStatusText.style.color = "var(--text-main)";

            const status = await invoke("check_tools_status");
            const hasFfmpeg = !!status['ffmpeg'];

            if (!hasFfmpeg) {
                lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_ffmpeg_missing') : "FFmpegが未インストールです";
                lufsStatusText.style.color = "#ef4444";
                lufsCountText.textContent = "-- / --";
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = window.i18n ? window.i18n.t('Extensions.btn_ffmpeg_required') : "FFmpegが必要です";
                return;
            }

            const lufsInfo = await invoke("check_lufs_status");
            lufsCountText.textContent = `${lufsInfo.calculated} / ${lufsInfo.total}`;

            if (lufsInfo.total === 0) {
                lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_no_songs') : "ライブラリに楽曲がありません";
                lufsStatusText.style.color = "var(--text-sub)";
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = window.i18n ? window.i18n.t('Extensions.btn_add_songs') : "楽曲を追加してください";
            } else if (lufsInfo.is_completed) {
                lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_completed') : "測定完了 (全曲解析済み)";
                lufsStatusText.style.color = "#10b981";
                btnStartLufsCalc.disabled = false;
                btnStartLufsCalc.textContent = window.i18n ? window.i18n.t('Extensions.btn_recalc_lufs') : "音量測定を再実行";
            } else {
                lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_uncalculated', { count: lufsInfo.uncalculated }) : `未測定の楽曲があります (${lufsInfo.uncalculated}曲)`;
                lufsStatusText.style.color = "#f59e0b";
                btnStartLufsCalc.disabled = false;
                btnStartLufsCalc.textContent = window.i18n ? window.i18n.t('Extensions.btn_start_lufs') : "音量測定を開始";
            }
        } catch (e) {
            console.error("Failed to check LUFS status:", e);
            if (lufsStatusText) {
                lufsStatusText.textContent = window.i18n ? window.i18n.t('Extensions.status_failed') : "ステータス取得失敗";
                lufsStatusText.style.color = "#ef4444";
            }
        }
    }

    window.addEventListener('focus', () => {
        if (!isLufsCalculating) {
            checkLufsStatus();
        }
    });

    if (btnStartLufsCalc) {
        btnStartLufsCalc.addEventListener('click', async () => {
            if (isLufsCalculating) return;

            try {
                const lufsInfo = await invoke("check_lufs_status");
                const isForce = lufsInfo && lufsInfo.is_completed;

                isLufsCalculating = true;
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = window.i18n ? window.i18n.t('Extensions.btn_calculating') : "測定中...";

                if (lufsProgressContainer) {
                    lufsProgressContainer.style.display = 'block';
                    if (lufsProgressBar) lufsProgressBar.style.width = '0%';
                    if (lufsProgressMessage) lufsProgressMessage.textContent = window.i18n ? window.i18n.t('Extensions.lufs_preparing') : "準備中...";
                    if (lufsProgressCount) lufsProgressCount.textContent = "0 / 0";
                }

                await invoke("start_lufs_calculation_all", { force: isForce });

                showAlert(
                    window.i18n ? window.i18n.t('Common.complete') : "完了",
                    window.i18n ? window.i18n.t('Extensions.msg_lufs_completed') : "すべての楽曲の音量測定が完了しました！"
                );
            } catch (err) {
                console.error("LUFS calculation error:", err);
                showAlert(
                    window.i18n ? window.i18n.t('Common.error') : "エラー",
                    (window.i18n ? window.i18n.t('Extensions.msg_lufs_error') : "音量測定中にエラーが発生しました: ") + err,
                    true
                );
            } finally {
                isLufsCalculating = false;
                if (lufsProgressContainer) {
                    setTimeout(() => {
                        lufsProgressContainer.style.display = 'none';
                    }, 2000);
                }
                await checkLufsStatus();
            }
        });
    }

    async function checkStatus() {
        btnMainAction.disabled = true;
        updateCard.style.display = 'none';
        try {
            const status = await invoke("check_tools_status");
            renderTools(status);
            updateActionCard(status);
        } catch (e) {
            toolsList.innerHTML = `<div class="tool-item not-installed">${window.i18n ? window.i18n.t('Common.error') : 'エラーが発生しました'}</div>`;
        } finally {
            await checkLufsStatus();
        }
    }

    function renderTools(status) {
        toolsList.innerHTML = '';
        const allTools = ['yt-dlp', 'ffmpeg', 'deno', 'cloudflared'];

        for (const tool of allTools) {
            const isInstalled = !!status[tool];
            const item = document.createElement('div');
            item.className = `tool-item ${isInstalled ? 'installed' : 'not-installed'}`;
            
            const statusText = isInstalled 
                ? (window.i18n ? window.i18n.t('Extensions.tool_status_installed') : '正常にインストール済み')
                : (window.i18n ? window.i18n.t('Extensions.tool_status_not_installed') : '未インストール (または不正なファイル)');

            item.innerHTML = `<div class="tool-info"><span class="tool-name">${tool}</span><span class="tool-desc">${getToolDesc(tool)}</span></div><span class="tool-status">${statusText}</span>`;
            toolsList.appendChild(item);
        }
    }

    function updateActionCard(status) {
        const allTools = ['yt-dlp', 'ffmpeg', 'deno', 'cloudflared'];
        const missingTools = allTools.filter(tool => !status[tool]);

        if (missingTools.length === 0) {
            actionTitle.textContent = window.i18n ? window.i18n.t('Extensions.action_title_all_ready') : "全てのツールが揃っています";
            actionDesc.textContent = window.i18n ? window.i18n.t('Extensions.action_desc_all_ready') : "すべての外部ツールが正常に利用可能です。";
            btnMainAction.textContent = window.i18n ? window.i18n.t('Extensions.btn_check_updates') : "アップデートを確認";
            btnMainAction.disabled = false;
            btnMainAction.onclick = () => checkForUpdates();
        } else {
            actionTitle.textContent = window.i18n ? window.i18n.t('Extensions.action_title_missing') : "不足・不正なツールがあります";
            actionDesc.textContent = window.i18n ? window.i18n.t('Extensions.action_desc_missing') : "一部の機能を利用するにはツールの更新・追加が必要です。";
            btnMainAction.textContent = window.i18n ? window.i18n.t('Extensions.btn_redownload') : "再ダウンロードを実行";
            btnMainAction.disabled = false;
            btnMainAction.onclick = () => installTools(missingTools);
        }
    }

    async function checkForUpdates() {
        btnMainAction.disabled = true;
        btnMainAction.textContent = window.i18n ? window.i18n.t('Extensions.btn_checking') : "確認中...";
        try {
            const results = await invoke("check_tool_updates");
            renderUpdateResults(results);
        } catch (e) {
            showAlert(
                window.i18n ? window.i18n.t('Common.error') : "エラー",
                window.i18n ? window.i18n.t('Extensions.msg_network_error') : "通信に失敗しました",
                true
            );
        }
        finally {
            btnMainAction.textContent = window.i18n ? window.i18n.t('Extensions.btn_check_updates') : "アップデートを確認";
            btnMainAction.disabled = false;
        }
    }

    function renderUpdateResults(results) {
        updateResultList.innerHTML = '';
        pendingUpdates = [];
        let updateCount = 0;
        for (const [tool, info] of Object.entries(results)) {
            const item = document.createElement('div');
            if (info.updateNeeded) { updateCount++; pendingUpdates.push(tool); }
            
            const isCorrupted = info.localVersion.includes("正しいファイルではありません");
            const localVersionHtml = isCorrupted 
                ? `<span style="color:#ef4444; font-weight:bold;">${window.i18n ? window.i18n.t('Extensions.tool_corrupted') : '不正なファイル'}</span>` 
                : info.localVersion;

            const statusText = info.updateNeeded 
                ? (isCorrupted ? (window.i18n ? window.i18n.t('Extensions.tool_reinstall_needed') : '再インストール') : (window.i18n ? window.i18n.t('Extensions.tool_update_needed') : '要更新')) 
                : (window.i18n ? window.i18n.t('Extensions.tool_up_to_date') : '最新');

            item.className = `tool-item ${info.updateNeeded ? 'not-installed' : 'installed'}`;
            item.innerHTML = `
                <div class="tool-info">
                    <span class="tool-name">${tool}</span>
                    <span class="tool-desc">${localVersionHtml} → ${info.latestVersion}</span>
                </div>
                <span class="tool-status">${statusText}</span>
            `;
            updateResultList.appendChild(item);
        }
        updateCard.style.display = 'block';
        btnExecUpdate.disabled = updateCount === 0;
        btnExecUpdate.textContent = updateCount > 0 
            ? (window.i18n ? window.i18n.t('Extensions.btn_exec_update') : "アップデート・修復を実行") 
            : (window.i18n ? window.i18n.t('Extensions.btn_all_latest') : "すべて最新版で正常です");
        btnExecUpdate.onclick = () => installTools(pendingUpdates);
    }

    async function installTools(toolsToInstall) {
        btnMainAction.disabled = true;
        btnExecUpdate.disabled = true;
        progressArea.style.display = 'block';
        try {
            for (const tool of toolsToInstall) {
                await invoke("install_tool", { toolName: tool });
            }
            showAlert(
                window.i18n ? window.i18n.t('Common.complete') : "完了",
                window.i18n ? window.i18n.t('Extensions.msg_all_tools_updated') : "すべてのツールを更新・修復しました。"
            );
        } catch (e) {
            showAlert(
                window.i18n ? window.i18n.t('Common.error') : "エラー",
                e,
                true
            );
        }
        progressArea.style.display = 'none';
        
        await checkStatus();
    }

    await checkStatus();
});