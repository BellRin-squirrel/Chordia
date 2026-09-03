document.addEventListener("DOMContentLoaded", async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    // バージョン表示
    const appVersionContainer = document.getElementById("infoAppVersion");
    if (appVersionContainer) {
        try {
            const appVersion = await invoke("get_app_version");
            appVersionContainer.textContent = appVersion;
        } catch(e) {
            appVersionContainer.textContent = "v5.0.0";
        }
    }

    // タブ切り替え
    const navButtons = document.querySelectorAll('.info-nav-btn');
    const sections = document.querySelectorAll('.info-section');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            
            navButtons.forEach(b => {
                if (b.dataset.target === targetId) b.classList.add('active');
                else b.classList.remove('active');
            });

            sections.forEach(sec => {
                if (sec.id === targetId) sec.classList.add('active');
                else sec.classList.remove('active');
            });

            if (targetId === 'sec-music-stats') loadPlayStatistics();
            if (targetId === 'sec-work-stats') loadWorkStatistics();
        });
    });

    const escapeHtml = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

    const deviceMap = new Map();
    function getDeviceClass(deviceName) {
        if (!deviceName) return 'device0';
        if (!deviceMap.has(deviceName)) {
            const idx = (deviceMap.size % 9) + 1;
            deviceMap.set(deviceName, `device${idx}`);
        }
        return deviceMap.get(deviceName);
    }

    function parseDotDate(dotStr) {
        if (!dotStr) return new Date(0);
        const p = dotStr.split('.').map(Number);
        if (p.length >= 5) {
            return new Date(p[0], p[1] - 1, p[2], p[3], p[4]);
        }
        return new Date(dotStr);
    }

    function formatDotDate(dotStr) {
        if (!dotStr) return '--';
        const p = dotStr.split('.');
        if (p.length >= 5) {
            return `${p[0]}/${p[1]}/${p[2]} ${p[3]}:${p[4]}`;
        }
        return dotStr;
    }

    // --- 楽曲再生統計の読み込み ---
    async function loadPlayStatistics() {
        const syncBadge = document.getElementById('syncStatusBadgePlay');
        const rankingContainer = document.getElementById('topRankingContainer');
        const historyTbody = document.getElementById('playHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            const isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (isSyncLoggedIn) {
                if (syncBadge) {
                    syncBadge.textContent = "● Chordia Sync オンライン同期中";
                    syncBadge.className = "sync-indicator-badge cloud";
                }

                const cloudHistory = await invoke("fetch_cloud_play_history");
                renderCloudPlayStats(cloudHistory, rankingContainer, historyTbody);
            } else {
                if (syncBadge) {
                    syncBadge.textContent = "● ローカル再生履歴";
                    syncBadge.className = "sync-indicator-badge local";
                }

                const localStats = await invoke("get_local_play_statistics");
                renderLocalPlayStats(localStats, rankingContainer, historyTbody);
            }
        } catch(e) {
            console.error("Failed to load play statistics:", e);
            if (historyTbody) {
                historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${escapeHtml(e)}</td></tr>`;
            }
        }
    }

    function renderCloudPlayStats(history, rankingEl, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
            return;
        }

        // 日付新しい順にソート
        const sortedHistory = [...history].sort((a, b) => {
            const dA = parseDotDate(a.date);
            const dB = parseDotDate(b.date);
            return dB - dA;
        });

        // 直近7日間のランキング集計
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const countMap = new Map();
        sortedHistory.forEach(item => {
            const itemDate = parseDotDate(item.date);
            if (itemDate >= sevenDaysAgo) {
                const key = `${item.title || 'Unknown'}___${item.artist || 'Unknown'}`;
                const cur = countMap.get(key) || { title: item.title, artist: item.artist, count: 0 };
                cur.count += 1;
                countMap.set(key, cur);
            }
        });

        const rankingList = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

        // ランキング描画
        if (rankingList.length > 0) {
            rankingEl.innerHTML = '';
            rankingList.forEach((r, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ranking-item';
                const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                itemDiv.innerHTML = `
                    <div class="rank-badge ${rankClass}">${idx + 1}</div>
                    <div class="rank-info">
                        <div class="rank-title">${escapeHtml(r.title)}</div>
                        <div class="rank-artist">${escapeHtml(r.artist)}</div>
                    </div>
                    <div class="rank-count">${r.count} 回</div>
                `;
                rankingEl.appendChild(itemDiv);
            });
        } else {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
        }

        // 全履歴テーブル描画
        tbody.innerHTML = '';
        sortedHistory.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = getDeviceClass(item.device);
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong>${escapeHtml(item.title || 'Unknown')}</strong></td>
                <td>${escapeHtml(item.artist || 'Unknown')}</td>
                <td>${escapeHtml(item.album || '--')}</td>
                <td><span class="device-badge ${devClass}">${escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.8rem; color:var(--text-sub);">${formatDotDate(item.date)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderLocalPlayStats(stats, rankingEl, tbody) {
        const ranking = stats.ranking || [];
        const history = stats.history || [];

        if (ranking.length > 0) {
            rankingEl.innerHTML = '';
            ranking.forEach((r, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ranking-item';
                const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                itemDiv.innerHTML = `
                    <div class="rank-badge ${rankClass}">${idx + 1}</div>
                    <div class="rank-info">
                        <div class="rank-title">${escapeHtml(r.title)}</div>
                        <div class="rank-artist">${escapeHtml(r.artist)}</div>
                    </div>
                    <div class="rank-count">${r.count} 回</div>
                `;
                rankingEl.appendChild(itemDiv);
            });
        } else {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">再生データがありません。</p>';
        }

        if (history.length > 0) {
            tbody.innerHTML = '';
            history.forEach((item, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="color:var(--text-sub);">${idx + 1}</td>
                    <td><strong>${escapeHtml(item.title || 'Unknown')}</strong></td>
                    <td>${escapeHtml(item.artist || 'Unknown')}</td>
                    <td>--</td>
                    <td><span class="device-badge device1">Desktop (Local)</span></td>
                    <td style="font-family:monospace; font-size:0.8rem; color:var(--text-sub);">${escapeHtml(item.timestamp || '--')}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
        }
    }

    // --- 作業統計の読み込み ---
    async function loadWorkStatistics() {
        const syncBadge = document.getElementById('syncStatusBadgeWork');
        const notConnectedArea = document.getElementById('workSyncNotConnected');
        const connectedArea = document.getElementById('workSyncConnectedArea');
        const tbody = document.getElementById('workHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            const isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (!isSyncLoggedIn) {
                if (syncBadge) {
                    syncBadge.textContent = "● 未接続";
                    syncBadge.className = "sync-indicator-badge";
                }
                if (notConnectedArea) notConnectedArea.style.display = 'block';
                if (connectedArea) connectedArea.style.display = 'none';
                return;
            }

            if (syncBadge) {
                syncBadge.textContent = "● Chordia Sync オンライン同期中";
                syncBadge.className = "sync-indicator-badge cloud";
            }
            if (notConnectedArea) notConnectedArea.style.display = 'none';
            if (connectedArea) connectedArea.style.display = 'block';

            const workHistory = await invoke("fetch_cloud_work_history");
            renderWorkHistory(workHistory, tbody);
        } catch(e) {
            console.error("Failed to load work statistics:", e);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${escapeHtml(e)}</td></tr>`;
            }
        }
    }

    function renderWorkHistory(history, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-sub); padding:24px;">作業セッション履歴がありません。</td></tr>';
            return;
        }

        const sorted = [...history].sort((a, b) => {
            const dA = parseDotDate(a.end);
            const dB = parseDotDate(b.end);
            return dB - dA;
        });

        tbody.innerHTML = '';
        sorted.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = getDeviceClass(item.device);
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong style="color:var(--primary-color); font-size:0.95rem;">${escapeHtml(item.time || '--')}</strong></td>
                <td><span class="device-badge ${devClass}">${escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.8rem; color:var(--text-sub);">${formatDotDate(item.end)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
});