document.addEventListener('DOMContentLoaded', () => {
    // ★ 追加：URLから高度な検索パラメータを受け取り、初期状態として適用する
    const params = new URLSearchParams(window.location.search);
    const advTitle = params.get('adv_title');
    const advArtist = params.get('adv_artist');
    
    if (advTitle && advArtist) {
        window.ManageState.advancedConditions = {
            type: 'group',
            match: 'all',
            items: [
                { type: 'filter', tag: 'title', op: 'equals', val: advTitle },
                { type: 'filter', tag: 'artist', op: 'equals', val: advArtist }
            ]
        };
    }

    if (window.PlayerController && typeof window.PlayerController.init === 'function') {
        window.PlayerController.init();
    }

    if (window.ModalController && typeof window.ModalController.init === 'function') {
        window.ModalController.init();
    }

    if (window.TableController && typeof window.TableController.loadTableData === 'function') {
        window.TableController.loadTableData();
    }

    const btnToggle = document.getElementById('btnToggleSelection');
    if(btnToggle) {
        btnToggle.addEventListener('click', () => {
            window.TableController.toggleSelectionMode();
        });
    }

    const btnBulkEdit = document.getElementById('btnBulkEdit');
    if (btnBulkEdit) {
        btnBulkEdit.addEventListener('click', () => {
            if (window.ModalController && typeof window.ModalController.openBulkEditModal === 'function') {
                window.ModalController.openBulkEditModal();
            }
        });
    }

    const btnBulkDelete = document.getElementById('btnBulkDelete');
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', () => {
            if (window.ModalController && typeof window.ModalController.openBulkDeleteModal === 'function') {
                window.ModalController.openBulkDeleteModal();
            }
        });
    }

    const btnSearch = document.getElementById('btnSearchManage');
    const inputSearch = document.getElementById('searchInputManage');
    const btnClear = document.getElementById('btnClearSearch');

    if (btnSearch && inputSearch) {
        btnSearch.addEventListener('click', () => {
            window.TableController.execSearch(inputSearch.value.trim());
        });

        inputSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.TableController.execSearch(inputSearch.value.trim());
            }
        });
    }

    if (btnClear && inputSearch) {
        btnClear.addEventListener('click', () => {
            inputSearch.value = ''; 
            window.TableController.execSearch(''); 
        });
    }

    const btnAdvanced = document.getElementById('btnAdvancedSearch');
    if (btnAdvanced) {
        btnAdvanced.addEventListener('click', () => {
            if (window.ModalController && typeof window.ModalController.openAdvancedSearch === 'function') {
                window.ModalController.openAdvancedSearch();
            }
        });
    }
});