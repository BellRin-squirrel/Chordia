window.WorkFocus = {
    isFocusActive: false,
    isPaused: false,
    isHelpOpen: false, 
    isAlarmPlaying: false,
    focusTimerInterval: null,
    quoteInterval: null,
    clockInterval: null,
    pauseTimerInterval: null,
    currentAlarmAudio: null,
    alarmTimeout: null,
    lastRecordedSongFilename: null,
    hasRecordedWorkSession: false,

    cfg: null, 

    pomoPhase: 'WORK', // 'WORK' or 'BREAK'
    totalWorkSeconds: 0,
    pomoRemaining: 0,
    isMusicFadingOut: false, 
    
    workQueue: [],
    workIndex: 0,
    workProgressSec: 0, 

    breakQueue: [],
    breakIndex: 0,
    breakProgressSec: 0,

    normalQueue: [],
    normalIndex: 0,

    start: async function() {
        const defaultConfig = {
            dateFormat: 'ymd',
            dayFormat: 'paren',
            clockFormat: '24h',
            showQuote: true,
            pomodoroMode: false,
            workDuration: 25,
            breakDuration: 5,
            slots: {
                normal: { target: null, shuffle: true },
                work: { target: null, shuffle: true },
                break: { target: null, shuffle: true }
            }
        };

        let raw = localStorage.getItem('chordia_work_config');
        this.cfg = defaultConfig;
        try {
            if (raw) this.cfg = Object.assign({}, defaultConfig, JSON.parse(raw));
            if (!this.cfg.slots) this.cfg.slots = defaultConfig.slots;
        } catch(e) {
            this.cfg = defaultConfig;
        }

        const configContainer = document.getElementById('configContainer');
        const workReadyView = document.getElementById('workReadyView');
        const workFocusView = document.getElementById('workFocusView');

        if (configContainer) configContainer.style.display = 'none';
        if (workReadyView) workReadyView.style.display = 'none';
        
        if (workFocusView) {
            workFocusView.style.display = 'flex';
            workFocusView.style.visibility = 'visible';
            workFocusView.style.opacity = '1';
        }
        document.body.className = 'mode-focus';

        const windowControls = document.getElementById('windowControlsMac');
        if (windowControls) {
            windowControls.style.display = 'none';
        }

        this.isFocusActive = true;
        this.isPaused = false;
        this.isHelpOpen = false; 
        this.isAlarmPlaying = false;
        this.totalWorkSeconds = 0;
        this.lastRecordedSongFilename = null;
        this.hasRecordedWorkSession = false;

        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.pause();
            this.currentAlarmAudio = null;
        }
        if (this.alarmTimeout) {
            clearTimeout(this.alarmTimeout);
            this.alarmTimeout = null;
        }

        this.workQueue = []; this.workIndex = 0; this.workProgressSec = 0;
        this.breakQueue = []; this.breakIndex = 0; this.breakProgressSec = 0;
        this.normalQueue = []; this.normalIndex = 0;
        await this.loadAllPlaylists();

        if (this.cfg.pomodoroMode) {
            this.pomoPhase = 'WORK';
            this.pomoRemaining = this.cfg.workDuration * 60;
        } else {
            this.pomoPhase = 'NORMAL';
            this.pomoRemaining = 0; 
        }
        
        this.isMusicFadingOut = false;

        this.applyDisplayFormats();
        this.updateClock();
        this.updateElapsedTimeUI();
        this.updateQuote();

        if (this.quoteInterval) clearInterval(this.quoteInterval);
        this.quoteInterval = setInterval(() => this.updateQuote(), 60000);

        if (this.clockInterval) clearInterval(this.clockInterval);
        this.clockInterval = setInterval(() => this.updateClock(), 1000);

        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
        this.focusTimerInterval = setInterval(() => {
            if (!this.isPaused && !this.isHelpOpen && !this.isAlarmPlaying) {
                if (this.pomoPhase === 'WORK' || this.pomoPhase === 'NORMAL') {
                    this.totalWorkSeconds++;
                }

                if (this.cfg.pomodoroMode) {
                    this.pomoRemaining--;
                    this.checkPomodoroTransition();
                }

                this.updateElapsedTimeUI();
            }
        }, 1000);

        this.playCurrentPhaseSong();
    },

    applyDisplayFormats: function() {
        if (!this.cfg) return;
        const focusLeftCol = document.getElementById('focusLeftCol');
        const focusMainArea = document.getElementById('focusMainArea');
        const focusTotalWorkLabel = document.getElementById('focusTotalWorkLabel');
        const focusTotalWorkDisplay = document.getElementById('focusTotalWorkDisplay');
        const focusDateDisplay = document.getElementById('focusDateDisplay');
        const focusClockDisplay = document.getElementById('focusClockDisplay');
        
        const pomoBadgeArea = document.getElementById('pomoBadgeArea');
        const focusPomoTimerDisplay = document.getElementById('focusPomoTimerDisplay');

        const isDateNone = this.cfg.dateFormat === 'none';
        const isDayNone = this.cfg.dayFormat === 'none';
        const isClockNone = this.cfg.clockFormat === 'none';

        if (focusTotalWorkLabel) focusTotalWorkLabel.style.display = 'block';
        if (focusTotalWorkDisplay) focusTotalWorkDisplay.style.display = 'block';

        if (isDateNone && isDayNone && isClockNone) {
            if (focusLeftCol) focusLeftCol.style.display = 'none';
            if (focusMainArea) focusMainArea.classList.add('center-only');
        } else {
            if (focusLeftCol) focusLeftCol.style.display = 'flex';
            if (focusMainArea) focusMainArea.classList.remove('center-only');
        }

        if (focusDateDisplay) focusDateDisplay.style.display = (isDateNone && isDayNone) ? 'none' : 'block';
        if (focusClockDisplay) focusClockDisplay.style.display = isClockNone ? 'none' : 'block';

        if (this.cfg.pomodoroMode) {
            if (pomoBadgeArea) pomoBadgeArea.style.display = 'block';
            if (focusPomoTimerDisplay) focusPomoTimerDisplay.style.display = 'block';
        } else {
            if (pomoBadgeArea) pomoBadgeArea.style.display = 'none';
            if (focusPomoTimerDisplay) focusPomoTimerDisplay.style.display = 'none';
        }
    },

    updateClock: function() {
        if (!this.cfg || this.cfg.clockFormat === 'none') return;
        const clockEl = document.getElementById('focusClockDisplay');
        const dateEl = document.getElementById('focusDateDisplay');

        const now = new Date();
        const hrs = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');

        if (clockEl) {
            clockEl.textContent = (this.cfg.clockFormat === '12h') ? `${hrs % 12 || 12}:${mins}` : `${String(hrs).padStart(2, '0')}:${mins}`;
        }

        if (dateEl && (this.cfg.dateFormat !== 'none' || this.cfg.dayFormat !== 'none')) {
            let dateStr = "";
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const d = now.getDate();

            if (this.cfg.dateFormat === 'ymd') dateStr = `${y}年${m}月${d}日`;
            else if (this.cfg.dateFormat === 'md') dateStr = `${m}月${d}日`;
            else if (this.cfg.dateFormat === 'd') dateStr = `${d}日`;

            const dayShort = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
            const dayFull = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"][now.getDay()];

            let dayStr = "";
            if (this.cfg.dayFormat === 'paren') dayStr = ` (${dayShort})`;
            else if (this.cfg.dayFormat === 'short') dayStr = ` ${dayShort}曜`;
            else if (this.cfg.dayFormat === 'full') dayStr = ` ${dayFull}`;

            dateEl.textContent = `${dateStr}${dayStr}`.trim();
        }
    },

    updateElapsedTimeUI: function() {
        const totalEl = document.getElementById('focusTotalWorkDisplay');
        const pomoEl = document.getElementById('focusPomoTimerDisplay');

        const tHrs = Math.floor(this.totalWorkSeconds / 3600);
        const tMins = Math.floor((this.totalWorkSeconds % 3600) / 60);
        const tSecs = this.totalWorkSeconds % 60;

        if (totalEl) {
            totalEl.textContent = (tHrs > 0)
                ? `${tHrs}:${String(tMins).padStart(2, '0')}:${String(tSecs).padStart(2, '0')}`
                : `${tMins}:${String(tSecs).padStart(2, '0')}`;
        }

        if (this.cfg && this.cfg.pomodoroMode) {
            const badge = document.getElementById('pomoStatusBadge');
            const text = document.getElementById('pomoStatusText');
            if (badge && text) {
                if (this.pomoPhase === 'WORK') {
                    badge.className = 'pomo-status-badge focus-mode';
                    text.textContent = 'FOCUSING';
                } else {
                    badge.className = 'pomo-status-badge break-mode';
                    text.textContent = 'BREAK TIME';
                }
            }

            const pMins = Math.floor(this.pomoRemaining / 60);
            const pSecs = this.pomoRemaining % 60;
            if (pomoEl) {
                pomoEl.textContent = `${String(pMins).padStart(2, '0')}:${String(pSecs).padStart(2, '0')}`;
            }
        }
    },

    updateQuote: function() {
        const quoteEl = document.getElementById('focusQuoteDisplay');
        if (!quoteEl) return;
        if (this.cfg && !this.cfg.showQuote) {
            quoteEl.style.display = 'none';
            return;
        }
        quoteEl.style.display = 'block';
        if (window.WorkQuotes) {
            quoteEl.innerHTML = window.WorkQuotes.getRandomFormattedQuote();
        }
    },

    stopSession: function() {
        this.isFocusActive = false;
        this.isPaused = false;
        this.isHelpOpen = false;
        this.isAlarmPlaying = false;
        this.lastRecordedSongFilename = null;
        if (this.alarmTimeout) {
            clearTimeout(this.alarmTimeout);
            this.alarmTimeout = null;
        }
        if (this.currentAlarmAudio) {
            this.currentAlarmAudio.pause();
            this.currentAlarmAudio = null;
        }
        if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
        if (this.quoteInterval) clearInterval(this.quoteInterval);
        if (this.clockInterval) clearInterval(this.clockInterval);
        if (this.pauseTimerInterval) clearInterval(this.pauseTimerInterval);
        const audioPlayer = document.getElementById('workAudioPlayer');
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = "";
        }
    }
};
