document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.core.listen;

    let currentAuthCode = "------";
    let globalIp = "";
    let globalPort = "";

    let countdownInterval = null;
    let pendingRequests = {};  
    let approvedRequests = {}; 

    let isWanEnabled = false;
    let currentWanUrl = null;

    const wanToggle = document.getElementById('wanToggle');
    const wanStatusBadge = document.getElementById('wanStatusBadge');
    const wanInfoBox = document.getElementById('wanInfoBox');
    const displayWanUrl = document.getElementById('displayWanUrl');
    const displayIp = document.getElementById('displayIp');
    const wanQrDesc = document.getElementById('wanQrDesc');

    if (displayIp) {
        displayIp.textContent = window.i18n ? window.i18n.t('Sync.loading_ip') : "取得中...";
    }
    if (wanQrDesc && window.i18n) {
        wanQrDesc.innerHTML = window.i18n.t('Sync.wan_qr_desc');
    }

    function generateWanQrCode(url) {
        const container = document.getElementById('wan-qrcode-container');
        container.innerHTML = "";
        if (!url) return;
        
        const qrData = JSON.stringify({ wanUrl: url });
        new QRCode(container, { text: qrData, width: 140, height: 140, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
        document.getElementById('wanQrWrapper').style.display = 'block';
    }

    if (wanToggle) {
        wanToggle.addEventListener('change', async (e) => {
            isWanEnabled = e.target.checked;
            
            if (isWanEnabled) {
                wanStatusBadge.textContent = window.i18n ? window.i18n.t('Sync.wan_status_building') : "● WAN接続モード: ON (トンネル構築中...)";
                wanStatusBadge.style.color = "#f59e0b";
                if (wanInfoBox) wanInfoBox.style.display = "block";
                if (displayWanUrl) displayWanUrl.textContent = window.i18n ? window.i18n.t('Sync.wan_tunnel_building') : "トンネル構築中...";
                document.getElementById('wanQrWrapper').style.display = 'none';

                try {
                    const url = await invoke("toggle_wan_mode", { enable: true, port: parseInt(globalPort) });
                    currentWanUrl = url;
                    wanStatusBadge.textContent = window.i18n ? window.i18n.t('Sync.wan_status_on') : "● WAN接続モード: ON (有効・待機中)";
                    wanStatusBadge.style.color = "#10b981";
                    if (displayWanUrl) displayWanUrl.textContent = url;
                    showToast(window.i18n ? window.i18n.t('Sync.toast_wan_enabled') : "WAN モードを有効化しました");
                    
                    generateWanQrCode(url);
                } catch(err) {
                    let errMsg = err;
                    if (typeof err === 'string') {
                        if (err.startsWith('ERR_CLOUDFLARED_START')) {
                            const parts = err.split(':');
                            const bin = parts[1] || 'cloudflared';
                            errMsg = window.i18n ? window.i18n.t('Sync.err_cloudflared_start', { bin: bin }) : `cloudflared の起動に失敗しました (${bin})`;
                        } else if (err === 'ERR_CLOUDFLARED_TIMEOUT') {
                            errMsg = window.i18n ? window.i18n.t('Sync.err_cloudflared_timeout') : "Cloudflare Tunnel の URL 取得にタイムアウトしました。";
                        }
                    }
                    showToast(errMsg);
                    wanToggle.checked = false;
                    isWanEnabled = false;
                    wanStatusBadge.textContent = window.i18n ? window.i18n.t('Sync.wan_status_off') : "● WAN接続モード: OFF (無効)";
                    wanStatusBadge.style.color = "#ef4444";
                    if (wanInfoBox) wanInfoBox.style.display = "none";
                }
            } else {
                wanStatusBadge.textContent = window.i18n ? window.i18n.t('Sync.wan_status_off') : "● WAN接続モード: OFF (無効)";
                wanStatusBadge.style.color = "#ef4444";
                if (wanInfoBox) wanInfoBox.style.display = "none";
                currentWanUrl = null;
                
                await invoke("toggle_wan_mode", { enable: false, port: 0 });
                showToast(window.i18n ? window.i18n.t('Sync.toast_wan_disabled') : "WAN モードを無効化しました");
            }
        });
    }

    await listen('notify_auth_request', (event) => {
        const data = event.payload; 
        const msg = window.i18n ? window.i18n.t('Sync.toast_auth_request', { device: data.device }) : `接続要求: ${data.device} からのリクエスト`;
        showToast(msg);
        addRequestItem(data);
    });

    await listen('notify_auth_success', (event) => {
        const msg = window.i18n ? window.i18n.t('Sync.toast_auth_success', { device: event.payload.device }) : `ペアリング完了: ${event.payload.device} と接続されました`;
        showToast(msg);
        loadSessions();
        
        for (const [id, reqData] of Object.entries(pendingRequests)) { reqData.element.remove(); }
        pendingRequests = {};
        for (const [id, reqData] of Object.entries(approvedRequests)) { reqData.element.remove(); }
        approvedRequests = {};

        checkEmptyRequests();
        checkEmptyApprovedRequests();
    });

    await listen('update_auth_code', (event) => {
        currentAuthCode = event.payload;
        const display = document.getElementById('authCodeDisplay');
        if (display) display.textContent = currentAuthCode;
        
        const qrWrapper = document.getElementById('qr-wrapper');
        if (qrWrapper && qrWrapper.style.display === 'flex') {
            generateQrCode();
        }

        startSmoothCountdown();
    });

    function startSmoothCountdown() {
        const timerDuration = 30000; 
        const intervalStep = 50;     
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

            const seconds = Math.ceil(timeLeftMs / 1000);
            const countdownTextDisplay = document.getElementById('countdownTextDisplay');
            if (countdownTextDisplay && window.i18n) {
                countdownTextDisplay.innerHTML = window.i18n.t('Sync.countdown_text', { sec: `<span id="codeTimer">${seconds}</span>` });
            } else {
                const timer = document.getElementById('codeTimer');
                if (timer) timer.textContent = seconds;
            }

            const progress = (timeLeftMs / timerDuration) * 100;
            const barFill = document.getElementById('codeProgressBar');
            if (barFill) {
                barFill.style.width = `${progress}%`;
            }
        }, intervalStep);
    }

    try {
        const info = await invoke("start_sync_server");
        globalIp = info.ip;
        globalPort = info.port;
        document.getElementById('displayIp').textContent = globalIp;
        document.getElementById('displayPort').textContent = globalPort;
    } catch(e) {
        showToast(window.i18n ? window.i18n.t('Sync.toast_server_error') : "サーバーの起動に失敗しました");
        console.error(e);
    }

    function addRequestItem(req) {
        document.getElementById('noRequestsMsg').style.display = 'none';
        const list = document.getElementById('requestsList');
        
        if (pendingRequests[req.id]) {
            pendingRequests[req.id].element.remove();
        }
        
        const btnRejectText = window.i18n ? window.i18n.t('Sync.btn_reject') : "拒否";
        const btnApproveText = window.i18n ? window.i18n.t('Sync.btn_approve') : "許可";

        const li = document.createElement('li');
        li.className = 'request-item';
        li.innerHTML = `
            <div class="request-info">
                <strong style="font-size:1.1rem; color:var(--text-main);">${u.escapeHtml(req.device)}</strong><br>
                <small style="color:var(--text-sub);">${u.escapeHtml(req.ip)} (${u.escapeHtml(req.os)})</small>
            </div>
            <div class="request-actions">
                <button class="btn-reject" onclick="window.handleRequest('${req.id}', false)">${btnRejectText}</button>
                <button class="btn-approve" onclick="window.handleRequest('${req.id}', true)">${btnApproveText}</button>
            </div>
        `;
        list.appendChild(li);
        pendingRequests[req.id] = { req, element: li };
    }

    window.handleRequest = async (id, approve) => {
        await invoke("respond_to_request", { requestId: id, approve: approve });
        
        if (pendingRequests[id]) {
            const reqData = pendingRequests[id].req;
            pendingRequests[id].element.remove();
            delete pendingRequests[id];
            checkEmptyRequests();

            if (approve) {
                addApprovedRequestItem(reqData);
            }
        } else if (approvedRequests[id] && !approve) {
            approvedRequests[id].element.remove();
            delete approvedRequests[id];
            checkEmptyApprovedRequests();
        }
    };

    function addApprovedRequestItem(req) {
        document.getElementById('noWaitingCodeMsg').style.display = 'none';
        const list = document.getElementById('waitingCodeList');

        const labelWaiting = window.i18n ? window.i18n.t('Sync.label_waiting_code') : "コード入力待ち...";
        const btnCancelText = window.i18n ? window.i18n.t('Sync.btn_cancel_approval') : "取り消し";

        const li = document.createElement('li');
        li.className = 'request-item';
        li.style.borderColor = 'var(--text-sub)'; 
        li.innerHTML = `
            <div class="request-info">
                <strong style="font-size:1.1rem; color:var(--text-main);">${u.escapeHtml(req.device)}</strong><br>
                <small style="color:var(--text-sub);">${u.escapeHtml(req.ip)} (${labelWaiting})</small>
            </div>
            <div class="request-actions">
                <button class="btn-reject" onclick="window.handleRequest('${req.id}', false)">${btnCancelText}</button>
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

    function generateQrCode() {
        const container = document.getElementById('qrcode-container');
        container.innerHTML = "";
        if (!globalPort || globalPort === 0) return;
        
        const qrData = JSON.stringify({ 
            ip: globalIp, 
            port: globalPort.toString(), 
            code: currentAuthCode
        });
        new QRCode(container, { text: qrData, width: 140, height: 140, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
    }

    document.getElementById('btnShowQr').onclick = () => {
        if (!globalPort || globalPort === 0) {
            showToast(window.i18n ? window.i18n.t('Sync.toast_waiting_port') : "ポートの取得を待っています...");
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

    async function loadSessions() {
        const sessions = await invoke("get_active_sessions");
        const list = document.getElementById('sessionsList');
        if (sessions.length === 0) {
            const noSessionsText = window.i18n ? window.i18n.t('Sync.no_sessions') : "接続中のデバイスはありません。";
            list.innerHTML = `<li class="no-sessions">${noSessionsText}</li>`;
            return;
        }
        list.innerHTML = "";
        const btnDisconnectText = window.i18n ? window.i18n.t('Sync.btn_disconnect') : "切断";

        sessions.forEach(s => {
            const li = document.createElement('li');
            li.className = 'session-item';
            const remainingMsg = window.i18n 
                ? window.i18n.t('Sync.label_remaining_time', { min: Math.floor(s.remaining / 60), sec: s.remaining % 60 })
                : `最終アクセス: 残り${Math.floor(s.remaining / 60)}分${s.remaining % 60}秒`;

            li.innerHTML = `
                <div class="session-info">
                    <strong style="color:var(--text-main); font-size:1.05rem;">${u.escapeHtml(s.device)}</strong><br>
                    <small style="color:var(--text-sub);">${s.ip} - ${remainingMsg}</small>
                </div>
                <button class="btn-disconnect" onclick="terminateSession('${s.ip}', '${u.escapeHtml(s.device)}')">${btnDisconnectText}</button>
            `;
            list.appendChild(li);
        });
    }

    window.terminateSession = async (ip, device) => {
        await invoke("force_disconnect_session", { ip: ip, device: device });
        loadSessions();
    };

    function showToast(msg) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.textContent = msg;
        container.prepend(toast);
        setTimeout(() => { toast.classList.add('show'); }, 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => { toast.remove(); }, 500);
        }, 4000);
    }

    const u = { escapeHtml: (str) => str ? String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '' };

    window.onbeforeunload = () => { 
        invoke("toggle_wan_mode", { enable: false, port: 0 });
        invoke("stop_sync_server"); 
    };
    
    loadSessions();
    setInterval(loadSessions, 5000);
});