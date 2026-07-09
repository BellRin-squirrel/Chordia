(function() {
    window.LyricsController = {
        init: async function() {
            // 親ウィンドウ（プレイヤー）の存在確認
            if (!window.opener || !window.opener.PlayerState) {
                console.error("Parent window (Player) not found.");
                document.getElementById('lyricsBody').textContent = "プレイヤーが見つかりません。";
                return;
            }

            // 親ウィンドウの再生状態を参照
            const s = window.opener.PlayerState;
            const currentSong = s.queue[s.currentIndex];

            if (currentSong) {
                this.updateView(currentSong);
            }

            // プレイヤー側で曲が変わったことを検知するための定期チェック（オプション）
            // 通常はプレイヤー側から updateView が呼ばれますが、念のため
            setInterval(() => {
                const newSong = s.queue[s.currentIndex];
                if (newSong && this.lastFilename !== newSong.musicFilename) {
                    this.updateView(newSong);
                }
            }, 1000);
        },

        lastFilename: null,

        updateView: function(song) {
            if (!song) return;
            this.lastFilename = song.musicFilename;

            const titleEl = document.getElementById('songTitle');
            const artistEl = document.getElementById('songArtist');
            const lyricsBody = document.getElementById('lyricsBody');

            if (titleEl) titleEl.textContent = song.title || "Unknown Title";
            if (artistEl) artistEl.textContent = song.artist || "Unknown Artist";
            
            // ★ 最適化: Python(eel)を介さず、楽曲オブジェクト内の歌詞データを直接使用
            const lyricText = song.lyric || "";

            if (lyricsBody) {
                if (lyricText && lyricText.trim() !== "") {
                    lyricsBody.textContent = lyricText;
                    lyricsBody.classList.remove('no-lyrics');
                } else {
                    lyricsBody.textContent = "歌詞が登録されていません。";
                    lyricsBody.classList.add('no-lyrics');
                }
                // スクロール位置をトップに戻す
                const container = document.querySelector('.lyrics-container');
                if (container) container.scrollTop = 0;
            }
        }
    };

    // DOM読み込み完了時に初期化
    document.addEventListener('DOMContentLoaded', () => window.LyricsController.init());
})();