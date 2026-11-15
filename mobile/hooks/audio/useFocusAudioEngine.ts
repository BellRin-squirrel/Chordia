import { useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'expo-modules-core';
import { createAudioPlaylist, setAudioModeAsync } from 'expo-audio';
import {
  applyEqualizerSettings,
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
  const focusQueueRef = useRef<any[]>([]);
  const focusSessionTokenRef = useRef(0);
  const fadeVolumeRef = useRef(1.0);
  const androidPlaylistRef = useRef<any>(null);
  const androidListenersRef = useRef<any[]>([]);
  const androidCurrentSoundCheckDbRef = useRef(0);

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
        if (!isFocusActiveRef.current || !event) return;
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

  const clearAndroidPlaylist = () => {
    androidListenersRef.current.forEach((sub) => {
      try {
        if (sub && typeof sub.remove === 'function') sub.remove();
      } catch (e) {}
    });
    androidListenersRef.current = [];

    if (androidPlaylistRef.current) {
      const pl = androidPlaylistRef.current;
      androidPlaylistRef.current = null;
      try {
        pl.pause?.();
        pl.clearLockScreenControls?.();
        pl.destroy?.();
      } catch (e) {}
    }
  };

  const applyAndroidPlaylistVolume = () => {
    const pl = androidPlaylistRef.current;
    if (!pl) return;
    const multiplier = appVolumeSettingRef.current.multiplier;
    const attenuation = multiplier <= 1.0 ? multiplier : 1.0;
    const scVol = soundCheckEnabledRef.current
      ? gainDbToPlaybackVolume(androidCurrentSoundCheckDbRef.current)
      : 1.0;
    const boostDb = multiplier > 1.0 ? 20 * Math.log10(multiplier) : 0;
    setSoundCheckGain(
      (soundCheckEnabledRef.current ? androidCurrentSoundCheckDbRef.current : 0) + boostDb
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

  const startFocusQueue = async (
    songs: any[],
    shuffle: boolean = false,
    loopMode: LoopModeType = 'ALL'
  ) => {
    if (!songs || songs.length === 0) return;

    const sessionToken = ++focusSessionTokenRef.current;
    isFocusActiveRef.current = true;
    fadeVolumeRef.current = 1.0;

    let queue = [...songs];
    if (shuffle && queue.length > 1) {
      queue = queue.sort(() => Math.random() - 0.5);
    }
    focusQueueRef.current = queue;

    await syncNativeAudioEffects();

    if (Platform.OS === 'ios') {
      const firstSong = queue[0];
      let firstGain = 0;
      if (soundCheckEnabledRef.current && firstSong?.localMusicUri) {
        try {
          firstGain = await getSoundCheckGain(firstSong.localMusicUri);
        } catch (e) {
          firstGain = 0;
        }
        if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) return;
      }

      const filePaths = queue.map((s) => s.localMusicUri).filter(Boolean);
      if (filePaths.length === 0) return;
      const initialGains = filePaths.map((_, idx) => (idx === 0 ? firstGain : 0));

      setFocusFadeVolumeIOS(1.0);
      const ok = startFocusQueueIOS(filePaths, initialGains, 0, loopMode, shuffle);
      if (ok) {
        onTrackChangeRef.current(queue[0], 0, queue);
        onPlayStateChangeRef.current(true);
      }

      // 2曲目以降の SoundCheck をバックグラウンドで順次解決し、ネイティブキューへ反映
      if (soundCheckEnabledRef.current && queue.length > 1) {
        void (async () => {
          for (let i = 1; i < queue.length; i++) {
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

    // Android: expo-audio の AudioPlaylist を排他モード・ロック画面非表示で使用
    clearAndroidPlaylist();
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
    } catch (e) {}

    await initEqualizer(0);
    await syncNativeAudioEffects();

    const sources = queue.map((s) => resolveExpoAudioSource(s.localMusicUri));
    const loopStr = loopMode === 'ONE' ? 'single' : loopMode === 'ALL' ? 'all' : 'none';
    const playlist = createAudioPlaylist({
      sources,
      updateInterval: 250,
      loop: loopStr,
    });

    androidPlaylistRef.current = playlist;
    try {
      playlist.clearLockScreenControls?.();
    } catch (e) {}

    const updateAndroidTrackSoundCheck = async (song: any) => {
      if (!soundCheckEnabledRef.current || !song?.localMusicUri) {
        androidCurrentSoundCheckDbRef.current = 0;
        applyAndroidPlaylistVolume();
        return;
      }
      try {
        const db = await getSoundCheckGain(song.localMusicUri);
        if (sessionToken !== focusSessionTokenRef.current || !isFocusActiveRef.current) return;
        androidCurrentSoundCheckDbRef.current = db;
      } catch (e) {
        androidCurrentSoundCheckDbRef.current = 0;
      }
      applyAndroidPlaylistVolume();
    };

    try {
      const subTrack = playlist.addListener('trackChanged', (event: any) => {
        if (!isFocusActiveRef.current || sessionToken !== focusSessionTokenRef.current) return;
        const idx = typeof event?.currentIndex === 'number' ? event.currentIndex : 0;
        const song = focusQueueRef.current[idx];
        if (song) {
          onTrackChangeRef.current(song, idx, focusQueueRef.current);
          void updateAndroidTrackSoundCheck(song);
        }
      });
      if (subTrack) androidListenersRef.current.push(subTrack);

      const subStatus = playlist.addListener('playlistStatusUpdate', (status: any) => {
        if (!isFocusActiveRef.current || sessionToken !== focusSessionTokenRef.current) return;
        if (typeof status?.playing === 'boolean') {
          onPlayStateChangeRef.current(status.playing);
        }
      });
      if (subStatus) androidListenersRef.current.push(subStatus);
    } catch (e) {}

    await updateAndroidTrackSoundCheck(queue[0]);
    onTrackChangeRef.current(queue[0], 0, queue);
    playlist.play();
    onPlayStateChangeRef.current(true);
  };

  const pauseFocusAudio = async () => {
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios') {
      pauseIOS();
    } else if (androidPlaylistRef.current) {
      try {
        androidPlaylistRef.current.pause();
      } catch (e) {}
    }
    onPlayStateChangeRef.current(false);
  };

  const resumeFocusAudio = async () => {
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios') {
      playIOS();
    } else if (androidPlaylistRef.current) {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
        androidPlaylistRef.current.play();
      } catch (e) {}
    }
    onPlayStateChangeRef.current(true);
  };

  const setFocusFadeVolume = (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    fadeVolumeRef.current = clamped;
    if (!isFocusActiveRef.current) return;
    if (Platform.OS === 'ios') {
      setFocusFadeVolumeIOS(clamped);
    } else {
      applyAndroidPlaylistVolume();
    }
  };

  const stopFocusAudio = async () => {
    focusSessionTokenRef.current += 1;
    isFocusActiveRef.current = false;
    fadeVolumeRef.current = 1.0;

    if (Platform.OS === 'ios') {
      stopFocusModeIOS();
    } else {
      clearAndroidPlaylist();
    }
    onPlayStateChangeRef.current(false);
  };

  return {
    isFocusActiveRef,
    startFocusQueue,
    pauseFocusAudio,
    resumeFocusAudio,
    setFocusFadeVolume,
    stopFocusAudio,
  };
};
