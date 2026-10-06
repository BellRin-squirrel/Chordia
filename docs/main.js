document.addEventListener('DOMContentLoaded', () => {
    // タブ切り替え処理
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-tab');

            // ボタンのアクティブ状態切り替え
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // コンテンツの表示/非表示切り替え
            tabContents.forEach(content => {
                if (content.id === targetId) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
});