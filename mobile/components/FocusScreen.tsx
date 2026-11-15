import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, TextInput, StyleSheet, Modal, Alert, Platform, UIManager, Animated, useWindowDimensions, PanResponder, Linking, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { FocusSetupView } from './focus/FocusSetupView';
import { FocusTimerView } from './focus/FocusTimerView';
import { getPlaylistSongs } from '../utils/playlistEvaluator';
import { t } from '../utils/i18n';
import { 
  addWorkHistoryApi, 
  formatWorkSessionEndTime, 
  formatWorkDuration, 
  verifyChordiaSyncSession, 
  ACCOUNT_STORAGE_KEY 
} from '../utils/chordiaSync';

const BEEP_SOUND_URI = 'data:audio/wav;base64,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';

const STORAGE_KEY = 'chordia_focus_settings';
const HISTORY_KEY = 'chordia_focus_history';
const TEMP_WORK_KEY = 'chordia_temp_work_seconds';
const showNativeAlert = Alert.alert;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const FocusScreen = ({ 
  dynamicStyles, insets, themeColor, localLibrary = [], localPlaylists = [], 
  currentSong, startQueue,
  startFocusQueue, pauseFocusAudio, resumeFocusAudio, setFocusFadeVolume, stopFocusAudio,
  stage, setStage, audioEngine, changeAudioEngine, 
  themeR, themeG, themeB, language = 'ja' 
}: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const padTopOffset = isPad ? 36 : 8;

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
  const isExitingFocusRef = useRef(false);
  const [isExitingFocus, setIsExitingFocus] = useState(false);
  
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

  const saveSessionToHistory = useCallback(async (seconds: number) => {
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

      const isValid = await verifyChordiaSyncSession(true, language);
      if (isValid) {
        const accountJson = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (accountJson) {
          const account = JSON.parse(accountJson);
          if (account.sid) {
            const endFormatted = formatWorkSessionEndTime(new Date(endTime));
            const timeFormatted = formatWorkDuration(seconds);

            console.log(`[FocusSession] 🏁 作業セッション終了 (${seconds}秒)。Chordia Sync に送信します...`);
            addWorkHistoryApi(account.sid, endFormatted, timeFormatted);
          }
        }
      }
    } catch (e) {
      console.error("Failed to save focus history", e);
    }
  }, [language]);

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
  }, [saveSessionToHistory]);

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
        await pauseFocusAudio?.();
    } else { 
        if (pauseStartTimeRef.current) {
            const pausedDuration = nowMs - pauseStartTimeRef.current;
            totalPausedMsRef.current += pausedDuration;
            totalPhasePausedMsRef.current += pausedDuration;
        }
        pauseStartTimeRef.current = null;
        setPausedSeconds(0);
        setFocusFadeVolume?.(1.0);
        await resumeFocusAudio?.();
    }
  }, [pauseFocusAudio, resumeFocusAudio, setFocusFadeVolume]);

  const exitFocusMode = useCallback(() => {
    if (isExitingFocusRef.current) return;
    isExitingFocusRef.current = true;
    setIsExitingFocus(true);
    fadeTriggeredRef.current = false;
    setStage('SETUP');
    void (async () => {
      try {
        await stopFocusAudio?.();
        await saveSessionToHistory(totalWorkSecondsRef.current);
      } catch (error) {
        console.error('Failed to exit focus session:', error);
      }
    })();
  }, [saveSessionToHistory, setStage, stopFocusAudio]);

  const onSelectCollection = useCallback((item: any) => {
    if (pickingTarget === 'MAIN') setMainPlaylist(item);
    else if (pickingTarget === 'WORK') setWorkPlaylist(item);
    else if (pickingTarget === 'BREAK') setBreakPlaylist(item);
    setPickerVisible(false);
  }, [pickingTarget]);

  const switchPhaseMusic = async (phase: 'WORK' | 'BREAK') => {
    const isWork = phase === 'WORK';
    const target = isWork 
      ? (pomoEnabledRef.current ? playlistRefs.current.workPlaylist : playlistRefs.current.mainPlaylist) 
      : playlistRefs.current.breakPlaylist;
    const shuffle = isWork 
      ? (pomoEnabledRef.current ? playlistRefs.current.workShuffle : playlistRefs.current.mainShuffle) 
      : playlistRefs.current.breakShuffle;

    if (target) {
      let songs: any[] = [];
      if (target.type === 'PLAYLIST') {
        const playlistData = (localPlaylists && localPlaylists.find((p: any) => p.id === target.data?.id || p.id === target.id)) || target.data;
        songs = getPlaylistSongs(playlistData, localLibrary);
      } else if (Array.isArray(target.songs) && target.songs.length > 0) {
        songs = target.songs;
      }

      if (songs.length === 0 && Array.isArray(target.songs) && target.songs.length > 0) {
        songs = target.songs;
      }
      if (songs.length === 0 && Array.isArray(localLibrary) && localLibrary.length > 0) {
        songs = localLibrary;
      }

      if (songs.length > 0) {
        if (startFocusQueue) {
          await startFocusQueue(songs, shuffle, 'ALL');
        } else {
          startQueue(songs, undefined, shuffle, null, 0, 'ALL');
        }
      }
    }
  };

  const playAlarmSound = async () => {
    try {
      Vibration.vibrate([0, 500, 200, 500]);
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      const alarmPlayer = createAudioPlayer(BEEP_SOUND_URI);
      alarmPlayer.play();
      await new Promise(r => setTimeout(r, 800));
      try {
        alarmPlayer.pause();
        alarmPlayer.remove?.();
      } catch (_) {}
    } catch (e) { 
      await new Promise(r => setTimeout(r, 600)); 
    }
  };

  const handlePhaseTransition = async () => {
    isTransitioningRef.current = true;
    try {
      await pauseFocusAudio?.();
      await playAlarmSound();
      if (isExitingFocusRef.current) return;
      
      const nextState = pomoStateRef.current === 'WORK' ? 'BREAK' : 'WORK';
      setPomoState(nextState);
      
      const nextSeconds = nextState === 'WORK' ? workTimeRef.current : breakTimeRef.current;
      setPomoRemaining(nextSeconds);
      phaseStartTimeRef.current = Date.now();
      totalPhasePausedMsRef.current = 0; 
      fadeTriggeredRef.current = false;
      
      await switchPhaseMusic(nextState);
      if (isExitingFocusRef.current) return;

      if (isPausedRef.current) {
        await pauseFocusAudio?.();
        setFocusFadeVolume?.(1.0);
      } else {
        setFocusFadeVolume?.(0);
        for (let i = 1; i <= 10; i++) {
          if (isExitingFocusRef.current || isPausedRef.current) break;
          setFocusFadeVolume?.(i / 10);
          await new Promise(r => setTimeout(r, 150));
        }
        if (!isExitingFocusRef.current) {
          setFocusFadeVolume?.(1.0);
        }
      }
    } catch (e) { 
      setFocusFadeVolume?.(1.0);
    } finally {
      isTransitioningRef.current = false;
    }
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

            if (remainingSec <= 6 && remainingSec >= 2 && !fadeTriggeredRef.current) {
                fadeTriggeredRef.current = true;
                (async () => {
                    try {
                        for (let i = 10; i >= 0; i--) { 
                          if (!fadeTriggeredRef.current || isExitingFocusRef.current) break;
                          setFocusFadeVolume?.(i / 10);
                          await new Promise(r => setTimeout(r, 350)); 
                        }
                    } catch(e) {}
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
  }, [stage, setFocusFadeVolume]);

  const panResponder = useRef(PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 30 || Math.abs(g.dy) > 30,
      onPanResponderRelease: (evt, g) => { if (!showHelpRef.current && (Math.abs(g.dx) > 50 || Math.abs(g.dy) > 50)) exitFocusMode(); },
  })).current;

  const startFocusSession = async () => {
    isExitingFocusRef.current = false;
    setIsExitingFocus(false);
    setFocusFadeVolume?.(1.0);
    
    sessionStartTimeRef.current = Date.now();
    phaseStartTimeRef.current = Date.now();
    totalPausedMsRef.current = 0;
    totalPhasePausedMsRef.current = 0;
    pauseStartTimeRef.current = null;
    fadeTriggeredRef.current = false;
    isTransitioningRef.current = false;

    workProgressRef.current = { index: 0, position: 0 };
    breakProgressRef.current = { index: 0, position: 0 };

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
                          
                          <TouchableOpacity style={{ marginTop: 20, paddingBottom: 10, alignItems: 'center', opacity: isExitingFocus ? 0.5 : 1 }} onPress={exitFocusMode} disabled={isExitingFocus}>
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
            <View style={[s.guideCard, { backgroundColor: isLiquidGlassAvailable() && Platform.OS === 'ios' ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 30, overflow: 'hidden' }]}>
                {Platform.OS === 'ios' && isLiquidGlassAvailable() && (
                  <GlassView
                    pointerEvents="none"
                    glassEffectStyle="regular"
                    colorScheme={dynamicStyles.bg === '#000000' ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                )}
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
            
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: Platform.OS === 'ios' && isLiquidGlassAvailable() ? 'transparent' : themeColor, marginTop: 40, width: '100%', overflow: 'hidden' }]} onPress={startFocusSession}>
              {Platform.OS === 'ios' && isLiquidGlassAvailable() && (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  isInteractive
                  colorScheme={dynamicStyles.bg === '#000000' ? 'dark' : 'light'}
                  tintColor={themeColor}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={[s.primaryBtnText, { color: buttonTextColor }]}>{t('guide_start_btn', language)}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={{ marginTop: 25, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 10 }} onPress={() => setStage('SETUP')}>
              {Platform.OS === 'ios' && isLiquidGlassAvailable() && (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  isInteractive
                  colorScheme={dynamicStyles.bg === '#000000' ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={{ color: dynamicStyles.subText, fontWeight: 'bold' }}>{t('guide_redo_setup', language)}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
  }

  const handleFinishSetup = () => isReady ? setStage('GUIDE') : showNativeAlert(t('alert_no_list_title', language), t('alert_no_list_desc', language));

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[s.header, { 
        paddingTop: (insets?.top || 0) + padTopOffset, 
        height: 44 + (insets?.top || 0) + padTopOffset, 
        backgroundColor: dynamicStyles.bg 
      }]}>
        {Platform.OS === 'ios' && isLiquidGlassAvailable() ? (
          <Pressable
            onPress={handleFinishSetup}
            accessibilityRole="button"
            style={{ position: 'absolute', left: 16, bottom: 4, opacity: isReady ? 1 : 0.8, zIndex: 10 }}
          >
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              colorScheme={dynamicStyles.bg === '#000000' ? 'dark' : 'light'}
              tintColor={themeColor}
              style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
            >
              <Text style={{ color: buttonTextColor, fontSize: 14, fontWeight: '900' }}>{t('finish_setup_btn', language)}</Text>
            </GlassView>
          </Pressable>
        ) : (
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
        )}
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
                                  showNativeAlert(t('alert_timer_error_title', language), t('alert_timer_error_desc', language));
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