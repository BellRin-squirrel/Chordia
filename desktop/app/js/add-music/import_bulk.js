document.addEventListener('DOMContentLoaded', async () => {
    // Tauri環境外やブリッジ未読込時でもクラッシュしないように厳重に保護
    const tauri = window.__TAURI__;
    const invoke = (tauri && tauri.core) ? tauri.core.invoke : (tauri && tauri.tauri ? tauri.tauri.invoke : null);
    const listen = (tauri && tauri.event) ? tauri.event.listen : null;

    const u = {
        escapeHtml: (str) => str ? String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '',
        showToast: (m, e) => {
            const t = document.getElementById('toast');
            if (t) {
                t.textContent = m; t.className = 'toast show '+(e?'error':'success');
                setTimeout(()=>t.classList.remove('show'), 4000);
            }
        },
        showAlert: (t, m) => {
            const modal = document.getElementById('alertModal');
            const btnOk = document.getElementById('btnAlertOk');
            const titleEl = document.getElementById('alertTitle');
            const msgEl = document.getElementById('alertMessage');
            
            if (titleEl) titleEl.textContent = t;
            if (msgEl) msgEl.textContent = m;
            
            if (modal) {
                modal.style.display = 'flex'; 
                setTimeout(() => modal.classList.add('show'), 10);
            }
            if (btnOk && modal) {
                btnOk.onclick = () => {
                    modal.classList.remove('show');
                    setTimeout(() => modal.style.display = 'none', 300);
                };
            }
        }
    };

    const progressArea = document.getElementById('progressArea');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (listen) {
        listen('js_import_progress', (event) => {
            if (progressArea) progressArea.style.display = 'block';
            if (progressText) progressText.textContent = data.message;
            if (progressBar) progressBar.style.width = (data.current / data.total * 100) + '%';
        });
    }

    let scannedData = [];
    let importMode = 'list'; 
    let activeTags = [];
    let currentZipPassword = ""; 
    let currentEditIndex = -1;

    // 初期化時：タグ情報のフェッチ
    if (invoke) {
        try {
            const settings = await invoke("get_app_settings");
            const allTags = await invoke("get_available_tags");
            activeTags = allTags.filter(t => settings.active_tags.includes(t.key));
        } catch(e) { console.error(e); }
    }

    // タブ切り替え監視
    const tabs = document.querySelectorAll('.tab-menu-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            if (target === 'tab-jsoncsv') importMode = 'list';
            else if (target === 'tab-mp3zip') importMode = 'zip';
        });
    });

    function setupDragAndDrop(element, callback) {
        if (!element) return;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.add('dragover'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.remove('dragover'), false);
        });
        element.addEventListener('drop', e => {
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) callback(e.dataTransfer.files[0]);
        });
    }

    // --- TAB 3: リスト (JSON/CSV) インポート ---
    const dropArea = document.getElementById('dropArea');
    const fileInputImport = document.getElementById('fileInputImport');
    const btnScanImportList = document.getElementById('btnScanImportList');
    const importFileInfo = document.getElementById('importFileInfo');
    const importListResultSection = document.getElementById('importListResultSection');

    // ★ 修正：ファイル入力（クリック）時の無限バブリングイベントループを完全に防止するため、stopPropagation を強制
    if (dropArea && fileInputImport) {
        dropArea.onclick = () => fileInputImport.click();
        fileInputImport.onclick = (e) => e.stopPropagation();
        fileInputImport.onchange = (e) => handleListFile(e.target.files[0]);
    }
    setupDragAndDrop(dropArea, handleListFile);

    function handleListFile(file) {
        if (!file) return;
        const nameEl = document.getElementById('importFileName');
        if (nameEl) nameEl.textContent = file.name;
        if (dropArea) dropArea.style.display = 'none';
        if (importFileInfo) importFileInfo.style.display = 'flex';
        if (btnScanImportList) btnScanImportList.disabled = false;
        window._selectedImportFile = file;
    }

    const btnClearImportFile = document.getElementById('btnClearImportFile');
    if (btnClearImportFile) {
        btnClearImportFile.onclick = () => {
            if (fileInputImport) fileInputImport.value = '';
            window._selectedImportFile = null;
            if (importFileInfo) importFileInfo.style.display = 'none';
            if (dropArea) dropArea.style.display = 'block';
            if (btnScanImportList) btnScanImportList.disabled = true;
            if (importListResultSection) importListResultSection.style.display = 'none';
        };
    }

    if (btnScanImportList) {
        btnScanImportList.onclick = () => {
            const file = window._selectedImportFile;
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const ext = file.name.split('.').pop().toLowerCase();
                const res = await invoke("parse_list_import", { content: e.target.result, fileType: ext });
                if (res.status === 'success') {
                    scannedData = res.data;
                    renderTable('list');
                    if (importListResultSection) importListResultSection.style.display = 'block';
                } else { u.showAlert("エラー", res.message); }
            };
            reader.readAsText(file);
        };
    }

    const btnExecListImport = document.getElementById('btnExecListImport');
    if(btnExecListImport) btnExecListImport.onclick = () => handleFinalImportWithCheck('list');


    // --- TAB 4: ZIP インポート ---
    const dropAreaZip = document.getElementById('dropAreaZip');
    const fileInputZip = document.getElementById('fileInputZip');
    const zipFileInfo = document.getElementById('zipFileInfo');
    const zipFileName = document.getElementById('zipFileName');
    const btnClearZipFile = document.getElementById('btnClearZipFile');
    const btnScanZip = document.getElementById('btnScanZip');
    const zipResultSection = document.getElementById('zipResultSection');

    // ★ 修正：ファイル入力（クリック）時の無限バブリングイベントループを完全に防止するため、stopPropagation を強制
    if (dropAreaZip && fileInputZip) {
        dropAreaZip.onclick = () => fileInputZip.click();
        fileInputZip.onclick = (e) => e.stopPropagation();
        fileInputZip.onchange = (e) => handleZipFile(e.target.files[0]);
    }
    setupDragAndDrop(dropAreaZip, handleZipFile);

    function handleZipFile(file) {
        if (!file) return;
        if (zipFileName) zipFileName.textContent = file.name;
        if (dropAreaZip) dropAreaZip.style.display = 'none';
        if (zipFileInfo) zipFileInfo.style.display = 'flex';
        if (btnScanZip) btnScanZip.disabled = false;
        window._selectedZipFile = file;
        currentZipPassword = ""; 
    }

    if(btnClearZipFile) {
        btnClearZipFile.onclick = () => {
            if(fileInputZip) fileInputZip.value = '';
            window._selectedZipFile = null;
            currentZipPassword = "";
            if(zipFileInfo) zipFileInfo.style.display = 'none';
            if(dropAreaZip) dropAreaZip.style.display = 'block';
            if(btnScanZip) btnScanZip.disabled = true;
            if(zipResultSection) zipResultSection.style.display = 'none';
        };
    }

    if(btnScanZip) {
        btnScanZip.onclick = async () => {
            const file = window._selectedZipFile;
            if (!file) return;
            
            if (progressArea) progressArea.style.display = 'block';
            if (progressText) progressText.textContent = "ZIPファイルをスキャン中...";
            
            try {
                const base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result.split(',')[1]);
                    reader.readAsDataURL(file);
                });
                
                const res = await invoke("scan_zip_import", { zipDataB64: base64Data, password: null });
                
                if (res.status === 'password_required') {
                    if (progressArea) progressArea.style.display = 'none';
                    document.getElementById('zipPassword').value = '';
                    const pModal = document.getElementById('passwordModal');
                    pModal.style.display = 'flex';
                    setTimeout(() => pModal.classList.add('show'), 10);
                } else if (res.status === 'success') {
                    scannedData = res.data;
                    renderTable('zip');
                    if(zipResultSection) zipResultSection.style.display = 'block';
                } else {
                    u.showAlert("エラー", res.message || "スキャンに失敗しました");
                }
            } catch(err) {
                u.showAlert("エラー", "ZIP解析中にエラーが発生しました: " + err);
            } finally {
                // ★ 修正：パスワード入力モーダルが実際にアクティブ（クラスに show がある）かでプログレスの非表示判定を行う
                const pModal = document.getElementById('passwordModal');
                const isPassVisible = pModal && pModal.classList.contains('show');
                if (progressArea && !isPassVisible) {
                    progressArea.style.display = 'none';
                }
            }
        };
    }

    document.getElementById('btnCancelPass').onclick = () => {
        const pModal = document.getElementById('passwordModal');
        pModal.classList.remove('show');
        setTimeout(() => pModal.style.display = 'none', 300);
    };

    document.getElementById('btnSubmitPass').onclick = async () => {
        const passVal = document.getElementById('zipPassword').value;
        if (passVal.length > 128) {
            u.showToast("パスワードは128文字以内にしてください", true);
            return;
        }
        currentZipPassword = passVal;

        const pModal = document.getElementById('passwordModal');
        pModal.classList.remove('show');
        setTimeout(() => pModal.style.display = 'none', 300);

        const file = window._selectedZipFile;
        if (progressArea) {
            progressArea.style.display = 'block';
            progressText.textContent = "ZIPファイルを解析中...";
        }
        
        try {
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            const res = await invoke("scan_zip_import", { zipDataB64: base64Data, password: currentZipPassword });
            if (res.status === 'success') {
                scannedData = res.data;
                renderTable('zip');
                if(zipResultSection) zipResultSection.style.display = 'block';
            } else {
                u.showAlert("エラー", res.message);
            }
        } catch(err) {
            u.showAlert("エラー", "ZIP解析中にエラーが発生しました: " + err);
        } finally {
            if (progressArea) progressArea.style.display = 'none';
        }
    };

    const btnExecZipImport = document.getElementById('btnExecZipImport');
    if(btnExecZipImport) btnExecZipImport.onclick = () => handleFinalImportWithCheck('zip');


    // 重複確認と本登録
    async function handleFinalImportWithCheck(type) {
        let validItems = [];
        let addedSignatures = new Set();
        
        for (let i = 0; i < scannedData.length; i++) {
            const item = scannedData[i];
            const title = (item.title || "").trim();
            const artist = (item.artist || "").trim();
            const sig = `${title.toLowerCase()}|${artist.toLowerCase()}`;
            
            let isExistingDup = false;
            let isPlaylistDup = false;

            if (title && artist) {
                const duplicates = await invoke("check_duplicate_songs", { title, artist });
                if (duplicates.length > 0) isExistingDup = true;
            }
            
            if (!isExistingDup && addedSignatures.has(sig)) {
                isPlaylistDup = true;
            }

            if (isExistingDup || isPlaylistDup) {
                const action = await showImportDuplicatePrompt(item, isExistingDup);
                if (action === 'cancel') {
                    return; 
                } else if (action === 'skip') {
                    continue; 
                }
            }

            addedSignatures.add(sig);
            validItems.push(item);
        }

        if (validItems.length === 0) {
            u.showToast("インポートする楽曲がありません", true);
            return;
        }

        executeRegistration(type, validItems);
    }

    function showImportDuplicatePrompt(item, isExisting) {
        return new Promise((resolve) => {
            const modal = document.getElementById('importDuplicateModal');
            const msgEl = document.getElementById('importDupMessage');
            const manageBtnArea = document.getElementById('importDupManageBtnArea');
            const btnManage = document.getElementById('btnImportDupManage');
            const btnCancel = document.getElementById('btnImportDupCancel');
            const btnSkip = document.getElementById('btnImportDupSkip');
            const btnContinue = document.getElementById('btnImportDupContinue');

            const title = u.escapeHtml(item.title);
            const artist = u.escapeHtml(item.artist);

            if (isExisting) {
                msgEl.innerHTML = `「${title}」（${artist}）の楽曲はすでに追加されています。`;
                if (manageBtnArea) manageBtnArea.style.display = 'block';
                if (btnManage) {
                    btnManage.onclick = async () => {
                        const label = `manage_window_${Date.now()}`;
                        const targetUrl = new URL(`manage.html?mode=window&adv_title=${encodeURIComponent(item.title)}&adv_artist=${encodeURIComponent(item.artist)}`, window.location.href).href;
                        await invoke("open_new_window", {
                            label: label,
                            url: targetUrl,
                            title: "データベース管理 - Chordia",
                            width: 1200.0,
                            height: 900.0
                        });
                    };
                }
            } else {
                msgEl.innerHTML = `「${title}」（${artist}）の楽曲はインポートの項目内で重複しています。`;
                if (manageBtnArea) manageBtnArea.style.display = 'none';
            }

            const cleanup = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.style.display = 'none', 300);
                if(btnManage) btnManage.onclick = null;
                btnCancel.onclick = null;
                btnSkip.onclick = null;
                btnContinue.onclick = null;
            };

            btnCancel.onclick = () => { cleanup(); resolve('cancel'); };
            btnSkip.onclick = () => { cleanup(); resolve('skip'); };
            btnContinue.onclick = () => { cleanup(); resolve('continue'); };

            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        });
    }

    async function executeRegistration(type, dataList) {
        if (progressArea) progressArea.style.display = 'block';
        if (progressText) progressText.textContent = "ライブラリへ登録中...";
        
        let res;
        if (type === 'list') {
            res = await invoke("execute_final_list_import", { importDataList: dataList });
        } else if (type === 'zip') {
            const file = window._selectedZipFile;
            const b64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            res = await invoke("execute_zip_import", { zipDataB64: b64, importDataList: dataList, password: currentZipPassword });
        }
        
        if (progressArea) progressArea.style.display = 'none';
        if (res && res.status === 'success') {
            u.showAlert("完了", `${res.count}曲の登録が完了しました。`);
            if (type === 'list') {
                const btnClearImportFile = document.getElementById('btnClearImportFile');
                if(btnClearImportFile) btnClearImportFile.click();
            } else {
                if(btnClearZipFile) btnClearZipFile.click();
            }
        } else {
            u.showAlert("エラー", res ? res.message : "不明なエラーが発生しました");
        }
    }

    function renderTable(type) {
        const thead = document.getElementById(type === 'list' ? 'importListTableHeader' : 'mp3TableHeader');
        const tbody = document.getElementById(type === 'list' ? 'importListTableBody' : 'mp3TableBody');
        if(!thead || !tbody) return;
        
        let h = `<tr><th>No.</th><th>アート</th><th>タイトル *</th><th>アーティスト *</th>`;
        activeTags.forEach(t => { if(t.key !== 'title' && t.key !== 'artist') h += `<th>${t.label}</th>`; });
        h += `<th>パス / ファイル名</th><th>操作</th></tr>`; 
        thead.innerHTML = h;

        tbody.innerHTML = '';
        scannedData.forEach((item, idx) => {
            const tr = document.createElement('tr');
            const pathName = item.musicFilename || item.relPath || '';
            const artSrc = item.artworkBase64 || item.imageData || 'icon/Chordia.png';
            
            let row = `<td>${idx + 1}</td>
                <td class="col-art-thumb"><img id="import-art-${idx}" src="${artSrc}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></td>
                <td><input type="text" class="smart-input" value="${u.escapeHtml(item.title || '')}" onchange="window.updateImportData(${idx}, 'title', this.value)"></td>
                <td><input type="text" class="smart-input" value="${u.escapeHtml(item.artist || '')}" onchange="window.updateImportData(${idx}, 'artist', this.value)"></td>`;
            
            activeTags.forEach(t => { 
                if(t.key !== 'title' && t.key !== 'artist') {
                    row += `<td><input type="text" class="smart-input" value="${u.escapeHtml(item[t.key]||'')}" onchange="window.updateImportData(${idx}, '${t.key}', this.value)"></td>`; 
                }
            });
            
            row += `<td style="word-break: break-all; white-space: normal;" title="${u.escapeHtml(pathName)}">${u.escapeHtml(pathName)}</td>
                <td class="col-action">
                    <button class="btn-icon-action" onclick="window.openImportLyricModal(${idx})" title="歌詞を編集"><svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                    <button class="btn-icon-action" onclick="window.openImportArtModal(${idx})" title="アートワークを変更"><svg style="width:20px;height:20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></button>
                    <button class="btn-del-row" onclick="window.deleteImportRow(${idx}, '${type}')">削除</button>
                </td>`;
            tr.innerHTML = row;
            tbody.appendChild(tr);
        });
    }

    window.updateImportData = (idx, key, val) => {
        if (scannedData[idx]) scannedData[idx][key] = val;
    };

    window.deleteImportRow = (idx, type) => {
        if (confirm("この楽曲をインポートリストから除外しますか？")) {
            scannedData.splice(idx, 1);
            renderTable(type);
        }
    };

    window.openImportLyricModal = (idx) => {
        currentEditIndex = idx;
        const item = scannedData[idx];
        const modal = document.getElementById('importLyricModal');
        document.getElementById('importLyricTextArea').value = item.lyric || "";
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    };

    document.getElementById('btnSaveImportLyric').onclick = () => {
        if (scannedData[currentEditIndex]) {
            scannedData[currentEditIndex].lyric = document.getElementById('importLyricTextArea').value;
        }
        const modal = document.getElementById('importLyricModal');
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
        u.showToast("反映しました", false);
    };

    document.getElementById('btnCancelImportLyric').onclick = () => {
        const modal = document.getElementById('importLyricModal');
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    };

    window.openImportArtModal = (idx) => {
        currentEditIndex = idx;
        const item = scannedData[idx];
        const artPreview = document.getElementById('currentImportArtPreview');
        artPreview.src = item.artworkBase64 || item.imageData || 'icon/Chordia.png';
        
        document.getElementById('importMiniVideoUrl').value = '';
        document.getElementById('importMiniImageUrl').value = '';
        document.getElementById('importArtStatusText').textContent = "現在の画像";
        
        const errEl = document.getElementById('importArtErrorDisplay');
        if (errEl) errEl.style.display = 'none';

        const defaultTab = document.querySelector('#importArtTabsMini .art-mini-tab-btn[data-target="import-art-mini-local"]');
        if (defaultTab) defaultTab.click();

        const modal = document.getElementById('importArtModal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    };

    const importArtMiniTabs = document.querySelectorAll('#importArtTabsMini .art-mini-tab-btn');
    importArtMiniTabs.forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.target;
            importArtMiniTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#importArtModal .art-mini-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetContent = document.getElementById(target);
            if (targetContent) targetContent.classList.add('active');
            showImportArtError("");
        };
    });

    const artPreview = document.getElementById('currentImportArtPreview');
    document.getElementById('newImportArtInput').onchange = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            artPreview.src = ev.target.result;
            document.getElementById('importArtStatusText').textContent = "新しい画像 (反映前)";
            showImportArtError("");
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('btnFetchImportVideoArt').onclick = async () => {
        const url = document.getElementById('importMiniVideoUrl').value.trim();
        showImportArtError("");
        if (!url) { showImportArtError("URLを入力してください"); return; }

        const btn = document.getElementById('btnFetchImportVideoArt');
        const orgText = btn.textContent;
        btn.disabled = true; btn.textContent = "確認中...";

        try {
            const status = await invoke("check_tools_status");
            if (!status['yt-dlp'] || !status['ffmpeg']) {
                showImportArtError("拡張機能が不足しています");
                return;
            }

            btn.textContent = "取得中...";
            const info = await invoke("fetch_video_info", { url: url });
            if (info.status === 'success' && info.thumbnail) {
                btn.textContent = "画像を変換中...";
                const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                if (b64) {
                    artPreview.src = b64;
                    document.getElementById('importArtStatusText').textContent = "動画サムネイル (反映前)";
                    u.showToast("サムネイルを取得しました");
                } else { showImportArtError("画像加工に失敗しました"); }
            } else { showImportArtError(info.message || "取得失敗"); }
        } catch(e) { showImportArtError("通信エラー"); }
        finally { btn.disabled = false; btn.textContent = orgText; }
    };

    document.getElementById('btnFetchImportDirectArt').onclick = async () => {
        const url = document.getElementById('importMiniImageUrl').value.trim();
        showImportArtError("");
        if (!url) { showImportArtError("URLを入力してください"); return; }

        const btn = document.getElementById('btnFetchImportDirectArt');
        const orgText = btn.textContent;
        btn.disabled = true; btn.textContent = "取得中...";

        try {
            const res = await invoke("fetch_and_crop_image_url", { url: url });
            if (res.status === 'success') {
                artPreview.src = res.data;
                document.getElementById('importArtStatusText').textContent = "画像URL (反映前)";
                u.showToast("画像を取得しました");
            } else { showImportArtError("取得失敗: " + res.message); }
        } catch(e) { showImportArtError("エラー"); }
        finally { btn.disabled = false; btn.textContent = orgText; }
    };

    document.getElementById('btnExecImportRemoveArt').onclick = () => {
        artPreview.src = "REMOVE";
        document.getElementById('importArtStatusText').textContent = "削除予定 (反映前)";
        showImportArtError("");
    };

    document.getElementById('btnCancelImportArt').onclick = () => {
        const modal = document.getElementById('importArtModal');
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    };

    const btnCloseImportArtModalX = document.getElementById('btnCloseImportArtModalX');
    if (btnCloseImportArtModalX) {
        btnCloseImportArtModalX.onclick = () => {
            const modal = document.getElementById('importArtModal');
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            }
        };
    }

    const btnAutoImportLyric = document.getElementById('btnAutoImportLyric');
    if (btnAutoImportLyric) {
        btnAutoImportLyric.onclick = async () => {
            const item = scannedData[currentEditIndex];
            if (!item || !item.title || !item.artist) {
                u.showToast("タイトルとアーティストが必要です", true);
                return;
            }
            const orgText = btnAutoImportLyric.textContent;
            btnAutoImportLyric.textContent = "検索中...";
            btnAutoImportLyric.disabled = true;

            try {
                const data = await invoke("search_lyrics_online", { title: item.title, artist: item.artist });

                if (data.statusCode === 404 || data.error) {
                    u.showToast("見つかりませんでした", true);
                    return;
                }

                if (!Array.isArray(data) || data.length === 0) {
                    u.showToast("見つかりませんでした", true);
                    return;
                }

                const filtered = data.filter(d => d.plainLyrics);
                if (filtered.length > 0) {
                    const list = document.getElementById('importLyricResultList');
                    list.innerHTML = '';
                    filtered.forEach(d => {
                        const li = document.createElement('li');
                        li.style.padding = '10px'; li.style.cursor = 'pointer'; li.style.borderBottom = '1px solid rgba(128,128,128,0.2)';
                        li.innerHTML = `<strong>${u.escapeHtml(d.trackName)}</strong><br><small>${u.escapeHtml(d.artistName)}</small>`;
                        li.onclick = () => {
                            document.getElementById('importLyricTextArea').value = d.plainLyrics;
                            document.getElementById('importLyricSearchModal').classList.remove('show');
                            setTimeout(() => { document.getElementById('importLyricSearchModal').style.display = 'none'; }, 300); 
                        };
                        list.appendChild(li);
                    });
                    document.getElementById('importLyricSearchModal').style.display = 'flex'; 
                    setTimeout(() => document.getElementById('importLyricSearchModal').classList.add('show'), 10);
                } else {
                    u.showToast("見つかりませんでした", true);
                }
            } catch (e) {
                u.showToast("通信エラーが発生しました", true);
            } finally {
                btnAutoImportLyric.textContent = orgText;
                btnAutoImportLyric.disabled = false;
            }
        };
    }

    const btnCloseImportSearch = document.getElementById('btnCloseImportSearch');
    if (btnCloseImportSearch) {
        btnCloseImportSearch.onclick = () => {
            const modal = document.getElementById('importLyricSearchModal');
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            }
        };
    }
});