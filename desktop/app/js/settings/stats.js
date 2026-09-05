window.SettingsStats = {
    deviceMap: new Map(),

    getDeviceClass: function(deviceName) {
        if (!deviceName) return 'device0';
        if (!this.deviceMap.has(deviceName)) {
            const idx = (this.deviceMap.size % 9) + 1;
            this.deviceMap.set(deviceName, `device${idx}`);
        }
        return this.deviceMap.get(deviceName);
    },

    parseDateTime: function(dateStr) {
        if (!dateStr) return new Date(0);
        if (dateStr.includes('.')) {
            const p = dateStr.split('.').map(Number);
            if (p.length >= 5) {
                return new Date(p[0], p[1] - 1, p[2], p[3], p[4]);
            }
        }
        const dt = new Date(dateStr);
        return isNaN(dt.getTime()) ? new Date(0) : dt;
    },

    formatDateTime: function(dateStr) {
        if (!dateStr) return '--';
        if (dateStr.includes('.')) {
            const p = dateStr.split('.').map(Number);
            if (p.length >= 5) {
                const y = p[0];
                const m = String(p[1]).padStart(2, '0');
                const d = String(p[2]).padStart(2, '0');
                const h = String(p[3]).padStart(2, '0');
                const min = String(p[4]).padStart(2, '0');
                return `${y}/${m}/${d} ${h}:${min}`;
            }
        }
        const dt = new Date(dateStr);
        if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            const h = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');
            return `${y}/${m}/${d} ${h}:${min}`;
        }
        return dateStr;
    },

    escapeHtml: function(str) {
        return str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';
    },

    // ★ 楽曲再生統計の取得前にセッション状態を確認
    loadPlayStatistics: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const syncBadge = document.getElementById('syncStatusBadgePlay');
        const rankingContainer = document.getElementById('topRankingContainer');
        const historyTbody = document.getElementById('playHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            let isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (isSyncLoggedIn) {
                const isValid = await invoke("verify_current_cloud_session");
                if (isValid) {
                    if (syncBadge) {
                        syncBadge.textContent = "● Chordia Sync オンライン同期中";
                        syncBadge.className = "sync-indicator-badge cloud";
                    }
                    const cloudHistory = await invoke("fetch_cloud_play_history");
                    this.renderCloudPlayStats(cloudHistory, rankingContainer, historyTbody);
                    return;
                } else {
                    isSyncLoggedIn = false;
                    window.SettingsGeneral.showToast("Chordia Sync の認証に失敗しました", true);
                    if (window.SettingsSync) window.SettingsSync.showLoggedOutView();
                }
            }

            if (syncBadge) {
                syncBadge.textContent = "● ローカル再生履歴";
                syncBadge.className = "sync-indicator-badge local";
            }
            const localStats = await invoke("get_local_play_statistics");
            this.renderLocalPlayStats(localStats, rankingContainer, historyTbody);
        } catch(e) {
            console.error("Failed to load play statistics:", e);
            if (historyTbody) {
                historyTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${this.escapeHtml(e)}</td></tr>`;
            }
        }
    },

    renderCloudPlayStats: function(history, rankingEl, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
            return;
        }

        const sortedHistory = [...history].sort((a, b) => {
            const dA = this.parseDateTime(a.date || a.timestamp);
            const dB = this.parseDateTime(b.date || b.timestamp);
            return dB - dA;
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const countMap = new Map();
        sortedHistory.forEach(item => {
            const itemDate = this.parseDateTime(item.date || item.timestamp);
            if (itemDate >= sevenDaysAgo) {
                const key = `${item.title || 'Unknown'}___${item.artist || 'Unknown'}`;
                const cur = countMap.get(key) || { title: item.title, artist: item.artist, count: 0 };
                cur.count += 1;
                countMap.set(key, cur);
            }
        });

        const rankingList = Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

        if (rankingList.length > 0) {
            rankingEl.innerHTML = '';
            rankingList.forEach((r, idx) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ranking-item';
                const rankClass = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
                itemDiv.innerHTML = `
                    <div class="rank-badge ${rankClass}">${idx + 1}</div>
                    <div class="rank-info">
                        <div class="rank-title">${this.escapeHtml(r.title)}</div>
                        <div class="rank-artist">${this.escapeHtml(r.artist)}</div>
                    </div>
                    <div class="rank-count">${r.count} 回</div>
                `;
                rankingEl.appendChild(itemDiv);
            });
        } else {
            rankingEl.innerHTML = '<p style="color:var(--text-sub); font-size:0.9rem;">直近7日間の再生データがありません。</p>';
        }

        tbody.innerHTML = '';
        sortedHistory.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = this.getDeviceClass(item.device);
            const dateStr = item.date || item.timestamp;
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong>${this.escapeHtml(item.title || 'Unknown')}</strong></td>
                <td>${this.escapeHtml(item.artist || 'Unknown')}</td>
                <td>${this.escapeHtml(item.album || '--')}</td>
                <td><span class="device-badge ${devClass}">${this.escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${this.formatDateTime(dateStr)}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderLocalPlayStats: function(stats, rankingEl, tbody) {
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
                        <div class="rank-title">${this.escapeHtml(r.title)}</div>
                        <div class="rank-artist">${this.escapeHtml(r.artist)}</div>
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
                const dateStr = item.timestamp || item.date;
                tr.innerHTML = `
                    <td style="color:var(--text-sub);">${idx + 1}</td>
                    <td><strong>${this.escapeHtml(item.title || 'Unknown')}</strong></td>
                    <td>${this.escapeHtml(item.artist || 'Unknown')}</td>
                    <td>${this.escapeHtml(item.album || '--')}</td>
                    <td><span class="device-badge device1">Desktop (Local)</span></td>
                    <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${this.formatDateTime(dateStr)}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding:24px;">再生履歴がありません。</td></tr>';
        }
    },

    // ★ 作業統計の取得前にセッション状態を確認
    loadWorkStatistics: async function() {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const syncBadge = document.getElementById('syncStatusBadgeWork');
        const notConnectedArea = document.getElementById('workSyncNotConnected');
        const connectedArea = document.getElementById('workSyncConnectedArea');
        const tbody = document.getElementById('workHistoryTableBody');

        try {
            const authInfo = await invoke("get_cloud_auth_info");
            let isSyncLoggedIn = (authInfo && authInfo.logged_in);

            if (isSyncLoggedIn) {
                const isValid = await invoke("verify_current_cloud_session");
                if (isValid) {
                    if (syncBadge) {
                        syncBadge.textContent = "● Chordia Sync オンライン同期中";
                        syncBadge.className = "sync-indicator-badge cloud";
                    }
                    if (notConnectedArea) notConnectedArea.style.display = 'none';
                    if (connectedArea) connectedArea.style.display = 'block';

                    const workHistory = await invoke("fetch_cloud_work_history");
                    this.renderWorkHistory(workHistory, tbody);
                    return;
                } else {
                    isSyncLoggedIn = false;
                    window.SettingsGeneral.showToast("Chordia Sync の認証に失敗しました", true);
                    if (window.SettingsSync) window.SettingsSync.showLoggedOutView();
                }
            }

            const localWorkHistory = await invoke("get_local_work_history");
            if (Array.isArray(localWorkHistory) && localWorkHistory.length > 0) {
                if (syncBadge) {
                    syncBadge.textContent = "● ローカル作業履歴";
                    syncBadge.className = "sync-indicator-badge local";
                }
                if (notConnectedArea) notConnectedArea.style.display = 'none';
                if (connectedArea) connectedArea.style.display = 'block';
                this.renderWorkHistory(localWorkHistory, tbody);
            } else {
                if (syncBadge) {
                    syncBadge.textContent = "● 未接続";
                    syncBadge.className = "sync-indicator-badge";
                }
                if (notConnectedArea) notConnectedArea.style.display = 'block';
                if (connectedArea) connectedArea.style.display = 'none';
            }
        } catch(e) {
            console.error("Failed to load work statistics:", e);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:24px;">データの取得に失敗しました: ${this.escapeHtml(e)}</td></tr>`;
            }
        }
    },

    renderWorkHistory: function(history, tbody) {
        if (!Array.isArray(history) || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-sub); padding:24px;">作業セッション履歴がありません。</td></tr>';
            return;
        }

        const sorted = [...history].sort((a, b) => {
            const dA = this.parseDateTime(a.end);
            const dB = this.parseDateTime(b.end);
            return dB - dA;
        });

        tbody.innerHTML = '';
        sorted.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const devClass = this.getDeviceClass(item.device);
            tr.innerHTML = `
                <td style="color:var(--text-sub);">${idx + 1}</td>
                <td><strong style="color:var(--primary-color); font-size:0.95rem;">${this.escapeHtml(item.time || '--')}</strong></td>
                <td><span class="device-badge ${devClass}">${this.escapeHtml(item.device || 'Unknown')}</span></td>
                <td style="font-family:monospace; font-size:0.85rem; color:var(--text-sub);">${this.formatDateTime(item.end)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};