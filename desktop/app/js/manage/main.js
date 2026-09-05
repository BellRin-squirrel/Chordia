document.addEventListener('DOMContentLoaded', () => {
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
            // 楽曲選択モード切り替え時にセッション状態を確認
            if (window.checkChordiaSyncSession) window.checkChordiaSyncSession();
        });
    }

    const btnSearch = document.getElementById('btnSearchManage');
    const inputSearch = document.getElementById('searchInputManage');
    const btnClear = document.getElementById('btnClearSearch');

    if (btnSearch && inputSearch) {
        btnSearch.addEventListener('click', () => {
            window.TableController.execSearch(inputSearch.value.trim());
            // 検索実行時にセッション状態を確認
            if (window.checkChordiaSyncSession) window.checkChordiaSyncSession();
        });

        inputSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.TableController.execSearch(inputSearch.value.trim());
                if (window.checkChordiaSyncSession) window.checkChordiaSyncSession();
            }
        });
    }

    if (btnClear && inputSearch) {
        btnClear.addEventListener('click', () => {
            inputSearch.value = ''; 
            window.TableController.execSearch(''); 
            if (window.checkChordiaSyncSession) window.checkChordiaSyncSession();
        });
    }

    // エクスプローラー等での編集後やウィンドウ復帰時にテーブル再読み込み＆セッション状態確認
    window.addEventListener('focus', () => {
        if (!document.querySelector('#tableBody input.inline-input')) {
            if (window.TableController && typeof window.TableController.loadTableData === 'function') {
                window.TableController.loadTableData();
            }
        }
        if (window.checkChordiaSyncSession) {
            window.checkChordiaSyncSession();
        }
    });
});