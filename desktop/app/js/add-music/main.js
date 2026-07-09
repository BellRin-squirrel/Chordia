document.addEventListener('DOMContentLoaded', async () => {
    // --- コンポーネントの初期化 ---
    if (window.TagsController) await window.TagsController.init();
    if (window.DuplicateController) window.DuplicateController.init();
    if (window.SubmitController) window.SubmitController.init();

    if (window.SourceController) window.SourceController.init();
    if (window.ArtworkController) window.ArtworkController.init();
    if (window.LyricController) window.LyricController.init();
    if (window.BulkController) window.BulkController.init();
});