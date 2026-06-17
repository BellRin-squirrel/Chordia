window.ManageState = {
    libraryData: [],
    editingIndex: -1,
    newArtBase64: null,
    currentPlayingIndex: -1,
    isSeeking: false,
    clickTimer: null,
    DEFAULT_ICON: "icon/Chordia.png",
    
    sortState: { field: null, direction: 'asc' },
    
    currentPage: 1,
    itemsPerPage: 50,
    isShowAll: false,
    totalItems: 0,
    
    // 選択モード用
    isSelectionMode: false,
    selectedIds: new Set(), 
    
    activeTags: [],
    tagLabels: {},
    
    SVG_PLAY: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:24px;height:24px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>`,
    SVG_PAUSE: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:24px;height:24px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>`
};