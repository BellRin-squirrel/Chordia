import { useState, useRef, useEffect } from 'react';
import { Animated, Dimensions, Alert } from 'react-native';
import TrackPlayer, { State as RNTPState, usePlaybackState, useProgress, RepeatMode, Capability, Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const { height } = Dimensions.get('window');

let isRNTPInitialized = false;

export const useAudioPlayer = () => {
  const[audioEngine, setAudioEngine] = useState<'expo-av'|'rntp'>('rntp');

  const[isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [playQueue, setPlayQueue] = useState<any[]>([]); 
  const[currentIndex, setCurrentIndex] = useState(0);
  const [loopMode, setLoopMode] = useState<'OFF' | 'ALL' | 'ONE'>('OFF');
  const [isShuffle, setIsShuffle] = useState(false);
  
  const [isFullPlayer, setIsFullPlayer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [navStackLength, setNavStackLength] = useState(1);

  const [toastVisible, setToastVisible] = useState(false);
  const[toastMessage, setToastMessage] = useState('');
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

  const [playbackStatusExpo, setPlaybackStatusExpo] = useState<any>({
    positionMillis: 0,
    durationMillis: 0,
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
    return () => clearExpoPolling();
  },[]);

  const clearExpoPolling = () => {
    if (expoPollingRef.current) {
      clearInterval(expoPollingRef.current);
      expoPollingRef.current = null;
    }
  };

  const startExpoPolling = (player: any) => {
    clearExpoPolling();
    expoPollingRef.current = setInterval(() => {
      if (!player) return;
      
      const cTime = player.currentTime || 0;
      const dTime = player.duration || 0;
      const pState = player.playing || false;
      
      setPlaybackStatusExpo({
        positionMillis: cTime * 1000,
        durationMillis: dTime * 1000,
      });

      setIsPlaying(pState);

      if (dTime > 0 && cTime >= dTime - 0.2 && !pState) {
        if (!player.isLooping) {
           handleNextInternal();
        }
      }
    }, 250);
  };

  const changeAudioEngine = async (engine: 'expo-av'|'rntp') => {
    if (engine === audioEngine) return;
    
    const wasPlaying = isPlaying;
    const currentSongToRestore = currentSongRef.current;
    let currentPosition = 0;
    
    if (audioEngine === 'rntp') {
      try { 
        currentPosition = (await TrackPlayer.getPosition()) * 1000;
        await TrackPlayer.stop(); 
        await TrackPlayer.reset(); 
      } catch(e){}
    } else {
      currentPosition = playbackStatusExpo.positionMillis || 0;
      try { 
        expoAudioPlayerRef.current?.pause(); 
        clearExpoPolling();
      } catch(e){}
    }
    
    setAudioEngine(engine);
    await AsyncStorage.setItem('audioEngine', engine);
    
    if (currentSongToRestore && activeQueueRef.current.length > 0) {
      loadAndPlayInternal(currentSongToRestore, activeQueueRef.current, indexRef.current, currentPosition, wasPlaying);
    } else {
      setPlayQueue([]);
      setCurrentSong(null);
    }
  };

  useEffect(() => {
    const initExpoAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: 'mixWithOthers', 
          interruptionModeAndroid: 'duckOthers',
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) { console.warn("Expo-Audio init failed", e); }
    };
    initExpoAudio();
  },[]);

  useEffect(() => {
    const initRNTP = async () => {
      if (isRNTPInitialized) return;
      try {
        await TrackPlayer.setupPlayer();
        await TrackPlayer.updateOptions({
          android: { appKilledBehavior: 'StopPlaybackAndRemoveNotification' as any },
          capabilities:[ Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.SeekTo ],
          compactCapabilities:[Capability.Play, Capability.Pause, Capability.SkipToNext],
        });
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

  const saveHistory = async (song: any) => {
    try {
      const rs = await AsyncStorage.getItem('recently_played_songs');
      let list = rs ? JSON.parse(rs) : [];
      list =[song, ...list.filter((s: any) => s.localMusicUri !== song.localMusicUri)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_songs', JSON.stringify(list));
    } catch(e){}
  };

  const initExpoAudioPlayer = (uri: string, isLoopOne: boolean, autoPlay: boolean = true) => {
    clearExpoPolling();
    let player = expoAudioPlayerRef.current;
    if (player) {
      player.replace({ uri });
      player.isLooping = isLoopOne;
      if (autoPlay) player.play();
      else player.pause();
    } else {
      player = createAudioPlayer({ uri });
      player.isLooping = isLoopOne;
      expoAudioPlayerRef.current = player;
      if (autoPlay) player.play();
    }
    startExpoPolling(player);
  };

  const loadAndPlayInternal = async (
    song: any, 
    activeQueue: any[] = [], 
    startIndex: number = 0, 
    startPositionMs: number = 0,
    shouldPlay: boolean = true
  ) => {
    try {
      if (audioEngine === 'rntp') {
        await TrackPlayer.reset();
        const tracks = activeQueue.map(s => ({
          id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
          artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s
        }));
        await TrackPlayer.add(tracks);
        await TrackPlayer.skip(startIndex);

        if (loopRef.current === 'ONE') await TrackPlayer.setRepeatMode(RepeatMode.Track);
        else if (loopRef.current === 'ALL') await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        else await TrackPlayer.setRepeatMode(RepeatMode.Off);

        if (startPositionMs > 0) {
           await TrackPlayer.seekTo(startPositionMs / 1000);
        }

        if (shouldPlay) {
           setTimeout(async () => {
              try { await TrackPlayer.play(); } catch(e) {}
           }, 300);
        } else {
           setIsPlaying(false);
        }
      } else {
        const isLoopOne = loopRef.current === 'ONE';
        initExpoAudioPlayer(song.localMusicUri, isLoopOne, shouldPlay);
        
        if (startPositionMs > 0) {
          expoAudioPlayerRef.current?.seekTo(startPositionMs / 1000);
          setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: startPositionMs }));
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
    
    // 現在の曲を基準に新しいキュー順序を生成
    const newActiveQueue = rebuildActiveQueue(nextShuffle, currentSong);
    activeQueueRef.current = newActiveQueue;

    const targetIndex = newActiveQueue.findIndex(s => s.localMusicUri === currentSong.localMusicUri);
    
    // JS(React)側のUIを即座に更新
    const appQueue = newActiveQueue.slice(targetIndex + 1);
    setPlayQueue(appQueue);
    queueRef.current = appQueue;
    setCurrentIndex(targetIndex);
    indexRef.current = targetIndex;

    // ★ 修正: RNTPで「音楽を止めずに裏でキューだけを再構築」する処理
    if (audioEngine === 'rntp') {
      try {
        const queue = await TrackPlayer.getQueue();
        const activeIndex = await TrackPlayer.getActiveTrackIndex();
        
        if (activeIndex !== undefined && activeIndex !== null) {
          // 現在再生中の曲「以外」をすべてネイティブから削除する
          const indicesToRemove = queue.map((_, i) => i).filter(i => i !== activeIndex);
          if (indicesToRemove.length > 0) {
            await TrackPlayer.remove(indicesToRemove);
          }
          
          // 残った現在の曲は自動的にインデックス 0 になる。その前後に新しいリストを挿入する
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
        expoAudioPlayerRef.current.isLooping = (nextLoop === 'ONE');
      }
    }
  };

  const handleNextInternal = async () => {
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
        expoAudioPlayerRef.current?.seekTo(0);
        setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: 0 }));
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
      if (isPlaying) player.pause();
      else player.play();
      setIsPlaying(!isPlaying);
    }
  };

  const setPositionAsync = async (v: number) => {
    if (audioEngine === 'rntp') {
      await TrackPlayer.seekTo(v / 1000);
    } else {
      expoAudioPlayerRef.current?.seekTo(v / 1000);
      setPlaybackStatusExpo((prev: any) => ({ ...prev, positionMillis: v }));
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