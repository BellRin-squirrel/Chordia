(function() {
    Object.assign(window.WorkFocus, {
        isSamePlaylist: function() {
            if (!this.cfg || !this.cfg.pomodoroMode) return false;
            const workTarget = this.cfg.slots && this.cfg.slots.work ? this.cfg.slots.work.target : null;
            const breakTarget = this.cfg.slots && this.cfg.slots.break ? this.cfg.slots.break.target : null;
            if (!workTarget || !breakTarget) return false;
            return workTarget.type === breakTarget.type && workTarget.id === breakTarget.id;
        },

        loadAllPlaylists: async function() {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            const loadSlot = async (slotData) => {
                if (!slotData || !slotData.target) return [];
                let songs = [];
                if (slotData.target.type === 'playlist') {
                    const details = await invoke("get_playlist_details", { plId: slotData.target.id });
                    if (details && details.songs) songs = details.songs;
                } else if (slotData.target.type === 'album') {
                    const details = await invoke("get_virtual_playlist_details", { field: "album", value: slotData.target.name });
                    if (details && details.songs) songs = details.songs;
                } else if (slotData.target.type === 'artist') {
                    const details = await invoke("get_virtual_playlist_details", { field: "artist", value: slotData.target.name });
                    if (details && details.songs) songs = details.songs;
                }
                if (songs.length > 0 && slotData.shuffle) {
                    for (let i = songs.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [songs[i], songs[j]] = [songs[j], songs[i]];
                    }
                }
                return songs;
            };

            if (this.cfg.pomodoroMode) {
                this.workQueue = await loadSlot(this.cfg.slots.work);
                if (this.isSamePlaylist()) {
                    this.breakQueue = this.workQueue;
                } else {
                    this.breakQueue = await loadSlot(this.cfg.slots.break);
                }
            } else {
                this.normalQueue = await loadSlot(this.cfg.slots.normal);
            }
        },

        checkPomodoroTransition: function() {
            const audioPlayer = document.getElementById('workAudioPlayer');
            
            if (this.pomoRemaining === 6 && !this.isMusicFadingOut && audioPlayer && !audioPlayer.paused) {
                this.isMusicFadingOut = true;
                this.fadeOutAudio(audioPlayer, 4500); 
            }

            if (this.pomoRemaining <= 0) {
                this.isMusicFadingOut = false;
                if (audioPlayer) {
                    const currentPos = audioPlayer.currentTime;
                    audioPlayer.pause();
                    if (this.isSamePlaylist()) {
                        this.workProgressSec = currentPos;
                        this.breakProgressSec = currentPos;
                    } else {
                        if (this.pomoPhase === 'WORK') {
                            this.workProgressSec = currentPos;
                        } else {
                            this.breakProgressSec = currentPos;
                        }
                    }
                }
                
                this.pomoRemaining = 0;
                this.updateElapsedTimeUI();

                this.triggerPhaseTransitionAlarm();
            }
        },

        triggerPhaseTransitionAlarm: function() {
            this.isAlarmPlaying = true;

            if ('vibrate' in navigator) {
                navigator.vibrate([400, 200, 400]);
            }
            
            const beepUrl = "https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav";
            
            if (this.currentAlarmAudio) {
                this.currentAlarmAudio.pause();
                this.currentAlarmAudio = null;
            }

            const beepAudio = new Audio(beepUrl);
            beepAudio.volume = 1.0;
            this.currentAlarmAudio = beepAudio;
            beepAudio.play().catch(e => console.error("BeepSound play error:", e));

            if (this.alarmTimeout) clearTimeout(this.alarmTimeout);
            this.alarmTimeout = setTimeout(() => {
                if (this.currentAlarmAudio) {
                    this.currentAlarmAudio.pause();
                    this.currentAlarmAudio.currentTime = 0;
                    this.currentAlarmAudio = null;
                }

                if (this.pomoPhase === 'WORK') {
                    this.pomoPhase = 'BREAK';
                    this.pomoRemaining = this.cfg.breakDuration * 60;
                    if (this.isSamePlaylist()) {
                        this.breakIndex = this.workIndex;
                        this.breakProgressSec = this.workProgressSec;
                    }
                } else {
                    this.pomoPhase = 'WORK';
                    this.pomoRemaining = this.cfg.workDuration * 60;
                    if (this.isSamePlaylist()) {
                        this.workIndex = this.breakIndex;
                        this.workProgressSec = this.breakProgressSec;
                    }
                }
                
                this.updateElapsedTimeUI();
                this.playCurrentPhaseSong(true); 

                this.isAlarmPlaying = false;
                this.alarmTimeout = null;
            }, 1200);
        },

        fadeOutAudio: function(audio, durationMs) {
            const steps = 10;
            const interval = durationMs / steps;
            let currentVol = audio.volume;
            const stepVol = currentVol / steps;

            const fade = setInterval(() => {
                if (audio.paused || this.pomoRemaining <= 0) {
                    clearInterval(fade);
                    return;
                }
                currentVol -= stepVol;
                if (currentVol <= 0.05) {
                    currentVol = 0;
                    clearInterval(fade);
                }
                audio.volume = Math.max(0, currentVol);
            }, interval);
        },

        fadeInAudio: function(audio, targetVolume, durationMs) {
            audio.volume = 0;
            const steps = 10;
            const interval = durationMs / steps;
            const stepVol = targetVolume / steps;
            let currentVol = 0;

            const fade = setInterval(() => {
                if (audio.paused) {
                    clearInterval(fade);
                    return;
                }
                currentVol += stepVol;
                if (currentVol >= targetVolume) {
                    currentVol = targetVolume;
                    clearInterval(fade);
                }
                audio.volume = Math.min(targetVolume, currentVol);
            }, interval);
        },

        playCurrentPhaseSong: async function(withFadeIn = false) {
            let song = null;
            let startSec = 0;

            if (this.cfg.pomodoroMode) {
                if (this.pomoPhase === 'WORK') {
                    if (this.workQueue.length > 0) {
                        song = this.workQueue[this.workIndex];
                        startSec = this.workProgressSec;
                    }
                } else {
                    if (this.breakQueue.length > 0) {
                        song = this.breakQueue[this.breakIndex];
                        startSec = this.breakProgressSec;
                    }
                }
            } else {
                if (this.normalQueue.length > 0) {
                    song = this.normalQueue[this.normalIndex];
                }
            }

            const audioPlayer = document.getElementById('workAudioPlayer');
            const songNameText = document.getElementById('focusSongNameText');

            if (!song || !audioPlayer) {
                if (songNameText) songNameText.textContent = "再生可能な楽曲がありません";
                return;
            }

            const convertFileSrc = window.__TAURI__.core ? window.__TAURI__.core.convertFileSrc : (window.__TAURI__.tauri ? window.__TAURI__.tauri.convertFileSrc : (p => p));
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

            try {
                let streamUrl = song.streamUrl;
                if (!streamUrl && song.musicFilename) {
                    const absPath = await invoke("resolve_path", { relPath: song.musicFilename });
                    streamUrl = convertFileSrc(absPath);
                }
                if (streamUrl) {
                    const isSameSrc = (audioPlayer.src === streamUrl || audioPlayer.src.endsWith(encodeURI(streamUrl)) || audioPlayer.src.endsWith(streamUrl));
                    if (!isSameSrc) {
                        audioPlayer.src = streamUrl;
                        audioPlayer.load();
                    }

                    audioPlayer.currentTime = startSec;
                    
                    const savedVol = localStorage.getItem('player_volume') ? (parseFloat(localStorage.getItem('player_volume')) / 100) : 1.0;
                    
                    if (withFadeIn) {
                        audioPlayer.volume = 0;
                        audioPlayer.play().then(() => {
                            this.fadeInAudio(audioPlayer, savedVol, 2000);
                        }).catch(() => {});
                    } else {
                        audioPlayer.volume = savedVol;
                        audioPlayer.play().catch(() => {});
                    }
                    
                    if (songNameText) songNameText.textContent = `${song.title || 'Unknown'} - ${song.artist || 'Unknown'}`;

                    if (song.musicFilename && this.lastRecordedSongFilename !== song.musicFilename) {
                        this.lastRecordedSongFilename = song.musicFilename;
                        setTimeout(async () => {
                            try {
                                await invoke("record_playback", { song: song });
                            } catch(e) {
                                console.error("Focus record_playback error:", e);
                            }
                        }, 50);
                    }
                }
            } catch(e) {
                console.error("Play error:", e);
            }
        }
    });
})();
