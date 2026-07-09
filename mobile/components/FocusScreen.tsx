import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Alert, LayoutAnimation, Platform, UIManager, Animated, useWindowDimensions, PanResponder, Linking, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FocusSetupView } from './focus/FocusSetupView';
import { FocusTimerView } from './focus/FocusTimerView';

const STORAGE_KEY = 'chordia_focus_settings';
const HISTORY_KEY = 'chordia_focus_history';
const TEMP_WORK_KEY = 'chordia_temp_work_seconds';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FocusScreen = ({ dynamicStyles, insets, themeColor, localLibrary, localPlaylists, currentSong, startQueue, stage, setStage, audioEngine, changeAudioEngine, themeR, themeG, themeB }: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [dateMode, setDateMode] = useState('年月日');
  const [dayMode, setDayMode] = useState('(日)');
  const [clockMode, setClockMode] = useState('22:19');
  const [showQuote, setShowQuote] = useState(true);
  
  const [pomoEnabled, setPomoEnabled] = useState(false);
  const [workTime, setWorkTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  
  const [customTimerType, setCustomTimerType] = useState<'WORK' | 'BREAK' | null>(null);
  const [customH, setCustomH] = useState(0);
  const [customM, setCustomM] = useState(0);
  const [customS, setCustomS] = useState(0);
  
  const [mainPlaylist, setMainPlaylist] = useState<any>(null);
  const [mainShuffle, setMainShuffle] = useState(true);
  const [workPlaylist, setWorkPlaylist] = useState<any>(null);
  const [workShuffle, setWorkShuffle] = useState(true);
  const [breakPlaylist, setBreakPlaylist] = useState<any>(null);
  const [breakShuffle, setBreakShuffle] = useState(true);

  const [now, setNow] = useState(new Date());
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);
  const [pomoState, setPomoState] = useState<'WORK' | 'BREAK'>('WORK');
  const [pomoRemaining, setPomoRemaining] = useState(Math.floor(workTime * 60));
  const [pausedSeconds, setPausedSeconds] = useState(0);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [expanded, setExpanded] = useState({ PLAYLIST: true, ALBUM: false, ARTIST: false });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<'MAIN' | 'WORK' | 'BREAK'>('MAIN');

  const sessionStartTimeRef = useRef<number | null>(null);
  const phaseStartTimeRef = useRef<number | null>(null);
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef<number>(0);
  const totalPhasePausedMsRef = useRef<number>(0);

  const isTransitioningRef = useRef(false);
  const fadeTriggeredRef = useRef(false);

  const pomoStateRef = useRef(pomoState);
  const isPausedRef = useRef(isPaused);
  const showHelpRef = useRef(showHelp);
  const pomoEnabledRef = useRef(pomoEnabled);
  const workTimeRef = useRef(workTime);
  const breakTimeRef = useRef(breakTime);
  const totalWorkSecondsRef = useRef(0);
  
  const playlistRefs = useRef<any>({});
  const workProgressRef = useRef({ index: 0, position: 0 });
  const breakProgressRef = useRef({ index: 0, position: 0 });
  const introToastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { pomoStateRef.current = pomoState; }, [pomoState]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { showHelpRef.current = showHelp; }, [showHelp]);
  useEffect(() => { pomoEnabledRef.current = pomoEnabled; }, [pomoEnabled]);
  useEffect(() => { workTimeRef.current = workTime; }, [workTime]);
  useEffect(() => { breakTimeRef.current = breakTime; }, [breakTime]);
  useEffect(() => { totalWorkSecondsRef.current = totalWorkSeconds; }, [totalWorkSeconds]);
  
  useEffect(() => {
      playlistRefs.current = { mainPlaylist, workPlaylist, breakPlaylist, mainShuffle, workShuffle, breakShuffle };
  }, [mainPlaylist, workPlaylist, breakPlaylist, mainShuffle, workShuffle, breakShuffle]);

  useEffect(() => { 
      if (stage !== 'FOCUS') setPomoRemaining(Math.floor(workTime * 60)); 
  }, [workTime, stage]);

  const iconBgColor = `rgba(${themeR || 79}, ${themeG || 70}, ${themeB || 229}, 0.15)`;

  const saveSessionToHistory = async (seconds: number) => {
    if (seconds <= 0) return;
    try {
      const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
      let history = historyJson ? JSON.parse(historyJson) : [];
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        duration: seconds
      };
      history = [newEntry, ...history].slice(0, 100);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      await AsyncStorage.removeItem(TEMP_WORK_KEY);
    } catch (e) {
      console.error("Failed to save focus history", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const temp = await AsyncStorage.getItem(TEMP_WORK_KEY);
        if (temp) {
          const secs = parseInt(temp, 10);
          if (secs > 5) await saveSessionToHistory(secs);
        }

        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue != null) {
          const s = JSON.parse(jsonValue);
          if (s.dateMode) setDateMode(s.dateMode);
          if (s.dayMode) setDayMode(s.dayMode);
          if (s.clockMode) setClockMode(s.clockMode);
          if (s.showQuote !== undefined) setShowQuote(s.showQuote);
          if (s.pomoEnabled !== undefined) setPomoEnabled(s.pomoEnabled);
          if (s.workTime) setWorkTime(s.workTime);
          if (s.breakTime) setBreakTime(s.breakTime);
          if (s.mainPlaylist) setMainPlaylist(s.mainPlaylist);
          if (s.mainShuffle !== undefined) setMainShuffle(s.mainShuffle);
          if (s.workPlaylist) setWorkPlaylist(s.workPlaylist);
          if (s.workShuffle !== undefined) setWorkShuffle(s.workShuffle);
          if (s.breakPlaylist) setBreakPlaylist(s.breakPlaylist);
          if (s.breakShuffle !== undefined) setBreakShuffle(s.breakShuffle);
        }
      } catch (e) {}
    };
    init();
  }, []);

  useEffect(() => {
    const saveSettings = async () => {
      try {
        const settings = { dateMode, dayMode, clockMode, showQuote, pomoEnabled, workTime, breakTime, mainPlaylist, mainShuffle, workPlaylist, workShuffle, breakPlaylist, breakShuffle };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {}
    };
    saveSettings();
  }, [dateMode, dayMode, clockMode, showQuote, pomoEnabled, workTime, breakTime, mainPlaylist, mainShuffle, workPlaylist, workShuffle, breakPlaylist, breakShuffle]);

  const togglePause = useCallback(async (forcePause = false) => {
    const nextState = forcePause ? true : !isPausedRef.current;
    setIsPaused(nextState);
    const nowMs = Date.now();
    
    if (nextState) { 
        pauseStartTimeRef.current = nowMs;
        await TrackPlayer.pause(); 
    } else { 
        if (pauseStartTimeRef.current) {
            const pausedDuration = nowMs - pauseStartTimeRef.current;
            totalPausedMsRef.current += pausedDuration;
            totalPhasePausedMsRef.current += pausedDuration;
        }
        pauseStartTimeRef.current = null;
        setPausedSeconds(0);
        await TrackPlayer.play(); 
    }
  }, []);

  const exitFocusMode = useCallback(async () => {
    await TrackPlayer.pause();
    await saveSessionToHistory(totalWorkSecondsRef.current);
    setStage('SETUP');
  }, [setStage]);

  const toggleSection = useCallback((section: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [section]: !prev[section as keyof typeof expanded] }));
  }, []);

  const onSelectCollection = useCallback((item: any) => {
    if (pickingTarget === 'MAIN') setMainPlaylist(item);
    else if (pickingTarget === 'WORK') setWorkPlaylist(item);
    else if (pickingTarget === 'BREAK') setBreakPlaylist(item);
    setPickerVisible(false);
  }, [pickingTarget]);

  const switchPhaseMusic = async (phase: 'WORK' | 'BREAK') => {
    const target = phase === 'WORK' ? (pomoEnabledRef.current ? playlistRefs.current.workPlaylist : playlistRefs.current.mainPlaylist) : playlistRefs.current.breakPlaylist;
    const shuffle = phase === 'WORK' ? (pomoEnabledRef.current ? playlistRefs.current.workShuffle : playlistRefs.current.mainShuffle) : playlistRefs.current.breakShuffle;
    if (target) {
      const songs = target.type === 'PLAYLIST' 
        ? (target.data.isAll ? localLibrary : localLibrary.filter((s:any) => target.data.music?.includes(s.musicFilename.split(/[\\/]/).pop())))
        : target.songs;
      await startQueue(songs, null, shuffle);
    }
  };

  const playAlarmSound = async () => {
    try {
      Vibration.vibrate([0, 500, 200, 500]);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { sound: alarm } = await Audio.Sound.createAsync(
        { uri: 'https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav' },
        { shouldPlay: true, volume: 1.0 }
      );
      await new Promise(r => setTimeout(r, 1200));
      await alarm.unloadAsync();
    } catch (e) { await new Promise(r => setTimeout(r, 1200)); }
  };

  const handlePhaseTransition = async () => {
    isTransitioningRef.current = true;
    try {
      const pos = await TrackPlayer.getPosition();
      const idx = await TrackPlayer.getActiveTrackIndex();
      
      if (pomoStateRef.current === 'WORK') workProgressRef.current = { index: idx || 0, position: pos };
      else breakProgressRef.current = { index: idx || 0, position: pos };
      
      await TrackPlayer.pause();
      await playAlarmSound();
      
      const nextState = pomoStateRef.current === 'WORK' ? 'BREAK' : 'WORK';
      setPomoState(nextState);
      
      const nextSeconds = Math.floor((nextState === 'WORK' ? workTimeRef.current : breakTimeRef.current) * 60);
      setPomoRemaining(nextSeconds);
      phaseStartTimeRef.current = Date.now();
      totalPhasePausedMsRef.current = 0; 
      fadeTriggeredRef.current = false;
      
      await TrackPlayer.setVolume(0);
      await switchPhaseMusic(nextState);
      const nextProgress = nextState === 'WORK' ? workProgressRef.current : breakProgressRef.current;
      
      setTimeout(async () => {
        try {
          await TrackPlayer.seekTo(nextProgress.position);
          await TrackPlayer.setRepeatMode(RepeatMode.Queue);
          if (!isPausedRef.current) {
            await TrackPlayer.play();
            for(let i=1; i<=10; i++) { await TrackPlayer.setVolume(i/10); await new Promise(r => setTimeout(r, 200)); }
          } else { 
            await TrackPlayer.setVolume(1.0); 
          }
        } catch(e){}
        isTransitioningRef.current = false;
      }, 1000);
    } catch(e) { isTransitioningRef.current = false; }
  };

  const handlePhaseTransitionRef = useRef(handlePhaseTransition);
  useEffect(() => { handlePhaseTransitionRef.current = handlePhaseTransition; }, [handlePhaseTransition]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let autoSaveTimer: ReturnType<typeof setInterval>;

    if (stage === 'FOCUS') {
      Animated.timing(introToastAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        setTimeout(() => Animated.timing(introToastAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(), 3000);
      });

      autoSaveTimer = setInterval(async () => {
        if (!isPausedRef.current && !isTransitioningRef.current) {
          await AsyncStorage.setItem(TEMP_WORK_KEY, totalWorkSecondsRef.current.toString());
        }
      }, 5000);

      timer = setInterval(() => {
        const currentTime = Date.now();
        setNow(new Date(currentTime));
        
        if (isPausedRef.current && pauseStartTimeRef.current) {
          const pausedDiff = Math.floor((currentTime - pauseStartTimeRef.current) / 1000);
          setPausedSeconds(pausedDiff);
          return;
        }

        if (isTransitioningRef.current || showHelpRef.current) return;

        if (sessionStartTimeRef.current) {
            let activeMs = currentTime - sessionStartTimeRef.current - totalPausedMsRef.current;
            if (pomoEnabledRef.current && pomoStateRef.current === 'BREAK') {
            } else {
               setTotalWorkSeconds(Math.floor(activeMs / 1000));
            }
        }

        if (pomoEnabledRef.current && phaseStartTimeRef.current) {
            const phaseTotalMs = Math.floor((pomoStateRef.current === 'WORK' ? workTimeRef.current : breakTimeRef.current) * 60 * 1000);
            const elapsedMs = currentTime - phaseStartTimeRef.current - totalPhasePausedMsRef.current;
            const remainingSec = Math.ceil((phaseTotalMs - elapsedMs) / 1000);

            if (remainingSec === 6 && !fadeTriggeredRef.current) {
                fadeTriggeredRef.current = true;
                (async () => {
                    try {
                        for(let i=10; i>=0; i--) { await TrackPlayer.setVolume(i/10); await new Promise(r => setTimeout(r, 450)); }
                    } catch(e){}
                })();
            }

            if (remainingSec <= 0 && !isTransitioningRef.current) {
                isTransitioningRef.current = true;
                setPomoRemaining(0); 
                handlePhaseTransitionRef.current(); 
            } else if (remainingSec > 0) {
                setPomoRemaining(remainingSec);
            }
        }
      }, 1000);
    }
    return () => {
      clearInterval(timer);
      clearInterval(autoSaveTimer);
    };
  }, [stage]);

  const panResponder = useRef(PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 30 || Math.abs(g.dy) > 30,
      onPanResponderRelease: (evt, g) => { if (!showHelpRef.current && (Math.abs(g.dx) > 50 || Math.abs(g.dy) > 50)) exitFocusMode(); },
  })).current;

  const startFocusSession = async () => {
    if (audioEngine !== 'rntp') { changeAudioEngine('rntp'); await new Promise(r => setTimeout(r, 500)); }
    await TrackPlayer.setVolume(1.0);
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);
    
    sessionStartTimeRef.current = Date.now();
    phaseStartTimeRef.current = Date.now();
    totalPausedMsRef.current = 0;
    totalPhasePausedMsRef.current = 0;
    pauseStartTimeRef.current = null;
    fadeTriggeredRef.current = false;
    isTransitioningRef.current = false;

    setTotalWorkSeconds(0);
    setPausedSeconds(0);
    setPomoState('WORK');
    setPomoRemaining(Math.floor(workTime * 60));
    setIsPaused(false);
    setShowHelp(false);
    setStage('FOCUS');
    
    await switchPhaseMusic('WORK'); 
  };

  const musicCollections = useMemo(() => {
    const albumsMap = new Map();
    const artistsMap = new Map();
    localLibrary.forEach((s: any) => {
      const ak = `${s.album}:::${s.artist}`;
      if (!albumsMap.has(ak)) albumsMap.set(ak, { id: ak, type: 'ALBUM', title: s.album, sub: s.artist, art: s.localImageUri, songs: [] });
      albumsMap.get(ak).songs.push(s);
      if (!artistsMap.has(s.artist)) artistsMap.set(s.artist, { id: s.artist, type: 'ARTIST', title: s.artist, sub: 'アーティスト', art: s.localImageUri, songs: [] });
      artistsMap.get(s.artist).songs.push(s);
    });
    const playlists = localPlaylists.map((p: any) => ({ id: p.id, type: 'PLAYLIST', title: p.playlistName, sub: 'プレイリスト', art: null, data: p }));
    const res: any[] = [];
    res.push({ isHeader: true, section: 'PLAYLIST', title: 'プレイリスト' });
    if (expanded.PLAYLIST) res.push(...playlists);
    res.push({ isHeader: true, section: 'ALBUM', title: 'アルバム' });
    if (expanded.ALBUM) res.push(...Array.from(albumsMap.values()));
    res.push({ isHeader: true, section: 'ARTIST', title: 'アーティスト' });
    if (expanded.ARTIST) res.push(...Array.from(artistsMap.values()));
    return res;
  }, [localLibrary, localPlaylists, expanded]);

  const isReady = pomoEnabled ? (workPlaylist && breakPlaylist) : mainPlaylist;

  if (stage === 'FOCUS') {
    return (
        <View style={{ flex: 1 }}>
          <FocusTimerView 
              isLandscape={isLandscape} insets={insets} themeColor={themeColor} isAppDark={dynamicStyles.bg === '#000000'}
              dateStr={dateMode==='表示しない'?"": (dateMode==='年月日'?`${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`: dateMode==='月日'?`${now.getMonth()+1}月${now.getDate()}日`:`${now.getDate()}日`)}
              dayStr={dayMode==='表示しない'?"": dayMode==='(日)'?`(${['日','月','火','水','木','金','土'][now.getDay()]})`: dayMode==='日曜'?['日','月','火','水','木','金','土'][now.getDay()]+'曜':['日','月','火','水','木','金','土'][now.getDay()]+'曜日'}
              clockStr={clockMode==='表示しない'?"": clockMode==='22:19'?`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`:`${now.getHours()%12||12}:${String(now.getMinutes()).padStart(2,'0')}`}
              dayMode={dayMode} totalWorkSeconds={totalWorkSeconds} pomoEnabled={pomoEnabled} pomoState={pomoState} pomoRemaining={pomoRemaining}
              currentSong={currentSong} isPaused={isPaused} showHelp={showHelp} pausedSeconds={pausedSeconds}
              formatTime={(s:number)=>{const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sc=Math.floor(s%60); return h>0? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`}}
              handleTouchPress={() => { if (!showHelpRef.current) togglePause(); }} handleLongPress={() => { if (!showHelpRef.current) { togglePause(true); setShowHelp(true); } }}
              panHandlers={panResponder.panHandlers} introToastAnim={introToastAnim}
              showQuote={showQuote}
          />
          <Modal visible={showHelp} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: isLandscape ? 15 : 30 }}>
                  <View style={{ backgroundColor: dynamicStyles.card, padding: isLandscape ? 20 : 30, borderRadius: 25, width: '100%', maxWidth: isLandscape ? 600 : 400, maxHeight: '90%', borderWidth: 1, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: isLandscape ? 15 : 20 }}><Ionicons name="information-circle" size={28} color={themeColor} /><Text style={{ color: dynamicStyles.text, fontSize: 20, fontWeight: 'bold' }}>操作ヘルプ</Text></View>
                          <Text style={{ color: dynamicStyles.subText, marginBottom: isLandscape ? 15 : 25, lineHeight: 22 }}>この画面では、通常のタップ操作は制限されています。{"\n"}(現在、一時停止中です)</Text>
                          <View style={{ gap: isLandscape ? 12 : 20, marginBottom: 30 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBgColor, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="pause" size={22} color={themeColor} /></View><View style={{ flex: 1 }}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>一時停止 / 再開</Text><Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>画面を「タップ」</Text></View></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBgColor, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="menu" size={22} color={themeColor} /></View><View style={{ flex: 1 }}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>ヘルプ表示</Text><Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>画面を「長押し」</Text></View></View><View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}><Ionicons name="exit-outline" size={22} color="#ef4444" /></View><View style={{ flex: 1 }}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>集中を終了する</Text><Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>画面を大きくスワイプ</Text></View></View></View>
                          <TouchableOpacity style={{ backgroundColor: themeColor, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }} onPress={() => { setShowHelp(false); togglePause(false); }}><Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>理解して再開する</Text></TouchableOpacity>
                          <TouchableOpacity style={{ marginTop: 20, paddingBottom: 10, alignItems: 'center' }} onPress={exitFocusMode}><Text style={{ color: '#ef4444', fontWeight: 'bold' }}>今すぐ終了する</Text></TouchableOpacity>
                      </ScrollView>
                  </View>
              </View>
          </Modal>
        </View>
    );
  }

  if (stage === 'GUIDE') {
    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: dynamicStyles.bg, justifyContent: 'center', alignItems: 'center', padding: 30, paddingBottom: 200 }}>
            <Ionicons name="sparkles" size={60} color={themeColor} /><Text style={{ color: dynamicStyles.text, fontSize: 26, fontWeight: '900', marginTop: 20 }}>準備完了！</Text>
            <View style={[s.guideCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 30 }]}>
                <View style={s.guideStep}><Ionicons name="shield-checkmark" size={24} color={themeColor} /><Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>アクセスガイドを有効にしましたか？</Text></View>
                <View style={{ paddingLeft: 39, marginBottom: 15 }}><Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 20 }}>・通知が一切表示されなくなります{"\n"}・他のアプリを容易に開けなくなります</Text><TouchableOpacity style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={() => Linking.openURL('https://support.apple.com/ja-jp/111795')}><Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }}>アクセスガイドの使い方はこちら</Text><Ionicons name="open-outline" size={12} color={themeColor} /></TouchableOpacity></View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} /><View style={s.guideStep}><Ionicons name="headset" size={24} color={themeColor} /><Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>イヤホンを使用していますか？</Text></View>
                <View style={{ paddingLeft: 39, marginBottom: 15 }}><Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>音楽の世界に没入し、目の前の作業に集中しましょう。</Text></View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} /><View style={s.guideStep}><Ionicons name="volume-mute" size={24} color={themeColor} /><Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>ノイズキャンセリングは有効ですか？</Text></View><View style={{ paddingLeft: 39, marginBottom: 15 }}><Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>周囲の雑音を遮断することで、圧倒的に集中力が高まります。</Text></View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} /><View style={s.guideStep}><Ionicons name="warning" size={20} color="#f59e0b" /><Text style={{ color: '#f59e0b', fontSize: 12, flex: 1, fontWeight: 'bold' }}>※作業中は他のアプリからの通知音等を防ぐため、強制的に標準プレイヤーが使用されます。</Text></View>
            </View>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: themeColor, marginTop: 40, width: '100%' }]} onPress={startFocusSession}><Text style={s.primaryBtnText}>集中を楽しむ！</Text></TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 25 }} onPress={() => setStage('SETUP')}><Text style={{ color: dynamicStyles.subText, fontWeight: 'bold' }}>設定をやり直す</Text></TouchableOpacity>
        </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[s.header, { paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0), backgroundColor: dynamicStyles.bg }]}>
        <TouchableOpacity 
          style={{ position: 'absolute', left: 16, bottom: 0, height: 44, justifyContent: 'center', opacity: isReady ? 1 : 0.5, zIndex: 10 }}
          onPress={() => isReady ? setStage('GUIDE') : Alert.alert("リスト未選択", "再生リストを選択してください。")}
        >
          {/* ★ 変更: 「完了」から「設定完了」に変更 */}
          <Text style={{ color: themeColor, fontSize: 16, fontWeight: 'bold' }}>設定完了</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: dynamicStyles.text }]}>作業設定</Text>
      </View>
      
      <FocusSetupView 
        {...{ 
          dynamicStyles, themeColor, dateMode, setDateMode, dayMode, setDayMode, clockMode, setClockMode, showQuote, setShowQuote, pomoEnabled, setPomoEnabled, workTime, setWorkTime, breakTime, setBreakTime, mainPlaylist, setMainPlaylist, mainShuffle, setMainShuffle, workPlaylist, setWorkPlaylist, workShuffle, setWorkShuffle, breakPlaylist, setBreakPlaylist, breakShuffle, setBreakShuffle, musicCollections, expanded, toggleSection, onSelectCollection, pickerVisible, setPickerVisible, setPickingTarget, isReady, 
          openCustomTimerModal: (type: 'WORK' | 'BREAK') => {
              setCustomTimerType(type);
              const currentSecs = Math.floor((type === 'WORK' ? workTime : breakTime) * 60);
              setCustomH(Math.floor(currentSecs / 3600));
              setCustomM(Math.floor((currentSecs % 3600) / 60));
              setCustomS(currentSecs % 60);
          }
        }} 
      />

      <Modal visible={customTimerType !== null} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <View style={{ backgroundColor: dynamicStyles.card, padding: 25, borderRadius: 25, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
                      カスタム{customTimerType === 'WORK' ? '作業' : '休憩'}時間
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customH)} onChangeText={(t) => setCustomH(Number(t.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>時間</Text>
                      </View>
                      <Text style={{ fontSize: 24, color: dynamicStyles.text, fontWeight: 'bold', marginBottom: 25 }}>:</Text>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customM)} onChangeText={(t) => setCustomM(Number(t.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>分</Text>
                      </View>
                      <Text style={{ fontSize: 24, color: dynamicStyles.text, fontWeight: 'bold', marginBottom: 25 }}>:</Text>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customS)} onChangeText={(t) => setCustomS(Number(t.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>秒</Text>
                      </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 15 }}>
                      <TouchableOpacity 
                          style={{ flex: 1, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#e5e7eb' }} 
                          onPress={() => setCustomTimerType(null)}
                      >
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>キャンセル</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={{ flex: 1, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColor }} 
                          onPress={() => {
                              const totalSecs = (customH * 3600) + (customM * 60) + customS;
                              if (totalSecs <= 0) {
                                  Alert.alert("エラー", "1秒以上の時間を設定してください");
                                  return;
                              }
                              if (customTimerType === 'WORK') setWorkTime(totalSecs / 60);
                              else setBreakTime(totalSecs / 60);
                              setCustomTimerType(null);
                          }}
                      >
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>決定</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

    </View>
  );
};

const s = StyleSheet.create({
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  primaryBtn: { height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  guideCard: { width: '100%', borderRadius: 24, padding: 25, marginTop: 20, borderWidth: 1 },
  guideStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideText: { fontSize: 14, flex: 1 },
});