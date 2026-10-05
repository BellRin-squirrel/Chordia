import { useState, useRef, useEffect } from 'react';
import { EventEmitter } from 'expo-modules-core';
import { 
  loadAndPlayIOS, 
  pauseIOS, 
  playIOS, 
  stopIOS, 
  seekToIOS, 
  getPositionIOS, 
  getDurationIOS, 
  isPlayingIOS,
  setIosEqualizerEngineMode,
  updateIosNowPlaying,
  getNativeModule
} from '../../utils/equalizer';

export const useIosEqualizerEngine = (
  onTrackEnded: () => void,
  onRemoteCommand?: (action: string, param?: any) => void
) => {
  const isIOSEQActiveRef = useRef(false);
  const iosEQPollingRef = useRef<NodeJS.Timeout | null>(null);
  const onTrackEndedRef = useRef(onTrackEnded);
  const onRemoteCommandRef = useRef(onRemoteCommand);

  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  useEffect(() => {
    onRemoteCommandRef.current = onRemoteCommand;
  }, [onRemoteCommand]);

  // ★ EventEmitter を用いて Swift 側の onRemoteCommand イベントを確実に購読
  useEffect(() => {
    const mod = getNativeModule();
    if (!mod) return;

    let subscription: any = null;
    try {
      const emitter = new EventEmitter(mod);
      subscription = emitter.addListener('onRemoteCommand', (event: any) => {
        if (event && event.action && onRemoteCommandRef.current) {
          onRemoteCommandRef.current(event.action, event.position);
        }
      });
    } catch (e) {}

    return () => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (e) {}
    };
  }, []);

  const [playbackStatusIOSEQ, setPlaybackStatusIOSEQ] = useState({
    positionMillis: 0,
    durationMillis: 0,
    isPlaying: false,
  });

  const clearIOSEQPolling = () => {
    if (iosEQPollingRef.current) {
      clearInterval(iosEQPollingRef.current);
      iosEQPollingRef.current = null;
    }
  };

  const startIOSEQPolling = (onPlayStateChange: (playing: boolean) => void) => {
    clearIOSEQPolling();
    iosEQPollingRef.current = setInterval(() => {
      if (!isIOSEQActiveRef.current) return;
      const posSec = getPositionIOS();
      const durSec = getDurationIOS();
      const playing = isPlayingIOS();

      setPlaybackStatusIOSEQ({
        positionMillis: posSec * 1000,
        durationMillis: durSec * 1000,
        isPlaying: playing,
      });
      onPlayStateChange(playing);

      if (durSec > 0 && posSec >= durSec - 0.25) {
        onTrackEndedRef.current();
      }
    }, 250);
  };

  const playIosEQ = () => {
    playIOS();
  };

  const pauseIosEQ = () => {
    pauseIOS();
  };

  const stopIosEQ = () => {
    stopIOS();
    clearIOSEQPolling();
  };

  const seekIosEQ = (seconds: number) => {
    seekToIOS(seconds);
    setPlaybackStatusIOSEQ((prev) => ({ ...prev, positionMillis: seconds * 1000 }));
  };

  return {
    isIOSEQActiveRef,
    playbackStatusIOSEQ,
    setPlaybackStatusIOSEQ,
    startIOSEQPolling,
    clearIOSEQPolling,
    playIosEQ,
    pauseIosEQ,
    stopIosEQ,
    seekIosEQ,
    loadAndPlayIOS,
    getPositionIOS,
    getDurationIOS,
    setEngineMode: setIosEqualizerEngineMode,
    updateNowPlaying: updateIosNowPlaying,
  };
};