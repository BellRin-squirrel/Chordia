document.addEventListener('DOMContentLoaded', async () => {
    // ★ 追加：新しいウィンドウで開かれた場合（または設定で新ウィンドウ指定時）、左上の「トップへ戻る」ボタンを非表示にする
    try {
        const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
        const isWindowMode = window.__TAURI__ && window.__TAURI__.window && window.__TAURI__.window.getCurrentWindow().label === 'add_music_window';
        const settings = await invoke("get_app_settings");
        if (isWindowMode || (settings && settings.open_add_music_new_window)) {
            const backArea = document.querySelector('.header-left');
            if (backArea) backArea.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
    }

    // --- コンポーネントの初期化 ---
    if (window.TagsController) await window.TagsController.init();
    if (window.DuplicateController) window.DuplicateController.init();
    if (window.SubmitController) window.SubmitController.init();

    if (window.SourceController) window.SourceController.init();
    if (window.ArtworkController) window.ArtworkController.init();
    if (window.LyricController) window.LyricController.init();
    if (window.BulkController) window.BulkController.init();
});