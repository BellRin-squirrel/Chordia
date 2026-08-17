document.addEventListener('DOMContentLoaded', async () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.core.listen;

    const calcMessage = document.getElementById('calcMessage');
    const calcCount = document.getElementById('calcCount');
    const progressBar = document.getElementById('progressBar');
    const btnClose = document.getElementById('btnClose');

    const params = new URLSearchParams(window.location.search);
    const forceRecalc = params.get('force') === 'true';

    if (listen) {
        await listen("lufs_calc_progress", (event) => {
            const data = event.payload;
            if (!data) return;

            let msg = data.message || "";
            if (window.i18n && data.status_code) {
                switch (data.status_code) {
                    case "already_completed":
                        msg = window.i18n.t('Extensions.lufs_already_completed');
                        break;
                    case "preparing":
                        msg = window.i18n.t('Extensions.lufs_preparing_analysis');
                        break;
                    case "analyzing":
                        msg = window.i18n.t('Extensions.lufs_analyzing', { title: data.title || "" });
                        break;
                    case "analyzed":
                        msg = window.i18n.t('Extensions.lufs_analyzed', { title: data.title || "" });
                        break;
                    case "completed":
                        msg = window.i18n.t('Extensions.lufs_completed');
                        break;
                }
            }

            if (calcMessage) calcMessage.textContent = msg;
            if (calcCount) calcCount.textContent = `${data.current} / ${data.total}`;
            
            if (progressBar && data.total > 0) {
                let percent = (data.current / data.total) * 100;
                progressBar.style.width = `${percent}%`;
            }

            if (btnClose && data.current === data.total) {
                btnClose.textContent = window.i18n ? window.i18n.t('Common.close') : "完了 (閉じる)";
            }
        });
    }

    if (btnClose) {
        btnClose.addEventListener('click', async () => {
            try {
                await invoke("close_lufs_calc_window");
            } catch (e) {
                console.error("Failed to close window:", e);
            }
        });
    }

    try {
        await invoke("start_lufs_calculation_all", { force: forceRecalc });
    } catch (e) {
        if (calcMessage) {
            calcMessage.textContent = window.i18n ? window.i18n.t('Common.error') : "エラーが発生しました";
            calcMessage.style.color = "#ef4444";
        }
        console.error(e);
    }
});