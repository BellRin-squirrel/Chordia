window.ArtworkController = {
    artworkDataLocal: null,
    artworkDataExtracted: null,
    artworkDataThumb1: null,
    artworkDataThumb2: null,
    artworkDataUrl: null,
    activeTab: 'art-local',
    defaultIconBase64: null,

    init: async function() {
        const u = window.AddMusicUtils;
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

        try {
            this.defaultIconBase64 = await invoke("get_default_art_url");
        } catch(e) { console.error("Default icon load failed"); }

        const trigger = document.getElementById('artMethodTrigger');
        const dropdown = document.getElementById('artMethodDropdown');
        const options = document.querySelectorAll('#artMethodDropdown .custom-option');
        const displayVal = document.getElementById('artMethodValue');
        const contents = document.querySelectorAll('.art-tab-content');

        if (trigger && dropdown) {
            trigger.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            };

            options.forEach(opt => {
                opt.onclick = (e) => {
                    e.stopPropagation();
                    const target = opt.dataset.target;
                    const label = opt.querySelector('span').textContent;
                    const srcCtrl = window.SourceController;

                    if (target === 'art-thumb1') {
                        if (!srcCtrl || srcCtrl.getSourceType() !== 'download' || !srcCtrl.getVideoInfo()) {
                            u.showAlert("動画情報を取得していないため、元のサムネイルは利用できません。\n音源の設定で「動画ダウンロード」を選択し、URLから情報を取得してください。");
                            dropdown.classList.remove('show'); return;
                        }
                    }
                    if (target === 'art-extract') {
                        if (!srcCtrl || srcCtrl.getSourceType() !== 'local' || !srcCtrl.getMusicFile()) {
                            u.showAlert("ローカル音源ファイルが選択されていないため、抽出機能は利用できません。\n音源の設定でMP3/MP4ファイルをアップロードしてください。");
                            dropdown.classList.remove('show'); return;
                        }
                    }

                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    displayVal.textContent = label;
                    this.activeTab = target;

                    contents.forEach(c => c.classList.remove('active'));
                    const targetPane = document.getElementById(target);
                    if (targetPane) targetPane.classList.add('active');

                    dropdown.classList.remove('show');
                };
            });

            document.addEventListener('click', () => dropdown.classList.remove('show'));
        }

        const input = document.getElementById('artworkInput');
        const dropZone = document.getElementById('artworkDropZone');
        const removeBtn = document.getElementById('removeArtwork');
        if(input) input.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
        if(dropZone) u.setupDragAndDrop(dropZone, (file) => this.handleFile(file));
        if(removeBtn) removeBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            this.resetLocal();
        });

        const btnExtract = document.getElementById('btnExtractArtwork');
        if (btnExtract) {
            btnExtract.addEventListener('click', async () => {
                const srcCtrl = window.SourceController;
                const musicFile = srcCtrl.getMusicFile();
                if (!musicFile) { u.showToast("音源ファイルがありません", true); return; }
                
                btnExtract.disabled = true; btnExtract.textContent = "抽出中...";
                
                try {
                    const b64Music = await u.readFileAsBase64(musicFile);
                    const b64Img = await invoke("extract_artwork_from_local_file", { b64Music: b64Music });
                    
                    const imgEl = document.getElementById('extractPreview');
                    imgEl.style.display = 'block';
                    
                    if (b64Img) {
                        this.artworkDataExtracted = b64Img;
                        imgEl.src = b64Img;
                        u.showToast("アートワークを抽出しました", false);
                    } else {
                        this.artworkDataExtracted = this.defaultIconBase64;
                        imgEl.src = this.defaultIconBase64 || 'icon/Chordia.png';
                        u.showToast("アートワークが見つかりませんでした", false);
                    }
                } catch (e) {
                    u.showToast("抽出エラー", true);
                } finally {
                    btnExtract.disabled = false; btnExtract.textContent = "抽出を実行";
                }
            });
        }

        const btnDownloadOrigThumb = document.getElementById('btnDownloadOrigThumb');
        if (btnDownloadOrigThumb) {
            btnDownloadOrigThumb.addEventListener('click', async () => {
                const srcCtrl = window.SourceController;
                const info = srcCtrl.getVideoInfo();
                if (!info || !info.thumbnail) { u.showToast("サムネイルがありません", true); return; }
                
                btnDownloadOrigThumb.disabled = true; btnDownloadOrigThumb.textContent = "保存先を選択中...";
                try {
                    const result = await invoke("download_original_thumbnail", { url: info.thumbnail });
                    if (result.status === 'success') u.showToast(result.message, false);
                    else u.showToast(result.message, true);
                } catch (e) { u.showToast("エラーが発生しました", true); } 
                finally { btnDownloadOrigThumb.disabled = false; btnDownloadOrigThumb.textContent = "オリジナル画像を保存"; }
            });
        }

        const btnFetchAltThumb = document.getElementById('btnFetchAltThumb');
        if (btnFetchAltThumb) {
            btnFetchAltThumb.addEventListener('click', async () => {
                const url = document.getElementById('altVideoUrl').value.trim();
                if (!url) { u.showToast("URLを入力してください", true); return; }
                
                btnFetchAltThumb.disabled = true; btnFetchAltThumb.textContent = "取得中...";
                try {
                    const info = await invoke("fetch_video_info", { url: url });
                    if (info.status === 'success' && info.thumbnail) {
                        const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                        if (b64) {
                            this.artworkDataThumb2 = b64;
                            const imgEl = document.getElementById('thumb2Preview');
                            imgEl.src = b64; imgEl.style.display = 'block';
                            u.showToast("取得しました", false);
                        } else { u.showToast("画像変換に失敗しました", true); }
                    } else { u.showAlert(info.message || "取得失敗"); }
                } catch(e) { u.showToast("通信エラー", true); } 
                finally { btnFetchAltThumb.disabled = false; btnFetchAltThumb.textContent = "サムネイルを取得"; }
            });
        }

        const btnPreviewImageUrl = document.getElementById('btnPreviewImageUrl');
        if (btnPreviewImageUrl) {
            btnPreviewImageUrl.addEventListener('click', async () => {
                const url = document.getElementById('imageUrl').value.trim();
                if (!url) { u.showToast("URLを入力してください", true); return; }
                
                btnPreviewImageUrl.disabled = true; btnPreviewImageUrl.textContent = "取得中...";
                try {
                    const res = await invoke("fetch_and_crop_image_url", { url: url });
                    if (res.status === 'success') {
                        this.artworkDataUrl = res.data;
                        const imgEl = document.getElementById('urlPreview');
                        imgEl.src = res.data; imgEl.style.display = 'block';
                        u.showToast("取得しました", false);
                    } else { u.showAlert(res.message); }
                } catch(e) { u.showToast("エラー", true); }
                finally { btnPreviewImageUrl.disabled = false; btnPreviewImageUrl.textContent = "画像をプレビュー"; }
            });
        }
    },

    handleFile: function(file) {
        const u = window.AddMusicUtils;
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            u.showToast('画像ファイルを選択してください', true);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('artworkPreview');
            const removeBtn = document.getElementById('removeArtwork');
            if(preview) { preview.src = e.target.result; preview.style.display = 'block'; }
            if(removeBtn) removeBtn.style.display = 'block';
            this.artworkDataLocal = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    resetLocal: function() {
        const preview = document.getElementById('artworkPreview');
        const removeBtn = document.getElementById('removeArtwork');
        const input = document.getElementById('artworkInput');
        if(preview) { preview.src = ''; preview.style.display = 'none'; }
        if(removeBtn) removeBtn.style.display = 'none';
        if(input) input.value = '';
        this.artworkDataLocal = null;
    },

    preloadThumbnail: async function(url) {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        try {
            const b64 = await invoke("fetch_and_crop_thumbnail", { url: url });
            if (b64) {
                this.artworkDataThumb1 = b64;
                const previewImg = document.getElementById('thumb1Preview');
                const container = document.getElementById('thumb1PreviewContainer');
                if (previewImg && container) {
                    previewImg.src = b64;
                    container.style.display = 'flex';
                }
            }
        } catch (e) { console.error("Thumb crop error", e); }
    },

    resetThumbnail: function() {
        this.artworkDataThumb1 = null;
        const previewImg = document.getElementById('thumb1Preview');
        const container = document.getElementById('thumb1PreviewContainer');
        if (previewImg) previewImg.src = '';
        if (container) container.style.display = 'none';
        
        if (this.activeTab === 'art-thumb1') {
            const localOpt = document.querySelector('#artMethodDropdown .custom-option[data-target="art-local"]');
            if (localOpt) localOpt.click();
        }
    },

    getArtworkData: function() {
        switch(this.activeTab) {
            case 'art-local': return this.artworkDataLocal || this.defaultIconBase64;
            case 'art-extract': return this.artworkDataExtracted || this.defaultIconBase64;
            case 'art-thumb1': return this.artworkDataThumb1 || this.defaultIconBase64;
            case 'art-thumb2': return this.artworkDataThumb2 || this.defaultIconBase64;
            case 'art-url': return this.artworkDataUrl || this.defaultIconBase64;
            case 'art-none': return this.defaultIconBase64;
            default: return this.defaultIconBase64;
        }
    },
    
    getActiveTab: function() { return this.activeTab; }
};