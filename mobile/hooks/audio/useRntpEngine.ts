import { useEffect, useRef } from 'react';
import { Platform, NativeModules } from 'react-native';
import TrackPlayer, { 
  usePlaybackState, 
  useProgress, 
  Capability, 
  AppKilledPlaybackBehavior,
  Event 
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initEqualizer, applyEqualizerSettings } from '../../utils/equalizer';
import { isStatePlaying } from './types';

let isRNTPInitialized = false;

interface UseRntpEngineHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onTogglePlayPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeek?: (seconds: number) => void;
}

export const useRntpEngine = (handlers?: UseRntpEngineHandlers) => {
  const rntpState = usePlaybackState();
  const rntpProgress = useProgress(250);
  const isRNTPPlaying = isStatePlaying(rntpState);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const syncAndroidEqualizerSession = async () => {
    if (Platform.OS === 'android') {
      try {
        const TrackPlayerModule = NativeModules.TrackPlayerModule || NativeModules.TrackPlayer;
        if (TrackPlayerModule?.getAudioSessionId) {
          const sid = await TrackPlayerModule.getAudioSessionId();
          if (sid && sid > 0) {
            console.log('[Equalizer] Attached to real ExoPlayer audioSessionId:', sid);
            await initEqualizer(sid);

            const eqJson = await AsyncStorage.getItem('chordia_equalizer_settings');
            if (eqJson) {
              const parsed = JSON.parse(eqJson);
              applyEqualizerSettings({
                enabled: !!parsed.isEnabled,
                preamp: parsed.preamp || 0,
                gains: Array.isArray(parsed.bands) ? parsed.bands.map((b: any) => b.gain) : [],
              });
            }
          }
        }
      } catch (e) {}
    }
  };

  const clearRNTPNotification = async () => {
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      await TrackPlayer.updateOptions({ capabilities: [], compactCapabilities: [] });
    } catch (e) {}
  };

  const restoreRNTPNotification = async () => {
    try {
      await TrackPlayer.updateOptions({
        android: { appKilledBehavior: AppKilledPlaybackBehavior.ContinuePlayback, alwaysPauseOnInterruption: false },
        capabilities: [
          Capability.Play, 
          Capability.Pause, 
          Capability.SkipToNext, 
          Capability.SkipToPrevious, 
          Capability.SeekTo, 
          Capability.Stop
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
        notificationCapabilities: [
          Capability.Play, 
          Capability.Pause, 
          Capability.SkipToNext, 
          Capability.SkipToPrevious, 
          Capability.SeekTo
        ],
      });
    } catch (e) {}
  };

  useEffect(() => {
    const initRNTP = async () => {
      if (isRNTPInitialized) return;
      try {
        await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
        await restoreRNTPNotification();
        isRNTPInitialized = true;
      } catch (e) {}
    };
    initRNTP();
  }, []);

  // ★ Dev Client時等の null/undefined イベント登録を防ぐ安全なリスナー登録ヘルパー
  useEffect(() => {
    const subscriptions: any[] = [];

    const safeAddListener = (eventName: any, callback: (event: any) => void) => {
      if (!eventName || typeof eventName !== 'string') {
        return;
      }
      try {
        const sub = TrackPlayer.addEventListener(eventName, callback);
        if (sub) subscriptions.push(sub);
      } catch (e) {}
    };

    safeAddListener(Event.RemotePlay, () => {
      handlersRef.current?.onPlay?.();
    });
    safeAddListener(Event.RemotePause, () => {
      handlersRef.current?.onPause?.();
    });
    safeAddListener(Event.RemoteTogglePlayPause, () => {
      handlersRef.current?.onTogglePlayPause?.();
    });
    safeAddListener(Event.RemoteNext, () => {
      handlersRef.current?.onNext?.();
    });
    safeAddListener(Event.RemotePrevious, () => {
      handlersRef.current?.onPrev?.();
    });
    safeAddListener(Event.RemoteSeek, (event) => {
      handlersRef.current?.onSeek?.(event.position);
    });

    return () => {
      subscriptions.forEach((sub) => {
        try {
          if (sub && typeof sub.remove === 'function') {
            sub.remove();
          }
        } catch (e) {}
      });
    };
  }, []);

  return {
    rntpState,
    rntpProgress,
    isRNTPPlaying,
    syncAndroidEqualizerSession,
    clearRNTPNotification,
    restoreRNTPNotification,
  };
};