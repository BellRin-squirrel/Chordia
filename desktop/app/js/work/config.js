window.WorkConfig = {
    selectedSlots: {
        'normal': null,
        'pomo-work': null,
        'pomo-break': null
    },

    init: function() {
        this.setupSegmentButtons();
        this.setupToggles();
        this.setupShuffleButtons();
        this.setupFormTriggers();
    },

    setupSegmentButtons: function() {
        const groups = document.querySelectorAll('[data-setting]');
        const customWorkWrap = document.getElementById('customWorkWrap');
        const customWorkInput = document.getElementById('customWorkInput');
        const customBreakWrap = document.getElementById('customBreakWrap');
        const customBreakInput = document.getElementById('customBreakInput');

        groups.forEach(group => {
            const btns = group.querySelectorAll('button');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => {
                        b.classList.remove('active');
                        const check = b.querySelector('.check-mark');
                        if (check) check.remove();
                    });

                    btn.classList.add('active');
                    const checkSpan = document.createElement('span');
                    checkSpan.className = 'check-mark';
                    checkSpan.textContent = '✓';
                    btn.appendChild(checkSpan);

                    const settingKey = group.dataset.setting;
                    if (settingKey === 'workDuration') {
                        const isCustom = btn.dataset.val === 'custom';
                        if (customWorkWrap) customWorkWrap.style.display = isCustom ? 'flex' : 'none';
                        if (isCustom && customWorkInput) {
                            customWorkInput.classList.remove('input-error');
                            customWorkInput.focus();
                        }
                    } else if (settingKey === 'breakDuration') {
                        const isCustom = btn.dataset.val === 'custom';
                        if (customBreakWrap) customBreakWrap.style.display = isCustom ? 'flex' : 'none';
                        if (isCustom && customBreakInput) {
                            customBreakInput.classList.remove('input-error');
                            customBreakInput.focus();
                        }
                    }
                });
            });
        });
    },

    setupToggles: function() {
        const togglePomodoro = document.getElementById('togglePomodoro');
        const pomodoroSettingsArea = document.getElementById('pomodoroSettingsArea');
        const slotAreaNormal = document.getElementById('slotAreaNormal');
        const slotAreaPomodoro = document.getElementById('slotAreaPomodoro');

        if (togglePomodoro) {
            togglePomodoro.addEventListener('change', (e) => {
                const isPomo = e.target.checked;
                if (pomodoroSettingsArea) pomodoroSettingsArea.style.display = isPomo ? 'block' : 'none';
                if (slotAreaPomodoro) slotAreaPomodoro.style.display = isPomo ? 'block' : 'none';
                if (slotAreaNormal) slotAreaNormal.style.display = isPomo ? 'none' : 'block';
            });
        }
    },

    setupShuffleButtons: function() {
        const shufBtns = [
            document.getElementById('btnShuffleNormal'),
            document.getElementById('btnShuffleWork'),
            document.getElementById('btnShuffleBreak')
        ];

        shufBtns.forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                const isCurrentlyOn = btn.dataset.state === 'on';
                const newState = isCurrentlyOn ? 'off' : 'on';
                btn.dataset.state = newState;
                btn.classList.toggle('active', newState === 'on');
                btn.querySelector('.shuf-text').textContent = (newState === 'on') ? 'ON' : 'OFF';
            });
        });
    },

    setupFormTriggers: function() {
        const triggerNormal = document.getElementById('triggerNormal');
        const triggerWork = document.getElementById('triggerWork');
        const triggerBreak = document.getElementById('triggerBreak');

        if (triggerNormal) triggerNormal.addEventListener('click', () => window.WorkPicker.open('normal'));
        if (triggerWork) triggerWork.addEventListener('click', () => window.WorkPicker.open('pomo-work'));
        if (triggerBreak) triggerBreak.addEventListener('click', () => window.WorkPicker.open('pomo-break'));

        const btnCompleteConfig = document.getElementById('btnCompleteConfig');
        if (btnCompleteConfig) {
            btnCompleteConfig.addEventListener('click', () => this.handleCompleteConfig());
        }
    },

    setSlotItem: function(slotName, item) {
        this.selectedSlots[slotName] = item;
        let labelEl = null;
        if (slotName === 'normal') labelEl = document.getElementById('labelNormal');
        else if (slotName === 'pomo-work') labelEl = document.getElementById('labelWork');
        else if (slotName === 'pomo-break') labelEl = document.getElementById('labelBreak');

        if (labelEl) {
            const prefix = (item.type === 'playlist') ? '📁 ' : (item.type === 'album') ? '💿 ' : '👤 ';
            labelEl.textContent = `${prefix}${item.name}`;
            labelEl.style.color = 'var(--text-main)';
        }
    },

    handleCompleteConfig: function() {
        const togglePomodoro = document.getElementById('togglePomodoro');
        const toggleQuote = document.getElementById('toggleQuote');
        const customWorkInput = document.getElementById('customWorkInput');
        const customBreakInput = document.getElementById('customBreakInput');
        const isPomo = togglePomodoro ? togglePomodoro.checked : false;

        const getSegmentVal = (name) => {
            const activeBtn = document.querySelector(`[data-setting="${name}"] .active`);
            return activeBtn ? activeBtn.dataset.val : null;
        };

        let finalWorkDuration = 25;
        let finalBreakDuration = 5;

        if (isPomo) {
            const workVal = getSegmentVal('workDuration');
            if (workVal === 'custom') {
                const customWork = parseInt(customWorkInput.value, 10);
                if (isNaN(customWork) || customWork <= 0) {
                    customWorkInput.classList.add('input-error');
                    customWorkInput.focus();
                    window.WorkMain.showToast("作業時間のカスタム分数を正しく入力してください", true);
                    return;
                }
                finalWorkDuration = customWork;
            } else {
                finalWorkDuration = parseInt(workVal, 10) || 25;
            }

            const breakVal = getSegmentVal('breakDuration');
            if (breakVal === 'custom') {
                const customBreak = parseInt(customBreakInput.value, 10);
                if (isNaN(customBreak) || customBreak <= 0) {
                    customBreakInput.classList.add('input-error');
                    customBreakInput.focus();
                    window.WorkMain.showToast("休憩時間のカスタム分数を正しく入力してください", true);
                    return;
                }
                finalBreakDuration = customBreak;
            } else {
                finalBreakDuration = parseInt(breakVal, 10) || 5;
            }

            if (!this.selectedSlots['pomo-work']) {
                window.WorkMain.showToast("「作業用」の再生リストを選択してください", true);
                return;
            }
            if (!this.selectedSlots['pomo-break']) {
                window.WorkMain.showToast("「休憩用」の再生リストを選択してください", true);
                return;
            }
        } else {
            if (!this.selectedSlots['normal']) {
                window.WorkMain.showToast("「使用するリスト」を選択してください", true);
                return;
            }
        }

        const workConfig = {
            dateFormat: getSegmentVal('dateFormat') || 'ymd',
            dayFormat: getSegmentVal('dayFormat') || 'paren',
            clockFormat: getSegmentVal('clockFormat') || '24h',
            showQuote: toggleQuote ? toggleQuote.checked : true,
            pomodoroMode: isPomo,
            workDuration: finalWorkDuration,
            breakDuration: finalBreakDuration,
            slots: {
                normal: {
                    target: this.selectedSlots['normal'],
                    shuffle: document.getElementById('btnShuffleNormal').dataset.state === 'on'
                },
                work: {
                    target: this.selectedSlots['pomo-work'],
                    shuffle: document.getElementById('btnShuffleWork').dataset.state === 'on'
                },
                break: {
                    target: this.selectedSlots['pomo-break'],
                    shuffle: document.getElementById('btnShuffleBreak').dataset.state === 'on'
                }
            }
        };

        localStorage.setItem('chordia_work_config', JSON.stringify(workConfig));
        window.WorkMain.showReadyView();
    }
};