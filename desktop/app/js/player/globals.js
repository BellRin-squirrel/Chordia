window.PlayerState = {
    playlists: [],
    currentPlaylistIndex: -1,
    editingPlaylistIndex: -1,
    contextTargetIndex: -1,
    isSeeking: false,
    
    // Playback State
    queue: [], 
    currentIndex: -1, 
    isPlaying: false, 
    isShuffle: false, 
    loopMode: 'off', 
    originalList: [],
    
    // Song Selection & Preload
    fullLibrary: null,
    
    DEFAULT_ICON: "icon/Chordia.png",
    
    // Icons
    SVG_PLAY: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>`,
    SVG_PAUSE: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.75 5.25a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 3 0V6.75a1.5 1.5 0 0 0-1.5-1.5Zm10.5 0a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 3 0V6.75a1.5 1.5 0 0 0-1.5-1.5Z" clip-rule="evenodd" /></svg>`,
    ICON_PLAYING: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;color:var(--primary-color);"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 1 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" /><path d="M15.932 7.757a.75.75 0 0 1 1.061 0 4.5 4.5 0 0 1 0 6.364.75.75 0 1 1-1.06-1.06 3 3 0 0 0 0-4.242.75.75 0 0 1 0-1.062Z" /></svg>`
};