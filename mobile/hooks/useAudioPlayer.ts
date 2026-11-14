import { useState, useRef, useEffect } from 'react';
import { Animated, Dimensions, Easing, Platform } from 'react-native';
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
import { 
  initEqualizer, 
  applyEqualizerSettings, 
  addEqualizerChangeListener, 
  EqualizerApplyPayload,
  setSoundCheckGain,
  setAppVolumeMultiplierNative,
  getEqualizerDebugInfo
} from '../utils/equalizer';
import { gainDbToPlaybackVolume, getSoundCheckGain } from '../utils/soundCheck';
import { 
  getAppVolumeSetting, 
  addAppVolumeChangeListener, 
  VolumeMultiplierSetting, 
  DEFAULT_VOLUME_SETTING 
} from '../utils/appVolume';

export type { PlayCollectionContext };

const { height } = Dimensions.get('window');

export const useAudioPlayer = (soundCheckEnabled = false) => {
  const [audioEngine, setAudioEngine] = useState<AudioEngineType>('rntp');
  const [isPlaying, setIsPlaying] = useState(false);

  const [isFullPlayer, setIsFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [navStackLength, setNavStackLength] = useState(1);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const toastAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const queueTransitionAnim = useRef(new Animated.Value(0)).current;

  const [currentContext, setCurrentContext] = useState<PlayCollectionContext | null>(null);
  const currentContextRef = useRef<PlayCollectionContext | null>(null);
  const isPlayingRef = useRef(false);

  const soundCheckEnabledRef = useRef(soundCheckEnabled);
  const audioEngineRef = useRef<AudioEngineType>(audioEngine);
  const appVolumeSettingRef = useRef<VolumeMultiplierSetting>(DEFAULT_VOLUME_SETTING);
  const isEQEnabledRef = useRef<boolean>(false);

  useEffect(() => {
    soundCheckEnabledRef.current = soundCheckEnabled;
  }, [soundCheckEnabled]);

  useEffect(() => {
    audioEngineRef.current = audioEngine;
  }, [audioEngine]);

  useEffect(() => {
    currentContextRef.current = currentContext;
  }, [currentContext]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const queueMgr = useQueueManager();
  const handleNextRef = useRef<(fromRemote?: boolean) => void>(() => {});
  const handlePrevRef = useRef<(fromRemote?: boolean) => void>(() => {});
  const togglePlayPauseRef = useRef<() => void>(() => {});
  const setPositionAsyncRef = useRef<(v: number) => void>(() => {});

  const lastSkipTimeRef = useRef(0);
  const soundCheckRequestRef = useRef(0);

  const applySoundCheckForSong = async (song: any) => {
    const requestId = ++soundCheckRequestRef.current;
    const volSetting = appVolumeSettingRef.current;
    const multiplier = volSetting.multiplier;
    const currentSoundCheck = soundCheckEnabledRef.current;
    const currentEngine = audioEngineRef.current;

    const hasNativeMultiplier = setAppVolumeMultiplierNative(multiplier);
    const boostDb = multiplier > 1.0 ? 20 * Math.log10(multiplier) : 0;
    const attenuationVolume = multiplier <= 1.0 ? multiplier : 1.0;

    let soundCheckDb = 0;
    if (currentSoundCheck) {
      try {
        soundCheckDb = await getSoundCheckGain(song.localMusicUri);
      } catch (error) {
        soundCheckDb = 0;
        console.error('[SoundCheck] Could not normalize track:', error);
      }
      if (requestId !== soundCheckRequestRef.current) return;
    }

    if (Platform.OS === 'ios' && iosEq.isIOSEQActiveRef.current) {
      if (hasNativeMultiplier) {
        setSoundCheckGain(soundCheckDb);
      } else {
        const volDb = multiplier !== 1.0 ? 20 * Math.log10(multiplier) : 0;
        setSoundCheckGain(soundCheckDb + volDb);
      }
      return;
    }

    const basePlaybackVolume = currentSoundCheck ? gainDbToPlaybackVolume(soundCheckDb) : 1.0;
    const finalPlaybackVolume = Math.min(1.0, Math.max(0, basePlaybackVolume * attenuationVolume));

    if (Platform.OS === 'android' && currentEngine === 'rntp') {
      if (currentSoundCheck || multiplier !== 1.0 || isEQEnabledRef.current) {
        await rntp.syncAndroidEqualizerSession();
        if (requestId !== soundCheckRequestRef.current) return;
      }
      if (hasNativeMultiplier) {
        setSoundCheckGain(soundCheckDb);
      } else {
        setSoundCheckGain(soundCheckDb + boostDb);
      }
      try {
        await TrackPlayer.setVolume(finalPlaybackVolume);
      } catch (e) {}
    } else if (currentEngine === 'rntp') {
      setSoundCheckGain(hasNativeMultiplier ? soundCheckDb : soundCheckDb + boostDb);
      try {
        await TrackPlayer.setVolume(finalPlaybackVolume);
      } catch (e) {}
    } else if (expoAudio.expoAudioPlayerRef.current) {
      setSoundCheckGain(hasNativeMultiplier ? soundCheckDb : soundCheckDb + boostDb);
      expoAudio.expoAudioPlayerRef.current.volume = finalPlaybackVolume;
    }
  };

  const applySoundCheckForSongRef = useRef(applySoundCheckForSong);
  applySoundCheckForSongRef.current = applySoundCheckForSong;

  const iosEq = useIosEqualizerEngine(
    () => handleNextRef.current(),
    (action: string, param?: any) => {
      if (action === 'play') {
        setIsPlaying(true);
        sync.sendNowPlayingUpdate();
      } else if (action === 'pause') {
        setIsPlaying(false);
        sync.sendNowPlayingUpdate();
      } else if (action === 'togglePlayPause') {
        togglePlayPauseRef.current();
      } else if (action === 'next') {
        handleNextRef.current();
      } else if (action === 'prev') {
        handlePrevRef.current();
      } else if (action === 'seek' && typeof param === 'number') {
        setPositionAsyncRef.current(param * 1000);
      }
    }
  );

  const rntp = useRntpEngine({
    onPlay: () => {
      if (iosEq.isIOSEQActiveRef.current) return;
      if (!isPlayingRef.current) togglePlayPauseRef.current();
    },
    onPause: () => {
      if (iosEq.isIOSEQActiveRef.current) return;
      if (isPlayingRef.current) togglePlayPauseRef.current();
    },
    onTogglePlayPause: () => {
      if (iosEq.isIOSEQActiveRef.current) return;
      togglePlayPauseRef.current();
    },
    onNext: (fromRemote: boolean) => {
      if (iosEq.isIOSEQActiveRef.current) return;
      handleNextRef.current(fromRemote);
    },
    onPrev: (fromRemote: boolean) => {
      if (iosEq.isIOSEQActiveRef.current) return;
      handlePrevRef.current(fromRemote);
    },
    onSeek: (seconds) => {
      if (iosEq.isIOSEQActiveRef.current) return;
      setPositionAsyncRef.current(seconds * 1000);
    },
  });

  const expoAudio = useExpoAudioEngine(() => handleNextRef.current());

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
      if (audioEngineRef.current === 'rntp') {
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

  useEffect(() => {
    AsyncStorage.getItem('audioEngine').then(async (val) => {
      const mode = (val === 'expo-av' || val === 'rntp') ? val : 'rntp';
      setAudioEngine(mode);
      audioEngineRef.current = mode;
      if (Platform.OS === 'ios') {
        iosEq.setEngineMode(mode);
      }
      if (mode === 'expo-av') {
        await rntp.clearRNTPNotification();
      }
    }).catch((error) => {
      console.error('[AudioPlayer] Failed to load audio engine setting:', error);
    });

    (async () => {
      try {
        await initEqualizer(0);
        const eqJson = await AsyncStorage.getItem('chordia_equalizer_settings');
        if (eqJson) {
          const parsed = JSON.parse(eqJson);
          isEQEnabledRef.current = !!parsed.isEnabled;
          iosEq.isIOSEQActiveRef.current = Platform.OS === 'ios' && !!parsed.isEnabled;
          applyEqualizerSettings({
            enabled: !!parsed.isEnabled,
            preamp: parsed.preamp || 0,
            gains: Array.isArray(parsed.bands) ? parsed.bands.map((b: any) => b.gain) : [],
          }, false);
        }
        const volSetting = await getAppVolumeSetting();
        appVolumeSettingRef.current = volSetting;
        setAppVolumeMultiplierNative(volSetting.multiplier);
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
    if (!Event.PlaybackState) return;
    const sub = TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp') {
        setIsPlaying(isStatePlaying(event));
      }
    });
    return () => sub.remove();
  }, []);

  const loadAndPlayInternal = async (
    song: any,
    activeQueue: any[] = [],
    startIndex: number = 0,
    startPositionMs: number = 0,
    shouldPlay: boolean = true,
    targetEngine?: AudioEngineType
  ) => {
    const targetSeconds = startPositionMs > 0 ? startPositionMs / 1000 : 0;
    const engineToUse = targetEngine || audioEngineRef.current;

    let isEQEnabled = isEQEnabledRef.current;
    let savedPreamp = 0;
    let savedGains: number[] = [];
    try {
      const eqRaw = await AsyncStorage.getItem('chordia_equalizer_settings');
      if (eqRaw) {
        const parsed = JSON.parse(eqRaw);
        isEQEnabled = !!parsed.isEnabled;
        isEQEnabledRef.current = isEQEnabled;
        savedPreamp = Number(parsed.preamp) || 0;
        savedGains = Array.isArray(parsed.bands) ? parsed.bands.map((b: any) => Number(b.gain) || 0) : [];
      }
    } catch (e) {}

    const hasVolumeSetting = appVolumeSettingRef.current.multiplier !== 1.0;

    if (Platform.OS === 'ios' && (isEQEnabled || soundCheckEnabledRef.current || hasVolumeSetting)) {
      iosEq.isIOSEQActiveRef.current = true;
      expoAudio.clearExpoResources();
      await rntp.clearRNTPNotification();

      iosEq.setEngineMode(engineToUse);
      // 再生前にネイティブ側へ最新のイコライザー設定を同期
      applyEqualizerSettings({
        enabled: isEQEnabled,
        preamp: savedPreamp,
        gains: savedGains,
      }, false);

      const success = iosEq.loadAndPlayIOS(song.localMusicUri, targetSeconds, shouldPlay);
      if (success) {
        void applySoundCheckForSongRef.current(song);
        setIsPlaying(shouldPlay);
        iosEq.startIOSEQPolling(setIsPlaying);

        const dur = (song.duration || 0) > 0 ? song.duration : 180;
        iosEq.setTrackISRC(song.isrc || null);
        iosEq.updateNowPlaying(
          song.title || 'Untitled',
          song.artist || 'Unknown Artist',
          song.album || 'Unknown Album',
          song.localImageUri || null,
          dur,
          targetSeconds,
          shouldPlay
        );

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

    try {
      if (engineToUse === 'rntp') {
        await rntp.ensureRNTPInitialized();
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
                    void applySoundCheckForSongRef.current(song);
                  } catch (e) {
                    void applySoundCheckForSongRef.current(song);
                  }
                }, 120);
              } else {
                void applySoundCheckForSongRef.current(song);
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
        void applySoundCheckForSongRef.current(song);

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

  const loadAndPlayInternalRef = useRef(loadAndPlayInternal);
  loadAndPlayInternalRef.current = loadAndPlayInternal;

  // アプリ内音量倍率変更のリアルタイムリスナー
  useEffect(() => {
    const unsub = addAppVolumeChangeListener((newSetting) => {
      appVolumeSettingRef.current = newSetting;

      const cur = queueMgr.currentSongRef.current;
      if (!cur) return;

      if (Platform.OS === 'ios' && isPlayingRef.current) {
        const hasVolAdjustment = newSetting.multiplier !== 1.0;
        const shouldBeIOSEQ = isEQEnabledRef.current || soundCheckEnabledRef.current || hasVolAdjustment;
        if (shouldBeIOSEQ !== iosEq.isIOSEQActiveRef.current) {
          void (async () => {
            let posMs = 0;
            if (iosEq.isIOSEQActiveRef.current) posMs = iosEq.getPositionIOS() * 1000;
            else if (audioEngineRef.current === 'rntp') {
              try { posMs = (await TrackPlayer.getPosition()) * 1000; } catch (e) {}
            } else posMs = expoAudio.playbackStatusExpo.positionMillis || 0;
            loadAndPlayInternalRef.current(cur, queueMgr.activeQueueRef.current, queueMgr.indexRef.current, posMs, true);
          })();
          return;
        }
      }

      void applySoundCheckForSongRef.current(cur);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const current = queueMgr.currentSongRef.current;
    if (!current || !isPlayingRef.current) return;
    const hasVolumeSetting = appVolumeSettingRef.current.multiplier !== 1.0;
    if (Platform.OS === 'ios' && (soundCheckEnabled || iosEq.isIOSEQActiveRef.current || hasVolumeSetting)) {
      void (async () => {
        let positionMs = 0;
        if (iosEq.isIOSEQActiveRef.current) positionMs = iosEq.getPositionIOS() * 1000;
        else if (audioEngineRef.current === 'rntp') {
          try { positionMs = (await TrackPlayer.getPosition()) * 1000; } catch (e) {}
        } else positionMs = expoAudio.playbackStatusExpo.positionMillis || 0;
        loadAndPlayInternalRef.current(current, queueMgr.activeQueueRef.current, queueMgr.indexRef.current, positionMs, true);
      })();
      return;
    }
    void applySoundCheckForSongRef.current(current);
  }, [soundCheckEnabled]);

  useEffect(() => {
    const unsub = addEqualizerChangeListener((payload: EqualizerApplyPayload) => {
      isEQEnabledRef.current = payload.enabled;

      const current = queueMgr.currentSongRef.current;
      if (!current) return;

      if (Platform.OS === 'android') {
        void rntp.syncAndroidEqualizerSession();
        return;
      }

      if (Platform.OS === 'ios') {
        const hasVolAdjustment = appVolumeSettingRef.current.multiplier !== 1.0;
        const shouldBeIOSEQ = payload.enabled || soundCheckEnabledRef.current || hasVolAdjustment;
        const needsEngineSwitch = (shouldBeIOSEQ !== iosEq.isIOSEQActiveRef.current);

        if (!needsEngineSwitch) {
          // 既に iosEq で再生中の場合、エンジン切り替えは不要でネイティブの updateEqualizerHardware に即反映される
          void applySoundCheckForSongRef.current(current);
          return;
        }

        const isCurrentlyPlaying = isPlayingRef.current;
        void (async () => {
          let curMs = 0;
          if (iosEq.isIOSEQActiveRef.current) {
            curMs = iosEq.getPositionIOS() * 1000;
          } else if (audioEngineRef.current === 'rntp') {
            try { curMs = (await TrackPlayer.getPosition()) * 1000; } catch (e) {}
          } else {
            curMs = expoAudio.playbackStatusExpo.positionMillis || 0;
          }
          loadAndPlayInternalRef.current(
            current,
            queueMgr.activeQueueRef.current,
            queueMgr.indexRef.current,
            curMs,
            isCurrentlyPlaying
          );
        })();
      }
    });

    return () => unsub();
  }, []);

  const changeAudioEngine = async (newEngine: AudioEngineType) => {
    if (newEngine === audioEngineRef.current) return;
    const wasPlaying = isPlayingRef.current;
    const current = queueMgr.currentSongRef.current;

    let curPositionMs = 0;
    if (iosEq.isIOSEQActiveRef.current) {
      curPositionMs = iosEq.getPositionIOS() * 1000;
    } else if (audioEngineRef.current === 'rntp') {
      try {
        curPositionMs = (await TrackPlayer.getPosition()) * 1000;
      } catch (e) {}
    } else {
      curPositionMs = expoAudio.playbackStatusExpo.positionMillis || 0;
    }

    setAudioEngine(newEngine);
    audioEngineRef.current = newEngine;
    await AsyncStorage.setItem('audioEngine', newEngine);

    if (Platform.OS === 'ios' && iosEq.isIOSEQActiveRef.current) {
      iosEq.setEngineMode(newEngine);
      return;
    }

    if (current && queueMgr.activeQueueRef.current.length > 0) {
      if (audioEngineRef.current === 'rntp') {
        await rntp.clearRNTPNotification();
      } else {
        expoAudio.clearExpoResources();
      }

      setTimeout(() => {
        loadAndPlayInternalRef.current(
          current,
          queueMgr.activeQueueRef.current,
          queueMgr.indexRef.current,
          curPositionMs,
          wasPlaying,
          newEngine
        );
      }, 100);
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

    if (context !== undefined) {
      currentContextRef.current = context;
      setCurrentContext(context);
    }

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

    if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp') {
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

    if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp') {
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

  const handleNextInternal = async (fromRemote = false) => {
    const now = Date.now();
    if (now - lastSkipTimeRef.current < 400) return;
    lastSkipTimeRef.current = now;

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
      if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp') {
        if (!fromRemote) {
          await TrackPlayer.skipToNext();
        }
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
  const handleNext = () => handleNextInternal(false);

  const handlePrevInternal = async (fromRemote = false) => {
    const now = Date.now();
    if (now - lastSkipTimeRef.current < 400) return;
    lastSkipTimeRef.current = now;

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

    if (audioEngineRef.current === 'rntp') {
      const currentPos = await TrackPlayer.getPosition();
      if (currentPos > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        if (!fromRemote) {
          await TrackPlayer.skipToPrevious();
        }
      }
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

  handlePrevRef.current = handlePrevInternal;
  const handlePrev = () => handlePrevInternal(false);

  const togglePlayPauseInternal = async () => {
    if (iosEq.isIOSEQActiveRef.current) {
      if (isPlayingRef.current) {
        iosEq.pauseIosEQ();
        setIsPlaying(false);
      } else {
        iosEq.playIosEQ();
        setIsPlaying(true);
      }
      sync.sendNowPlayingUpdate();
      return;
    }

    if (audioEngineRef.current === 'rntp') {
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
      if (isPlayingRef.current) {
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

  togglePlayPauseRef.current = togglePlayPauseInternal;
  const togglePlayPause = () => togglePlayPauseInternal();

  const setPositionAsync = async (v: number) => {
    if (iosEq.isIOSEQActiveRef.current) {
      iosEq.seekIosEQ(v / 1000);
    } else if (audioEngineRef.current === 'rntp') {
      await TrackPlayer.seekTo(v / 1000);
    } else {
      try {
        expoAudio.expoAudioPlayerRef.current?.seekTo(v / 1000);
        expoAudio.setPlaybackStatusExpo((prev) => ({ ...prev, positionMillis: v }));
      } catch (e) {}
    }
    sync.sendNowPlayingUpdate(Math.floor(v / 1000));
  };

  setPositionAsyncRef.current = setPositionAsync;

  const closeFullPlayer = (animateSlide = true) => {
    const finishClose = () => {
      setIsFullPlayer(false); setShowQueue(false); setShowLyrics(false); queueTransitionAnim.setValue(0);
    };

    if (!animateSlide) {
      finishClose();
      return;
    }

    Animated.timing(slideAnim, {
      toValue: height,
      duration: 320,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(finishClose);
  };

  useEffect(() => {
    if (!Event.PlaybackActiveTrackChanged) return;
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp' && event.track && event.track.originalData) {
        const newSong = event.track.originalData;
        queueMgr.setCurrentSong(newSong);
        queueMgr.currentSongRef.current = newSong;
        void applySoundCheckForSongRef.current(newSong);

        const activeQueue = queueMgr.activeQueueRef.current;
        const idx = activeQueue.findIndex((s) => s.localMusicUri === newSong.localMusicUri);

        const prevIdx = queueMgr.indexRef.current;
        const lastIdx = activeQueue.length - 1;
        if (prevIdx === lastIdx && idx === 0 && queueMgr.loopRef.current === 'ALL') {
          if (queueMgr.shuffleRef.current && queueMgr.originalQueueRef.current.length > 0) {
            const nextShuffled = [...queueMgr.originalQueueRef.current].sort(() => Math.random() - 0.5);
            queueMgr.activeQueueRef.current = nextShuffled;
            loadAndPlayInternalRef.current(nextShuffled[0], nextShuffled, 0, 0, true);
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

    if (!Event.PlaybackQueueEnded) return;
    const queueEndedSub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
      if (!iosEq.isIOSEQActiveRef.current && audioEngineRef.current === 'rntp' && queueMgr.loopRef.current === 'ALL') {
        const queueToUse = queueMgr.shuffleRef.current 
          ? [...queueMgr.originalQueueRef.current].sort(() => Math.random() - 0.5)
          : [...queueMgr.originalQueueRef.current];
        if (queueToUse.length > 0) {
          queueMgr.activeQueueRef.current = queueToUse;
          loadAndPlayInternalRef.current(queueToUse[0], queueToUse, 0, 0, true);
        }
      }
    });

    return () => {
      sub.remove();
      queueEndedSub.remove();
    };
  }, []);

  const stopPlayback = async () => {
    try {
      iosEq.isIOSEQActiveRef.current = false;
      iosEq.stopIosEQ();
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      expoAudio.clearExpoResources();
      queueMgr.setCurrentSong(null);
      queueMgr.setPlayQueue([]);
      setIsPlaying(false);
    } catch (e) {}
  };

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
    stopPlayback,
    slideAnim, 
    queueTransitionAnim, 
    closeFullPlayer,
    currentContext,
  };
};
