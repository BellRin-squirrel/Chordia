import { useState, useRef, useEffect } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { resolveExpoAudioSource } from './types';

export const useExpoAudioEngine = (onTrackEnded: () => void) => {
  const expoAudioPlayerRef = useRef<any>(null);
  const expoPollingRef = useRef<NodeJS.Timeout | null>(null);
  const expoStatusSubscriptionRef = useRef<any>(null);
  const onTrackEndedRef = useRef(onTrackEnded);

  useEffect(() => {
    onTrackEndedRef.current = onTrackEnded;
  }, [onTrackEnded]);

  const [playbackStatusExpo, setPlaybackStatusExpo] = useState({
    positionMillis: 0,
    durationMillis: 0,
    isPlaying: false,
  });

  const configureExpoAudioMode = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
    } catch (e) {}
  };

  useEffect(() => {
    configureExpoAudioMode();
  }, []);

  const clearExpoResources = () => {
    if (expoStatusSubscriptionRef.current) {
      try {
        if (typeof expoStatusSubscriptionRef.current.remove === 'function') {
          expoStatusSubscriptionRef.current.remove();
        } else if (typeof expoStatusSubscriptionRef.current === 'function') {
          expoStatusSubscriptionRef.current();
        }
      } catch (e) {}
      expoStatusSubscriptionRef.current = null;
    }
    if (expoPollingRef.current) {
      clearInterval(expoPollingRef.current);
      expoPollingRef.current = null;
    }
    if (expoAudioPlayerRef.current) {
      try {
        expoAudioPlayerRef.current.pause?.();
        expoAudioPlayerRef.current.remove?.();
        expoAudioPlayerRef.current.release?.();
      } catch (e) {}
      expoAudioPlayerRef.current = null;
    }
  };

  const startExpoPolling = (player: any, onPlayStateChange: (playing: boolean) => void) => {
    if (expoPollingRef.current) clearInterval(expoPollingRef.current);
    expoPollingRef.current = setInterval(() => {
      if (!player) return;
      const cTime = player.currentTime || 0;
      const dTime = player.duration || 0;
      const pState = player.playing ?? player.isPlaying ?? false;
      setPlaybackStatusExpo({ positionMillis: cTime * 1000, durationMillis: dTime * 1000, isPlaying: pState });
      onPlayStateChange(pState);
    }, 250);
  };

  const attachExpoAudioListeners = (player: any, onPlayStateChange: (playing: boolean) => void) => {
    try {
      const onStatusUpdate = (status: any) => {
        if (!status) return;
        if (status.currentTime !== undefined && status.duration !== undefined) {
          setPlaybackStatusExpo((prev) => ({ ...prev, positionMillis: (status.currentTime || 0) * 1000, durationMillis: (status.duration || 0) * 1000 }));
        }
        const activePlaying = status.isPlaying ?? status.playing;
        if (activePlaying !== undefined) {
          setPlaybackStatusExpo((prev) => ({ ...prev, isPlaying: activePlaying }));
          onPlayStateChange(activePlaying);
        }
        const isLooping = player.loop ?? player.isLooping ?? false;
        if (status.didJustFinish === true && !isLooping) {
          onTrackEndedRef.current();
        }
      };

      if (typeof player.addListener === 'function') {
        expoStatusSubscriptionRef.current = player.addListener('playbackStatusUpdate', onStatusUpdate);
      } else if (typeof player.addEventListener === 'function') {
        expoStatusSubscriptionRef.current = player.addEventListener('playbackStatusUpdate', onStatusUpdate);
      }
    } catch (e) {}
  };

  const initExpoAudioPlayer = async (
    song: any, 
    isLoopOne: boolean, 
    autoPlay: boolean, 
    onPlayStateChange: (playing: boolean) => void
  ) => {
    clearExpoResources();
    await configureExpoAudioMode();

    try {
      let player: any = null;
      const source = resolveExpoAudioSource(song.localMusicUri);

      try {
        player = createAudioPlayer(source);
      } catch (e1) {
        try {
          player = createAudioPlayer({ uri: typeof source === 'string' ? source : song.localMusicUri });
        } catch (e2) {
          player = createAudioPlayer(song.localMusicUri);
        }
      }

      expoAudioPlayerRef.current = player;
      if (player) {
        player.loop = isLoopOne;
        player.isLooping = isLoopOne;
        attachExpoAudioListeners(player, onPlayStateChange);
        if (autoPlay) {
          player.play();
          onPlayStateChange(true);
        } else {
          player.pause();
          onPlayStateChange(false);
        }
        startExpoPolling(player, onPlayStateChange);
      }
    } catch (e) {
      console.warn('[ExpoAudio] initExpoAudioPlayer failed:', e);
    }
  };

  return {
    expoAudioPlayerRef,
    playbackStatusExpo,
    setPlaybackStatusExpo,
    configureExpoAudioMode,
    clearExpoResources,
    initExpoAudioPlayer,
  };
};