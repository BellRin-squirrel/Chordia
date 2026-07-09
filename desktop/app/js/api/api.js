document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.core.listen;

    let currentAuthCode = "------";
    let globalIp = "";
    let globalPort = "";

    let countdownInterval = null;
    let pendingRequests = {};  // 許可待ち
    let approvedRequests = {}; // コード入力待ち

    // 接続要求（リクエスト）の受信
    await listen('notify_auth_request', (event) => {
        const data = event.payload; // {id, ip, device, os, status}
        showToast(`接続要求: ${data.device} からのリクエスト`);
        addRequestItem(data);
    });

    // ペアリング完了（接続成功）の受信
    await listen('notify_auth_success', (event) => {
        showToast(`ペアリング完了: ${event.payload.device} と接続されました`);
        loadSessions();
        
        // 成功したタイミングで保留中およびコード入力待ちのUIを全消去
        for (const [id, reqData] of Object.entries(pendingRequests)) {
            reqData.element.remove();
        }
        pendingRequests = {};
        
        for (const [id, reqData] of Object.entries(approvedRequests)) {
            reqData.element.remove();
        }
        approvedRequests = {};

        checkEmptyRequests();
        checkEmptyApprovedRequests();
    });

    // 認証コード更新タイマー
    await listen('update_auth_code', (event) => {
        currentAuthCode = event.payload;
        const display = document.getElementById('authCodeDisplay');
        if (display) display.textContent = currentAuthCode;
        
        // QRコード表示中の場合は、中身を自動的に再生成して新コードへ同期する
        const qrWrapper = document.getElementById('qr-wrapper');
        if (qrWrapper && qrWrapper.style.display === 'flex') {
            generateQrCode();
        }

        startSmoothCountdown();
    });

    // スムーズなプログレスバー制御
    function startSmoothCountdown() {
        const timerDuration = 30000; // 30秒
        const intervalStep = 50;     // 50ms周期で計算を更新
        let timeLeftMs = timerDuration;
        const startTime = Date.now();

        if (countdownInterval) clearInterval(countdownInterval);

        countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            timeLeftMs = timerDuration - elapsed;

            if (timeLeftMs <= 0) {
                timeLeftMs = 0;
                clearInterval(countdownInterval);
            }

            // 秒数の表示更新（切り上げ）
            const seconds = Math.ceil(timeLeftMs / 1000);
            const timer = document.getElementById('codeTimer');
            if (timer) timer.textContent = seconds;

            // プログレスバーの更新
            const progress = (timeLeftMs / timerDuration) * 100;
            const barFill = document.getElementById('codeProgressBar');
            if (barFill) {
                barFill.style.width = `${progress}%`;
            }
        }, intervalStep);
    }

    // サーバー起動
    try {
        const info = await invoke("start_sync_server");
        globalIp = info.ip;
        globalPort = info.port;
        document.getElementById('displayIp').textContent = globalIp;
        document.getElementById('displayPort').textContent = globalPort;
    } catch(e) {
        showToast("サーバーの起動に失敗しました");
        console.error(e);
    }

    // リクエストを「許可待ちリスト」に表示
    function addRequestItem(req) {
        document.getElementById('noRequestsMsg').style.display = 'none';
        const list = document.getElementById('requestsList');
        
        if (pendingRequests[req.id]) {
            pendingRequests[req.id].element.remove();
        }
        
        const li = document.createElement('li');
        li.className = 'request-item';
        li.innerHTML = `
            <div class="request-info">
                <strong style="font-size:1.1rem; color:var(--text-main);">${u.escapeHtml(req.device)}</strong><br>
                <small style="color:var(--text-sub);">${u.escapeHtml(req.ip)} (${u.escapeHtml(req.os)})</small>
            </div>
            <div class="request-actions">
                <button class="btn-reject" onclick="window.handleRequest('${req.id}', false)">拒否</button>
                <button class="btn-approve" onclick="window.handleRequest('${req.id}', true)">許可</button>
            </div>
        `;
        list.appendChild(li);
        pendingRequests[req.id] = { req, element: li };
    }

    // リクエストの判定処理
    window.handleRequest = async (id, approve) => {
        await invoke("respond_to_request", { requestId: id, approve: approve });
        
        if (pendingRequests[id]) {
            const reqData = pendingRequests[id].req;
            pendingRequests[id].element.remove();
            delete pendingRequests[id];
            checkEmptyRequests();

            if (approve) {
                // 許可された場合、「認証コード入力待ち」セクションに要素を移動
                addApprovedRequestItem(reqData);
            }
        } else if (approvedRequests[id] && !approve) {
            // 入力待ち画面からの拒否（取り消し）
            approvedRequests[id].element.remove();
            delete approvedRequests[id];
            checkEmptyApprovedRequests();
        }
    };

    // リクエストを「認証コード入力待ちリスト」へ移動・生成
    function addApprovedRequestItem(req) {
        document.getElementById('noWaitingCodeMsg').style.display = 'none';
        const list = document.getElementById('waitingCodeList');

        const li = document.createElement('li');
        li.className = 'request-item';
        li.style.borderColor = 'var(--text-sub)'; // 入力待ちは落ち着いた枠線に変更
        li.innerHTML = `
            <div class="request-info">
                <strong style="font-size:1.1rem; color:var(--text-main);">${u.escapeHtml(req.device)}</strong><br>
                <small style="color:var(--text-sub);">${u.escapeHtml(req.ip)} (コード入力待ち...)</small>
            </div>
            <div class="request-actions">
                <button class="btn-reject" onclick="window.handleRequest('${req.id}', false)">取り消し</button>
            </div>
        `;
        list.appendChild(li);
        approvedRequests[req.id] = { req, element: li };
    }

    function checkEmptyRequests() {
        if (Object.keys(pendingRequests).length === 0) {
            document.getElementById('noRequestsMsg').style.display = 'block';
        }
    }

    function checkEmptyApprovedRequests() {
        if (Object.keys(approvedRequests).length === 0) {
            document.getElementById('noWaitingCodeMsg').style.display = 'block';
        }
    }

    // QRコードの生成
    function generateQrCode() {
        const container = document.getElementById('qrcode-container');
        container.innerHTML = "";
        if (!globalPort || globalPort === 0) return;
        
        const qrData = JSON.stringify({ ip: globalIp, port: globalPort.toString(), code: currentAuthCode });
        new QRCode(container, { text: qrData, width: 140, height: 140, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
    }

    // QRコードの表示トグル
    document.getElementById('btnShowQr').onclick = () => {
        if (!globalPort || globalPort === 0) {
            showToast("ポートの取得を待っています...");
            return;
        }

        generateQrCode();
        document.getElementById('qr-wrapper').style.display = 'flex';
        document.getElementById('qr-placeholder').style.display = 'none';
    };

    document.getElementById('btnHideQr').onclick = () => {
        document.getElementById('qr-wrapper').style.display = 'none';
        document.getElementById('qr-placeholder').style.display = 'flex';
    };

    // セッション（同期中セッション）一覧表示
    async function loadSessions() {
        const sessions = await invoke("get_active_sessions");
        const list = document.getElementById('sessionsList');
        if (sessions.length === 0) {
            list.innerHTML = '<li class="no-sessions">接続中のデバイスはありません。</li>';
            return;
        }
        list.innerHTML = "";
        sessions.forEach(s => {
            const li = document.createElement('li');
            li.className = 'session-item';
            li.innerHTML = `
                <div class="session-info">
                    <strong style="color:var(--text-main); font-size:1.05rem;">${u.escapeHtml(s.device)}</strong><br>
                    <small style="color:var(--text-sub);">${s.ip} - 最終アクセス: 残り${Math.floor(s.remaining / 60)}分${s.remaining % 60}秒</small>
                </div>
                <button class="btn-disconnect" onclick="terminateSession('${s.ip}', '${u.escapeHtml(s.device)}')">切断</button>
            `;
            list.appendChild(li);
        });
    }

    // 切断（プロンプトを挟まず即時切断）
    window.terminateSession = async (ip, device) => {
        await invoke("force_disconnect_session", { ip: ip, device: device });
        loadSessions();
    };

    // 右上での多重スタックトースト表示
    function showToast(msg) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.textContent = msg;

        // コンテナの最上部に挿入し、既存の通知を下方に押し下げる
        container.prepend(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // 4秒後に非表示にし、トランジション完了後にDOMから消去
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 4000);
    }

    const u = { escapeHtml: (str) => str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) };

    window.onbeforeunload = () => { 
        invoke("stop_sync_server"); 
    };
    
    loadSessions();
    setInterval(loadSessions, 5000);
});