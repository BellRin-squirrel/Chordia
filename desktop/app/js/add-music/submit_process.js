window.SubmitController = {
    init: function() {
        const form = document.getElementById('addMusicForm');
        if(form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                if (window.DuplicateController && window.DuplicateController.hasDuplicates()) {
                    const confirmModal = document.getElementById('confirmDuplicateModal');
                    if(confirmModal) {
                        confirmModal.style.display = 'flex';
                        setTimeout(() => confirmModal.classList.add('show'), 10);
                    }
                    return;
                }
                await this.startAddProcess();
            };
        }

        const btnCancelDupAdd = document.getElementById('btnCancelDupAdd');
        if(btnCancelDupAdd) {
            btnCancelDupAdd.onclick = () => {
                const modal = document.getElementById('confirmDuplicateModal');
                if(modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.style.display = 'none', 300);
                }
            };
        }

        const btnConfirmDupAdd = document.getElementById('btnConfirmDupAdd');
        if(btnConfirmDupAdd) {
            btnConfirmDupAdd.onclick = async () => {
                const modal = document.getElementById('confirmDuplicateModal');
                if(modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.style.display = 'none', 300);
                }
                await this.startAddProcess();
            };
        }
    },

    showLoading: function(msg) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        if(loadingText) loadingText.textContent = msg;
        if(loadingOverlay) loadingOverlay.style.display = 'flex';
    },

    hideLoading: function() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if(loadingOverlay) loadingOverlay.style.display = 'none';
    },

    startAddProcess: async function() {
        const u = window.AddMusicUtils;
        const sCtrl = window.SourceController;
        const aCtrl = window.ArtworkController;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

        const sourceType = sCtrl.getSourceType();
        let musicFile = null;
        let videoInfo = null;

        const metaData = {};
        const activeTagsKeys = window.TagsController ? window.TagsController.getActiveTagsKeys() :[];
        activeTagsKeys.forEach(key => {
            const el = document.getElementById(`tag_${key}`);
            if (el) metaData[key] = el.value.trim();
        });
        
        const lyricEl = document.getElementById('lyric');
        metaData.lyric = lyricEl ? lyricEl.value.trim() : "";
        metaData.artwork_data = aCtrl.getArtworkData(); 
        metaData.artwork_type = aCtrl.getActiveTab(); 

        const btnSubmit = document.getElementById('btnSubmitAll');
        if(btnSubmit) btnSubmit.disabled = true;

        try {
            let result = false;
            if (sourceType === 'local') {
                musicFile = sCtrl.getMusicFile();
                if (!musicFile) { u.showAlert("音源となるファイルを選択してください"); return; }
                this.showLoading("ファイルの読み込み中...");
                const b64Music = await u.readFileAsBase64(musicFile);
                metaData.music_data = b64Music;
                metaData.music_name = musicFile.name;
                this.showLoading("ライブラリへ保存中...");
                result = await invoke("save_music_data", { data: metaData });
            } else if (sourceType === 'download') {
                videoInfo = sCtrl.getVideoInfo();
                if (!videoInfo) { u.showAlert("動画情報を取得してください"); return; }
                this.showLoading("動画をダウンロード中...");
                metaData.video_url = videoInfo.url;
                // ★ Rustのダウンロード関数を呼び出す
                result = await invoke("download_and_save_music", { data: metaData });
            }

            this.hideLoading();
            if (result) {
                u.showAlert("楽曲をライブラリに追加しました！");
                document.getElementById('addMusicForm').reset();
                sCtrl.reset();
                aCtrl.resetLocal();
                if(lyricEl) lyricEl.value = '';
                if(window.DuplicateController) window.DuplicateController.reset();
            } else {
                u.showAlert("保存に失敗しました。");
            }
        } catch (error) {
            this.hideLoading();
            console.error("Add Process Error:", error);
            u.showAlert("エラーが発生しました。\n" + error);
        } finally {
            if(btnSubmit) btnSubmit.disabled = false;
        }
    }
};