const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

document.addEventListener("DOMContentLoaded", async () => {
    const appVersionContainer = document.getElementsByClassName("app-version")[0];
    const appVersion = await invoke("get_app_version");
    appVersionContainer.textContent = appVersion;
});