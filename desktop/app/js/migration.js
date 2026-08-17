document.addEventListener('DOMContentLoaded', async () => {
    const tauri = window.__TAURI__;
    const invoke = (tauri && tauri.core) ? tauri.core.invoke : (tauri && tauri.tauri ? tauri.tauri.invoke : null);
    const listen = (tauri && tauri.event) ? tauri.event.listen : null;
    
    const chkMusic = document.getElementById('chkMusic');
    const chkImages = document.getElementById('chkImages');
    const chkDb = document.getElementById('chkDb');
    const chkSettings = document.getElementById('chkSettings');
    const chkPlaylists = document.getElementById('chkPlaylists');
    
    const exportPathInput = document.getElementById('exportPath');
    const btnBrowse = document.getElementById('btnBrowse');
    const btnExport = document.getElementById('btnExport');
    const btnExportText = document.getElementById('btnExportText');
    const exportPassword = document.getElementById('exportPassword');
    
    const dropArea = document.getElementById('dropAreaImport');
    const importFileInfo = document.getElementById('importFileInfo');
    const importFileName = document.getElementById('importFileName');
    const btnClearImportFile = document.getElementById('btnClearImportFile');
    const importPassword = document.getElementById('importPassword');
    const btnSubmitPassword = document.getElementById('btnSubmitPassword');
    const importPasswordContainer = document.getElementById('importPasswordContainer');
    
    const modalOverlay = document.getElementById('modalOverlay');
    const resultPathDisplay = document.getElementById('resultPath');
    const btnComplete = document.getElementById('btnComplete');
    const btnShowInExplorer = document.getElementById('btnShowInExplorer');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const btnCancelLoading = document.getElementById('btnCancelLoading');

    let selectedImportPath = "";
    let isCancelled = false;

    const isMac = navigator.userAgent.includes('Mac') || navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (listen) {
        try {
            await listen("migration_status", (event) => {
                if (event.payload === "rewriting_cache") {
                    const textEl = document.getElementById('loadingText');
                    if (textEl) {
                        textEl.textContent = window.i18n ? window.i18n.t('Migration.msg_rewriting_cache') : "キャッシュを再度書き込んでいます...";
                    }
                }
            });
        } catch (e) {
            console.error("Failed to register migration_status listener", e);
        }
    }

    try {
        const defaultPath = await invoke("get_default_export_path");
        if (exportPathInput) exportPathInput.value = defaultPath;
    } catch (e) { console.error(e); }

    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            const selectedPath = await invoke("ask_save_path", { currentPath: exportPathInput.value });
            if (selectedPath) exportPathInput.value = selectedPath;
        });
    }

    if (btnCancelLoading) {
        btnCancelLoading.addEventListener('click', () => {
            isCancelled = true;
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            if (btnExport) btnExport.disabled = false;
            showToast(window.i18n ? window.i18n.t('Migration.toast_interrupted') : "処理を中断しました", true);
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const savePath = exportPathInput.value;
            if (!savePath) { 
                showToast(window.i18n ? window.i18n.t('Migration.toast_specify_path') : "エクスポート先のファイル名を指定してください", true); 
                return; 
            }

            const targets = {
                music: chkMusic.checked,
                images: chkImages.checked,
                db: chkDb.checked,
                settings: chkSettings.checked,
                playlists: chkPlaylists.checked
            };

            if (!Object.values(targets).includes(true)) { 
                showToast(window.i18n ? window.i18n.t('Migration.toast_select_target') : "項目を1つ以上選択してください", true); 
                return; 
            }

            const pass = exportPassword ? exportPassword.value : "";
            if (pass.length > 128) { 
                showToast(window.i18n ? window.i18n.t('Migration.toast_pass_too_long') : "パスワードは128文字以内にしてください", true); 
                return; 
            }

            isCancelled = false;
            btnExport.disabled = true;
            if (btnExportText) {
                btnExportText.textContent = window.i18n ? window.i18n.t('Migration.btn_exporting') : 'エクスポート中...';
            }

            if (loadingOverlay) {
                document.getElementById('loadingText').textContent = window.i18n ? window.i18n.t('Migration.msg_compressing') : "データをバックアップ用に圧縮しています...";
                loadingOverlay.style.display = 'flex';
            }

            try {
                const result = await invoke("execute_export", { 
                    targets: targets, 
                    savePath: savePath,
                    password: pass
                });
                
                if (isCancelled) return;

                if (loadingOverlay) loadingOverlay.style.display = 'none';
                if (result.success) {
                    showToast(window.i18n ? window.i18n.t('Migration.toast_export_success') : "エクスポートが完了しました", false);
                    document.getElementById('modalTitle').textContent = window.i18n ? window.i18n.t('Migration.modal_export_title') : "エクスポート完了";
                    document.getElementById('modalMessage').textContent = window.i18n ? window.i18n.t('Migration.modal_export_msg') : "データが正常にバックアップされました。";
                    
                    if (resultPathDisplay) {
                        resultPathDisplay.textContent = result.path;
                        resultPathDisplay.style.display = 'block';
                    }
                    if (btnComplete) {
                        btnComplete.textContent = window.i18n ? window.i18n.t('Common.back_to_top') : "トップへ戻る";
                    }
                    if (btnShowInExplorer) {
                        btnShowInExplorer.textContent = isMac 
                            ? (window.i18n ? window.i18n.t('Migration.btn_show_finder') : "Finderで表示") 
                            : (window.i18n ? window.i18n.t('Migration.btn_show_explorer') : "エクスプローラーで表示");
                        btnShowInExplorer.style.display = 'inline-flex';
                    }
                    modalOverlay.classList.add('show');
                } else { 
                    showToast(`Error: ${result.message}`, true); 
                }
            } catch (e) { 
                if (isCancelled) return;
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                showToast(window.i18n ? window.i18n.t('Migration.toast_system_error') : "システムエラーが発生しました", true); 
                console.error(e);
            } finally { 
                if (!isCancelled) {
                    btnExport.disabled = false; 
                    if (btnExportText) {
                        btnExportText.textContent = window.i18n ? window.i18n.t('Migration.btn_export') : "エクスポートを実行";
                    }
                }
            }
        });
    }

    if (btnShowInExplorer) {
        btnShowInExplorer.addEventListener('click', async () => {
            const exportedPath = resultPathDisplay ? resultPathDisplay.textContent : "";
            if (exportedPath) {
                try {
                    await invoke("show_in_explorer", { path: exportedPath });
                } catch (e) {
                    showToast(isMac 
                        ? (window.i18n ? window.i18n.t('Migration.toast_finder_failed') : "Finderの展開に失敗しました")
                        : (window.i18n ? window.i18n.t('Migration.toast_explorer_failed') : "エクスプローラーの展開に失敗しました"), 
                        true
                    );
                }
            }
        });
    }

    if (dropArea) {
        dropArea.onclick = async () => {
            try {
                const path = await invoke("ask_import_path");
                if (path) {
                    selectedImportPath = path;
                    const fileName = path.split(/[\\/]/).pop();
                    if (importFileName) importFileName.textContent = fileName;
                    if (dropArea) dropArea.style.display = 'none';
                    if (importFileInfo) importFileInfo.style.display = 'flex';
                    
                    await runImportRestore("");
                }
            } catch(e) {
                console.error(e);
            }
        };

        setupDragAndDrop(dropArea, async (file) => {
            if (!file) return;
            const path = file.path || file.name;
            if (!path.toLowerCase().endsWith('.zip')) {
                showToast(window.i18n ? window.i18n.t('Migration.toast_zip_required') : "引継ぎファイルはZIP形式である必要があります", true);
                return;
            }
            selectedImportPath = path;
            const fileName = file.name || path.split(/[\\/]/).pop();
            if (importFileName) importFileName.textContent = fileName;
            if (dropArea) dropArea.style.display = 'none';
            if (importFileInfo) importFileInfo.style.display = 'flex';

            await runImportRestore("");
        });
    }

    if (btnSubmitPassword) {
        btnSubmitPassword.onclick = async () => {
            const pass = importPassword ? importPassword.value : "";
            if (!pass) {
                showToast(window.i18n ? window.i18n.t('Migration.toast_enter_password') : "復号用パスワードを入力してください", true);
                return;
            }
            await runImportRestore(pass);
        };
    }
    if (importPassword) {
        importPassword.onkeydown = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const pass = importPassword.value;
                if (!pass) {
                    showToast(window.i18n ? window.i18n.t('Migration.toast_enter_password') : "復号用パスワードを入力してください", true);
                    return;
                }
                await runImportRestore(pass);
            }
        };
    }

    if (btnClearImportFile) {
        btnClearImportFile.onclick = () => {
            selectedImportPath = "";
            if (importFileInfo) importFileInfo.style.display = 'none';
            if (dropArea) dropArea.style.display = 'block';
            if (importPasswordContainer) importPasswordContainer.style.display = 'none';
            if (importPassword) importPassword.value = '';
        };
    }

    async function runImportRestore(pass = "") {
        if (!selectedImportPath) return;

        isCancelled = false;
        if (loadingOverlay) {
            document.getElementById('loadingText').textContent = window.i18n ? window.i18n.t('Migration.msg_restoring') : "引継ぎZIPファイルを解析・復元しています...";
            loadingOverlay.style.display = 'flex';
        }

        try {
            const result = await invoke("execute_migration_import", {
                zipPath: selectedImportPath,
                password: pass || null
            });

            if (isCancelled) return;
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            if (result.status === "password_required") {
                showToast(window.i18n ? window.i18n.t('Migration.toast_password_protected') : "このファイルはパスワードで保護されています", true);
                if (importPasswordContainer) importPasswordContainer.style.display = 'block';
                if (importPassword) {
                    importPassword.value = '';
                    importPassword.focus();
                }
            } else if (result.status === "success") {
                if (importPasswordContainer) importPasswordContainer.style.display = 'none';
                
                showToast(window.i18n ? window.i18n.t('Migration.toast_import_success') : "インポートが完了しました", false);
                document.getElementById('modalTitle').textContent = window.i18n ? window.i18n.t('Migration.modal_import_title') : "インポート(復元)完了";
                document.getElementById('modalMessage').textContent = window.i18n ? window.i18n.t('Migration.modal_import_msg') : "すべてのライブラリと設定が正常に復元されました。";
                if (resultPathDisplay) resultPathDisplay.style.display = 'none';
                if (btnComplete) {
                    btnComplete.textContent = window.i18n ? window.i18n.t('Common.back_to_top') : "トップへ戻る";
                }
                if (btnShowInExplorer) {
                    btnShowInExplorer.style.display = 'none';
                }
                modalOverlay.classList.add('show');
            }
        } catch (err) {
            if (isCancelled) return;
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            showToast(window.i18n ? window.i18n.t('Migration.toast_restore_failed', { err: err }) : `復元に失敗しました: ${err}`, true);
        }
    }

    if (btnComplete) {
        btnComplete.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

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

    function showToast(message, isError) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast show ' + (isError ? 'error' : 'success');
        setTimeout(() => toast.classList.remove('show'), 5000);
    }
});