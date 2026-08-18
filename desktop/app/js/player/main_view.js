(function() {
    const s = window.PlayerState;
    const u = window.PlayerUtils;

    window.MainViewController = {
        playerSettings: null,
        selectedTrackIndices: new Set(), 
        lastTrackClickedIndex: null,    
        selectedCoverData: { type: 'keep', val: null },
        currentPlSongsForCover: [],

        init: function() {
            const setClick = (id, fn) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', fn);
            };

            setClick('btnPlayAll', () => window.PlayerController.startPlaybackSession('normal'));
            setClick('btnShuffleAll', () => window.PlayerController.startPlaybackSession('shuffle'));
            setClick('btnEditPlaylistCover', () => this.openPlaylistCoverModal());

            document.addEventListener('click', (e) => {
                const isClickInTable = e.target.closest('.song-table tr');
                const isClickInMenu = e.target.closest('.context-menu');
                if (!isClickInTable && !isClickInMenu) this.clearSelection();

                const trackMenu = document.getElementById('trackContextMenu');
                if (trackMenu) trackMenu.style.display = 'none';

                document.querySelectorAll('.ph-sort-container .custom-select-dropdown').forEach(d => {
                    if (!e.target.closest('.custom-select-wrapper')) d.classList.remove('show');
                });
            });

            const searchBox = document.getElementById('playlistLocalSearch');
            if (searchBox) {
                searchBox.addEventListener('input', () => this.renderMainView());
            }

            this.initInfoModal();
            this.initTrackMenuEvents();
            this.initSmartRemoveModal();
            this.initCoverModal();
        },

        initCoverModal: function() {
            const modal = document.getElementById('playlistCoverModal');
            if (!modal) return;

            const btnCloseX = document.getElementById('btnClosePlCoverModalX');
            const btnCancel = document.getElementById('btnCancelPlCover');
            const btnSave = document.getElementById('btnSavePlCover');

            const closeModal = () => modal.classList.remove('show');
            if (btnCloseX) btnCloseX.onclick = closeModal;
            if (btnCancel) btnCancel.onclick = closeModal;

            const tabs = modal.querySelectorAll('#plCoverTabsMini .art-mini-tab-btn');
            tabs.forEach(btn => {
                btn.onclick = () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    modal.querySelectorAll('.art-mini-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const content = document.getElementById(btn.dataset.target);
                    if (content) content.classList.add('active');
                };
            });

            const songSearchInput = document.getElementById('plCoverSongSearch');
            if (songSearchInput) {
                songSearchInput.oninput = (e) => {
                    this.filterCoverSongGrid(e.target.value);
                };
            }

            const dropZone = document.getElementById('plCoverDropZone');
            const fileInput = document.getElementById('plCoverFileInput');

            if (dropZone && fileInput) {
                dropZone.onclick = () => fileInput.click();
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) this.handleCoverFile(file);
                };

                ['dragenter', 'dragover'].forEach(ev => {
                    dropZone.addEventListener(ev, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropZone.classList.add('dragover');
                    }, false);
                });
                ['dragleave', 'drop'].forEach(ev => {
                    dropZone.addEventListener(ev, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropZone.classList.remove('dragover');
                    }, false);
                });
