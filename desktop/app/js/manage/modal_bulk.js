(function() {
    const s = window.ManageState;
    const u = window.ManageUtils;
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    window.BulkEditController = {
        commonLyric: "",

        init: function() {
            const btnBulkEdit = document.getElementById('btnBulkEdit');
            if (btnBulkEdit) {
                btnBulkEdit.addEventListener('click', () => this.open());
            }
            const btnBulkDelete = document.getElementById('btnBulkDelete');
            if (btnBulkDelete) {
                btnBulkDelete.addEventListener('click', () => this.openBulkDelete());
            }

            document.getElementById('btnCancelBulkEdit').onclick = () => document.getElementById('bulkEditModal').classList.remove('show');
            document.getElementById('btnExecBulkEdit').onclick = () => this.execute();

            const bulkArtRadioKeep = document.querySelector('input[name="bulkArtMode"][value="keep"]');
            const bulkArtRadioOverwrite = document.querySelector('input[name="bulkArtMode"][value="overwrite"]');
            
            const handleArtModeChange = () => {
                const mode = document.querySelector('input[name="bulkArtMode"]:checked').value;
                this.toggleArtControls(mode);
            };

            if (bulkArtRadioKeep) bulkArtRadioKeep.addEventListener('change', handleArtModeChange);
            if (bulkArtRadioOverwrite) bulkArtRadioOverwrite.addEventListener('change', handleArtModeChange);

            const bulkLyricRadioKeep = document.querySelector('input[name="bulkLyricMode"][value="keep"]');
            const bulkLyricRadioOverwrite = document.querySelector('input[name="bulkLyricMode"][value="overwrite"]');

            const handleLyricModeChange = () => {
                const mode = document.querySelector('input[name="bulkLyricMode"]:checked').value;
                this.toggleLyricControls(mode);
            };

            if (bulkLyricRadioKeep) bulkLyricRadioKeep.addEventListener('change', handleLyricModeChange);
            if (bulkLyricRadioOverwrite) bulkLyricRadioOverwrite.addEventListener('change', handleLyricModeChange);

            const bulkEditArtMiniTabs = document.querySelectorAll('#bulkEditArtTabsMini .art-mini-tab-btn');
            bulkEditArtMiniTabs.forEach(btn => {
                btn.onclick = () => {
                    const target = btn.dataset.target;
                    bulkEditArtMiniTabs.forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('#bulkEditModal .art-mini-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const targetContent = document.getElementById(target);
                    if (targetContent) targetContent.classList.add('active');
                    this.showError(""); 
                };
            });

            const bulkEditArtPreview = document.getElementById('currentBulkEditArtPreview');
            document.getElementById('newBulkEditArtInput').onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    s.bulkNewArtBase64 = ev.target.result;
                    bulkEditArtPreview.src = ev.target.result;
                    document.getElementById('bulkEditArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_new') : "新しい画像 (反映前)";
                    this.showError("");
                };
                reader.readAsDataURL(file);
            };

            document.getElementById('btnFetchBulkEditVideoArt').onclick = async () => {
                const url = document.getElementById('bulkEditMiniVideoUrl').value.trim();
                this.showError("");
                if (!url) { this.showError(window.i18n ? window.i18n.t('Manage.msg_enter_url') : "URLを入力してください"); return; }
                const btn = document.getElementById('btnFetchBulkEditVideoArt');
                const orgText = btn.textContent;
                btn.disabled = true; btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "確認中...";
                try {
                    const status = await invoke("check_tools_status");
                    if (!status['yt-dlp'] || !status['ffmpeg']) {
                        this.showError(window.i18n ? window.i18n.t('Manage.msg_ext_missing') : "拡張機能が不足しています");
                        return;
                    }
                    btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
                    const info = await invoke("fetch_video_info", { url: url });
                    if (info.status === 'success' && info.thumbnail) {
                        const b64 = await invoke("fetch_and_crop_thumbnail", { url: info.thumbnail });
                        if (b64) {
                            s.bulkNewArtBase64 = b64;
                            bulkEditArtPreview.src = b64;
                            document.getElementById('bulkEditArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_thumb') : "動画サムネイル (反映前)";
                            u.showToast(window.i18n ? window.i18n.t('Manage.msg_art_fetch_success') : "サムネイルを取得しました");
                        } else { this.showError("Failed to process image"); }
                    } else { this.showError(info.message || "Fetch failed"); }
                } catch(e) { this.showError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "エラーが発生しました"); }
                finally { btn.disabled = false; btn.textContent = orgText; }
            };

            document.getElementById('btnFetchBulkEditDirectArt').onclick = async () => {
                const url = document.getElementById('bulkEditMiniImageUrl').value.trim();
                this.showError("");
                if (!url) { this.showError(window.i18n ? window.i18n.t('Manage.msg_enter_url') : "URLを入力してください"); return; }
                const btn = document.getElementById('btnFetchBulkEditDirectArt');
                const orgText = btn.textContent;
                btn.disabled = true; btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "取得中...";
                try {
                    const res = await invoke("fetch_and_crop_image_url", { url: url });
                    if (res.status === 'success') {
                        s.bulkNewArtBase64 = res.data;
                        bulkEditArtPreview.src = res.data;
                        document.getElementById('bulkEditArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_url') : "画像URL (反映前)";
                        u.showToast(window.i18n ? window.i18n.t('Manage.msg_img_fetch_success') : "画像を取得しました");
                    } else { this.showError("Fetch failed: " + res.message); }
                } catch(e) { this.showError(window.i18n ? window.i18n.t('Manage.msg_network_error') : "通信エラー"); }
                finally { btn.disabled = false; btn.textContent = orgText; }
            };

            document.getElementById('btnExecBulkEditRemoveArt').onclick = () => {
                s.bulkNewArtBase64 = "REMOVE";
                bulkEditArtPreview.src = s.DEFAULT_ICON;
                document.getElementById('bulkEditArtStatusText').textContent = window.i18n ? window.i18n.t('Manage.art_status_remove') : "削除予定 (反映前)";
                this.showError("");
            };
        },

        toggleArtControls: function(mode) {
            const tabsContainer = document.getElementById('bulkEditArtTabsMini');
            const localContent = document.getElementById('bulk-edit-art-mini-local');
            const videoContent = document.getElementById('bulk-edit-art-mini-video');
            const imageContent = document.getElementById('bulk-edit-art-mini-image');
            const removeBtn = document.getElementById('btnExecBulkEditRemoveArt');
            
            const elementsToToggle = [
                tabsContainer, localContent, videoContent, imageContent, removeBtn
            ];

            const keepLabel = window.i18n ? window.i18n.t('Manage.label_keep_art') : "< 維持 > (そのまま維持されます)";

            if (mode === "keep") {
                elementsToToggle.forEach(el => {
                    if (el) {
                        el.style.pointerEvents = "none";
                        el.style.opacity = "0.4";
                    }
                });
                const artPreview = document.getElementById('currentBulkEditArtPreview');
                const statusText = document.getElementById('bulkEditArtStatusText');
                if (artPreview) artPreview.src = s.DEFAULT_ICON;
                if (statusText) statusText.textContent = keepLabel;
                s.bulkNewArtBase64 = null;
            } else {
                elementsToToggle.forEach(el => {
                    if (el) {
                        el.style.pointerEvents = "auto";
                        el.style.opacity = "1";
                    }
                });
                const artPreview = document.getElementById('currentBulkEditArtPreview');
                const statusText = document.getElementById('bulkEditArtStatusText');
                if (artPreview) artPreview.src = s.bulkNewArtBase64 || s.DEFAULT_ICON;
                if (statusText) statusText.textContent = s.bulkNewArtBase64 ? (s.bulkNewArtBase64 === "REMOVE" ? (window.i18n ? window.i18n.t('Manage.art_status_remove') : "削除予定 (反映前)") : (window.i18n ? window.i18n.t('Manage.art_status_new') : "新しい画像 (反映前)")) : "";
            }
        },

        toggleLyricControls: function(mode) {
            const lyricTextArea = document.getElementById('bulkEditLyricTextArea');
            const keepLyricLabel = window.i18n ? window.i18n.t('Manage.label_keep_lyric') : "< 維持 > (歌詞は変更されません)";

            if (lyricTextArea) {
                if (mode === "keep") {
                    lyricTextArea.style.pointerEvents = "none";
                    lyricTextArea.style.opacity = "0.4";
                    lyricTextArea.value = keepLyricLabel;
                } else {
                    lyricTextArea.style.pointerEvents = "auto";
                    lyricTextArea.style.opacity = "1";
                    lyricTextArea.value = (this.commonLyric === "< 維持 >" || this.commonLyric === "< Keep >") ? "" : this.commonLyric;
                }
            }
        },

        open: async function() {
            if (s.selectedIds.size === 0) { 
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_select_songs_prompt') : "楽曲を選択してください", true); 
                return; 
            }
            const container = document.getElementById('bulkFormContainer');
            container.innerHTML = `<p style="text-align:center; padding:20px; grid-column:1/-1;">${window.i18n ? window.i18n.t('Common.loading') : '読込中...'}</p>`;
            document.getElementById('bulkEditModal').classList.add('show');
            
            const commonValues = await invoke("get_common_values_for_selected", { filenames: Array.from(s.selectedIds) });
            const settings = await invoke("get_app_settings");
            const allTags = await invoke("get_available_tags");
            const activeTags = allTags.filter(t => settings.active_tags.includes(t.key));
            container.innerHTML = '';
            
            const keepTagText = window.i18n ? window.i18n.t('Manage.label_keep') : "< 維持 >";

            activeTags.forEach(tag => {
                const row = document.createElement('div');
                row.className = 'form-row';
                const val = commonValues[tag.key];
                const displayVal = (val === "< 維持 >" || val === "< Keep >") ? keepTagText : val;
                const tagLabel = (window.i18n && window.i18n.t) ? window.i18n.t(`Tags.${tag.key}`) : tag.label;

                row.innerHTML = `
                    <label style="font-size:0.85rem; font-weight:700; color:var(--text-sub); margin-bottom:4px;">${tagLabel}</label>
                    <input type="text" class="bulk-input" data-key="${tag.key}" value="${u.escapeHtml(displayVal)}" 
                           style="width: 100%; background: var(--bg-color); color: var(--text-main); border: 1px solid rgba(128,128,128,0.2); padding: 8px; border-radius: 6px; outline: none; box-sizing: border-box;"
                           onfocus="if(this.value==='${keepTagText}') this.value=''" onblur="if(this.value==='') this.value='${keepTagText}'">
                `;
                container.appendChild(row);
            });

            this.commonLyric = commonValues.lyric || "";

            const radioKeep = document.querySelector('input[name="bulkArtMode"][value="keep"]');
            if (radioKeep) radioKeep.checked = true;
            s.bulkNewArtBase64 = null;
            this.toggleArtControls("keep");

            const radioLyricKeep = document.querySelector('input[name="bulkLyricMode"][value="keep"]');
            if (radioLyricKeep) radioLyricKeep.checked = true;
            this.toggleLyricControls("keep");
        },

        showError: function(msg) {
            const errEl = document.getElementById('bulkEditArtErrorDisplay');
            if (!errEl) return;
            if (msg) {
                errEl.textContent = "⚠️ " + msg;
                errEl.style.display = 'block';
            } else {
                errEl.style.display = 'none';
                errEl.textContent = "";
            }
        },

        execute: async function() {
            const updates = {};
            const keepTagText = window.i18n ? window.i18n.t('Manage.label_keep') : "< 維持 >";
            
            document.querySelectorAll('#bulkFormContainer .bulk-input').forEach(input => {
                const val = input.value;
                if (val === keepTagText || val === "< 維持 >" || val === "< Keep >") {
                    updates[input.dataset.key] = "< 維持 >";
                } else {
                    updates[input.dataset.key] = val;
                }
            });
            
            const lyricMode = document.querySelector('input[name="bulkLyricMode"]:checked').value;
            if (lyricMode === "overwrite") {
                const lyricTextArea = document.getElementById('bulkEditLyricTextArea');
                updates['lyric'] = lyricTextArea ? lyricTextArea.value : "";
            } else {
                updates['lyric'] = "< 維持 >";
            }
            
            const mode = document.querySelector('input[name="bulkArtMode"]:checked').value;
            if (mode === "overwrite") {
                if (s.bulkNewArtBase64 !== null) {
                    updates['artworkBase64'] = s.bulkNewArtBase64;
                } else {
                    updates['artworkBase64'] = s.DEFAULT_ICON; 
                }
            } else {
                updates['artworkBase64'] = "< 維持 >";
            }

            document.getElementById('bulkEditModal').classList.remove('show');
            
            const btn = document.getElementById('btnExecBulkEdit');
            const originalText = btn.textContent;
            btn.disabled = true; 
            btn.textContent = window.i18n ? window.i18n.t('Common.loading') : "適用中...";
            
            try {
                const res = await invoke("update_multiple_songs", { 
                    filenames: Array.from(s.selectedIds), 
                    updates: updates 
                });
                if (res.success) {
                    u.showToast(window.i18n ? window.i18n.t('Manage.msg_bulk_updated', { count: res.count }) : `${res.count}曲を一括更新しました`, false);
                    window.TableController.loadTableData();
                }
            } catch(e) {
                console.error("Bulk edit error:", e);
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_bulk_edit_failed') : "一括更新に失敗しました", true);
            } finally {
                btn.disabled = false; btn.textContent = originalText;
            }
        },

        openBulkDelete: function() {
            if (s.selectedIds.size === 0) { 
                u.showToast(window.i18n ? window.i18n.t('Manage.msg_select_songs_prompt') : "楽曲を選択してください", true); 
                return; 
            }
            s.editingIndex = -99;
            const targetText = window.i18n 
                ? window.i18n.t('Manage.label_bulk_delete_target', { count: s.selectedIds.size }) 
                : `選択された ${s.selectedIds.size} 曲`;
                
            document.getElementById('deleteTargetName').textContent = targetText;
            document.getElementById('btnExecDelete').onclick = async () => {
                const res = await invoke("delete_multiple_songs", { filenames: Array.from(s.selectedIds) });
                if (res.success) {
                    u.showToast(window.i18n ? window.i18n.t('Manage.msg_bulk_deleted', { count: res.count }) : `${res.count}曲を削除しました`, false);
                    document.getElementById('deleteModal').classList.remove('show');
                    window.TableController.toggleSelectionMode();
                }
            };
            document.getElementById('deleteModal').classList.add('show');
        }
    };
})();
