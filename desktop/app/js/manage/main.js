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

    // ★ エクスプローラーやFinder等で直接編集した後にウィンドウにフォーカスが戻った場合、自動で最新データを再読み込み
    window.addEventListener('focus', () => {
        if (!document.querySelector('#tableBody input.inline-input')) {
            if (window.TableController && typeof window.TableController.loadTableData === 'function') {
                window.TableController.loadTableData();
            }
        }
    });
});