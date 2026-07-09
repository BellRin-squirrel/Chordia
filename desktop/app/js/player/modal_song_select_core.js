(function() {
    const s = window.PlayerState;

    window.ModalSongSelect = {
        libraryData:[],
        selectedFilenames: new Set(),
        currentPlaylistId: null,
        sortField: null,
        sortDesc: false,
        lastClickedIndex: null,
        _tempContextId: null,
        activeTags:[],
        advancedConditions: null, 

        findTargetPlaylistId: function() {
            if (this._tempContextId) return this._tempContextId;
            if (window.SidebarController) {
                const side = window.SidebarController;
                for (let key in side) {
                    if (typeof side[key] === 'number' && side[key] !== -1 && s.playlists[side[key]]) {
                        return s.playlists[side[key]].id;
                    }
                }
            }
            return s.currentPlaylistId || null;
        },

        evaluateSmartRules: function(song, ruleItem) {
            if (!ruleItem) return true;
            if (ruleItem.type === 'group') {
                const matchType = ruleItem.match;
                const results = ruleItem.items.map(child => this.evaluateSmartRules(song, child));
                if (results.length === 0) return true;
                return matchType === 'all' ? results.every(r => r) : results.some(r => r);
            } else if (ruleItem.type === 'filter') {
                const tag = ruleItem.tag;
                const op = ruleItem.op;
                const targetVal = ruleItem.val;
                const songVal = String(song[tag] || '').toLowerCase();
                
                if (['track', 'year', 'disc', 'bpm'].includes(tag)) {
                    const sNum = parseFloat(song[tag]) || 0;
                    if (op === 'range') {
                        const min = parseFloat(targetVal[0]) || 0;
                        const max = parseFloat(targetVal[1]) || 0;
                        return sNum >= min && sNum <= max;
                    }
                    const vNum = parseFloat(targetVal) || 0;
                    if (op === 'equals') return sNum === vNum;
                    if (op === 'not_equals') return sNum !== vNum;
                    if (op === 'greater') return sNum > vNum;
                    if (op === 'less') return sNum < vNum;
                    return false;
                }
                
                const targetStr = String(targetVal).toLowerCase();
                if (op === 'contains') return songVal.includes(targetStr);
                if (op === 'not_contains') return !songVal.includes(targetStr);
                if (op === 'equals') return songVal === targetStr;
                if (op === 'not_equals') return songVal !== targetStr;
                if (op === 'startswith') return songVal.startsWith(targetStr);
                if (op === 'endswith') return songVal.endsWith(targetStr);
            }
            return false;
        },

        filterData: function(query) {
            const q = query ? query.toLowerCase().trim() : "";
            const rows = document.querySelectorAll('#selectTableBody tr');
            
            rows.forEach((row, index) => {
                const item = this.libraryData[index];
                let matchText = true;
                
                if (q) {
                    matchText = (
                        (item.title && item.title.toLowerCase().includes(q)) ||
                        (item.artist && item.artist.toLowerCase().includes(q)) ||
                        (item.album && item.album.toLowerCase().includes(q))
                    );
                }
                
                let matchAdv = true;
                if (this.advancedConditions) {
                    matchAdv = this.evaluateSmartRules(item, this.advancedConditions);
                }

                row.style.display = (matchText && matchAdv) ? 'table-row' : 'none';
            });
            
            this.lastClickedIndex = null;
            this.updateHeaderCheckboxState();
        },

        sortData: function(field) {},

        // ★ 修正: 保存後に確実に再描画する
        save: async function() {
            const btn = document.getElementById('btnSaveSelect');
            const originalText = btn.textContent;
            btn.disabled = true; btn.textContent = "保存中...";
            
            try {
                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const newSongs = Array.from(this.selectedFilenames);
                const updatedPl = await invoke("update_playlist_by_id", { plId: this.currentPlaylistId, field: 'music', value: newSongs });
                if (updatedPl) {
                    if (s.currentPlaylistIndex !== -1 && s.playlists[s.currentPlaylistIndex].id === this.currentPlaylistId) {
                        await window.MainViewController.selectPlaylist(s.currentPlaylistIndex);
                    } else {
                        const idx = s.playlists.findIndex(p => p.id === this.currentPlaylistId);
                        if (idx !== -1) {
                            s.playlists[idx] = await invoke("get_playlist_details", { plId: this.currentPlaylistId });
                        }
                    }
                    window.PlayerUtils.showToast("プレイリストを更新しました", false);
                    this.close();
                }
            } catch (e) { 
                console.error(e);
                window.PlayerUtils.showToast("保存に失敗しました", true); 
            } finally { 
                btn.disabled = false; btn.textContent = originalText; 
            }
        }
    };
})();