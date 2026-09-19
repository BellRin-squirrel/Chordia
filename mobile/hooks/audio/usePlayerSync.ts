import { useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  addPlayHistoryApi, 
  verifyChordiaSyncSession, 
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

      const ph = await AsyncStorage.getItem('chordia_playback_history');
      let playHistory = ph ? JSON.parse(ph) : [];
      playHistory = [{
        id: `${song.localMusicUri || 'song'}_${Date.now()}`,
        title: song.title || 'Untitled',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        localMusicUri: song.localMusicUri,
        localImageUri: song.localImageUri,
        playedAt: new Date().toISOString(),
      }, ...playHistory].slice(0, 500);
      await AsyncStorage.setItem('chordia_playback_history', JSON.stringify(playHistory));

      const isValid = await verifyChordiaSyncSession(true);
      if (isValid) {
        const accountJson = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (accountJson) {
          const account = JSON.parse(accountJson);
          if (account.sid) {
            addPlayHistoryApi(account.sid, song.title || 'Untitled', song.artist || 'Unknown Artist', song.album || 'Unknown Album').catch(() => {});
          }
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && currentSong && currentContextRef.current) {
      interval = setInterval(() => {
        if (AppState.currentState === 'active' && !relayCooldownRef.current) {
          sendNowPlayingUpdate();
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentSong]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'active') {
        if (isPlaying && currentSong && currentContextRef.current) {
          sendNowPlayingUpdate();
        }
      }
    });
    return () => subscription.remove();
  }, [isPlaying, currentSong]);

  return {
    relayCooldownRef,
    sendNowPlayingUpdate,
    saveHistory,
  };
};