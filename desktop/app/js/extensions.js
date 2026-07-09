document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : null;

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

    const TOOL_DETAILS = {
        'yt-dlp': 'YouTubeなどの動画プラットフォームから動画・音声をダウンロードします。',
        'ffmpeg': 'ダウンロードした動画から音声を抽出・変換するために使用します。',
        'deno': '一部のサイトのダウンロード処理を補助するJavaScriptランタイムです。'
    };

    let pendingUpdates = [];

    // ★ 修正：アラート表示ロジックに display の切り替えと閉じる処理を統合
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
                // フェードアウトアニメーション完了後に完全に非表示にする
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
        }
    }

    function renderTools(status) {
        toolsList.innerHTML = '';
        for (const [tool, isInstalled] of Object.entries(status)) {
            const item = document.createElement('div');
            item.className = `tool-item ${isInstalled ? 'installed' : 'not-installed'}`;
            item.innerHTML = `<div class="tool-info"><span class="tool-name">${tool}</span><span class="tool-desc">${TOOL_DETAILS[tool]}</span></div><span class="tool-status">${isInstalled ? '正常にインストール済み' : '未インストール (または不正なファイル)'}</span>`;
            toolsList.appendChild(item);
        }
    }

    function updateActionCard(status) {
        const missingTools = Object.keys(status).filter(tool => !status[tool]);
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