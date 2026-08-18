document.addEventListener('DOMContentLoaded', async () => {
    const tauri = window.__TAURI__;
    const invoke = (tauri && tauri.core) ? tauri.core.invoke : (tauri && tauri.tauri ? tauri.tauri.invoke : null);
    const listen = (tauri && tauri.event) ? tauri.event.listen : null;
    const convertFileSrc = (tauri && tauri.core) ? tauri.core.convertFileSrc : (tauri && tauri.tauri ? tauri.tauri.convertFileSrc : null);

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

        listen("tauri://drag-drop", async (event) => {
            const payload = event.payload;
            if (payload && payload.paths && payload.paths.length > 0) {
                const filePath = payload.paths[0];
                const fileName = filePath.split(/[\\/]/).pop();
                
                const activeTabBtn = document.querySelector('.tab-menu .tab-btn.active');
                const activeTarget = activeTabBtn ? activeTabBtn.dataset.target : '';

                if (activeTarget === 'tab-mp3zip' || importMode === 'zip') {
                    if (fileName.toLowerCase().endsWith('.zip')) {
                        if (convertFileSrc) {
                            try {
                                const response = await fetch(convertFileSrc(filePath));
                                const blob = await response.blob();
                                const file = new File([blob], fileName, { type: 'application/zip' });
                                handleZipFile(file);
                            } catch(e) {
                                console.error("Native drop file fetch failed:", e);
                            }
                        }
                    } else {
                        u.showToast(window.i18n ? window.i18n.t('Migration.toast_zip_required') : "ZIP形式 (.zip) のファイルを選択してください", true);
                    }
                } else if (activeTarget === 'tab-jsoncsv' || importMode === 'list') {
                    if (fileName.toLowerCase().endsWith('.json') || fileName.toLowerCase().endsWith('.csv')) {
                        const mime = fileName.toLowerCase().endsWith('.json') ? 'application/json' : 'text/csv';
                        if (convertFileSrc) {
                            try {
                                const response = await fetch(convertFileSrc(filePath));
                                const blob = await response.blob();
                                const file = new File([blob], fileName, { type: mime });
                                handleListFile(file);
                            } catch(e) {
                                console.error("Native drop load failed:", e);
                            }
                        }
                    }
                }
            }
        });
    }

    let scannedData = [];
    let importMode = 'list'; 
    let activeTags = [];
    let currentZipPassword = ""; 
    let currentEditIndex = -1;

    if (invoke) {
        try {
            const settings = await invoke("get_app_settings");
            const allTags = await invoke("get_available_tags");
            activeTags = allTags.filter(t => settings.active_tags.includes(t.key));
        } catch(e) { console.error(e); }
    }

    const tabs = document.querySelectorAll('.tab-menu-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            if (target === 'tab-jsoncsv') importMode = 'list';
            else if (target === 'tab-mp3zip') importMode = 'zip';
        });
    });

    window.addEventListener('dragover', (e) => e.preventDefault(), false);
    window.addEventListener('drop', (e) => e.preventDefault(), false);

    function setupDragAndDrop(element, callback) {
        if (!element) return;
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, e => { 
                e.preventDefault(); 
                e.stopPropagation(); 
            }, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.add('dragover'), false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            element.addEventListener(eventName, () => element.classList.remove('dragover'), false);
        });
        element.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                callback(e.dataTransfer.files[0]);
            }
        }, false);
    }

    // --- TAB 3: リスト (JSON/CSV) インポート ---
    const dropArea = document.getElementById('dropArea');
    const fileInputImport = document.getElementById('fileInputImport');
    const btnScanImportList = document.getElementById('btnScanImportList');
    const importFileInfo = document.getElementById('importFileInfo');
    const importListResultSection = document.getElementById('importListResultSection');

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
                } else { 
                    u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", res.message); 
                }
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

    if (dropAreaZip && fileInputZip) {
        dropAreaZip.onclick = () => fileInputZip.click();
        fileInputZip.onclick = (e) => e.stopPropagation();
        fileInputZip.onchange = (e) => handleZipFile(e.target.files[0]);
    }
    setupDragAndDrop(dropAreaZip, handleZipFile);

    function handleZipFile(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.zip')) {
            u.showToast(window.i18n ? window.i18n.t('Migration.toast_zip_required') : "ZIP形式 (.zip) のファイルを選択してください", true);
            return;
        }
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

            const zipScanSection = document.getElementById('zipScanSection');
            if (zipScanSection) zipScanSection.style.display = 'block';
        };
    }

    if(btnScanZip) {
        btnScanZip.onclick = async () => {
            const file = window._selectedZipFile;
            if (!file) return;

            const zipScanSection = document.getElementById('zipScanSection');
            if (zipScanSection) zipScanSection.style.display = 'none';
            
            if (progressArea) progressArea.style.display = 'block';
            if (progressText) progressText.textContent = window.i18n ? window.i18n.t('AddMusic.progress_scanning_zip') : "ZIPファイルをスキャン中...";
            
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

                    if (zipScanSection) zipScanSection.style.display = 'none';
                } else {
                    if (zipScanSection) zipScanSection.style.display = 'block';
                    u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", res.message || (window.i18n ? window.i18n.t('Common.error') : "スキャンに失敗しました"));
                }
            } catch(err) {
                if (zipScanSection) zipScanSection.style.display = 'block';
                u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", "ZIP解析中にエラーが発生しました: " + err);
            } finally {
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

        const zipScanSection = document.getElementById('zipScanSection');
        if (zipScanSection) zipScanSection.style.display = 'block';
    };

    document.getElementById('btnSubmitPass').onclick = async () => {
        const passVal = document.getElementById('zipPassword').value;
        if (passVal.length > 128) {
            u.showToast(window.i18n ? window.i18n.t('Migration.toast_pass_too_long') : "パスワードは128文字以内にしてください", true);
            return;
        }
        currentZipPassword = passVal;

        const pModal = document.getElementById('passwordModal');
        pModal.classList.remove('show');
        setTimeout(() => pModal.style.display = 'none', 300);

        const file = window._selectedZipFile;
        if (progressArea) {
            progressArea.style.display = 'block';
            progressText.textContent = window.i18n ? window.i18n.t('AddMusic.progress_analyzing_zip') : "ZIPファイルを解析中...";
        }

        const zipScanSection = document.getElementById('zipScanSection');
        if (zipScanSection) zipScanSection.style.display = 'none';
        
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

                if (zipScanSection) zipScanSection.style.display = 'none';
            } else {
                if (zipScanSection) zipScanSection.style.display = 'block';
                u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", res.message);
            }
        } catch(err) {
            if (zipScanSection) zipScanSection.style.display = 'block';
            u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", "ZIP解析中にエラーが発生しました: " + err);
        } finally {
            if (progressArea) progressArea.style.display = 'none';
        }
    };

    const btnExecZipImport = document.getElementById('btnExecZipImport');
    if(btnExecZipImport) btnExecZipImport.onclick = () => handleFinalImportWithCheck('zip');


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
            u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_no_songs_to_import') : "インポートする楽曲がありません", true);
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
                msgEl.innerHTML = window.i18n 
                    ? window.i18n.t('AddMusic.dup_existing_msg', { title: title, artist: artist }) 
                    : `「${title}」（${artist}）の楽曲はすでに追加されています。`;

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
                msgEl.innerHTML = window.i18n 
                    ? window.i18n.t('AddMusic.dup_bulk_msg', { title: title, artist: artist }) 
                    : `「${title}」（${artist}）の楽曲はインポートの項目内で重複しています。`;

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
        if (progressText) progressText.textContent = window.i18n ? window.i18n.t('AddMusic.progress_registering') : "ライブラリへ登録中...";
        
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
            // ★ 完了メッセージの多言語化
            u.showAlert(
                window.i18n ? window.i18n.t('Common.complete') : "完了", 
                window.i18n ? window.i18n.t('AddMusic.msg_import_success', { count: res.count }) : `${res.count}曲の登録が完了しました。`
            );
            if (type === 'list') {
                const btnClearImportFile = document.getElementById('btnClearImportFile');
                if(btnClearImportFile) btnClearImportFile.click();
            } else {
                if(btnClearZipFile) btnClearZipFile.click();
            }
        } else {
            u.showAlert(window.i18n ? window.i18n.t('Common.error') : "エラー", res ? res.message : "不明なエラーが発生しました");
        }
    }

    // ★ 修正: テーブルヘッダー、各行の削除ボタンを多言語化
    function renderTable(type) {
        const thead = document.getElementById(type === 'list' ? 'importListTableHeader' : 'mp3TableHeader');
        const tbody = document.getElementById(type === 'list' ? 'importListTableBody' : 'mp3TableBody');
        if(!thead || !tbody) return;
        
        const thNo = window.i18n ? window.i18n.t('AddMusic.th_no') : "No.";
        const thArt = window.i18n ? window.i18n.t('AddMusic.th_art') : "アート";
        const thTitle = (window.i18n ? window.i18n.t('Tags.title') : "タイトル") + " *";
        const thArtist = (window.i18n ? window.i18n.t('Tags.artist') : "アーティスト") + " *";
        const thPath = window.i18n ? window.i18n.t('AddMusic.th_path_filename') : "パス / ファイル名";
        const thAction = window.i18n ? window.i18n.t('Manage.th_action') : "操作";
        const btnDelText = window.i18n ? window.i18n.t('Common.delete') : "削除";

        let h = `<tr><th>${thNo}</th><th>${thArt}</th><th>${thTitle}</th><th>${thArtist}</th>`;
        activeTags.forEach(t => { 
            if(t.key !== 'title' && t.key !== 'artist') {
                const tagLabel = (window.i18n && window.i18n.t) ? window.i18n.t(`Tags.${t.key}`) : t.label;
                h += `<th>${tagLabel}</th>`; 
            }
        });
        h += `<th>${thPath}</th><th>${thAction}</th></tr>`; 
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
                    <button class="btn-del-row" onclick="window.deleteImportRow(${idx}, '${type}')">${btnDelText}</button>
                </td>`;
            tr.innerHTML = row;
            tbody.appendChild(tr);
        });
    }

    window.updateImportData = (idx, key, val) => {
        if (scannedData[idx]) scannedData[idx][key] = val;
    };

    window.deleteImportRow = (idx, type) => {
        const confirmMsg = window.i18n ? window.i18n.t('AddMusic.confirm_remove_row') : "この楽曲を追加リストから除外しますか？";
        if (confirm(confirmMsg)) {
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
        u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_applied') : "反映しました", false);
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
        document.getElementById('importArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_current') : "現在の画像";
        
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
            document.getElementById('importArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_new') : "新しい画像 (反映前)";
            showImportArtError("");
        };
        reader.readAsDataURL(file);
    };

    document.getElementById('btnFetchImportVideoArt').onclick = async () => {
        const url = document.getElementById('importMiniVideoUrl').value.trim();
        showImportArtError("");
        if (!url) { showImportArtError(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください"); return; }

        const btn = document.getElementById('btnFetchImportVideoArt');
        const orgText = btn.textContent;
        btn.disabled = true; btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "確認中...";

        try {
            const status = await invoke("check_tools_status");
            if (!status['yt-dlp'] || !status['ffmpeg']) {
                showImportArtError(window.i18n ? window.i18n.t('AddMusic.msg_ext_needed') : "拡張機能が不足しています");
                return;
            }

            btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
            const info = await invoke("fetch_video_info", { url: url });
            if (info.status === 'success' && info.thumbnail) {
                btn.textContent = window.i18n ? window.i18n.t('AddMusic.loading_processing_thumb') : "画像を変換中...";
                const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                if (b64) {
                    artPreview.src = b64;
                    document.getElementById('importArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_thumb') : "動画サムネイル (反映前)";
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_fetch_success') : "サムネイルを取得しました");
                } else { showImportArtError("Failed to crop image"); }
            } else { showImportArtError(info.message || "Failed to fetch info"); }
        } catch(e) { showImportArtError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラー"); }
        finally { btn.disabled = false; btn.textContent = orgText; }
    };

    document.getElementById('btnFetchImportDirectArt').onclick = async () => {
        const url = document.getElementById('importMiniImageUrl').value.trim();
        showImportArtError("");
        if (!url) { showImportArtError(window.i18n ? window.i18n.t('AddMusic.msg_enter_url') : "URLを入力してください"); return; }

        const btn = document.getElementById('btnFetchImportDirectArt');
        const orgText = btn.textContent;
        btn.disabled = true; btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";

        try {
            const res = await invoke("fetch_and_crop_image_url", { url: url });
            if (res.status === 'success') {
                artPreview.src = res.data;
                document.getElementById('importArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_url') : "画像URL (反映前)";
                u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_fetch_success') : "画像を取得しました");
            } else { showImportArtError("Fetch failed: " + res.message); }
        } catch(e) { showImportArtError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "エラー"); }
        finally { btn.disabled = false; btn.textContent = orgText; }
    };

    document.getElementById('btnExecImportRemoveArt').onclick = () => {
        artPreview.src = "REMOVE";
        document.getElementById('importArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_remove') : "削除予定 (反映前)";
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
                u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_title_artist_required') : "タイトルとアーティストが必要です", true);
                return;
            }
            const orgText = btnAutoImportLyric.textContent;
            btnAutoImportLyric.textContent = window.i18n ? window.i18n.t('Common.loading') : "検索中...";
            btnAutoImportLyric.disabled = true;

            try {
                const data = await invoke("search_lyrics_online", { title: item.title, artist: item.artist });

                if (data.statusCode === 404 || data.error) {
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true);
                    return;
                }

                if (!Array.isArray(data) || data.length === 0) {
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true);
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
                    u.showToast(window.i18n ? window.i18n.t('AddMusic.msg_art_not_found') : "見つかりませんでした", true);
                }
            } catch (e) {
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラーが発生しました", true);
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
