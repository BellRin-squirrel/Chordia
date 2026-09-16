(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    Object.assign(window.PlayerController, {
        initAirPlay: function() {
            const btnAirPlay = document.getElementById('btnAirPlay');
            const audio = document.getElementById('mainAudio');
            const menu = document.getElementById('airplayDeviceMenu');

            if (!btnAirPlay || !audio) return;

            document.addEventListener('click', (e) => {
                if (menu && !e.target.closest('#btnAirPlay') && !e.target.closest('#airplayDeviceMenu')) {
                    menu.style.display = 'none';
                }
            });

            btnAirPlay.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (menu && menu.style.display === 'block') {
                    menu.style.display = 'none';
                    return;
                }

                const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
                const isMac = navigator.userAgent.includes('Mac');
                const list = menu.querySelector('ul');
                if (!list) return;

                list.innerHTML = '';

                const liSound = document.createElement('li');
                liSound.innerHTML = `<span>サウンド設定を開く</span>`;
                liSound.onclick = async (ev) => {
                    ev.stopPropagation();
                    try {
                        await invoke("open_sound_settings");
                    } catch(err) {
                        console.error(err);
                    }
                    menu.style.display = 'none';
                };
                list.appendChild(liSound);

                const liDevices = document.createElement('li');
                liDevices.innerHTML = isMac ? `<span>AirPlay対応機器一覧</span>` : `<span>出力デバイスを変更</span>`;
                
                liDevices.onclick = async (ev) => {
                    ev.stopPropagation();
                    
                    const hadNoSrc = !audio.src;
                    if (hadNoSrc) {
                        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
                    }

                    if (typeof audio.webkitShowPlaybackTargetPicker === 'function') {
                        try {
                            audio.webkitShowPlaybackTargetPicker();
                        } catch (err) {
                            console.warn("webkitShowPlaybackTargetPicker failed:", err);
                        }
                        menu.style.display = 'none';
                        return;
                    }

                    if (navigator.mediaDevices && typeof navigator.mediaDevices.selectAudioOutput === 'function') {
                        try {
                            const device = await navigator.mediaDevices.selectAudioOutput();
                            if (device && typeof audio.setSinkId === 'function') {
                                await audio.setSinkId(device.deviceId);
                                u.showToast(`出力先: ${device.label || '選択されたデバイス'}`);
                                btnAirPlay.classList.add('active');
                                if (hadNoSrc && !s.isPlaying) audio.src = "";
                            }
                        } catch (err) {
                            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                                console.warn("selectAudioOutput error:", err);
                            }
                        }
                        menu.style.display = 'none';
                        return;
                    }

                    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
                        try {
                            let devices = await navigator.mediaDevices.enumerateDevices();
                            let audioOutputs = devices.filter(d => d.kind === 'audiooutput');

                            if (audioOutputs.length > 0 && !audioOutputs[0].label) {
                                try {
                                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                    stream.getTracks().forEach(track => track.stop());
                                    devices = await navigator.mediaDevices.enumerateDevices();
                                    audioOutputs = devices.filter(d => d.kind === 'audiooutput');
                                } catch(e) {}
                            }

                            if (audioOutputs.length > 0) {
                                window.PlayerController.showAudioDeviceMenu(audioOutputs, btnAirPlay, menu, audio);
                                return;
                            }
                        } catch (err) {
                            console.error("enumerateDevices error:", err);
                        }
                    }

                    window.PlayerController.showAudioDeviceMenu([
                        { deviceId: 'default', label: 'システム既定のスピーカー / 出力' }
                    ], btnAirPlay, menu, audio);
                };
                list.appendChild(liDevices);

                menu.style.display = 'block';
            });
        },

        showAudioDeviceMenu: function(devices, btn, menu, audio) {
            if (!menu) return;
            const list = menu.querySelector('ul');
            if (!list) return;

            list.innerHTML = '';
            const currentSinkId = (typeof audio.sinkId === 'string') ? audio.sinkId : 'default';

            devices.forEach((dev, idx) => {
                const li = document.createElement('li');
                const label = dev.label || `オーディオ出力 ${idx + 1}`;
                const isSelected = (dev.deviceId === currentSinkId) || (currentSinkId === '' && idx === 0) || (currentSinkId === 'default' && dev.deviceId === 'default');
                
                if (isSelected) li.classList.add('selected');
                
                li.innerHTML = `
                    <span>${u.escapeHtml(label)}</span>
                    ${isSelected ? '<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
                `;

                li.onclick = async () => {
                    try {
                        if (typeof audio.setSinkId === 'function') {
                            await audio.setSinkId(dev.deviceId);
                            u.showToast(`出力先を変更しました: ${label}`);
                            btn.classList.add('active');
                        } else {
                            u.showToast(`出力先を選択しました: ${label}`);
                        }
                    } catch (err) {
                        console.error("setSinkId error:", err);
                        u.showToast("出力先の変更に失敗しました", true);
                    }
                    menu.style.display = 'none';
                };

                list.appendChild(li);
            });

            menu.style.display = 'block';
        }
    });
})();