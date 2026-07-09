window.ManageUtils = {
    // ダブルクォーテーションやシングルクォーテーションも確実にエスケープする
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
    
    // ★修正: トーストのクラス設定を add_music 画面と同じ堅牢なロジックに統一
    showToast: function(msg, isErr) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show ' + (isErr ? 'error' : 'success');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },
    
    formatTime: function(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },
    
    updateSeekColor: function(p) {
        const seekBar = document.getElementById('seekBar');
        if(seekBar) seekBar.style.background = `linear-gradient(to right, #4f46e5 ${p}%, #e5e7eb ${p}%)`;
    }
};