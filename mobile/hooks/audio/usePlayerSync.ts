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
  const lastRecordedSongRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  const sendNowPlayingUpdate = async (overrideTimeSec?: number) => {
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

    // 同一曲に対する短時間（10秒以内）の重複呼び出しを確実にブロック
    const songKey = song.localMusicUri || `${song.title || ''}:::${song.artist || ''}`;
    const now = Date.now();
    if (lastRecordedSongRef.current.key === songKey && now - lastRecordedSongRef.current.time < 10000) {
      return;
    }
    lastRecordedSongRef.current = { key: songKey, time: now };

    try {
      const rs = await AsyncStorage.getItem('recently_played_songs');
      let list = rs ? JSON.parse(rs) : [];
      list = [song, ...list.filter((s: any) => s.localMusicUri !== song.localMusicUri)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_songs', JSON.stringify(list));

      await recordPlayHistoryWithSync(song);
    } catch (e) {}
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && currentSong && currentContextRef.current) {
      interval = setInterval(() => {
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
