window.SourceController = {
    sourceType: 'local',
    musicFile: null,
    fetchedVideoInfo: null,

    init: function() {
        const u = window.AddMusicUtils;
        const sourceRadios = document.getElementsByName('sourceType');
        const sourceLocalArea = document.getElementById('sourceLocalArea');
        const sourceDownloadArea = document.getElementById('sourceDownloadArea');

        sourceRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.sourceType = e.target.value;
                if (this.sourceType === 'local') {
                    sourceLocalArea.classList.add('active');
                    sourceDownloadArea.classList.remove('active');
                } else {
                    sourceLocalArea.classList.remove('active');
                    sourceDownloadArea.classList.add('active');
                }
                this.validateArtworkTab();
            });
        });

        const fileInput = document.getElementById('fileInput');
        const fileDropZone = document.getElementById('fileDropZone');

        if(fileInput) fileInput.addEventListener('change', (e) => this.handleMusic(e.target.files[0]));
        if(fileDropZone) u.setupDragAndDrop(fileDropZone, (file) => this.handleMusic(file));

        const urlInput = document.getElementById('videoUrl');
        const btnFetch = document.getElementById('btnFetchVideoInfo');
        const btnCancel = document.getElementById('btnCancelVideo');
        if(btnFetch) btnFetch.addEventListener('click', () => this.fetchVideo());
        if(btnCancel) btnCancel.addEventListener('click', () => this.cancelVideo());

        // ★ 音源動画ダウンロードURL入力欄でのEnterキー対応
        if (urlInput) {
            urlInput.addEventListener('keydown', (e) => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (btnFetch) btnFetch.click();
                }
            });
        }
    },

    validateArtworkTab: function() {
        if (!window.ArtworkController) return;
        const u = window.AddMusicUtils;
        const activeTab = window.ArtworkController.getActiveTab();

        if (this.sourceType === 'local' && activeTab === 'art-thumb1') {
            u.showAlert(window.i18n ? window.i18n.t('AddMusic.alert_reset_art_local') : "音源がローカルファイルに変更されたため、アルバムアートを「ローカル」にリセットしました。");
            this.resetToLocalArtworkTab();
        }
        if (this.sourceType === 'download' && activeTab === 'art-extract') {
            u.showAlert(window.i18n ? window.i18n.t('AddMusic.alert_reset_art_download') : "音源が動画ダウンロードに変更されたため、アルバムアートを「ローカル」にリセットしました。");
            this.resetToLocalArtworkTab();
        }
    },

    resetToLocalArtworkTab: function() {
        const localOpt = document.querySelector('#artMethodDropdown .custom-option[data-target="art-local"]');
        if (localOpt) localOpt.click();
    },

    handleMusic: function(file) {
        const u = window.AddMusicUtils;
        if (!file) return;
        const name = file.name.toLowerCase();
        
        if (!name.endsWith('.mp3') && !name.endsWith('.mp4')) {
            u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_music_format_error') : 'MP3またはMP4ファイルのみ対応しています', true);
            return;
        }
        
        this.musicFile = file;
        const display = document.getElementById('singleFileNameDisplay');
        if(display) {
            display.textContent = window.i18n ? window.i18n.t('AddMusic.label_selected_file', { name: file.name }) : `選択中: ${file.name}`;
            display.style.color = 'var(--primary-color)';
        }
    },

    reset: function() {
        this.musicFile = null;
        this.fetchedVideoInfo = null;
        this.cancelVideo(); 
        
        const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('singleFileNameDisplay');
        if(fileInput) fileInput.value = '';
        if(fileName) {
            fileName.textContent = window.i18n ? window.i18n.t('AddMusic.drop_music_main') : "MP3 / MP4 ファイルをドラッグ＆ドロップ";
            fileName.style.color = "var(--text-main)";
        }
        const radioLocal = document.querySelector('input[name="sourceType"][value="local"]');
        if(radioLocal) {
            radioLocal.checked = true;
            radioLocal.dispatchEvent(new Event('change'));
        }
    },

    fetchVideo: async function() {
        const u = window.AddMusicUtils;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const urlInput = document.getElementById('videoUrl');
        const btn = document.getElementById('btnFetchVideoInfo');
        const url = urlInput.value.trim();
        
        if (!url) { u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください", true); return; }

        const originalText = btn.textContent;
        btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
        btn.disabled = true;

        try {
            const status = await invoke("check_tools_status");
            if (!status['yt-dlp'] || !status['ffmpeg']) {
                u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_ext_needed') : "動画機能を利用するには拡張機能（yt-dlp, ffmpeg）が必要です", true);
                return;
            }

            const res = await invoke("fetch_video_info", { url: url });
            if (res.status === 'success') {
                this.fetchedVideoInfo = res;
                this.fetchedVideoInfo.url = url;
                this.updateVideoUI(res);

                if (window.ArtworkController) {
                    btn.textContent = window.i18n ? window.i18n.t('AddMusic.loading_processing_thumb') : "サムネイル処理中...";
                    await window.ArtworkController.preloadThumbnail(res.thumbnail);
                }
            } else {
                u.showToast((window.i18n ? window.i18n.t('AddMusic.msg_fetch_failed', { msg: res.message }) : "取得に失敗しました: " + res.message), true);
            }
        } catch (e) {
            console.error(e);
            u.showToast(window.i18n ? window.i18n.t('Common.error') : "エラーが発生しました", true);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    updateVideoUI: function(info) {
        const u = window.AddMusicUtils;
        document.getElementById('urlInputGroup').style.display = 'none';
        document.getElementById('videoInfoDisplay').style.display = 'block';
        document.getElementById('videoThumb').src = info.thumbnail;
        document.getElementById('videoDuration').textContent = u.formatDuration(info.duration);
        document.getElementById('videoTitleDisplay').textContent = info.title;
    },

    cancelVideo: function() {
        this.fetchedVideoInfo = null;
        const urlInput = document.getElementById('videoUrl');
        if(urlInput) urlInput.value = '';
        
        document.getElementById('urlInputGroup').style.display = 'block';
        document.getElementById('videoInfoDisplay').style.display = 'none';
        if (window.ArtworkController) window.ArtworkController.resetThumbnail();
    },

    getMusicFile: function() { return this.musicFile; },
    getVideoInfo: function() { return this.fetchedVideoInfo; },
    getSourceType: function() { return this.sourceType; }
};
