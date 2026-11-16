import { useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'expo-modules-core';
import { createAudioPlaylist, setAudioModeAsync } from 'expo-audio';
import {
  applyEqualizerSettings,
  getEqualizerDebugInfo,
  getFocusStateIOS,
  getNativeModule,
  initEqualizer,
  pauseIOS,
  playIOS,
  setAppVolumeMultiplierNative,
  setFocusFadeVolumeIOS,
  setSoundCheckGain,
  startFocusQueueIOS,
  stopFocusModeIOS,
  updateFocusTrackSoundCheckIOS,
} from '../../utils/equalizer';
import { gainDbToPlaybackVolume, getSoundCheckGain } from '../../utils/soundCheck';
import { VolumeMultiplierSetting } from '../../utils/appVolume';
import { LoopModeType, resolveExpoAudioSource } from './types';

export interface FocusPlaybackSnapshot {
  queue: any[];
  index: number;
  positionSec: number;
}

interface UseFocusAudioEngineProps {
  soundCheckEnabledRef: React.MutableRefObject<boolean>;
  appVolumeSettingRef: React.MutableRefObject<VolumeMultiplierSetting>;
  isEQEnabledRef: React.MutableRefObject<boolean>;
  onTrackChange: (song: any, index: number, queue: any[]) => void;
  onPlayStateChange: (playing: boolean) => void;
}

export const useFocusAudioEngine = ({
  soundCheckEnabledRef,
  appVolumeSettingRef,
  isEQEnabledRef,
  onTrackChange,
  onPlayStateChange,
}: UseFocusAudioEngineProps) => {
  const isFocusActiveRef = useRef(false);
  const usingExpoFallbackRef = useRef(false);
  const focusQueueRef = useRef<any[]>([]);
  const focusCurrentIndexRef = useRef(0);
  const focusSessionTokenRef = useRef(0);
  const fadeVolumeRef = useRef(1.0);
  const expoPlaylistRef = useRef<any>(null);
  const expoListenersRef = useRef<any[]>([]);
  const expoCurrentSoundCheckDbRef = useRef(0);

  const onTrackChangeRef = useRef(onTrackChange);
  const onPlayStateChangeRef = useRef(onPlayStateChange);

  useEffect(() => {
    onTrackChangeRef.current = onTrackChange;
  }, [onTrackChange]);

  useEffect(() => {
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onPlayStateChange]);

  // iOS: ネイティブキューの自動曲送りイベントを受信して UI / 履歴を同期
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const mod = getNativeModule();
    if (!mod) return;

    let subFocusTrack: any = null;
    try {
      const emitter = new EventEmitter(mod);
      subFocusTrack = emitter.addListener('onFocusTrackChanged', (event: any) => {
        if (!isFocusActiveRef.current || usingExpoFallbackRef.current || !event) return;
        const queue = focusQueueRef.current;
        if (!queue || queue.length === 0) return;

        let idx = typeof event.index === 'number' ? event.index : 0;
        let matchedSong = queue[idx];
        if (event.uri) {
          const foundIdx = queue.findIndex((s: any) => s.localMusicUri === event.uri);
          if (foundIdx !== -1) {
            idx = foundIdx;
            matchedSong = queue[foundIdx];
          }
        }
        if (matchedSong) {
          focusCurrentIndexRef.current = idx;
          onTrackChangeRef.current(matchedSong, idx, queue);
          onPlayStateChangeRef.current(true);
        }
      });
    } catch (e) {}

    return () => {
      try {
        if (subFocusTrack && typeof subFocusTrack.remove === 'function') subFocusTrack.remove();
      } catch (e) {}
    };
  }, []);

  const clearExpoPlaylist = () => {
    expoListenersRef.current.forEach((sub) => {
      try {
        if (sub && typeof sub.remove === 'function') sub.remove();
      } catch (e) {}
    });
    expoListenersRef.current = [];

    if (expoPlaylistRef.current) {
      const pl = expoPlaylistRef.current;
      expoPlaylistRef.current = null;
      try {
        pl.pause?.();
        pl.clearLockScreenControls?.();
        pl.clear?.();
        pl.destroy?.();
      } catch (e) {}
    }
  };

  const applyExpoPlaylistVolume = () => {
    const pl = expoPlaylistRef.current;
    if (!pl) return;
    const multiplier = appVolumeSettingRef.current.multiplier;
    const attenuation = multiplier <= 1.0 ? multiplier : 1.0;
    const scVol = soundCheckEnabledRef.current
      ? gainDbToPlaybackVolume(expoCurrentSoundCheckDbRef.current)
      : 1.0;
    const boostDb = multiplier > 1.0 ? 20 * Math.log10(multiplier) : 0;
    setSoundCheckGain(
      (soundCheckEnabledRef.current ? expoCurrentSoundCheckDbRef.current : 0) + boostDb
    );
    const finalVol = Math.min(1.0, Math.max(0, scVol * attenuation * fadeVolumeRef.current));
    try {
      pl.volume = finalVol;
    } catch (e) {}
  };

  const syncNativeAudioEffects = async () => {
    try {
      const eqRaw = await AsyncStorage.getItem('chordia_equalizer_settings');
      if (eqRaw) {
        const parsed = JSON.parse(eqRaw);
        const enabled = !!parsed.isEnabled;
        isEQEnabledRef.current = enabled;
        applyEqualizerSettings(
          {
            enabled,
            preamp: Number(parsed.preamp) || 0,
            gains: Array.isArray(parsed.bands)
              ? parsed.bands.map((b: any) => Number(b.gain) || 0)
              : [],
          },
          false
        );
      }
      setAppVolumeMultiplierNative(appVolumeSettingRef.current.multiplier);
    } catch (e) {}
  };

  const startExpoPlaylist = async (
    queue: any[],
    startIndex: number,
    startSeconds: number,
    loopMode: LoopModeType,
    sessionToken: number
  ) => {
    usingExpoFallbackRef.current = true;
    clearExpoPlaylist();

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
    } catch (e) {}

    if (Platform.OS === 'android') {
      await initEqualizer(0);
    }
    await syncNativeAudioEffects();

    const safeStartIdx = Math.max(0, Math.min(startIndex, queue.length - 1));
    focusCurrentIndexRef.current = safeStartIdx;

    const sources = queue.map((s) => resolveExpoAudioSource(s.localMusicUri));
    const loopStr = loopMode === 'ONE' ? 'single' : loopMode === 'ALL' ? 'all' : 'none';
    const playlist = createAudioPlaylist({
      sources,
      updateInterval: 250,
      loop: loopStr,
    });

    expoPlaylistRef.current = playlist;
    try {
      playlist.clearLockScreenControls?.();
    } catch (e) {}

    const updateTrackSoundCheck = async (song: any) => {
      if (!soundCheckEnabledRef.current || !song?.localMusicUri) {
        expoCurrentSoundCheckDbRef.current = 0;
        applyExpoPlaylistVolume();
        return;
      }
      try {
        const db = await getSoundCheckGain(song.localMusicUri);
        if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) return;
        expoCurrentSoundCheckDbRef.current = db;
      } catch (e) {
        expoCurrentSoundCheckDbRef.current = 0;
      }
      applyExpoPlaylistVolume();
    };

    try {
      const subTrack = playlist.addListener('trackChanged', (event: any) => {
        if (!isFocusActiveRef.current || sessionToken !== focusSessionTokenRef.current) return;
        const idx = typeof event?.currentIndex === 'number' ? event.currentIndex : 0;
        focusCurrentIndexRef.current = idx;
        const song = focusQueueRef.current[idx];
        if (song) {
          onTrackChangeRef.current(song, idx, focusQueueRef.current);
          void updateTrackSoundCheck(song);
        }
      });
      if (subTrack) expoListenersRef.current.push(subTrack);

      const subStatus = playlist.addListener('playlistStatusUpdate', (status: any) => {
        if (!isFocusActiveRef.current || sessionToken !== focusSessionTokenRef.current) return;
        if (typeof status?.playing === 'boolean') {
          onPlayStateChangeRef.current(status.playing);
        }
      });
      if (subStatus) expoListenersRef.current.push(subStatus);
    } catch (e) {}

    if (safeStartIdx > 0) {
      try {
        playlist.skipTo(safeStartIdx);
      } catch (e) {}
    }

    await updateTrackSoundCheck(queue[safeStartIdx]);
    onTrackChangeRef.current(queue[safeStartIdx], safeStartIdx, queue);
    playlist.play();
    if (startSeconds > 0) {
      setTimeout(() => {
        if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) return;
        try {
          void playlist.seekTo(startSeconds);
        } catch (e) {}
      }, 150);
    }
    onPlayStateChangeRef.current(true);
  };

  const getFocusPlaybackSnapshot = (): FocusPlaybackSnapshot | null => {
    if (!isFocusActiveRef.current || focusQueueRef.current.length === 0) return null;

    if (Platform.OS === 'ios' && !usingExpoFallbackRef.current) {
      const nativeState = getFocusStateIOS();
      if (nativeState) {
        let orderedQueue = [...focusQueueRef.current];
        if (nativeState.paths.length > 0) {
          const songMap = new Map<string, any>();
          focusQueueRef.current.forEach((s: any) => {
            if (s?.localMusicUri) songMap.set(s.localMusicUri, s);
          });
          const rebuilt = nativeState.paths.map((p) => songMap.get(p)).filter(Boolean);
          if (rebuilt.length > 0) {
            orderedQueue = rebuilt;
          }
        }
        const safeIdx = Math.max(0, Math.min(nativeState.index, orderedQueue.length - 1));
        return {
          queue: orderedQueue,
          index: safeIdx,
          positionSec: Math.max(0, nativeState.position || 0),
        };
      }
    }

    if (expoPlaylistRef.current) {
      const pl = expoPlaylistRef.current;
      const idx = typeof pl.currentIndex === 'number' ? pl.currentIndex : focusCurrentIndexRef.current;
      const safeIdx = Math.max(0, Math.min(idx, focusQueueRef.current.length - 1));
      const pos = typeof pl.currentTime === 'number' ? pl.currentTime : 0;
      return {
        queue: [...focusQueueRef.current],
        index: safeIdx,
        positionSec: Math.max(0, pos),
      };
    }

    return {
      queue: [...focusQueueRef.current],
      index: Math.max(0, Math.min(focusCurrentIndexRef.current, focusQueueRef.current.length - 1)),
      positionSec: 0,
    };
  };

  const startFocusQueue = async (
    songs: any[],
    shuffle: boolean = false,
    loopMode: LoopModeType = 'ALL',
    resumeSnapshot?: FocusPlaybackSnapshot | null
  ) => {
    if ((!songs || songs.length === 0) && (!resumeSnapshot || resumeSnapshot.queue.length === 0)) return;

    const sessionToken = ++focusSessionTokenRef.current;
    isFocusActiveRef.current = true;
    usingExpoFallbackRef.current = false;
    fadeVolumeRef.current = 1.0;

    let queue: any[] = [];
    let startIndex = 0;
    let startSeconds = 0;

    if (resumeSnapshot && resumeSnapshot.queue.length > 0) {
      queue = [...resumeSnapshot.queue];
      startIndex = Math.max(0, Math.min(resumeSnapshot.index, queue.length - 1));
      startSeconds = Math.max(0, resumeSnapshot.positionSec || 0);
    } else {
      queue = [...songs];
      if (shuffle && queue.length > 1) {
        queue = queue.sort(() => Math.random() - 0.5);
      }
    }

    focusQueueRef.current = queue;
    focusCurrentIndexRef.current = startIndex;

    await syncNativeAudioEffects();

    if (Platform.OS === 'ios') {
      const mod = getNativeModule();
      if (typeof mod?.startFocusQueue === 'function') {
        const targetSong = queue[startIndex];
        let targetGain = 0;
        if (soundCheckEnabledRef.current && targetSong?.localMusicUri) {
          try {
            targetGain = await getSoundCheckGain(targetSong.localMusicUri);
          } catch (e) {
            targetGain = 0;
          }
          if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) return;
        }

        const filePaths = queue.map((s) => s.localMusicUri).filter(Boolean);
        if (filePaths.length === 0) return;
        const safeStartIdx = Math.max(0, Math.min(startIndex, filePaths.length - 1));
        const initialGains = filePaths.map((_, idx) => (idx === safeStartIdx ? targetGain : 0));

        setFocusFadeVolumeIOS(1.0);
        const ok = startFocusQueueIOS(filePaths, initialGains, safeStartIdx, startSeconds, loopMode, shuffle);
        if (ok) {
          onTrackChangeRef.current(queue[safeStartIdx], safeStartIdx, queue);
          onPlayStateChangeRef.current(true);

          if (soundCheckEnabledRef.current && queue.length > 1) {
            void (async () => {
              for (let i = 0; i < queue.length; i++) {
                if (i === safeStartIdx) continue;
                if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) break;
                const uri = queue[i]?.localMusicUri;
                if (!uri) continue;
                try {
                  const db = await getSoundCheckGain(uri);
                  if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) break;
                  updateFocusTrackSoundCheckIOS(uri, db);
                } catch (e) {}
              }
            })();
          }
          return;
        }
        console.warn('[FocusAudio] startFocusQueueIOS failed, falling back to expo-audio:', getEqualizerDebugInfo());
      } else {
        console.warn('[FocusAudio] Native startFocusQueue is unavailable (rebuild iOS app to enable EQ/SoundCheck in Focus mode). Falling back to expo-audio.');
      }
    }

    await startExpoPlaylist(queue, startIndex, startSeconds, loopMode, sessionToken);
  };

  const pauseFocusAudio = async () => {
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios' && !usingExpoFallbackRef.current) {
      pauseIOS();
    } else if (expoPlaylistRef.current) {
      try {
        expoPlaylistRef.current.pause();
      } catch (e) {}
    }
    onPlayStateChangeRef.current(false);
  };

  const resumeFocusAudio = async () => {
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios' && !usingExpoFallbackRef.current) {
      playIOS();
    } else if (expoPlaylistRef.current) {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        expoPlaylistRef.current.play();
      } catch (e) {}
    }
    onPlayStateChangeRef.current(true);
  };

  const setFocusFadeVolume = (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    fadeVolumeRef.current = clamped;
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios' && !usingExpoFallbackRef.current) {
      setFocusFadeVolumeIOS(clamped);
    } else {
      applyExpoPlaylistVolume();
    }
  };

  const stopFocusAudio = async () => {
    focusSessionTokenRef.current += 1;
    isFocusActiveRef.current = false;
    usingExpoFallbackRef.current = false;
    fadeVolumeRef.current = 1.0;
    focusQueueRef.current = [];
    focusCurrentIndexRef.current = 0;

    if (Platform.OS === 'ios') {
      stopFocusModeIOS();
    }
    clearExpoPlaylist();
    onPlayStateChangeRef.current(false);
  };

  return {
    isFocusActiveRef,
    startFocusQueue,
    getFocusPlaybackSnapshot,
    pauseFocusAudio,
    resumeFocusAudio,
    setFocusFadeVolume,
    stopFocusAudio,
  };
};