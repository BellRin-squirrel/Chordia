window.PlayerUtils = {
    showLoading: function() {
        const overlay = document.getElementById('playerLoadingOverlay');
        if(overlay) {
            overlay.style.display = 'flex';
            this.updateLoadingProgress(0, 0, "データ処理中...");
        }
    },
    hideLoading: function() {
        const overlay = document.getElementById('playerLoadingOverlay');
        if(overlay) overlay.style.display = 'none';
    },
    updateLoadingProgress: function(current, total, headerMsg) {
        const headEl = document.getElementById('loadingHeaderText');
        const detailEl = document.getElementById('loadingDetailText');
        if (headEl) headEl.textContent = headerMsg;
        if (!detailEl) return;
        let percent = 0;
        if (total > 0) percent = Math.floor((current / total) * 100);
        detailEl.textContent = `処理中... ${current} / ${total} (${percent}%)`;
    },
    showToast: function(msg, isErr) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg; 
        toast.className = 'toast show ' + (isErr ? 'error' : 'success');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },
    escapeHtml: function(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/[&<>"']/g, function(match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    },
    formatTime: function(seconds) {
        const m = Math.floor(seconds / 60); 
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },
    // ★ 修正：言語設定に応じた再生時間の多言語フォーマット
    formatTotalDuration: function(seconds) {
        if (seconds < 60) {
            const sec = Math.floor(seconds);
            return (window.i18n && window.i18n.t)
                ? window.i18n.t('Player.duration_seconds', { sec: sec })
                : `${sec}秒`;
        }
        if (seconds < 3600) {
            const min = Math.floor(seconds / 60);
            return (window.i18n && window.i18n.t)
                ? window.i18n.t('Player.duration_minutes', { min: min })
                : `${min}分`;
        }
        const hr = (seconds / 3600).toFixed(1);
        return (window.i18n && window.i18n.t)
            ? window.i18n.t('Player.duration_hours', { hr: hr })
            : `${hr}時間`;
    },
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },
    sortSongs: function(songs, sortBy, sortDesc = false) {
        if (!songs || !Array.isArray(songs)) return [];
        const list = [...songs];
        list.sort((a, b) => {
            let valA = a[sortBy] || ''; 
            let valB = b[sortBy] || '';
            if (['track', 'year', 'disc', 'bpm'].includes(sortBy)) {
                valA = parseInt(valA) || 0; valB = parseInt(valB) || 0;
                if (valA < valB) return sortDesc ? 1 : -1;
                if (valA > valB) return sortDesc ? -1 : 1;
                return 0;
            } else {
                valA = String(valA); valB = String(valB);
                const comp = valA.localeCompare(valB, 'ja');
                return sortDesc ? -comp : comp;
            }
        });
        return list;
    }
};
