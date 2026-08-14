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
                alert("検査中にエラーが発生しました: " + e);
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

        // 集計カードの描画
        const statusValEl = document.getElementById('summaryStatusVal');
        const issueCountValEl = document.getElementById('summaryIssueCountVal');
        
        if (issueCountValEl) issueCountValEl.textContent = `${totalIssues} 件`;

        if (statusValEl) {
            if (totalIssues === 0) {
                statusValEl.textContent = "正常 (問題なし)";
                statusValEl.className = "summary-value ok";
            } else if (corruptedCount > 0 || binIssueCount > 0) {
                statusValEl.textContent = "要確認 (エラーあり)";
                statusValEl.className = "summary-value error";
            } else {
                statusValEl.textContent = "軽微な警告あり";
                statusValEl.className = "summary-value warning";
            }
        }

        // 1. MP3タグ不整合
        updateBadge('badgeTagCount', tagCount);
        renderTagMismatches(report.tag_mismatches);

        // 2. 拡張機能 (bin)
        updateBadge('badgeBinCount', binIssueCount);
        renderBinStatus(report.bin_status);

        // 3. LUFS未計測曲
        updateBadge('badgeLufsCount', lufsCount);
        renderLufsUncalculated(report.uncalculated_lufs);

        // 4. userfiles破損
        updateBadge('badgeCorruptedCount', corruptedCount);
        renderCorruptedFiles(report.corrupted_userfiles);

        // 5. 不要・リンク切れファイル
        updateBadge('badgeOrphanCount', orphanCount);
        renderOrphanFiles(report);
    }

    function updateBadge(id, count) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = `${count}件`;
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
            container.innerHTML = '<div class="result-box status-ok-text">すべての楽曲のタグ情報がDBと一致しています。</div>';
            return;
        }

        let html = `<table class="integrity-table"><thead><tr><th>ファイル</th><th>タイトル</th><th>項目</th><th>DB上の値</th><th>MP3タグ上の値</th></tr></thead><tbody>`;
        list.forEach(item => {
            html += `<tr>
                <td>${escapeHtml(item.filename)}</td>
                <td>${escapeHtml(item.title)}</td>
                <td><strong>${escapeHtml(item.field)}</strong></td>
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

        if (bin.missing_tools.length > 0) {
            hasIssue = true;
            bin.missing_tools.forEach(tool => {
                html += `<li><span class="status-err-text">❌ 欠損:</span> 必須ツール <strong>${escapeHtml(tool)}</strong> がインストールされていません。</li>`;
            });
        }

        if (bin.invalid_tools.length > 0) {
            hasIssue = true;
            bin.invalid_tools.forEach(tool => {
                html += `<li><span class="status-err-text">⚠️ 破損:</span> ツール <strong>${escapeHtml(tool)}</strong> が正しく起動できません。</li>`;
            });
        }

        if (bin.unexpected_files.length > 0) {
            hasIssue = true;
            bin.unexpected_files.forEach(file => {
                html += `<li><span class="status-warn-text">❓ 不審ファイル:</span> binフォルダ内に未知の不要ファイル <strong>${escapeHtml(file)}</strong> が存在します。</li>`;
            });
        }

        if (!hasIssue) {
            html += '<li class="status-ok-text">すべての必須ツールが揃っており、不要なファイルもありません。</li>';
        }

        html += '</ul>';
        box.innerHTML = html;
    }

    function renderLufsUncalculated(list) {
        const container = document.getElementById('containerLufsUncalculated');
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = '<div class="result-box status-ok-text">すべての楽曲の音量解析が完了しています。</div>';
            return;
        }

        let html = `<table class="integrity-table"><thead><tr><th>ファイル</th><th>タイトル</th><th>アーティスト</th></tr></thead><tbody>`;
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
            box.innerHTML = '<div class="status-ok-text">設定およびデータベースファイルに破損は見つかりませんでした。</div>';
            return;
        }

        let html = '<ul class="integrity-list">';
        list.forEach(item => {
            html += `<li><span class="status-err-text">❌ 読込エラー:</span> <strong>${escapeHtml(item.filepath)}</strong> (${escapeHtml(item.error_reason)})</li>`;
        });
        html += '</ul>';
        box.innerHTML = html;
    }

    function renderOrphanFiles(report) {
        const box = document.getElementById('boxOrphanFiles');
        if (!box) return;

        let html = '<ul class="integrity-list">';
        let hasIssue = false;

        if (report.missing_music_files && report.missing_music_files.length > 0) {
            hasIssue = true;
            report.missing_music_files.forEach(file => {
                html += `<li><span class="status-err-text">❌ リンク切れ(音源):</span> DBに登録されていますがファイルが存在しません (<strong>${escapeHtml(file)}</strong>)</li>`;
            });
        }

        if (report.missing_image_files && report.missing_image_files.length > 0) {
            hasIssue = true;
            report.missing_image_files.forEach(file => {
                html += `<li><span class="status-err-text">❌ リンク切れ(画像):</span> DBに登録されていますが画像が存在しません (<strong>${escapeHtml(file)}</strong>)</li>`;
            });
        }

        if (report.orphan_music_files && report.orphan_music_files.length > 0) {
            hasIssue = true;
            report.orphan_music_files.forEach(file => {
                html += `<li><span class="status-warn-text">🗑️ 孤立音源:</span> DBで参照されていない不要な楽曲ファイル (<strong>${escapeHtml(file)}</strong>)</li>`;
            });
        }

        if (report.orphan_image_files && report.orphan_image_files.length > 0) {
            hasIssue = true;
            report.orphan_image_files.forEach(file => {
                html += `<li><span class="status-warn-text">🗑️ 孤立画像:</span> DBやプレイリストで参照されていない不要な画像 (<strong>${escapeHtml(file)}</strong>)</li>`;
            });
        }

        if (!hasIssue) {
            html += '<li class="status-ok-text">不要な孤立ファイルやリンク切れファイルはありません。</li>';
        }

        html += '</ul>';
        box.innerHTML = html;
    }
});