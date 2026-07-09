import { useState, useRef, useEffect } from 'react';
import { Animated, Dimensions, Alert } from 'react-native';
import TrackPlayer, { State as RNTPState, usePlaybackState, useProgress, RepeatMode, Capability, Event } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ★ 移行: expo-av を完全に排除し、最新の expo-audio をインポート
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const { height } = Dimensions.get('window');

let isRNTPInitialized = false;

export const useAudioPlayer = () => {
  // エンジンの状態 (互換性維持のため、状態名 'expo-av' を引き継ぎつつ内部は expo-audio で駆動)
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
  const currentSongRef = useRef<any>(null);
  const queueRef = useRef<any[]>([]);
  const indexRef = useRef<number>(0);
  const loopRef = useRef<any>('OFF');
  const shuffleRef = useRef<boolean>(false);
  
  // ★ 変更1: Expo-Audio用のRefと再生ステータスの互換定義
  const expoAudioPlayerRef = useRef<any>(null);
  const [playbackStatusExpo, setPlaybackStatusExpo] = useState<any>({
    positionMillis: 0,
    durationMillis: 0,
  });

  useEffect(() => { currentSongRef.current = currentSong; },[currentSong]);
  useEffect(() => { queueRef.current = playQueue; }, [playQueue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { loopRef.current = loopMode; }, [loopMode]);
  useEffect(() => { shuffleRef.current = isShuffle; }, [isShuffle]);

  // AsyncStorageからエンジン設定をロード
  useEffect(() => {
    AsyncStorage.getItem('audioEngine').then(val => {
      if (val === 'expo-av' || val === 'rntp') setAudioEngine(val);
    });
  },[]);

  // エンジンの切り替え関数
  const changeAudioEngine = async (engine: 'expo-av'|'rntp') => {
    if (engine === audioEngine) return;
    setIsPlaying(false);
    
    // 現在の再生を強制停止
    if (audioEngine === 'rntp') {
      try { await TrackPlayer.stop(); await TrackPlayer.reset(); } catch(e){}
    } else if (expoAudioPlayerRef.current) {
      try { expoAudioPlayerRef.current.pause(); } catch(e){}
    }
    
    setAudioEngine(engine);
    await AsyncStorage.setItem('audioEngine', engine);
    setPlayQueue([]);
    setCurrentSong(null);
    Alert.alert("設定変更", "再生エンジンを切り替えました。");
  };

  // ★ 変更2: 【初期化】Expo-Audio (最新の文字列引数設定で、他アプリとの干渉を回避)
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

  // 【初期化】RNTP (ロック画面コントロール用)
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

  // ---------------------------------------------------------
  // 状態の統合
  // ---------------------------------------------------------
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

  const rebuildQueue = (current: any, shuffle: boolean, loop: any, original: any[]) => {
    if (loop === 'ONE' || !current) return[]; 
    if (shuffle) {
      const others = original.filter(s => s.localMusicUri !== current.localMusicUri);
      return others.sort(() => Math.random() - 0.5);
    } else {
      const idx = original.findIndex(s => s.localMusicUri === current.localMusicUri);
      if (idx !== -1) return original.slice(idx + 1);
      return[];
    }
  };

  const saveHistory = async (song: any) => {
    try {
      const rs = await AsyncStorage.getItem('recently_played_songs');
      let list = rs ? JSON.parse(rs) : [];
      list =[song, ...list.filter((s: any) => s.localMusicUri !== song.localMusicUri)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_songs', JSON.stringify(list));
    } catch(e){}
  };

  // ★ 変更3: Expo-Audio のプレイヤー生成＆再生ライフサイクル監視
  const initExpoAudioPlayer = (uri: string, isLoopOne: boolean) => {
    if (expoAudioPlayerRef.current) {
      expoAudioPlayerRef.current.replace({ uri });
      expoAudioPlayerRef.current.isLooping = isLoopOne;
      expoAudioPlayerRef.current.play();
      return;
    }

    const player = createAudioPlayer({ uri });
    player.isLooping = isLoopOne;

    // 現在位置の監視 (秒からミリ秒へ互換変換)
    player.addListener('timeUpdate', (event: any) => {
      setPlaybackStatusExpo({
        positionMillis: event.currentTime * 1000,
        durationMillis: player.duration * 1000,
      });
    });

    // 再生状態の監視
    player.addListener('playbackStateChange', (event: any) => {
      const isPlay = event.newState === 'playing';
      setIsPlaying(isPlay);

      // 曲が終了したときの自動次曲スキップ
      if (event.newState === 'finished') {
        if (!player.isLooping) {
          handleNextInternal();
        }
      }
    });

    player.play();
    expoAudioPlayerRef.current = player;
  };

  const loadAndPlayInternal = async (song: any, queue: any[] =[], startIndex: number = 0) => {
    try {
      if (audioEngine === 'rntp') {
        await TrackPlayer.reset();
        const tracks = queue.map(s => ({
          id: s.localMusicUri, url: s.localMusicUri, title: s.title || 'Unknown', artist: s.artist || 'Unknown',
          artwork: s.localImageUri || require('../assets/images/icon.png'), originalData: s
        }));
        await TrackPlayer.add(tracks);
        await TrackPlayer.skip(startIndex);
        await TrackPlayer.play();
        
        setCurrentSong(queue[startIndex]);
        const appQueue = queue.slice(startIndex + 1);
        setPlayQueue(appQueue);
        queueRef.current = appQueue;
        setCurrentIndex(startIndex);
        saveHistory(queue[startIndex]);

      } else {
        // ★ 変更4: Expo-Audio による再生開始
        const isLoopOne = loopRef.current === 'ONE';
        initExpoAudioPlayer(song.localMusicUri, isLoopOne);
        setCurrentSong(song);
        saveHistory(song);
      }
    } catch (e) {
      Alert.alert("エラー", "再生に失敗しました");
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

    let finalQueue = [...songs];
    let targetIndex = 0;
    if (newShuffle) {
      const newQ = rebuildQueue(firstSong, newShuffle, loopRef.current, songs);
      finalQueue = [firstSong, ...newQ];
      targetIndex = 0;
    } else {
      targetIndex = finalQueue.findIndex(s => s.localMusicUri === firstSong.localMusicUri);
      if (targetIndex === -1) targetIndex = 0;
    }

    if (audioEngine === 'expo-av') {
      const newQueue = rebuildQueue(firstSong, newShuffle, loopRef.current, songs);
      setPlayQueue(newQueue);
      queueRef.current = newQueue;
      loadAndPlayInternal(firstSong);
    } else {
      loadAndPlayInternal(finalQueue, finalQueue, targetIndex);
    }
  };

  const toggleShuffleMode = () => {
    const nextShuffle = !isShuffle;
    setIsShuffle(nextShuffle);
    shuffleRef.current = nextShuffle;
    
    if (!currentSongRef.current) return;
    const remaining = originalQueueRef.current.filter(s => s.localMusicUri !== currentSongRef.current.localMusicUri);
    let newQueue =[];

    if (nextShuffle) {
        const shuffled = remaining.sort(() => Math.random() - 0.5);
        newQueue = [currentSongRef.current, ...shuffled];
    } else {
        newQueue = [...originalQueueRef.current];
    }

    if (audioEngine === 'rntp') {
      const idx = nextShuffle ? 0 : newQueue.findIndex(s => s.localMusicUri === currentSongRef.current.localMusicUri);
      loadAndPlayInternal(newQueue, newQueue, idx !== -1 ? idx : 0);
    } else {
      const expoQueue = rebuildQueue(currentSongRef.current, nextShuffle, loopRef.current, originalQueueRef.current);
      setPlayQueue(expoQueue);
      queueRef.current = expoQueue;
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
      // ★ 変更5: Expo-Audio のループ制御
      if (expoAudioPlayerRef.current) {
        expoAudioPlayerRef.current.isLooping = (nextLoop === 'ONE');
      }
    }
    
    if (currentSongRef.current) {
        const newQueue = rebuildQueue(currentSongRef.current, shuffleRef.current, nextLoop, originalQueueRef.current);
        setPlayQueue(newQueue);
        queueRef.current = newQueue;
    }
  };

  const handleNextInternal = async () => {
    if (audioEngine === 'rntp') {
      await TrackPlayer.skipToNext();
    } else {
      const queue = queueRef.current;
      const mode = loopRef.current;
      const original = originalQueueRef.current;

      if (mode === 'ONE' && currentSongRef.current) {
        loadAndPlayInternal(currentSongRef.current);
        return;
      }
      if (queue.length > 0) {
        const nextSong = queue[0];
        const remainingQueue = queue.slice(1);
        setPlayQueue(remainingQueue);
        queueRef.current = remainingQueue;
        loadAndPlayInternal(nextSong);
      } else {
        if (mode === 'ALL' && original.length > 0) {
          let firstSong;
          let newQueue;
          if (shuffleRef.current) {
              const shuffled = [...original].sort(() => Math.random() - 0.5);
              firstSong = shuffled[0];
              newQueue = shuffled.slice(1);
          } else {
              firstSong = original[0];
              newQueue = original.slice(1);
          }
          setPlayQueue(newQueue);
          queueRef.current = newQueue;
          loadAndPlayInternal(firstSong);
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
      const current = currentSongRef.current;
      const original = originalQueueRef.current;
      if (!current || original.length === 0) return;

      const currentPos = playbackStatusExpo?.positionMillis || 0;
      if (currentPos > 3000) {
        // ★ 変更6: Expo-Audio のミリ秒→秒互換シーク
        expoAudioPlayerRef.current?.seekTo(0);
        return;
      }

      const idx = original.findIndex(s => s.localMusicUri === current.localMusicUri);
      let prevSong = original[0];
      if (idx > 0) prevSong = original[idx - 1];
      else if (loopRef.current === 'ALL') prevSong = original[original.length - 1];
      
      const newQueue = rebuildQueue(prevSong, shuffleRef.current, loopRef.current, original);
      setPlayQueue(newQueue);
      queueRef.current = newQueue;
      loadAndPlayInternal(prevSong);
    }
  };

  const togglePlayPause = async () => {
    if (audioEngine === 'rntp') {
      const state = await TrackPlayer.getState();
      if (state === RNTPState.Playing) await TrackPlayer.pause();
      else await TrackPlayer.play();
    } else {
      // ★ 変更7: Expo-Audio の再生・一時停止切り替え
      const player = expoAudioPlayerRef.current;
      if (!player) return;
      if (isPlaying) player.pause();
      else player.play();
    }
  };

  const setPositionAsync = async (v: number) => {
    if (audioEngine === 'rntp') {
      await TrackPlayer.seekTo(v / 1000);
    } else {
      // ★ 変更8: Expo-Audio の秒シーク互換
      expoAudioPlayerRef.current?.seekTo(v / 1000);
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
            setCurrentSong(event.track.originalData);
            currentSongRef.current = event.track.originalData;
            
            const mode = loopRef.current;
            const original = originalQueueRef.current;
            if (mode !== 'ONE') {
               const newQueue = rebuildQueue(event.track.originalData, shuffleRef.current, mode, original);
               setPlayQueue(newQueue);
               queueRef.current = newQueue;
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