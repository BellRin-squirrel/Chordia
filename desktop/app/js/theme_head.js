(function() {
    const savedPrimary = localStorage.getItem('theme_primary_color');
    const savedBg = localStorage.getItem('theme_bg_color');
    const savedSubBg = localStorage.getItem('theme_sub_bg_color');
    const savedText = localStorage.getItem('theme_text_color');
    const root = document.documentElement;

    function adjustColorBrightness(hex, amount) {
        let usePound = false;
        if (hex[0] == "#") { hex = hex.slice(1); usePound = true; }
        let num = parseInt(hex, 16);
        let r = (num >> 16) + amount; if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amount; if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amount; if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    }

    function hexToRgba(hex, alpha) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (savedPrimary) {
        root.style.setProperty('--primary-color', savedPrimary);
        const dark = adjustColorBrightness(savedPrimary, -20);
        root.style.setProperty('--primary-color-dark', dark);
    }

    if (savedBg) {
        root.style.setProperty('--bg-color', savedBg);
    }
    
    if (savedSubBg) {
        root.style.setProperty('--card-bg', savedSubBg);
    }
    
    if (savedText) {
        root.style.setProperty('--text-main', savedText);
        root.style.setProperty('--text-sub', hexToRgba(savedText, 0.6));
    }
})();