window.i18n = {
    dictionary: {},
    fallbackDictionary: {}, // ★ 日本語フォールバック辞書

    init: async function(filename = null) {
        const invoke = window.__TAURI__ ? (window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke) : null;
        if (!invoke) return;

        try {
            // 初回に日本語フォールバック辞書を確実に保持
            if (Object.keys(this.fallbackDictionary).length === 0) {
                const jaPack = await invoke("get_language_pack", { filename: "Japanese.ini" });
                if (jaPack) this.fallbackDictionary = jaPack;
            }

            const pack = await invoke("get_language_pack", { filename: filename });
            if (pack) {
                this.dictionary = pack;
                this.applyToDOM();
            } else {
                // 読み込みエラー時は日本語をデフォルト適用
                this.dictionary = this.fallbackDictionary;
                this.applyToDOM();
            }
        } catch(e) {
            console.error("i18n init error, falling back to Japanese:", e);
            this.dictionary = this.fallbackDictionary;
            this.applyToDOM();
        }
    },

    t: function(key, params = {}) {
        if (!key) return "";
        const parts = key.split('.');
        
        let val = this.getValueFromDict(this.dictionary, parts);

        // ★ 指定された言語辞書に存在しないキーがある場合は日本語フォールバックで補完
        if (val === undefined || val === null) {
            val = this.getValueFromDict(this.fallbackDictionary, parts);
        }

        if (val === undefined || val === null) {
            return key;
        }

        if (typeof val === 'string') {
            for (const [pk, pv] of Object.entries(params)) {
                val = val.replace(new RegExp(`\\{${pk}\\}`, 'g'), pv);
            }
            return val;
        }
        return key;
    },

    getValueFromDict: function(dict, parts) {
        let current = dict;
        for (const p of parts) {
            if (current && current[p] !== undefined) {
                current = current[p];
            } else {
                return undefined;
            }
        }
        return current;
    },

    applyToDOM: function() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translated = this.t(key);
            if (translated && translated !== key) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.type === 'button' || el.type === 'submit') {
                        el.value = translated;
                    } else if (el.placeholder) {
                        el.placeholder = translated;
                    }
                } else {
                    el.textContent = translated;
                }
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.dataset.i18nPlaceholder;
            const translated = this.t(key);
            if (translated && translated !== key) {
                el.placeholder = translated;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            const translated = this.t(key);
            if (translated && translated !== key) {
                el.title = translated;
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.i18n.init();
});