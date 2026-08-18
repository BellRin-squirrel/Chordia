document.addEventListener('DOMContentLoaded', () => {
    const invoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.tauri.invoke;

    const btnStartCheck = document.getElementById('btnStartCheck');
    const loadingArea = document.getElementById('loadingArea');
    const resultsContainer = document.getElementById('resultsContainer');

    const escapeHtml = (str) => str ? String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) : '';

    if (btnStartCheck) {
        btnStartCheck.addEventListener('click', async () => {
            btnStartCheck.disabled = true;
            loadingArea.style.display = 'flex';
            resultsContainer.style.display = 'none';

            try {
                const report = await invoke("check_system_integrity");
                renderReport(report);
                resultsContainer.style.display = 'block';
            } catch (e) {
                alert((window.i18n ? window.i18n.t('Common.error') : "エラー") + ": " + e);
            } finally {
                loadingArea.style.display = 'none';
                btnStartCheck.disabled = false;
            }
        });
    }

    function renderReport(report) {
        const tagCount = report.tag_mismatches ? report.tag_mismatches.length : 0;
        
        let binIssueCount = 0;
        if (report.bin_status) {
            binIssueCount += report.bin_status.missing_tools.length;
            binIssueCount += report.bin_status.invalid_tools.length;
            binIssueCount += report.bin_status.unexpected_files.length;
        }

        const lufsCount = report.uncalculated_lufs ? report.uncalculated_lufs.length : 0;
        const corruptedCount = report.corrupted_userfiles ? report.corrupted_userfiles.length : 0;

        let orphanCount = 0;
        orphanCount += report.orphan_music_files ? report.orphan_music_files.length : 0;
        orphanCount += report.orphan_image_files ? report.orphan_image_files.length : 0;
        orphanCount += report.missing_music_files ? report.missing_music_files.length : 0;
        orphanCount += report.missing_image_files ? report.missing_image_files.length : 0;

        const totalIssues = tagCount + binIssueCount + lufsCount + corruptedCount + orphanCount;

        const statusValEl = document.getElementById('summaryStatusVal');
        const issueCountValEl = document.getElementById('summaryIssueCountVal');
        
        if (issueCountValEl) {
            issueCountValEl.textContent = window.i18n 
                ? window.i18n.t('Integrity.count_unit', { count: totalIssues }) 
                : `${totalIssues}件`;
        }

        if (statusValEl) {
            if (totalIssues === 0) {
                statusValEl.textContent = window.i18n ? window.i18n.t('Integrity.status_ok') : "正常 (問題なし)";
                statusValEl.className = "summary-value ok";
            } else if (corruptedCount > 0 || binIssueCount > 0) {
                statusValEl.textContent = window.i18n ? window.i18n.t('Integrity.status_error') : "要確認";
                statusValEl.className = "summary-value error";
            } else {
                statusValEl.textContent = window.i18n ? window.i18n.t('Integrity.status_warning') : "軽微な警告あり";
                statusValEl.className = "summary-value warning";
            }
        }

        updateBadge('badgeTagCount', tagCount);
        renderTagMismatches(report.tag_mismatches);

        updateBadge('badgeBinCount', binIssueCount);
        renderBinStatus(report.bin_status);

        updateBadge('badgeLufsCount', lufsCount);
        renderLufsUncalculated(report.uncalculated_lufs);

        updateBadge('badgeCorruptedCount', corruptedCount);
        renderCorruptedFiles(report.corrupted_userfiles);

        updateBadge('badgeOrphanCount', orphanCount);
        renderOrphanFiles(report);
    }

    function updateBadge(id, count) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = window.i18n ? window.i18n.t('Integrity.count_unit', { count: count }) : `${count}件`;
        if (count > 0) {
            el.classList.add('has-issues');
        } else {
            el.classList.remove('has-issues');
        }
    }

    function renderTagMismatches(list) {
        const container = document.getElementById('containerTagMismatches');
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = `<div class="result-box status-ok-text">${window.i18n ? window.i18n.t('Integrity.msg_tag_ok') : 'すべての楽曲のタグ情報がDBと一致しています。'}</div>`;
            return;
        }

        const thFile = window.i18n ? window.i18n.t('Integrity.th_file') : 'ファイル';
        const thTitle = window.i18n ? window.i18n.t('Tags.title') : 'タイトル';
        const thField = window.i18n ? window.i18n.t('Integrity.th_field') : '項目';
        const thDbVal = window.i18n ? window.i18n.t('Integrity.th_db_val') : 'DB上の値';
        const thTagVal = window.i18n ? window.i18n.t('Integrity.th_tag_val') : 'MP3タグ上の値';

        let html = `<table class="integrity-table"><thead><tr><th>${thFile}</th><th>${thTitle}</th><th>${thField}</th><th>${thDbVal}</th><th>${thTagVal}</th></tr></thead><tbody>`;
        list.forEach(item => {
            const fieldLabel = (window.i18n && window.i18n.t(`Tags.${item.field}`)) ? window.i18n.t(`Tags.${item.field}`) : item.field;
            html += `<tr>
                <td>${escapeHtml(item.filename)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td><strong>${escapeHtml(fieldLabel)}</strong></td>
                <td>${escapeHtml(item.db_value || '(空)')}</td>
                <td>${escapeHtml(item.file_value || '(空)')}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function renderBinStatus(bin) {
        const box = document.getElementById('boxBinStatus');
        if (!box) return;

        let html = '<ul class="integrity-list">';
        let hasIssue = false;

        const lblMissing = window.i18n ? window.i18n.t('Integrity.label_bin_missing') : '❌ 欠損:';
        const lblInvalid = window.i18n ? window.i18n.t('Integrity.label_bin_invalid') : '⚠️ 破損:';
        const lblUnexpected = window.i18n ? window.i18n.t('Integrity.label_bin_unexpected') : '❓ 不審ファイル:';

        if (bin.missing_tools.length > 0) {
            hasIssue = true;
            bin.missing_tools.forEach(tool => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_bin_missing', { tool: tool }) : `必須ツール ${tool} がインストールされていません。`;
                html += `<li><span class="status-err-text">${lblMissing}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (bin.invalid_tools.length > 0) {
            hasIssue = true;
            bin.invalid_tools.forEach(tool => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_bin_invalid', { tool: tool }) : `ツール ${tool} が正しく起動できません。`;
                html += `<li><span class="status-err-text">${lblInvalid}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (bin.unexpected_files.length > 0) {
            hasIssue = true;
            bin.unexpected_files.forEach(file => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_bin_unexpected', { file: file }) : `binフォルダ内に未知の不要ファイル ${file} が存在します。`;
                html += `<li><span class="status-warn-text">${lblUnexpected}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (!hasIssue) {
            html += `<li class="status-ok-text">${window.i18n ? window.i18n.t('Integrity.msg_bin_ok') : 'すべての必須ツールが揃っており、不要なファイルもありません。'}</li>`;
        }

        html += '</ul>';
        box.innerHTML = html;
    }

    function renderLufsUncalculated(list) {
        const container = document.getElementById('containerLufsUncalculated');
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = `<div class="result-box status-ok-text">${window.i18n ? window.i18n.t('Integrity.msg_lufs_ok') : 'すべての楽曲の音量解析が完了しています。'}</div>`;
            return;
        }

        const thFile = window.i18n ? window.i18n.t('Integrity.th_file') : 'ファイル';
        const thTitle = window.i18n ? window.i18n.t('Tags.title') : 'タイトル';
        const thArtist = window.i18n ? window.i18n.t('Tags.artist') : 'アーティスト';

        let html = `<table class="integrity-table"><thead><tr><th>${thFile}</th><th>${thTitle}</th><th>${thArtist}</th></tr></thead><tbody>`;
        list.forEach(item => {
            html += `<tr>
                <td>${escapeHtml(item.filename)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.artist)}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function renderCorruptedFiles(list) {
        const box = document.getElementById('boxCorruptedFiles');
        if (!box) return;

        if (!list || list.length === 0) {
            box.innerHTML = `<div class="status-ok-text">${window.i18n ? window.i18n.t('Integrity.msg_corrupted_ok') : '設定、言語パック、およびデータベースファイルに破損は見つかりませんでした。'}</div>`;
            return;
        }

        const lblCorrupted = window.i18n ? window.i18n.t('Integrity.label_corrupted') : '❌ 読込エラー:';
        let html = '<ul class="integrity-list">';
        list.forEach(item => {
            let reasonText = item.error_reason;
            if (window.i18n) {
                switch(item.error_reason) {
                    case "ERR_OFFICIAL_LANG_MISSING":
                        reasonText = window.i18n.t('Integrity.err_official_lang_missing');
                        break;
                    case "ERR_LANG_FILE_MODIFIED":
                        reasonText = window.i18n.t('Integrity.err_lang_file_modified');
                        break;
                    case "ERR_INI_SYNTAX":
                        reasonText = window.i18n.t('Integrity.err_ini_syntax');
                        break;
                    case "ERR_JSON_SYNTAX":
                        reasonText = window.i18n.t('Integrity.err_json_syntax');
                        break;
                    case "ERR_PLAYLIST_SYNTAX":
                        reasonText = window.i18n.t('Integrity.err_playlist_syntax');
                        break;
                    case "ERR_FILE_READ":
                        reasonText = window.i18n.t('Integrity.err_file_read');
                        break;
                }
            }
            html += `<li><span class="status-err-text">${lblCorrupted}</span> <strong>${escapeHtml(item.filepath)}</strong> (${escapeHtml(reasonText)})</li>`;
        });
        html += '</ul>';
        box.innerHTML = html;
    }

    function renderOrphanFiles(report) {
        const box = document.getElementById('boxOrphanFiles');
        if (!box) return;

        let html = '<ul class="integrity-list">';
        let hasIssue = false;

        const lblMissingMusic = window.i18n ? window.i18n.t('Integrity.label_missing_music') : '❌ リンク切れ(音源):';
        const lblMissingImage = window.i18n ? window.i18n.t('Integrity.label_missing_image') : '❌ リンク切れ(画像):';
        const lblOrphanMusic = window.i18n ? window.i18n.t('Integrity.label_orphan_music') : '🗑️ 孤立音源:';
        const lblOrphanImage = window.i18n ? window.i18n.t('Integrity.label_orphan_image') : '🗑️ 孤立画像:';

        if (report.missing_music_files && report.missing_music_files.length > 0) {
            hasIssue = true;
            report.missing_music_files.forEach(file => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_missing_music', { file: file }) : `DBに登録されていますがファイルが存在しません (${file})`;
                html += `<li><span class="status-err-text">${lblMissingMusic}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (report.missing_image_files && report.missing_image_files.length > 0) {
            hasIssue = true;
            report.missing_image_files.forEach(file => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_missing_image', { file: file }) : `DBに登録されていますが画像が存在しません (${file})`;
                html += `<li><span class="status-err-text">${lblMissingImage}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (report.orphan_music_files && report.orphan_music_files.length > 0) {
            hasIssue = true;
            report.orphan_music_files.forEach(file => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_orphan_music', { file: file }) : `DBで参照されていない不要な楽曲ファイル (${file})`;
                html += `<li><span class="status-warn-text">${lblOrphanMusic}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (report.orphan_image_files && report.orphan_image_files.length > 0) {
            hasIssue = true;
            report.orphan_image_files.forEach(file => {
                const desc = window.i18n ? window.i18n.t('Integrity.desc_orphan_image', { file: file }) : `DBやプレイリストで参照されていない不要な画像 (${file})`;
                html += `<li><span class="status-warn-text">${lblOrphanImage}</span> ${escapeHtml(desc)}</li>`;
            });
        }

        if (!hasIssue) {
            html += `<li class="status-ok-text">${window.i18n ? window.i18n.t('Integrity.msg_orphan_ok') : '不要な孤立ファイルやリンク切れファイルはありません。'}</li>`;
        }

        html += '</ul>';
        box.innerHTML = html;
    }
});