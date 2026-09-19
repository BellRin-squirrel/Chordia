import { useEffect } from 'react';
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

export const useRntpEngine = () => {
  const rntpState = usePlaybackState();
  const rntpProgress = useProgress(250);
  const isRNTPPlaying = isStatePlaying(rntpState);

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
        capabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.SeekTo, Capability.Stop],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
        notificationCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.SeekTo],
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

  return {
    rntpState,
    rntpProgress,
    isRNTPPlaying,
    syncAndroidEqualizerSession,
    clearRNTPNotification,
    restoreRNTPNotification,
  };
};