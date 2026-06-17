document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    
    const chkMusic = document.getElementById('chkMusic');
    const chkImages = document.getElementById('chkImages');
    const chkDb = document.getElementById('chkDb');
    const chkSettings = document.getElementById('chkSettings');
    const chkPlaylists = document.getElementById('chkPlaylists');
    const exportPathInput = document.getElementById('exportPath');
    const btnBrowse = document.getElementById('btnBrowse');
    const btnExport = document.getElementById('btnExport');
    const modalOverlay = document.getElementById('modalOverlay');
    const resultPathDisplay = document.getElementById('resultPath');
    const btnComplete = document.getElementById('btnComplete');
    const exportPassword = document.getElementById('exportPassword');

    try {
        const defaultPath = await invoke("get_default_export_path");
        exportPathInput.value = defaultPath;
    } catch (e) { console.error(e); }

    btnBrowse.addEventListener('click', async () => {
        const selectedPath = await invoke("ask_save_path", { currentPath: exportPathInput.value });
        if (selectedPath) exportPathInput.value = selectedPath;
    });

    btnExport.addEventListener('click', async () => {
        const savePath = exportPathInput.value;
        if (!savePath) { showToast("保存先を指定してください", true); return; }

        const targets = {
            music: chkMusic.checked,
            images: chkImages.checked,
            db: chkDb.checked,
            settings: chkSettings.checked,
            playlists: chkPlaylists.checked
        };

        if (!Object.values(targets).includes(true)) { showToast("項目を1つ以上選択してください", true); return; }

        // ★ 修正: JS側でも128文字チェックを行う
        const pass = exportPassword ? exportPassword.value : "";
        if (pass.length > 128) {
            showToast("パスワードは128文字以内にしてください", true);
            return;
        }

        btnExport.disabled = true;
        btnExport.innerHTML = 'エクスポート中...';

        try {
            const result = await invoke("execute_export", { 
                targets: targets, 
                savePath: savePath,
                password: pass
            });
            
            if (result.success) {
                showToast("完了しました", false);
                resultPathDisplay.textContent = result.path;
                modalOverlay.classList.add('show');
            } else { 
                showToast(`エラー: ${result.message}`, true); 
            }
        } catch (e) { 
            showToast("システムエラーが発生しました", true); 
            console.error(e);
        } 
        finally { 
            btnExport.disabled = false; 
            btnExport.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> エクスポートを実行`; 
        }
    });

    btnComplete.addEventListener('click', () => window.location.href = 'index.html');

    function showToast(message, isError) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show ' + (isError ? 'error' : 'success');
        setTimeout(() => toast.classList.remove('show'), 5000);
    }
});