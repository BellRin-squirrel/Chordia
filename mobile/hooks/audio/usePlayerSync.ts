import { useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  recordPlayHistoryWithSync, 
  registerNowPlayingApi, 
  ACCOUNT_STORAGE_KEY 
} from '../../utils/chordiaSync';
import { PlayCollectionContext } from './types';

interface UsePlayerSyncProps {
  isPlaying: boolean;
  currentSong: any;
  currentSongRef: React.MutableRefObject<any>;
  activeQueueRef: React.MutableRefObject<any[]>;
  currentContextRef: React.MutableRefObject<PlayCollectionContext | null>;
  shuffleRef: React.MutableRefObject<boolean>;
  loopRef: React.MutableRefObject<string>;
  getCurrentPositionSec: () => number;
}

export const usePlayerSync = ({
  isPlaying,
  currentSong,
  currentSongRef,
  activeQueueRef,
  currentContextRef,
  shuffleRef,
  loopRef,
  getCurrentPositionSec,
}: UsePlayerSyncProps) => {
  const isSendingNowPlayingRef = useRef(false);
  const relayCooldownRef = useRef(false);

  const sendNowPlayingUpdate = async (overrideTimeSec?: number) => {
    // バックグラウンド移行時は無差別な通信を控えて安定化
    if (AppState.currentState !== 'active') return;

    if (!currentContextRef.current) return;
    if (!currentSongRef.current) return;
    if (isSendingNowPlayingRef.current) return;

    try {
      const rawAccount = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (!rawAccount) return;
      const account = JSON.parse(rawAccount);
      if (!account?.sid) return;

      isSendingNowPlayingRef.current = true;

      const musiclist = activeQueueRef.current.map((s: any) => ({
        title: s.title || 'Untitled',
        artist: s.artist || 'Unknown Artist',
        album: s.album || 'Unknown Album',
      }));

      const currentTimeSec = overrideTimeSec !== undefined 
        ? overrideTimeSec 
        : getCurrentPositionSec();

      await registerNowPlayingApi(account.sid, {
        playlistID: currentContextRef.current.playlistID,
        playlistName: currentContextRef.current.playlistName,
        shuffle: !!shuffleRef.current,
        loop: loopRef.current !== 'OFF',
        musiclist,
        nowPlayingTitle: currentSongRef.current.title || 'Untitled',
        nowPlayingArtist: currentSongRef.current.artist || 'Unknown Artist',
        nowPlayingAlbum: currentSongRef.current.album || 'Unknown Album',
        nowPlayingTime: Math.max(0, currentTimeSec),
      });
    } catch (e) {
    } finally {
      isSendingNowPlayingRef.current = false;
    }
  };

  const saveHistory = async (song: any) => {
    if (!song) return;

    try {
      const rs = await AsyncStorage.getItem('recently_played_songs');
      let list = rs ? JSON.parse(rs) : [];
      list = [song, ...list.filter((s: any) => s.localMusicUri !== song.localMusicUri)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_songs', JSON.stringify(list));

      // ログイン中は WAL 方式で先行一時保存 → オンライン送信成功時に自動削除（オフライン時は保持）
      await recordPlayHistoryWithSync(song);
    } catch (e) {}
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && currentSong && currentContextRef.current) {
      interval = setInterval(() => {
        // フォアグラウンド時のみ定期送信
        if (AppState.currentState === 'active' && !relayCooldownRef.current) {
          sendNowPlayingUpdate();
        }
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentSong]);

  return {
    relayCooldownRef,
    sendNowPlayingUpdate,
    saveHistory,
  };
};