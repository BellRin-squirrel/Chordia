import { useState, useRef, useEffect } from 'react';
import { Animated, Dimensions, Alert } from 'react-native';
import TrackPlayer, { 
  State as RNTPState, 
  usePlaybackState, 
  useProgress, 
  RepeatMode, 
  Capability, 
  Event 
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createAudioPlayer, 
  setAudioModeAsync 
} from 'expo-audio';

const { height } = Dimensions.get('window');

let isRNTPInitialized = false;

export const useAudioPlayer = () => {
  const [audioEngine, setAudioEngine] = useState<'expo-av'|'rntp'>('rntp');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [playQueue, setPlayQueue] = useState<any[]>([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopMode, setLoopMode] = useState<'OFF' | 'ALL' | 'ONE'>('OFF');
  const [isShuffle, setIsShuffle] = useState(false);
  
  const [isFullPlayer, setIsFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [navStackLength, setNavStackLength] = useState(1);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const queueTransitionAnim = useRef(new Animated.Value(0)).current;

  const originalQueueRef = useRef<any[]>([]);
  const activeQueueRef = useRef<any[]>([]); 
  const queueRef = useRef<any[]>([]);       
  
  const currentSongRef = useRef<any>(null);
  const indexRef = useRef<number>(0);
  const loopRef = useRef<any>('OFF');
  const shuffleRef = useRef<boolean>(false);
  
  const expoAudioPlayerRef = useRef<any>(null);
  const expoPollingRef = useRef<NodeJS.Timeout | null>(null);
  const expoStatusSubscriptionRef = useRef<any>(null);
  const isSkippingRef = useRef<boolean>(false);

  const [playbackStatusExpo, setPlaybackStatusExpo] = useState<any>({
    positionMillis: 0,
    durationMillis: 0,
    isPlaying: false,
  });

  useEffect(() => { currentSongRef.current = currentSong; },[currentSong]);
  useEffect(() => { queueRef.current = playQueue; }, [playQueue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { loopRef.current = loopMode; }, [loopMode]);
  useEffect(() => { shuffleRef.current = isShuffle; }, [isShuffle]);

  useEffect(() => {
    AsyncStorage.getItem('audioEngine').then(val => {
      if (val === 'expo-av' || val === 'rntp') setAudioEngine(val);
    });
    return () => clearExpoResources();
  },[]);

  const configureExpoAudioMode = async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        playsInSilentModeIOS: true,
        shouldPlayInBackground: true,
        staysActiveInBackground: true,
        interruptionMode: 'mixWithOthers',
        interruptionModeIOS: 'mixWithOthers',
        interruptionModeAndroid: 'duckOthers',
        allowsRecording: false,
        allowsRecordingIOS: false,
      } as any);
    } catch (e) {
      console.warn("Expo-Audio mode configuration failed", e);
    }
  };

  useEffect(() => {
    configureExpoAudioMode();
  },[]);

  const clearRNTPNotification = async () => {
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      await TrackPlayer.updateOptions({
        capabilities: [],
        compactCapabilities: [],
      });
    } catch(e) {}
  };

  const restoreRNTPNotification = async () => {
    try {
      await TrackPlayer.updateOptions({
        android: { appKilledBehavior: 'StopPlaybackAndRemoveNotification' as any },
        capabilities:[ 
          Capability.Play, 
          Capability.Pause, 
          Capability.SkipToNext, 
          Capability.SkipToPrevious, 
          Capability.SeekTo 
        ],
        compactCapabilities:[Capability.Play, Capability.Pause, Capability.SkipToNext],
      });
    } catch(e) {}
  };

  useEffect(() => {
    const initRNTP = async () => {
      if (isRNTPInitialized) return;
      try {
        await TrackPlayer.setupPlayer();
        await restoreRNTPNotification();
        isRNTPInitialized = true;
      } catch (e) { console.log("RNTP setup error:", e); }
    };
    initRNTP();
  },[]);

  const rntpState = usePlaybackState();
  const rntpProgress = useProgress(250); 

  const playbackStatus = audioEngine === 'rntp' ? {
    positionMillis: rntpProgress.position * 1000,
    durationMillis: rntpProgress.duration * 1000,
    isPlaying: rntpState.state === RNTPState.Playing,
  } : playbackStatusExpo;

  useEffect(() => {
    if (audioEngine === 'rntp') {
      if (rntpState.state === RNTPState.Playing) setIsPlaying(true);
      else if (rntpState.state === RNTPState.Paused || rntpState.state === RNTPState.Stopped) setIsPlaying(false);
    }
  },[rntpState.state, audioEngine]);

  const showToast = (message: string) => {
    if (toastVisible) return;
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setToastVisible(false);
        });
      }, 2000);
    });
  };

  // ★ 最近再生した曲 ＆ 統計用再生ログの二重保存
  const saveHistory = async (song: any) => {
    try {
      // 1. 最近再生した曲（最大10件）
      const rs = await AsyncStorage.getItem('recently_played_songs');
      let list = rs ? JSON.parse(rs) : [];
      list = [song, ...list.filter((s: any) => s.localMusicUri !== song.localMusicUri)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_songs', JSON.stringify(list));

      // 2. 統計・ランキング用再生ログ（日時付き、最大500件）
      const ph = await AsyncStorage.getItem('chordia_playback_history');
      let playHistory = ph ? JSON.parse(ph) : [];
      const newEntry = {
        id: `${song.localMusicUri || 'song'}_${Date.now()}`,
        title: song.title || 'Untitled',
        artist: song.artist || 'Unknown Artist',
        album: song.album || 'Unknown Album',
        localMusicUri: song.localMusicUri,
        localImageUri: song.localImageUri,
        playedAt: new Date().toISOString(),
      };
      playHistory = [newEntry, ...playHistory].slice(0, 500);
      await AsyncStorage.setItem('chordia_playback_history', JSON.stringify(playHistory));
    } catch(e){}
  };

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
      } catch (e) {}
      expoAudioPlayerRef.current = null;
    }
  };

  const startExpoPolling = (player: any) => {
    if (expoPollingRef.current) clearInterval(expoPollingRef.current);
    expoPollingRef.current = setInterval(() => {
      if (!player) return;
      
      const cTime = player.currentTime || 0;
      const dTime = player.duration || 0;
      const pState = player.playing ?? player.isPlaying ?? false;
      
      setPlaybackStatusExpo((prev: any) => ({
        ...prev,
        positionMillis: cTime * 1000,
        durationMillis: dTime * 1000,
        isPlaying: pState,
      }));

      setIsPlaying(pState);
    }, 250);
  };

  const handleNextRef = useRef<() => void>(() => {});

  const attachExpoAudioListeners = (player: any) => {
    try {
      if (expoStatusSubscriptionRef.current) {
        if (typeof expoStatusSubscriptionRef.current.remove === 'function') {
          expoStatusSubscriptionRef.current.remove();
        } else if (typeof expoStatusSubscriptionRef.current === 'function') {
          expoStatusSubscriptionRef.current();
        }
        expoStatusSubscriptionRef.current = null;
      }

      const onStatusUpdate = (status: any) => {
        if (!status) return;

        if (status.currentTime !== undefined && status.duration !== undefined) {
          setPlaybackStatusExpo((prev: any) => ({
            ...prev,
            positionMillis: (status.currentTime || 0) * 1000,
            durationMillis: (status.duration || 0) * 1000,
          }));
        }

        const activePlaying = status.isPlaying ?? status.playing;
        if (activePlaying !== undefined) {
          setPlaybackStatusExpo((prev: any) => ({
            ...prev,
            isPlaying: activePlaying,
          }));
          setIsPlaying(activePlaying);
        }

        const isLooping = player.loop ?? player.isLooping ?? false;
        if (status.didJustFinish === true && !isLooping) {
          handleNextRef.current();
        }
      };

      if (typeof player.addListener === 'function') {
        expoStatusSubscriptionRef.current = player.addListener('playbackStatusUpdate', onStatusUpdate);
      } else if (typeof player.addEventListener === 'function') {
        expoStatusSubscriptionRef.current = player.addEventListener('playbackStatusUpdate', onStatusUpdate);
      }
    } catch (e) {
      console.warn('Expo-audio attachExpoAudioListeners error:', e);
    }
  };

  const initExpoAudioPlayer = async (song: any, isLoopOne: boolean, autoPlay: boolean = true) => {
    clearExpoResources();
    await configureExpoAudioMode();

    const uri = song.localMusicUri;
    let player: any = null;

    try {
      player = createAudioPlayer({ uri });
      expoAudioPlayerRef.current = player;

      if (player) {
        player.loop = isLoopOne;
        player.isLooping = isLoopOne;

        attachExpoAudioListeners(player);

        if (autoPlay) {
          player.play();
          setIsPlaying(true);
          setTimeout(() => {
            try {
              if (autoPlay && expoAudioPlayerRef.current === player) {
                player.play();
              }
            } catch (e) {}
          }, 80);
        } else {
          player.pause();
          setIsPlaying(false);
        }

        startExpoPolling(player);
      }
    } catch (e) {
      console.warn('[Expo-Audio] createAudioPlayer error:', e);
    }
  };

  const loadAndPlayInternal = async (
    song: any, 
    activeQueue: any[] = [], 
    startIndex: number = 0, 
    startPositionMs: number = 0,
    shouldPlay: boolean = true,
    targetEngine?: 'expo-av'|'rntp'
  ) => {
    const engineToUse = targetEngine || audioEngine;

    try {
      if (engineToUse === 'rntp') {
        clearExpoResources();

        await restoreRNTPNotification();
        await TrackPlayer.reset();
        const tracks = activeQueue.map(s => ({
          id: s.localMusicUri, 
          url: s.localMusicUri, 
          title: s.title || 'Unknown', 
          artist: s.artist || 'Unknown',
          artwork: s.localImageUri || require('../assets/images/icon.png'), 
          originalData: s
        }));
        await TrackPlayer.add(tracks);
        await TrackPlayer.skip(startIndex);

        if (loopRef.current === 'ONE') await TrackPlayer.setRepeatMode(RepeatMode.Track);
        else if (loopRef.current === 'ALL') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        else await TrackPlayer.setRepeatMode(RepeatMode.Off);

        setTimeout(async () => {
          try {
            if (startPositionMs > 0) {
               await TrackPlayer.seekTo(startPositionMs / 1000);
            }
            if (shouldPlay) {
               await TrackPlayer.play();
            } else {
               setIsPlaying(false);
            }
          } catch(e) {}
        }, 400);

      } else {
        await clearRNTPNotification();

        const isLoopOne = loopRef.current === 'ONE';
        await initExpoAudioPlayer(song, isLoopOne, shouldPlay); 
        
        if (startPositionMs > 0) {
          setTimeout(() => {
            try {
              expoAudioPlayerRef.current?.seekTo(startPositionMs / 1000);
              setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: startPositionMs }));
            } catch(e) {}
          }, 150);
        }
      }

      setCurrentSong(song);
      currentSongRef.current = song;
      
      const appQueue = activeQueue.slice(startIndex + 1);
      setPlayQueue(appQueue);
      queueRef.current = appQueue;
      
      setCurrentIndex(startIndex);
      indexRef.current = startIndex;
      
      saveHistory(song);
    } catch (e) {
      console.warn("loadAndPlayInternal Error:", e);
    }
  };

  const changeAudioEngine = async (engine: 'expo-av'|'rntp') => {
    if (engine === audioEngine) return;
    
    const wasPlaying = isPlaying;
    const currentSongToRestore = currentSongRef.current;
    let currentPosition = 0;
    
    if (audioEngine === 'rntp') {
      try { 
        currentPosition = (await TrackPlayer.getPosition()) * 1000;
        await clearRNTPNotification();
      } catch(e){}
    } else {
      currentPosition = playbackStatusExpo.positionMillis || 0;
      clearExpoResources();
    }
    
    setAudioEngine(engine);
    await AsyncStorage.setItem('audioEngine', engine);
    
    if (currentSongToRestore && activeQueueRef.current.length > 0) {
      setTimeout(() => {
        loadAndPlayInternal(currentSongToRestore, activeQueueRef.current, indexRef.current, currentPosition, wasPlaying, engine);
      }, 400);
    } else {
      setPlayQueue([]);
      setCurrentSong(null);
    }
  };

  const rebuildActiveQueue = (forceShuffle: boolean, currentSong: any) => {
    if (!currentSong || originalQueueRef.current.length === 0) return [];
    if (forceShuffle) {
      const remaining = originalQueueRef.current.filter(s => s.localMusicUri !== currentSong.localMusicUri);
      return [currentSong, ...remaining.sort(() => Math.random() - 0.5)];
    } else {
      return [...originalQueueRef.current];
    }
  };

  const startQueue = (songs: any[], selectedSong?: any | null, forceShuffle?: boolean) => {
    if (songs.length === 0) return;
    originalQueueRef.current = [...songs];
    const newShuffle = forceShuffle !== undefined ? forceShuffle : isShuffle;
    setIsShuffle(newShuffle);
    shuffleRef.current = newShuffle;

    let firstSong = selectedSong;
    if (!firstSong) {
        if (newShuffle) {
            const shuffled = [...songs].sort(() => Math.random() - 0.5);
            firstSong = shuffled[0];
        } else {
            firstSong = songs[0];
        }
    }

    const newActiveQueue = rebuildActiveQueue(newShuffle, firstSong);
    activeQueueRef.current = newActiveQueue;
    
    const targetIndex = newActiveQueue.findIndex(s => s.localMusicUri === firstSong.localMusicUri);
    loadAndPlayInternal(firstSong, newActiveQueue, targetIndex, 0, true);
  };

  const toggleShuffleMode = async () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    shuffleRef.current = nextShuffle;
    
    if (!currentSongRef.current || originalQueueRef.current.length === 0) return;
    
    const currentSong = currentSongRef.current;
    
    const newActiveQueue = rebuildActiveQueue(nextShuffle, currentSong);
    activeQueueRef.current = newActiveQueue;

    const targetIndex = newActiveQueue.findIndex(s => s.localMusicUri === currentSong.localMusicUri);
    
    const appQueue = newActiveQueue.slice(targetIndex + 1);
    setPlayQueue(appQueue);
    queueRef.current = appQueue;
    setCurrentIndex(targetIndex);
    indexRef.current = targetIndex;

    if (audioEngine === 'rntp') {
      try {
        const queue = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        
        if (activeIndex !== undefined && activeIndex !== null) {
          const indicesToRemove = queue.map((_, i) => i).filter(i => i !== activeIndex);
          if (indicesToRemove.length > 0) {
            await TrackPlayer.remove(indicesToRemove);
          }
          
          const tracksBefore = newActiveQueue.slice(0, targetIndex).map(s => ({
            id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
            artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s
          }));
          
          const tracksAfter = newActiveQueue.slice(targetIndex + 1).map(s => ({
            id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
            artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s
          }));
          
          if (tracksBefore.length > 0) {
            await TrackPlayer.add(tracksBefore, 0);
          }
          if (tracksAfter.length > 0) {
            await TrackPlayer.add(tracksAfter);
          }
        }
      } catch (e) {
        console.warn('Shuffle mode toggle error:', e);
      }
    }
  };

  const toggleLoopMode = async () => {
    const modes: ('OFF' | 'ALL' | 'ONE')[] = ['OFF', 'ALL', 'ONE'];
    const nextLoop = modes[(modes.indexOf(loopMode) + 1) % 3];
    setLoopMode(nextLoop);
    loopRef.current = nextLoop;
    
    if (audioEngine === 'rntp') {
      if (nextLoop === 'ONE') await TrackPlayer.setRepeatMode(RepeatMode.Track);
      else if (nextLoop === 'ALL') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      else await TrackPlayer.setRepeatMode(RepeatMode.Off);
    } else {
      if (expoAudioPlayerRef.current) {
        expoAudioPlayerRef.current.loop = (nextLoop === 'ONE');
        expoAudioPlayerRef.current.isLooping = (nextLoop === 'ONE');
      }
    }
  };

  const handleNextInternal = async () => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    setTimeout(() => { isSkippingRef.current = false; }, 600);

    if (audioEngine === 'rntp') {
      await TrackPlayer.skipToNext();
    } else {
      const activeQueue = activeQueueRef.current;
      const currentSong = currentSongRef.current;
      const mode = loopRef.current;
      const idx = indexRef.current;
      
      if (mode === 'ONE' && currentSong) {
        loadAndPlayInternal(currentSong, activeQueue, idx, 0, true);
        return;
      }
      
      const nextIdx = idx + 1;
      if (nextIdx < activeQueue.length) {
        const nextSong = activeQueue[nextIdx];
        loadAndPlayInternal(nextSong, activeQueue, nextIdx, 0, true);
      } else {
        if (mode === 'ALL' && activeQueue.length > 0) {
          let nextActiveQueue = activeQueue;
          if (shuffleRef.current) {
            const shuffled = [...originalQueueRef.current].sort(() => Math.random() - 0.5);
            nextActiveQueue = shuffled;
            activeQueueRef.current = nextActiveQueue;
          }
          const firstSong = nextActiveQueue[0];
          loadAndPlayInternal(firstSong, nextActiveQueue, 0, 0, true);
        } else {
          setIsPlaying(false);
        }
      }
    }
  };

  handleNextRef.current = handleNextInternal;

  const handleNext = () => handleNextInternal();
  
  const handlePrev = async () => {
    if (audioEngine === 'rntp') {
      const currentPos = await TrackPlayer.getPosition();
      if (currentPos > 3) await TrackPlayer.seekTo(0);
      else await TrackPlayer.skipToPrevious();
    } else {
      const activeQueue = activeQueueRef.current;
      const idx = indexRef.current;
      
      const currentPos = playbackStatusExpo?.positionMillis || 0;
      if (currentPos > 3000) {
        try {
          expoAudioPlayerRef.current?.seekTo(0);
          setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: 0 }));
        } catch(e) {}
        return;
      }

      let prevIdx = idx - 1;
      if (prevIdx < 0) {
        if (loopRef.current === 'ALL') prevIdx = activeQueue.length - 1;
        else prevIdx = 0;
      }
      
      const prevSong = activeQueue[prevIdx];
      loadAndPlayInternal(prevSong, activeQueue, prevIdx, 0, true);
    }
  };

  const togglePlayPause = async () => {
    if (audioEngine === 'rntp') {
      const state = await TrackPlayer.getState();
      if (state === RNTPState.Playing) await TrackPlayer.pause();
      else await TrackPlayer.play();
    } else {
      const player = expoAudioPlayerRef.current;
      if (!player) return;
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        await configureExpoAudioMode();
        player.play();
        setIsPlaying(true);
      }
    }
  };

  const setPositionAsync = async (v: number) => {
    if (audioEngine === 'rntp') {
      await TrackPlayer.seekTo(v / 1000);
    } else {
      try {
        expoAudioPlayerRef.current?.seekTo(v / 1000);
        setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: v }));
      } catch(e) {}
    }
  };

  const closeFullPlayer = () => {
    Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true }).start(() => { 
        setIsFullPlayer(false); setShowQueue(false); setShowLyrics(false); queueTransitionAnim.setValue(0);
    });
  };

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
        if (audioEngine === 'rntp' && event.track && event.track.originalData) {
            const newSong = event.track.originalData;
            setCurrentSong(newSong);
            currentSongRef.current = newSong;
            
            const activeQueue = activeQueueRef.current;
            const idx = activeQueue.findIndex(s => s.localMusicUri === newSong.localMusicUri);
            
            if (idx !== -1) {
                const newPlayQueue = activeQueue.slice(idx + 1);
                setPlayQueue(newPlayQueue);
                queueRef.current = newPlayQueue;
                setCurrentIndex(idx);
                indexRef.current = idx;
            }
        }
    });
    return () => sub.remove();
  }, [audioEngine]);

  return { 
    sound: { setPositionAsync },
    audioEngine, changeAudioEngine, 
    isPlaying, currentSong, playbackStatus, playQueue, currentIndex, 
    loopMode, toggleLoopMode, isShuffle, toggleShuffleMode, isFullPlayer, setIsFullPlayer, 
    showQueue, setShowQueue, showLyrics, setShowLyrics, 
    toastVisible, toastMessage, toastAnim, showToast,
    navStackLength, setNavStackLength,
    startQueue, loadAndPlay: (song:any) => startQueue([song], song, false), handleNext, handlePrev, togglePlayPause, 
    slideAnim, queueTransitionAnim, closeFullPlayer 
  };
};