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

    const TOOL_DETAILS = {
        'yt-dlp': 'YouTubeなどの動画プラットフォームから動画・音声をダウンロードします。',
        'ffmpeg': 'ダウンロードした動画からの音声抽出および「一定音量(LUFS)」の音量解析に使用します。',
        'deno': '一部のサイトのダウンロード処理を補助するJavaScriptランタイムです。',
        'cloudflared': 'WANでMobile版に楽曲を同期するために使用します。'
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
                progressText.textContent = `${toolName} を解凍・配置中...`;
                progressBar.style.width = '100%';
                return;
            }
            let percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
            progressText.textContent = `${toolName} をダウンロード中... ${percent}%`;
            progressBar.style.width = `${percent}%`;
        });

        // ★ 音量解析のリアルタイムプログレスイベントを拡張機能画面内で直接受信してインライン描画
        listen('lufs_calc_progress', (event) => {
            const data = event.payload;
            if (!data) return;

            if (lufsProgressContainer && lufsProgressContainer.style.display !== 'none') {
                if (lufsProgressMessage) lufsProgressMessage.textContent = data.message;
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
            lufsStatusText.textContent = "確認中...";
            lufsStatusText.style.color = "var(--text-main)";

            const status = await invoke("check_tools_status");
            const hasFfmpeg = !!status['ffmpeg'];

            if (!hasFfmpeg) {
                lufsStatusText.textContent = "FFmpegが未インストールです";
                lufsStatusText.style.color = "#ef4444";
                lufsCountText.textContent = "-- / -- 曲";
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = "FFmpegが必要です";
                return;
            }

            const lufsInfo = await invoke("check_lufs_status");
            lufsCountText.textContent = `${lufsInfo.calculated} / ${lufsInfo.total} 曲`;

            if (lufsInfo.total === 0) {
                lufsStatusText.textContent = "ライブラリに楽曲がありません";
                lufsStatusText.style.color = "var(--text-sub)";
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = "楽曲を追加してください";
            } else if (lufsInfo.is_completed) {
                lufsStatusText.textContent = "測定完了 (全曲解析済み)";
                lufsStatusText.style.color = "#10b981";
                btnStartLufsCalc.disabled = false;
                btnStartLufsCalc.textContent = "音量測定を再実行";
            } else {
                lufsStatusText.textContent = `未測定の楽曲があります (未解析: ${lufsInfo.uncalculated}曲)`;
                lufsStatusText.style.color = "#f59e0b";
                btnStartLufsCalc.disabled = false;
                btnStartLufsCalc.textContent = "音量測定を開始";
            }
        } catch (e) {
            console.error("Failed to check LUFS status:", e);
            if (lufsStatusText) {
                lufsStatusText.textContent = "ステータス取得失敗";
                lufsStatusText.style.color = "#ef4444";
            }
        }
    }

    window.addEventListener('focus', () => {
        if (!isLufsCalculating) {
            checkLufsStatus();
        }
    });

    // ★ 修正: 新しいウィンドウを開かず、同画面のインラインエリアで直接測定を実行
    if (btnStartLufsCalc) {
        btnStartLufsCalc.addEventListener('click', async () => {
            if (isLufsCalculating) return;

            try {
                const lufsInfo = await invoke("check_lufs_status");
                const isForce = lufsInfo && lufsInfo.is_completed;

                isLufsCalculating = true;
                btnStartLufsCalc.disabled = true;
                btnStartLufsCalc.textContent = "測定中...";

                if (lufsProgressContainer) {
                    lufsProgressContainer.style.display = 'block';
                    if (lufsProgressBar) lufsProgressBar.style.width = '0%';
                    if (lufsProgressMessage) lufsProgressMessage.textContent = "準備中...";
                    if (lufsProgressCount) lufsProgressCount.textContent = "0 / 0";
                }

                // 直接バックグラウンド解析タスクを呼び出し
                await invoke("start_lufs_calculation_all", { force: isForce });

                showAlert("完了", "すべての楽曲の音量測定が完了しました！");
            } catch (err) {
                console.error("LUFS calculation error:", err);
                showAlert("エラー", "音量測定中にエラーが発生しました: " + err, true);
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
            toolsList.innerHTML = `<div class="tool-item not-installed">エラーが発生しました</div>`;
        } finally {
            await checkLufsStatus();
        }
    }

    function renderTools(status) {
        toolsList.innerHTML = '';
        const allTools = Object.keys(TOOL_DETAILS);

        for (const tool of allTools) {
            const isInstalled = !!status[tool];
            const item = document.createElement('div');
            item.className = `tool-item ${isInstalled ? 'installed' : 'not-installed'}`;
            item.innerHTML = `<div class="tool-info"><span class="tool-name">${tool}</span><span class="tool-desc">${TOOL_DETAILS[tool] || ''}</span></div><span class="tool-status">${isInstalled ? '正常にインストール済み' : '未インストール (または不正なファイル)'}</span>`;
            toolsList.appendChild(item);
        }
    }

    function updateActionCard(status) {
        const allTools = Object.keys(TOOL_DETAILS);
        const missingTools = allTools.filter(tool => !status[tool]);

        if (missingTools.length === 0) {
            actionTitle.textContent = "全てのツールが揃っています";
            btnMainAction.textContent = "アップデートを確認";
            btnMainAction.disabled = false;
            btnMainAction.onclick = () => checkForUpdates();
        } else {
            actionTitle.textContent = "不足・不正なツールがあります";
            btnMainAction.textContent = "再ダウンロードを実行";
            btnMainAction.disabled = false;
            btnMainAction.onclick = () => installTools(missingTools);
        }
    }

    async function checkForUpdates() {
        btnMainAction.disabled = true;
        btnMainAction.textContent = "確認中...";
        try {
            const results = await invoke("check_tool_updates");
            renderUpdateResults(results);
        } catch (e) { showAlert("エラー", "通信に失敗しました", true); }
        finally { btnMainAction.textContent = "アップデートを確認"; btnMainAction.disabled = false; }
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
                ? `<span style="color:#ef4444; font-weight:bold;">${info.localVersion}</span>` 
                : info.localVersion;

            item.className = `tool-item ${info.updateNeeded ? 'not-installed' : 'installed'}`;
            item.innerHTML = `
                <div class="tool-info">
                    <span class="tool-name">${tool}</span>
                    <span class="tool-desc">${localVersionHtml} → ${info.latestVersion}</span>
                </div>
                <span class="tool-status">${info.updateNeeded ? (isCorrupted ? '再インストール' : '要更新') : '最新'}</span>
            `;
            updateResultList.appendChild(item);
        }
        updateCard.style.display = 'block';
        btnExecUpdate.disabled = updateCount === 0;
        btnExecUpdate.textContent = updateCount > 0 ? "アップデート・修復を実行" : "すべて最新版で正常です";
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
            showAlert("完了", "すべてのツールを更新・修復しました。");
        } catch (e) { showAlert("エラー", e, true); }
        progressArea.style.display = 'none';
        
        await checkStatus();
    }

    await checkStatus();
});