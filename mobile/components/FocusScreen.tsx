import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Alert, LayoutAnimation, Platform, UIManager, Animated, useWindowDimensions, PanResponder, Linking, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer, { RepeatMode } from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { FocusSetupView } from './focus/FocusSetupView';
import { FocusTimerView } from './focus/FocusTimerView';
import { getPlaylistSongs } from '../utils/playlistEvaluator';
import { t } from '../utils/i18n';

const STORAGE_KEY = 'chordia_focus_settings';
const HISTORY_KEY = 'chordia_focus_history';
const TEMP_WORK_KEY = 'chordia_temp_work_seconds';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FocusScreen = ({ 
  dynamicStyles, insets, themeColor, localLibrary = [], localPlaylists = [], 
  currentSong, startQueue, stage, setStage, audioEngine, changeAudioEngine, 
  themeR, themeG, themeB, language = 'ja' 
}: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [dateMode, setDateMode] = useState('年月日');
  const [dayMode, setDayMode] = useState('(日)');
  const [clockMode, setClockMode] = useState('22:19');
  const [showQuote, setShowQuote] = useState(true);
  
  const [pomoEnabled, setPomoEnabled] = useState(false);
  
  const [workTime, setWorkTime] = useState(25 * 60);
  const [breakTime, setBreakTime] = useState(5 * 60);
  
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
  const [pomoRemaining, setPomoRemaining] = useState(workTime);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  
  const [isPaused, setIsPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<'MAIN' | 'WORK' | 'BREAK'>('MAIN');

  const buttonTextColor = useMemo(() => {
    const r = themeR ?? 79;
    const g = themeG ?? 70;
    const b = themeB ?? 229;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 140 ? '#000000' : '#ffffff';
  }, [themeR, themeG, themeB]);

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
      if (stage !== 'FOCUS') setPomoRemaining(workTime); 
  }, [workTime, stage]);

  const iconBgColor = `rgba(${themeR || 79}, ${themeG || 70}, ${themeB || 229}, 0.15)`;

  const saveSessionToHistory = async (seconds: number) => {
    if (seconds <= 0) return;
    try {
      const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
      let history = historyJson ? JSON.parse(historyJson) : [];
      
      const startTime = sessionStartTimeRef.current || (Date.now() - seconds * 1000);
      const endTime = Date.now();
      const totalElapsedMs = endTime - startTime;

      const newEntries = [];

      if (totalElapsedMs <= 0) {
        newEntries.push({
          id: Date.now().toString(),
          date: new Date(endTime).toISOString(),
          duration: seconds
        });
      } else {
        let currentStartMs = startTime;
        while (currentStartMs < endTime) {
          const currentDateObj = new Date(currentStartMs);
          
          const endOfDay = new Date(currentDateObj);
          endOfDay.setHours(23, 59, 59, 999);
          
          let chunkEndMs = endOfDay.getTime();
          if (chunkEndMs > endTime) {
            chunkEndMs = endTime;
          }
          
          const chunkElapsedMs = chunkEndMs - currentStartMs;
          const ratio = chunkElapsedMs / totalElapsedMs;
          const chunkDurationSeconds = Math.round(seconds * ratio);
          
          if (chunkDurationSeconds > 0) {
            newEntries.push({
              id: Date.now().toString() + '_' + currentStartMs,
              date: new Date(chunkEndMs).toISOString(),
              duration: chunkDurationSeconds
            });
          }
          
          currentStartMs = chunkEndMs + 1;
        }
      }

      history = [...newEntries.reverse(), ...history].slice(0, 100);
      
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
          const sVal = JSON.parse(jsonValue);
          if (sVal.dateMode) setDateMode(sVal.dateMode);
          if (sVal.dayMode) setDayMode(sVal.dayMode);
          if (sVal.clockMode) setClockMode(sVal.clockMode);
          if (sVal.showQuote !== undefined) setShowQuote(sVal.showQuote);
          if (sVal.pomoEnabled !== undefined) setPomoEnabled(sVal.pomoEnabled);
          
          if (sVal.workTime !== undefined) {
            const wt = Number(sVal.workTime);
            setWorkTime(wt <= 120 ? wt * 60 : wt);
          }
          if (sVal.breakTime !== undefined) {
            const bt = Number(sVal.breakTime);
            setBreakTime(bt <= 60 ? bt * 60 : bt);
          }

          if (sVal.mainPlaylist) setMainPlaylist(sVal.mainPlaylist);
          if (sVal.mainShuffle !== undefined) setMainShuffle(sVal.mainShuffle);
          if (sVal.workPlaylist) setWorkPlaylist(sVal.workPlaylist);
          if (sVal.workShuffle !== undefined) setWorkShuffle(sVal.workShuffle);
          if (sVal.breakPlaylist) setBreakPlaylist(sVal.breakPlaylist);
          if (sVal.breakShuffle !== undefined) setBreakShuffle(sVal.breakShuffle);
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
        ? getPlaylistSongs(target.data, localLibrary)
        : target.songs;
      await startQueue(songs, null, shuffle);
    }
  };

  const playAlarmSound = async () => {
    try {
      Vibration.vibrate([0, 500, 200, 500]);
      await setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
      
      const alarmPlayer = createAudioPlayer('https://raw.githubusercontent.com/freeCodeCamp/cdn/master/build/testable-projects-fcc/audio/BeepSound.wav');
      alarmPlayer.play();
      
      await new Promise(r => setTimeout(r, 1200));
      alarmPlayer.pause();
    } catch (e) { 
      await new Promise(r => setTimeout(r, 1200)); 
    }
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
      
      const nextSeconds = nextState === 'WORK' ? workTimeRef.current : breakTimeRef.current;
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
            const phaseTotalMs = (pomoStateRef.current === 'WORK' ? workTimeRef.current : breakTimeRef.current) * 1000;
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
    setPomoRemaining(workTime);
    setIsPaused(false);
    setShowHelp(false);
    setStage('FOCUS');
    
    await switchPhaseMusic('WORK'); 
  };

  const isReady = pomoEnabled ? (workPlaylist && breakPlaylist) : mainPlaylist;

  if (stage === 'FOCUS') {
    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FocusTimerView 
              isLandscape={isLandscape} insets={insets} themeColor={themeColor} isAppDark={dynamicStyles.bg === '#000000'}
              now={now} dateMode={dateMode} dayMode={dayMode} clockMode={clockMode}
              totalWorkSeconds={totalWorkSeconds} pomoEnabled={pomoEnabled} pomoState={pomoState} pomoRemaining={pomoRemaining}
              currentSong={currentSong} isPaused={isPaused} showHelp={showHelp} pausedSeconds={pausedSeconds}
              formatTime={(sVal:number)=>{const h=Math.floor(sVal/3600); const m=Math.floor((sVal%3600)/60); const sc=Math.floor(sVal%60); return h>0? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`}}
              handleTouchPress={() => { if (!showHelpRef.current) togglePause(); }} handleLongPress={() => { if (!showHelpRef.current) { togglePause(true); setShowHelp(true); } }}
              panHandlers={panResponder.panHandlers} introToastAnim={introToastAnim}
              showQuote={showQuote}
              language={language}
          />
          <Modal visible={showHelp} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: isLandscape ? 15 : 30 }}>
                  <View style={{ backgroundColor: dynamicStyles.card, padding: isLandscape ? 20 : 30, borderRadius: 25, width: '100%', maxWidth: isLandscape ? 600 : 400, maxHeight: '90%', borderWidth: 1, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: isLandscape ? 15 : 20 }}>
                            <Ionicons name="information-circle" size={28} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 20, fontWeight: 'bold' }}>{t('focus_help_title', language)}</Text>
                          </View>
                          <Text style={{ color: dynamicStyles.subText, marginBottom: isLandscape ? 15 : 25, lineHeight: 22 }}>{t('focus_help_desc', language)}</Text>
                          <View style={{ gap: isLandscape ? 12 : 20, marginBottom: 30 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBgColor, justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="pause" size={22} color={themeColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('focus_help_pause_title', language)}</Text>
                                <Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>{t('focus_help_pause_desc', language)}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: iconBgColor, justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="menu" size={22} color={themeColor} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('focus_help_menu_title', language)}</Text>
                                <Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>{t('focus_help_menu_desc', language)}</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="exit-outline" size={22} color="#ef4444" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('focus_help_exit_title', language)}</Text>
                                <Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>{t('focus_help_exit_desc', language)}</Text>
                              </View>
                            </View>
                          </View>
                          
                          <TouchableOpacity style={{ backgroundColor: themeColor, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }} onPress={() => { setShowHelp(false); togglePause(false); }}>
                            <Text style={{ color: buttonTextColor, fontWeight: 'bold', fontSize: 16 }}>{t('focus_help_resume_btn', language)}</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity style={{ marginTop: 20, paddingBottom: 10, alignItems: 'center' }} onPress={exitFocusMode}>
                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>{t('focus_help_exit_now_btn', language)}</Text>
                          </TouchableOpacity>
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
            <Ionicons name="sparkles" size={60} color={themeColor} />
            <Text style={{ color: dynamicStyles.text, fontSize: 26, fontWeight: '900', marginTop: 20 }}>{t('guide_ready_title', language)}</Text>
            <View style={[s.guideCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 30 }]}>
                <View style={s.guideStep}>
                  <Ionicons name="shield-checkmark" size={24} color={themeColor} />
                  <Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>{t('guide_guided_access_title', language)}</Text>
                </View>
                <View style={{ paddingLeft: 39, marginBottom: 15 }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 20 }}>{t('guide_guided_access_desc', language)}</Text>
                  <TouchableOpacity style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }} onPress={() => Linking.openURL('https://support.apple.com/ja-jp/111795')}>
                    <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }}>{t('guide_guided_access_link', language)}</Text>
                    <Ionicons name="open-outline" size={12} color={themeColor} />
                  </TouchableOpacity>
                </View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} />
                <View style={s.guideStep}>
                  <Ionicons name="headset" size={24} color={themeColor} />
                  <Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>{t('guide_earphones_title', language)}</Text>
                </View>
                <View style={{ paddingLeft: 39, marginBottom: 15 }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>{t('guide_earphones_desc', language)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} />
                <View style={s.guideStep}>
                  <Ionicons name="volume-mute" size={24} color={themeColor} />
                  <Text style={[s.guideText, { color: dynamicStyles.text, fontWeight: 'bold' }]}>{t('guide_anc_title', language)}</Text>
                </View>
                <View style={{ paddingLeft: 39, marginBottom: 15 }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>{t('guide_anc_desc', language)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 15 }} />
                <View style={s.guideStep}>
                  <Ionicons name="warning" size={20} color="#f59e0b" />
                  <Text style={{ color: '#f59e0b', fontSize: 12, flex: 1, fontWeight: 'bold' }}>{t('guide_engine_warning', language)}</Text>
                </View>
            </View>
            
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: themeColor, marginTop: 40, width: '100%' }]} onPress={startFocusSession}>
              <Text style={[s.primaryBtnText, { color: buttonTextColor }]}>{t('guide_start_btn', language)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={{ marginTop: 25 }} onPress={() => setStage('SETUP')}>
              <Text style={{ color: dynamicStyles.subText, fontWeight: 'bold' }}>{t('guide_redo_setup', language)}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
  }

  const handleFinishSetup = () => isReady ? setStage('GUIDE') : Alert.alert(t('alert_no_list_title', language), t('alert_no_list_desc', language));

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[s.header, { paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0), backgroundColor: dynamicStyles.bg }]}>
        <TouchableOpacity 
          style={{ 
            position: 'absolute', 
            left: 16, 
            bottom: 4, 
            height: 36, 
            paddingHorizontal: 16, 
            borderRadius: 18, 
            backgroundColor: themeColor, 
            justifyContent: 'center', 
            alignItems: 'center',
            opacity: isReady ? 1 : 0.8, 
            zIndex: 10,
            shadowColor: themeColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
          }}
          onPress={handleFinishSetup}
        >
          <Text style={{ color: buttonTextColor, fontSize: 14, fontWeight: '900' }}>{t('finish_setup_btn', language)}</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: dynamicStyles.text }]}>{t('focus_setup_title', language)}</Text>
      </View>
      
      <FocusSetupView 
        {...{ 
          dynamicStyles, themeColor, buttonTextColor, dateMode, setDateMode, dayMode, setDayMode, clockMode, setClockMode, showQuote, setShowQuote, pomoEnabled, setPomoEnabled, workTime, setWorkTime, breakTime, setBreakTime, mainPlaylist, setMainPlaylist, mainShuffle, setMainShuffle, workPlaylist, setWorkPlaylist, workShuffle, setWorkShuffle, breakPlaylist, setBreakPlaylist, breakShuffle, setBreakShuffle, 
          localLibrary, localPlaylists, insets,
          onSelectCollection, pickerVisible, setPickerVisible, pickingTarget, setPickingTarget, isReady, 
          handleFinishSetup, language,
          openCustomTimerModal: (type: 'WORK' | 'BREAK') => {
              setCustomTimerType(type);
              const currentSecs = type === 'WORK' ? workTime : breakTime;
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
                      {customTimerType === 'WORK' ? t('custom_timer_title_work', language) : t('custom_timer_title_break', language)}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customH)} onChangeText={(text) => setCustomH(Number(text.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>{t('hours_unit', language)}</Text>
                      </View>
                      <Text style={{ fontSize: 24, color: dynamicStyles.text, fontWeight: 'bold', marginBottom: 25 }}>:</Text>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customM)} onChangeText={(text) => setCustomM(Number(text.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>{t('minutes_unit', language)}</Text>
                      </View>
                      <Text style={{ fontSize: 24, color: dynamicStyles.text, fontWeight: 'bold', marginBottom: 25 }}>:</Text>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                          <TextInput 
                              style={{ backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 24, fontWeight: 'bold', textAlign: 'center', borderRadius: 12, width: 70, height: 60 }} 
                              keyboardType="number-pad" maxLength={2} 
                              value={String(customS)} onChangeText={(text) => setCustomS(Number(text.replace(/[^0-9]/g, '')))}
                          />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 8 }}>{t('seconds_unit', language)}</Text>
                      </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 15 }}>
                      <TouchableOpacity 
                          style={{ flex: 1, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#e5e7eb' }} 
                          onPress={() => setCustomTimerType(null)}
                      >
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={{ flex: 1, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColor }} 
                          onPress={() => {
                              const totalSecs = (customH * 3600) + (customM * 60) + customS;
                              if (totalSecs <= 0) {
                                  Alert.alert(t('alert_timer_error_title', language), t('alert_timer_error_desc', language));
                                  return;
                              }
                              if (customTimerType === 'WORK') setWorkTime(totalSecs);
                              else setBreakTime(totalSecs);
                              setCustomTimerType(null);
                          }}
                      >
                          <Text style={{ color: buttonTextColor, fontWeight: 'bold' }}>{t('confirm', language)}</Text>
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
  primaryBtnText: { fontSize: 18, fontWeight: '900' },
  guideCard: { width: '100%', borderRadius: 24, padding: 25, marginTop: 20, borderWidth: 1 },
  guideStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideText: { fontSize: 14, flex: 1 },
});
