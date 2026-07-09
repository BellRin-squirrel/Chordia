window.TagsController = {
    autocompleteData: { title: [], artist: [], album:[] },
    activeTagsKeys:[],

    init: async function() {
        try {
            const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;
            
            const settings = await invoke("get_app_settings");
            const allTags = await invoke("get_available_tags");
            const activeTags = allTags.filter(t => settings.active_tags.includes(t.key));
            this.activeTagsKeys = activeTags.map(t => t.key);

            this.autocompleteData = await invoke("get_autocomplete_lists");

            const container = document.getElementById('dynamicTagsContainer');
            if(!container) return;
            container.innerHTML = '';

            activeTags.forEach(tag => {
                const group = document.createElement('div');
                group.className = 'form-group';
                
                const label = document.createElement('label');
                label.htmlFor = `tag_${tag.key}`;
                if (tag.key === 'title' || tag.key === 'artist') {
                    label.innerHTML = `${tag.label} <span class="required">*</span>`;
                } else {
                    label.textContent = tag.label;
                }

                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'input-with-suggest';
                inputWrapper.style.position = 'relative';
                inputWrapper.style.width = '100%';

                const input = document.createElement('input');
                input.id = `tag_${tag.key}`;
                input.setAttribute('autocomplete', 'new-password');
                input.setAttribute('name', `tag_${tag.key}_${Math.random().toString(36).substring(7)}`);
                
                if (['track', 'year', 'disc', 'bpm'].includes(tag.key)) {
                    input.type = 'number'; input.min = "1";
                    if (tag.key === 'track') input.placeholder = "1";
                } else {
                    input.type = 'text'; input.placeholder = `${tag.label}を入力`;
                }

                if (tag.key === 'title' || tag.key === 'artist') {
                    input.required = true;
                    input.addEventListener('input', this.debounce(() => {
                        if(window.DuplicateController) window.DuplicateController.checkDuplicates();
                    }, 500));
                }
                
                inputWrapper.appendChild(input);

                if (['title', 'artist', 'album'].includes(tag.key)) {
                    const suggestBox = document.createElement('div');
                    suggestBox.className = 'autocomplete-suggest';
                    suggestBox.id = `suggest_${tag.key}`;
                    suggestBox.style.display = 'none';
                    suggestBox.style.position = 'absolute';
                    suggestBox.style.top = 'calc(100% + 4px)';
                    suggestBox.style.left = '0';
                    suggestBox.style.width = '100%';
                    suggestBox.style.maxHeight = '250px';
                    suggestBox.style.overflowY = 'auto';
                    suggestBox.style.background = 'var(--card-bg)';
                    suggestBox.style.border = '1px solid var(--primary-color)';
                    suggestBox.style.borderRadius = '8px';
                    suggestBox.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
                    suggestBox.style.zIndex = '1000';

                    inputWrapper.appendChild(suggestBox);

                    input.addEventListener('focus', () => this.showSuggest(tag.key, input.value));
                    input.addEventListener('input', () => this.showSuggest(tag.key, input.value));
                    input.addEventListener('blur', () => {
                        setTimeout(() => { suggestBox.style.display = 'none'; }, 200);
                    });
                }

                group.appendChild(label); 
                group.appendChild(inputWrapper); 
                container.appendChild(group);
            });
        } catch(e) { console.error("タグの初期化に失敗しました", e); }
    },

    showSuggest: function(key, query) {
        const suggestBox = document.getElementById(`suggest_${key}`);
        if (!suggestBox) return;
        
        const q = query ? query.toLowerCase().trim() : '';
        let list = this.autocompleteData[key] ||[];
        
        if (q) {
            list = list.filter(item => item && item.toLowerCase().includes(q));
        }
        
        if (list.length === 0) {
            suggestBox.style.display = 'none';
            return;
        }

        suggestBox.innerHTML = '';
        list.slice(0, 50).forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggest-item';
            div.textContent = item;
            div.style.padding = '10px 14px';
            div.style.cursor = 'pointer';
            div.style.fontSize = '0.95rem';
            div.style.color = 'var(--text-main)';
            div.style.borderBottom = '1px solid rgba(128, 128, 128, 0.1)';
            div.style.whiteSpace = 'nowrap';
            div.style.overflow = 'hidden';
            div.style.textOverflow = 'ellipsis';
            
            div.onmouseover = () => {
                div.style.background = 'rgba(var(--primary-color-rgb, 79, 70, 229), 0.1)';
                div.style.color = 'var(--primary-color)';
                div.style.fontWeight = 'bold';
            };
            div.onmouseout = () => {
                div.style.background = 'transparent';
                div.style.color = 'var(--text-main)';
                div.style.fontWeight = 'normal';
            };

            div.onclick = () => {
                const inputEl = document.getElementById(`tag_${key}`);
                if(inputEl) {
                    inputEl.value = item;
                    suggestBox.style.display = 'none';
                    if (key === 'title' || key === 'artist') {
                        inputEl.dispatchEvent(new Event('input'));
                    }
                }
            };
            suggestBox.appendChild(div);
        });
        suggestBox.style.display = 'block';
    },

    debounce: function(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    getActiveTagsKeys: function() {
        return this.activeTagsKeys;
    }
};