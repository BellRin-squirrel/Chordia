document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.core.listen;

    const calcMessage = document.getElementById('calcMessage');
    const calcCount = document.getElementById('calcCount');
    const progressBar = document.getElementById('progressBar');
    const btnClose = document.getElementById('btnClose');

    if (listen) {
        await listen("lufs_calc_progress", (event) => {
            const data = event.payload;
            calcMessage.textContent = data.message;
            calcCount.textContent = `${data.current} / ${data.total}`;
            
            if (data.total > 0) {
                let percent = (data.current / data.total) * 100;
                progressBar.style.width = `${percent}%`;
            }

            if (data.current === data.total) {
                btnClose.textContent = "完了 (閉じる)";
            }
        });
    }

    // ★ 修正：Rustコマンド経由で自ウィンドウを確実に削除・破棄する
    btnClose.addEventListener('click', async () => {
        try {
            await invoke("close_lufs_calc_window");
        } catch (e) {
            console.error("Failed to close window:", e);
        }
    });

    try {
        await invoke("start_lufs_calculation_all");
    } catch (e) {
        calcMessage.textContent = "エラーが発生しました";
        calcMessage.style.color = "#ef4444";
        console.error(e);
    }
});