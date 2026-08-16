document.addEventListener('DOMContentLoaded', () => {
    const listen = window.__TAURI__.event ? window.__TAURI__.event.listen : window.__TAURI__.core.listen;

    const splashMessage = document.getElementById('splashMessage');
    const splashPercent = document.getElementById('splashPercent');
    const splashBarFill = document.getElementById('splashBarFill');

    if (listen) {
        listen('splash_progress', (event) => {
            const data = event.payload;
            if (!data) return;

            if (data.message && splashMessage) {
                splashMessage.textContent = data.message;
            }

            if (data.percent !== undefined && data.percent !== null) {
                const percent = Math.min(100, Math.max(0, data.percent));
                if (splashPercent) splashPercent.textContent = `${percent}%`;
                if (splashBarFill) splashBarFill.style.width = `${percent}%`;
            }
        });
    }
});