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
  const hasEndedTriggeredRef = useRef(false);

  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  useEffect(() => {
    onRemoteCommandRef.current = onRemoteCommand;
  }, [onRemoteCommand]);

  useEffect(() => {
    const mod = getNativeModule();
    if (!mod) return;

    let subRemote: any = null;
    let subEnded: any = null;

    try {
      const emitter = new EventEmitter(mod);
      subRemote = emitter.addListener('onRemoteCommand', (event: any) => {
        if (event && event.action && onRemoteCommandRef.current) {
          console.log(`[DEBUG-IOSEQ] onRemoteCommand received: ${event.action}`, event);
          onRemoteCommandRef.current(event.action, event.position);
        }
      });
      subEnded = emitter.addListener('onPlaybackEnded', () => {
        if (!hasEndedTriggeredRef.current && onTrackEndedRef.current) {
          console.log(`[DEBUG-IOSEQ] onPlaybackEnded received. Triggering next track.`);
          hasEndedTriggeredRef.current = true;
          onTrackEndedRef.current();
        }
      });
    } catch (e) {}

    return () => {
      try {
        if (subRemote && typeof subRemote.remove === 'function') subRemote.remove();
        if (subEnded && typeof subEnded.remove === 'function') subEnded.remove();
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
    hasEndedTriggeredRef.current = false;

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

      if (durSec > 0 && posSec >= durSec - 0.4) {
        if (!hasEndedTriggeredRef.current) {
          console.log(`[DEBUG-IOSEQ] Polling detected end of track. Triggering next.`);
          hasEndedTriggeredRef.current = true;
          onTrackEndedRef.current();
        }
      }
    }, 250);
  };

  const playIosEQ = () => {
    hasEndedTriggeredRef.current = false;
    playIOS();
  };

  const pauseIosEQ = () => {
    pauseIOS();
  };

  const stopIosEQ = () => {
    stopIOS();
    clearIOSEQPolling();
    hasEndedTriggeredRef.current = false;
  };

  const seekIosEQ = (seconds: number) => {
    hasEndedTriggeredRef.current = false;
    seekToIOS(seconds);
    setPlaybackStatusIOSEQ((prev) => ({ ...prev, positionMillis: seconds * 1000 }));
  };

  const loadAndPlaySafe = (filePath: string, startSeconds: number, autoPlay: boolean = true) => {
    hasEndedTriggeredRef.current = false;
    return loadAndPlayIOS(filePath, startSeconds, autoPlay);
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
    loadAndPlayIOS: loadAndPlaySafe,
    getPositionIOS,
    getDurationIOS,
    setEngineMode: setIosEqualizerEngineMode,
    updateNowPlaying: updateIosNowPlaying,
  };
};