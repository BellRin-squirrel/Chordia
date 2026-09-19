import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated, Dimensions, Platform } from 'react-native';
import TrackPlayer, { RepeatMode, Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { 
  PlayCollectionContext, 
  AudioEngineType, 
  LoopModeType, 
  isStatePlaying 
} from './audio/types';
import { useQueueManager } from './audio/useQueueManager';
import { useRntpEngine } from './audio/useRntpEngine';
import { useExpoAudioEngine } from './audio/useExpoAudioEngine';
import { useIosEqualizerEngine } from './audio/useIosEqualizerEngine';
import { usePlayerSync } from './audio/usePlayerSync';
import { initEqualizer, applyEqualizerSettings } from '../utils/equalizer';

export type { PlayCollectionContext };

const { height } = Dimensions.get('window');

export const useAudioPlayer = () => {
  const [audioEngine, setAudioEngine] = useState<AudioEngineType>('rntp');
  const [isPlaying, setIsPlaying] = useState(false);

  // UI状態
  const [isFullPlayer, setIsFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [navStackLength, setNavStackLength] = useState(1);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const toastAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const queueTransitionAnim = useRef(new Animated.Value(0)).current;

  const currentContextRef = useRef<PlayCollectionContext | null>(null);
  const isSkippingRef = useRef(false);

  // キュー管理
  const queueMgr = useQueueManager();

  // イベント前読み用関数 Ref
  const handleNextRef = useRef<() => void>(() => {});

  // 各プレイヤーエンジン
  const rntp = useRntpEngine();
  const expoAudio = useExpoAudioEngine(() => handleNextRef.current());
  const iosEq = useIosEqualizerEngine(() => handleNextRef.current());

  // 同期・履歴管理
  const sync = usePlayerSync({
    isPlaying,
    currentSong: queueMgr.currentSong,
    currentSongRef: queueMgr.currentSongRef,
    activeQueueRef: queueMgr.activeQueueRef,
    currentContextRef,
    shuffleRef: queueMgr.shuffleRef,
    loopRef: queueMgr.loopRef,
    getCurrentPositionSec: () => {
      if (iosEq.isIOSEQActiveRef.current) {
        return Math.floor(iosEq.getPositionIOS());
      }
      if (audioEngine === 'rntp') {
        return Math.floor(rntp.rntpProgress.position);
      }
      return Math.floor((expoAudio.playbackStatusExpo.positionMillis || 0) / 1000);
    },
  });

  const showToast = (message: string) => {
    if (toastVisible) return;
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setToastVisible(false);
        });
      }, 2500);
    });
  };

  // エンジン初期化
  useEffect(() => {
    AsyncStorage.getItem('audioEngine').then((val) => {
      if (val === 'expo-av' || val === 'rntp') setAudioEngine(val);
    });

    (async () => {
      try {
        await initEqualizer(0);
        const eqJson = await AsyncStorage.getItem('chordia_equalizer_settings');
        if (eqJson) {
          const parsed = JSON.parse(eqJson);
          iosEq.isIOSEQActiveRef.current = Platform.OS === 'ios' && !!parsed.isEnabled;
          applyEqualizerSettings({
            enabled: !!parsed.isEnabled,
            preamp: parsed.preamp || 0,
            gains: Array.isArray(parsed.bands) ? parsed.bands.map((b: any) => b.gain) : [],
          });
        }
      } catch (e) {}
    })();

    return () => {
      expoAudio.clearExpoResources();
      iosEq.clearIOSEQPolling();
    };
  }, []);

  const playbackStatus = iosEq.isIOSEQActiveRef.current 
    ? iosEq.playbackStatusIOSEQ 
    : (audioEngine === 'rntp' ? {
        positionMillis: rntp.rntpProgress.position * 1000,
        durationMillis: rntp.rntpProgress.duration * 1000,
        isPlaying: rntp.isRNTPPlaying,
      } : expoAudio.playbackStatusExpo);

  useEffect(() => {
    if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp') {
      setIsPlaying(rntp.isRNTPPlaying);
    }
  }, [rntp.isRNTPPlaying, audioEngine]);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp') {
        setIsPlaying(isStatePlaying(event));
      }
    });
    return () => sub.remove();
  }, [audioEngine]);

  const loadAndPlayInternal = async (
    song: any,
    activeQueue: any[] = [],
    startIndex: number = 0,
    startPositionMs: number = 0,
    shouldPlay: boolean = true,
    targetEngine?: AudioEngineType
  ) => {
    const targetSeconds = startPositionMs > 0 ? startPositionMs / 1000 : 0;

    let isEQEnabled = false;
    try {
      const eqRaw = await AsyncStorage.getItem('chordia_equalizer_settings');
      if (eqRaw) isEQEnabled = !!JSON.parse(eqRaw).isEnabled;
    } catch (e) {}

    // iOS: イコライザ有効時はネイティブ AVAudioEngine で再生
    if (Platform.OS === 'ios' && isEQEnabled) {
      expoAudio.clearExpoResources();
      await rntp.clearRNTPNotification();

      const success = iosEq.loadAndPlayIOS(song.localMusicUri, targetSeconds, shouldPlay);
      if (success) {
        iosEq.isIOSEQActiveRef.current = true;
        setIsPlaying(shouldPlay);
        iosEq.startIOSEQPolling(setIsPlaying);

        if (shouldPlay) sync.sendNowPlayingUpdate(Math.floor(targetSeconds));

        queueMgr.setCurrentSong(song);
        queueMgr.currentSongRef.current = song;
        queueMgr.updateQueueIndexes(startIndex, activeQueue);
        sync.saveHistory(song);
        return;
      }
      iosEq.isIOSEQActiveRef.current = false;
    }

    iosEq.isIOSEQActiveRef.current = false;
    iosEq.stopIosEQ();

    const engineToUse = targetEngine || audioEngine;

    try {
      if (engineToUse === 'rntp') {
        expoAudio.clearExpoResources();
        await rntp.restoreRNTPNotification();
        await TrackPlayer.reset();

        const tracks = activeQueue.map((s) => ({
          id: s.localMusicUri,
          url: s.localMusicUri,
          title: s.title || 'Unknown',
          artist: s.artist || 'Unknown',
          artwork: s.localImageUri || require('../assets/images/icon.png'),
          originalData: s,
        }));
        await TrackPlayer.add(tracks);
        await TrackPlayer.skip(startIndex);

        if (queueMgr.loopRef.current === 'ONE') await TrackPlayer.setRepeatMode(RepeatMode.Track);
        else if (queueMgr.loopRef.current === 'ALL') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        else await TrackPlayer.setRepeatMode(RepeatMode.Off);

        if (targetSeconds > 0) {
          try { await TrackPlayer.setVolume(0); } catch (e) {}
          try { await TrackPlayer.seekTo(targetSeconds); } catch (e) {}
        }

        setTimeout(async () => {
          try {
            if (targetSeconds > 0) await TrackPlayer.seekTo(targetSeconds);
            if (shouldPlay) {
              await TrackPlayer.play();
              setIsPlaying(true);
              if (Platform.OS === 'android') {
                setTimeout(rntp.syncAndroidEqualizerSession, 250);
                setTimeout(rntp.syncAndroidEqualizerSession, 800);
              }
              if (targetSeconds > 0) {
                setTimeout(async () => {
                  try {
                    const cur = await TrackPlayer.getPosition();
                    if (targetSeconds > 1 && cur < 0.5) await TrackPlayer.seekTo(targetSeconds);
                    await TrackPlayer.setVolume(1.0);
                  } catch (e) {
                    try { await TrackPlayer.setVolume(1.0); } catch (_) {}
                  }
                }, 120);
              } else {
                await TrackPlayer.setVolume(1.0);
              }
              sync.sendNowPlayingUpdate(Math.floor(targetSeconds));
            } else {
              setIsPlaying(false);
            }
          } catch (e) {
            try { await TrackPlayer.setVolume(1.0); } catch (_) {}
          }
        }, 200);

      } else {
        await rntp.clearRNTPNotification();
        const isLoopOne = queueMgr.loopRef.current === 'ONE';
        await expoAudio.initExpoAudioPlayer(song, isLoopOne, targetSeconds > 0 ? false : shouldPlay, setIsPlaying);

        if (targetSeconds > 0) {
          setTimeout(() => {
            try {
              expoAudio.expoAudioPlayerRef.current?.seekTo(targetSeconds);
              expoAudio.setPlaybackStatusExpo((prev) => ({ ...prev, positionMillis: startPositionMs }));
              if (shouldPlay) {
                expoAudio.expoAudioPlayerRef.current?.play();
                setIsPlaying(true);
              }
            } catch (e) {}
          }, 100);
        }

        if (shouldPlay) sync.sendNowPlayingUpdate(Math.floor(targetSeconds));
      }

      queueMgr.setCurrentSong(song);
      queueMgr.currentSongRef.current = song;
      queueMgr.updateQueueIndexes(startIndex, activeQueue);
      sync.saveHistory(song);
    } catch (e) {}
  };

  const changeAudioEngine = async (engine: AudioEngineType) => {
    if (engine === audioEngine) return;
    const wasPlaying = isPlaying;
    const currentSongToRestore = queueMgr.currentSongRef.current;
    let currentPosition = 0;

    if (iosEq.isIOSEQActiveRef.current) {
      currentPosition = (iosEq.getPositionIOS() || 0) * 1000;
      iosEq.stopIosEQ();
    } else if (audioEngine === 'rntp') {
      try {
        currentPosition = (await TrackPlayer.getPosition()) * 1000;
        await rntp.clearRNTPNotification();
      } catch (e) {}
    } else {
      currentPosition = expoAudio.playbackStatusExpo.positionMillis || 0;
      expoAudio.clearExpoResources();
    }

    setAudioEngine(engine);
    await AsyncStorage.setItem('audioEngine', engine);

    if (currentSongToRestore && queueMgr.activeQueueRef.current.length > 0) {
      setTimeout(() => {
        loadAndPlayInternal(currentSongToRestore, queueMgr.activeQueueRef.current, queueMgr.indexRef.current, currentPosition, wasPlaying, engine);
      }, 400);
    } else {
      queueMgr.setPlayQueue([]);
      queueMgr.setCurrentSong(null);
    }
  };

  const startQueue = (
    songs: any[],
    selectedSong?: any | null,
    forceShuffle?: boolean,
    context?: PlayCollectionContext | null,
    startPositionMs?: number,
    initialLoop?: LoopModeType,
    customQueue?: any[]
  ) => {
    if (songs.length === 0 && (!customQueue || customQueue.length === 0)) return;

    queueMgr.originalQueueRef.current = songs.length > 0 ? [...songs] : (customQueue ? [...customQueue] : []);

    const newShuffle = forceShuffle !== undefined ? forceShuffle : queueMgr.isShuffle;
    queueMgr.setIsShuffle(newShuffle);
    queueMgr.shuffleRef.current = newShuffle;

    if (initialLoop !== undefined) {
      queueMgr.setLoopMode(initialLoop);
      queueMgr.loopRef.current = initialLoop;
    }

    currentContextRef.current = context !== undefined ? context : currentContextRef.current;

    if (startPositionMs && startPositionMs > 0) {
      sync.relayCooldownRef.current = true;
      setTimeout(() => { sync.relayCooldownRef.current = false; }, 3500);
    }

    let newActiveQueue: any[] = [];
    let targetIndex = 0;

    if (customQueue && customQueue.length > 0) {
      newActiveQueue = [...customQueue];
      targetIndex = selectedSong
        ? newActiveQueue.findIndex((s) => s.localMusicUri === selectedSong.localMusicUri)
        : 0;
      if (targetIndex === -1) {
        if (selectedSong) {
          newActiveQueue.unshift(selectedSong);
          targetIndex = 0;
        } else {
          targetIndex = 0;
        }
      }
    } else {
      let firstSong = selectedSong;
      if (!firstSong) {
        if (newShuffle) {
          const shuffled = [...songs].sort(() => Math.random() - 0.5);
          firstSong = shuffled[0];
        } else {
          firstSong = songs[0];
        }
      }
      newActiveQueue = queueMgr.rebuildActiveQueue(newShuffle, firstSong);
      targetIndex = newActiveQueue.findIndex((s) => s.localMusicUri === firstSong.localMusicUri);
    }

    queueMgr.activeQueueRef.current = newActiveQueue;
    const songToPlay = newActiveQueue[targetIndex] || selectedSong || songs[0];
    loadAndPlayInternal(songToPlay, newActiveQueue, targetIndex, startPositionMs || 0, true);
  };

  const toggleShuffleMode = async () => {
    const nextShuffle = !queueMgr.isShuffle;
    queueMgr.setIsShuffle(nextShuffle);
    queueMgr.shuffleRef.current = nextShuffle;

    if (!queueMgr.currentSongRef.current || queueMgr.originalQueueRef.current.length === 0) return;
    const current = queueMgr.currentSongRef.current;

    const newActiveQueue = queueMgr.rebuildActiveQueue(nextShuffle, current);
    queueMgr.activeQueueRef.current = newActiveQueue;

    const targetIndex = newActiveQueue.findIndex((s) => s.localMusicUri === current.localMusicUri);
    queueMgr.updateQueueIndexes(targetIndex, newActiveQueue);

    if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp') {
      try {
        const queue = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        if (activeIndex !== undefined && activeIndex !== null) {
          const indicesToRemove = queue.map((_, i) => i).filter((i) => i !== activeIndex);
          if (indicesToRemove.length > 0) await TrackPlayer.remove(indicesToRemove);
          const tracksBefore = newActiveQueue.slice(0, targetIndex).map((s) => ({
            id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
            artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s,
          }));
          const tracksAfter = newActiveQueue.slice(targetIndex + 1).map((s) => ({
            id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
            artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s,
          }));
          if (tracksBefore.length > 0) await TrackPlayer.add(tracksBefore, 0);
          if (tracksAfter.length > 0) await TrackPlayer.add(tracksAfter);
        }
      } catch (e) {}
    }
    sync.sendNowPlayingUpdate();
  };

  const toggleLoopMode = async () => {
    const modes: LoopModeType[] = ['OFF', 'ALL', 'ONE'];
    const nextLoop = modes[(modes.indexOf(queueMgr.loopMode) + 1) % 3];
    queueMgr.setLoopMode(nextLoop);
    queueMgr.loopRef.current = nextLoop;

    if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp') {
      if (nextLoop === 'ONE') await TrackPlayer.setRepeatMode(RepeatMode.Track);
      else if (nextLoop === 'ALL') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      else await TrackPlayer.setRepeatMode(RepeatMode.Off);
    } else if (!iosEq.isIOSEQActiveRef.current) {
      if (expoAudio.expoAudioPlayerRef.current) {
        expoAudio.expoAudioPlayerRef.current.loop = nextLoop === 'ONE';
        expoAudio.expoAudioPlayerRef.current.isLooping = nextLoop === 'ONE';
      }
    }
    sync.sendNowPlayingUpdate();
  };

  const handleNextInternal = async () => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    setTimeout(() => { isSkippingRef.current = false; }, 600);

    const activeQueue = queueMgr.activeQueueRef.current;
    const currentSong = queueMgr.currentSongRef.current;
    const mode = queueMgr.loopRef.current;
    const idx = queueMgr.indexRef.current;

    if (mode === 'ONE' && currentSong) {
      loadAndPlayInternal(currentSong, activeQueue, idx, 0, true);
      return;
    }

    const nextIdx = idx + 1;
    if (nextIdx < activeQueue.length) {
      if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp') {
        await TrackPlayer.skipToNext();
      } else {
        const nextSong = activeQueue[nextIdx];
        loadAndPlayInternal(nextSong, activeQueue, nextIdx, 0, true);
      }
    } else {
      if (mode === 'ALL' && queueMgr.originalQueueRef.current.length > 0) {
        let nextActiveQueue = queueMgr.originalQueueRef.current;
        if (queueMgr.shuffleRef.current) {
          nextActiveQueue = [...queueMgr.originalQueueRef.current].sort(() => Math.random() - 0.5);
        }
        queueMgr.activeQueueRef.current = nextActiveQueue;
        const firstSong = nextActiveQueue[0];
        loadAndPlayInternal(firstSong, nextActiveQueue, 0, 0, true);
      } else {
        setIsPlaying(false);
        sync.sendNowPlayingUpdate();
      }
    }
  };

  handleNextRef.current = handleNextInternal;
  const handleNext = () => handleNextInternal();

  const handlePrev = async () => {
    if (iosEq.isIOSEQActiveRef.current) {
      const currentPos = (iosEq.getPositionIOS() || 0) * 1000;
      if (currentPos > 3000) {
        iosEq.seekIosEQ(0);
        sync.sendNowPlayingUpdate(0);
        return;
      }
      let prevIdx = queueMgr.indexRef.current - 1;
      if (prevIdx < 0) prevIdx = queueMgr.loopRef.current === 'ALL' ? queueMgr.activeQueueRef.current.length - 1 : 0;
      const prevSong = queueMgr.activeQueueRef.current[prevIdx];
      loadAndPlayInternal(prevSong, queueMgr.activeQueueRef.current, prevIdx, 0, true);
      return;
    }

    if (audioEngine === 'rntp') {
      const currentPos = await TrackPlayer.getPosition();
      if (currentPos > 3) await TrackPlayer.seekTo(0);
      else await TrackPlayer.skipToPrevious();
    } else {
      const activeQueue = queueMgr.activeQueueRef.current;
      const idx = queueMgr.indexRef.current;
      const currentPos = expoAudio.playbackStatusExpo?.positionMillis || 0;
      if (currentPos > 3000) {
        try {
          expoAudio.expoAudioPlayerRef.current?.seekTo(0);
          expoAudio.setPlaybackStatusExpo((prev) => ({ ...prev, positionMillis: 0 }));
        } catch (e) {}
        sync.sendNowPlayingUpdate(0);
        return;
      }

      let prevIdx = idx - 1;
      if (prevIdx < 0) {
        prevIdx = queueMgr.loopRef.current === 'ALL' ? activeQueue.length - 1 : 0;
      }
      const prevSong = activeQueue[prevIdx];
      loadAndPlayInternal(prevSong, activeQueue, prevIdx, 0, true);
    }
  };

  const togglePlayPause = async () => {
    if (iosEq.isIOSEQActiveRef.current) {
      if (isPlaying) {
        iosEq.pauseIosEQ();
        setIsPlaying(false);
      } else {
        iosEq.playIosEQ();
        setIsPlaying(true);
      }
      sync.sendNowPlayingUpdate();
      return;
    }

    if (audioEngine === 'rntp') {
      const state = await TrackPlayer.getState();
      const playing = isStatePlaying(state);
      if (playing) {
        setIsPlaying(false);
        await TrackPlayer.pause();
        sync.sendNowPlayingUpdate();
      } else {
        setIsPlaying(true);
        await TrackPlayer.play();
        if (Platform.OS === 'android') {
          setTimeout(rntp.syncAndroidEqualizerSession, 250);
        }
        sync.sendNowPlayingUpdate();
      }
    } else {
      const player = expoAudio.expoAudioPlayerRef.current;
      if (!player) return;
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        sync.sendNowPlayingUpdate();
      } else {
        await expoAudio.configureExpoAudioMode();
        player.play();
        setIsPlaying(true);
        sync.sendNowPlayingUpdate();
      }
    }
  };

  const setPositionAsync = async (v: number) => {
    if (iosEq.isIOSEQActiveRef.current) {
      iosEq.seekIosEQ(v / 1000);
    } else if (audioEngine === 'rntp') {
      await TrackPlayer.seekTo(v / 1000);
    } else {
      try {
        expoAudio.expoAudioPlayerRef.current?.seekTo(v / 1000);
        expoAudio.setPlaybackStatusExpo((prev) => ({ ...prev, positionMillis: v }));
      } catch (e) {}
    }
    sync.sendNowPlayingUpdate(Math.floor(v / 1000));
  };

  const closeFullPlayer = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => { 
      setIsFullPlayer(false); setShowQueue(false); setShowLyrics(false); queueTransitionAnim.setValue(0);
    });
  };

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp' && event.track && event.track.originalData) {
        const newSong = event.track.originalData;
        queueMgr.setCurrentSong(newSong);
        queueMgr.currentSongRef.current = newSong;

        const activeQueue = queueMgr.activeQueueRef.current;
        const idx = activeQueue.findIndex((s) => s.localMusicUri === newSong.localMusicUri);

        const prevIdx = queueMgr.indexRef.current;
        const lastIdx = activeQueue.length - 1;
        if (prevIdx === lastIdx && idx === 0 && queueMgr.loopRef.current === 'ALL') {
          if (queueMgr.shuffleRef.current && queueMgr.originalQueueRef.current.length > 0) {
            const nextShuffled = [...queueMgr.originalQueueRef.current].sort(() => Math.random() - 0.5);
            queueMgr.activeQueueRef.current = nextShuffled;
            loadAndPlayInternal(nextShuffled[0], nextShuffled, 0, 0, true);
            return;
          }
        }

        if (idx !== -1) {
          queueMgr.updateQueueIndexes(idx, activeQueue);
        }
        sync.saveHistory(newSong);

        if (Platform.OS === 'android') {
          setTimeout(rntp.syncAndroidEqualizerSession, 250);
          setTimeout(rntp.syncAndroidEqualizerSession, 800);
        }

        if (!sync.relayCooldownRef.current) {
          sync.sendNowPlayingUpdate(0);
        }
      }
    });

    const queueEndedSub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngine === 'rntp' && queueMgr.loopRef.current === 'ALL') {
        const queueToUse = queueMgr.shuffleRef.current 
          ? [...queueMgr.originalQueueRef.current].sort(() => Math.random() - 0.5)
          : [...queueMgr.originalQueueRef.current];
        if (queueToUse.length > 0) {
          queueMgr.activeQueueRef.current = queueToUse;
          loadAndPlayInternal(queueToUse[0], queueToUse, 0, 0, true);
        }
      }
    });

    return () => {
      sub.remove();
      queueEndedSub.remove();
    };
  }, [audioEngine]);

  return { 
    sound: { setPositionAsync },
    audioEngine, 
    changeAudioEngine, 
    isPlaying, 
    currentSong: queueMgr.currentSong, 
    playbackStatus, 
    playQueue: queueMgr.playQueue, 
    currentIndex: queueMgr.currentIndex, 
    loopMode: queueMgr.loopMode, 
    toggleLoopMode, 
    isShuffle: queueMgr.isShuffle, 
    toggleShuffleMode, 
    isFullPlayer, 
    setIsFullPlayer, 
    showQueue, 
    setShowQueue, 
    showLyrics, 
    setShowLyrics, 
    toastVisible, 
    toastMessage, 
    toastAnim, 
    showToast,
    navStackLength, 
    setNavStackLength,
    startQueue, 
    loadAndPlay: (song: any) => startQueue([song], song, false, null), 
    handleNext, 
    handlePrev, 
    togglePlayPause, 
    slideAnim, 
    queueTransitionAnim, 
    closeFullPlayer 
  };
};