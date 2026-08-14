document.addEventListener('DOMContentLoaded', () => {
    // スクロール時にナビゲーションバーへシャドウ（影）を追加
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });
});