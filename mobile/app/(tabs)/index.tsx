import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, useColorScheme, useWindowDimensions, View, FlatList, ScrollView, LogBox } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as Network from 'expo-network';

import TrackPlayer from 'react-native-track-player';

import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useLibraryData } from '../../hooks/useLibraryData';
import { useSync } from '../../hooks/useSync';

import { FocusScreen } from '../../components/FocusScreen';
import { FullScreenPlayer } from '../../components/FullScreenPlayer';
import { Library } from '../../components/Library';
import { MiniPlayer } from '../../components/MiniPlayer';
import { SettingsScreen } from '../../components/SettingsScreen';
import { SyncScreen } from '../../components/SyncScreen';
import { TabBar } from '../../components/TabBar';
import { LANDSCAPE_TAB_BAR_WIDTH, styles, TAB_BAR_HEIGHT } from '../../styles/styles';

export type TabType = 'SYNC' | 'PLAYER' | 'FOCUS' | 'SETTINGS' | 'LICENSE';
export type FocusStageType = 'SETUP' | 'GUIDE' | 'FOCUS';

const TAB_BAR_MARGIN = 25;
const MINI_PLAYER_GAP = 8;
const MINI_PLAYER_HEIGHT = 58;

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
  'The objective-c `getSleepTimerProgress',
  'The objective-c `setSleepTimer',
  'The objective-c `sleepWhenActiveTrackReachesEnd',
  'The objective-c `clearSleepTimer'
]);

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<TabType>('PLAYER');
  const [focusStage, setFocusStage] = useState<FocusStageType>('SETUP');
  const [focusHistory, setFocusHistory] = useState<any[]>([]);
  
  const [showAllHistory, setShowAllHistory] = useState(false);
  const historyBackButtonScale = useRef(new Animated.Value(1)).current;
  
  const [customAlert, setCustomAlert] = useState<{title: string, message?: string, buttons?: any[]} | null>(null);

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isAppDark = colorScheme === 'dark';
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    isDark, dynamicStyles, themeColor, themeR, themeG, themeB, setThemeR, setThemeG, setThemeB,
    isCustomTheme, recentColors, showRGBModal, setShowRGBModal,
    saveColor, applyCustomColor, localLibrary, setLocalLibrary, localPlaylists, setLocalPlaylists,
    showFocusTab, toggleFocusTab
  } = useLibraryData();

  const {
    sound, audioEngine, changeAudioEngine,
    isPlaying, currentSong, playbackStatus, playQueue, currentIndex,
    loopMode, toggleLoopMode, isShuffle, toggleShuffleMode,
    isFullPlayer, setIsFullPlayer, showQueue, setShowQueue, showLyrics, setShowLyrics,
    toastVisible, toastMessage, toastAnim, showToast,
    navStackLength, setNavStackLength,
    startQueue, handleNext, handlePrev, togglePlayPause,
    slideAnim, queueTransitionAnim, closeFullPlayer,
  } = useAudioPlayer();

  const {
    syncStage, setSyncStage, serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput,
    showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls,
    syncProgress, isSyncing, isFullScreenSyncing, requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect,
    setScannedQrData, clientInfo
  } = useSync({ 
    closeFullPlayer, 
    stopAndUnloadPlayer: async () => { await TrackPlayer.stop(); },
    localLibrary, setLocalLibrary, setLocalPlaylists
  });

  useEffect(() => {
    const requestInitialPermissions = async () => {
      try {
        if (Platform.OS === 'ios') {
          try {
            const localIp = await Network.getIpAddressAsync();
            if (localIp && (localIp.startsWith('192.168.') || localIp.startsWith('10.') || localIp.startsWith('172.'))) {
              const parts = localIp.split('.');
              const gatewayIp = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
              const controller = new AbortController();
              const tid = setTimeout(() => controller.abort(), 1000);
              
              await fetch(`http://${gatewayIp}:80`, { signal: controller.signal }).catch(() => {});
              clearTimeout(tid);
            }
          } catch (e) {}

          await new Promise(r => setTimeout(r, 600));
        }

        const { status } = await Camera.requestCameraPermissionsAsync();
        console.log('[Initial Permissions] Camera Status:', status);
      } catch (e) {
        console.warn('[Initial Permissions] Error:', e);
      }
    };

    requestInitialPermissions();
  }, []);

  useEffect(() => {
    const originalAlert = Alert.alert;
    Alert.alert = (title: string, message?: string, buttons?: any[]) => {
      setCustomAlert({ title, message, buttons });
    };
    return () => {
      Alert.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'LICENSE') {
      const loadHistory = async () => {
        try {
          const res = await AsyncStorage.getItem('chordia_focus_history');
          if (res) setFocusHistory(JSON.parse(res));
        } catch (e) {}
      };
      loadHistory();
    }
  }, [activeTab]);

  const isBlurBackground = activeTab === 'PLAYER' && navStackLength === 3;
  const rootBgColor = isBlurBackground ? '#000000' : (isAppDark ? '#000000' : '#f2f2f7');

  const actualDynamicStyles = {
    bg: isAppDark ? '#000000' : '#f2f2f7',
    card: isAppDark ? '#1c1c1e' : '#ffffff',
    text: isAppDark ? '#ffffff' : '#000000',
    subText: '#8e8e93',
    border: isAppDark ? '#38383a' : '#d1d1d6',
    blur: isAppDark ? 'dark' : 'light',
  };

  const miniPlayerShiftAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shouldShift = isLandscape && activeTab === 'PLAYER' && navStackLength === 3;
    Animated.spring(miniPlayerShiftAnim, { toValue: shouldShift ? 1 : 0, useNativeDriver: false, friction: 8, tension: 40 }).start();
  }, [navStackLength, isLandscape, activeTab]);

  const isFocusing = activeTab === 'FOCUS' && focusStage === 'FOCUS';
  const contentPaddingRight = isFocusing ? 0 : (isLandscape ? LANDSCAPE_TAB_BAR_WIDTH + 16 + insets.right : 0);
  const availableWidth = width - (isLandscape ? LANDSCAPE_TAB_BAR_WIDTH + 16 + insets.right : 0) - 16;
  const heroWidth = availableWidth * 0.4;
  const miniPlayerLeft = miniPlayerShiftAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 16 + heroWidth] });

  useEffect(() => {
    if (!showFocusTab && activeTab === 'FOCUS') {
      setActiveTab('PLAYER');
    }
  }, [showFocusTab]);

  const getAlertIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('完了') || t.includes('成功') || t.includes('設定変更') || t.includes('承認')) {
      return <Ionicons name="checkmark-circle-outline" size={38} color={themeColor} style={{ marginBottom: 12 }} />;
    }
    if (t.includes('エラー') || t.includes('失敗') || t.includes('拒否') || t.includes('切断') || t.includes('停止')) {
      return <Ionicons name="alert-circle-outline" size={38} color="#ef4444" style={{ marginBottom: 12 }} />;
    }
    return <Ionicons name="information-circle-outline" size={38} color={themeColor} style={{ marginBottom: 12 }} />;
  };

  // -------------------------------------------------------------
  // ★ 統計タブ (LICENSE) 用の関数
  // -------------------------------------------------------------
  const getLast7DaysData = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days.map(d => {
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const totalSec = focusHistory
        .filter((h: any) => {
          const hd = new Date(h.date);
          return hd >= d && hd < nextDay;
        })
        .reduce((sum: number, h: any) => sum + h.duration, 0);
      
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      return { date: d, totalSec, label: `${d.getMonth() + 1}/${d.getDate()}`, dayName: dayNames[d.getDay()] };
    });
  };

  const formatSecToHM = (sec: number) => {
    if (sec === 0) return '0分';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    return `${m}分`;
  };

  const formatSecToHMS = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  };

  const handleHistoryPressIn = () => { Animated.spring(historyBackButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handleHistoryPressOut = () => { Animated.spring(historyBackButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const GRAPH_HEIGHT = 180;
  // -------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: rootBgColor }]}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: rootBgColor, zIndex: -1 }} />
      <StatusBar style={isAppDark ? "light" : "dark"} backgroundColor="transparent" translucent={true} />
      
      <View style={{ flex: 1, backgroundColor: rootBgColor, paddingRight: contentPaddingRight }}>
        {activeTab === 'SYNC' && (
          <SyncScreen dynamicStyles={actualDynamicStyles} themeColor={themeColor} syncStage={syncStage} setSyncStage={setSyncStage} serverIp={serverIp} setServerIp={setServerIp} serverPort={serverPort} setServerPort={setServerPort} authCodeInput={authCodeInput} setAuthCodeInput={setAuthCodeInput} showCamera={showCamera} setShowCamera={setShowCamera} requestCameraPermission={requestCameraPermission} pcPlaylists={pcPlaylists} selectedPls={selectedPls} setSelectedPls={setSelectedPls} isSyncing={isSyncing} isDark={isAppDark} requestAuthToPC={requestAuthToPC} verifyAuthCode={verifyAuthCode} startSyncDownload={startSyncDownload} cancelSync={cancelSync} disconnect={disconnect} setScannedQrData={setScannedQrData} clientInfo={clientInfo} insets={insets} currentSong={currentSong} />
        )}
        {activeTab === 'PLAYER' && (
          <Library dynamicStyles={actualDynamicStyles} themeColor={themeColor} startQueue={startQueue} currentSong={currentSong} localLibrary={localLibrary} localPlaylists={localPlaylists} setNavStackLength={setNavStackLength} insets={insets} isDark={isAppDark} />
        )}
        {activeTab === 'FOCUS' && (
          <FocusScreen 
            dynamicStyles={actualDynamicStyles} 
            insets={insets} 
            themeColor={themeColor} 
            localLibrary={localLibrary}
            localPlaylists={localPlaylists}
            currentSong={currentSong}
            startQueue={startQueue}
            stage={focusStage}
            setStage={setFocusStage}
            audioEngine={audioEngine}           
            changeAudioEngine={changeAudioEngine}
            themeR={themeR} themeG={themeG} themeB={themeB}
          />
        )}
        {activeTab === 'SETTINGS' && (
          <SettingsScreen dynamicStyles={actualDynamicStyles} themeColor={themeColor} isCustomTheme={isCustomTheme} themeR={themeR} themeG={themeG} themeB={themeB} recentColors={recentColors} setThemeR={setThemeR} setThemeG={setThemeG} setThemeB={setThemeB} showRGBModal={showRGBModal} setShowRGBModal={setShowRGBModal} saveColor={saveColor} applyCustomColor={applyCustomColor} insets={insets} audioEngine={audioEngine} changeAudioEngine={changeAudioEngine} showFocusTab={showFocusTab} toggleFocusTab={toggleFocusTab} />
        )}
        {activeTab === 'LICENSE' && (
          <View style={{ flex: 1, backgroundColor: actualDynamicStyles.bg }}>
            <View style={[styles.headerBar, { backgroundColor: actualDynamicStyles.bg, borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0) }]}>
              <Text style={[styles.headerTitle, { color: actualDynamicStyles.text }]}>統計</Text>
            </View>

            <ScrollView 
              contentContainerStyle={{ 
                padding: 20, 
                paddingLeft: Math.max(insets?.left || 0, 20),
                paddingRight: Math.max(insets?.right || 0, 20),
                paddingBottom: 150 + (insets?.bottom || 0) 
              }}
            >
              <Text style={{ color: actualDynamicStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>活動記録</Text>
              
              {/* 1. 今週の棒グラフカード */}
              <View style={{ backgroundColor: actualDynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: actualDynamicStyles.border, marginBottom: 25 }}>
                <Text style={{ color: actualDynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 25 }}>過去7日間の集中時間</Text>
                
                <View style={{ flexDirection: 'row', height: GRAPH_HEIGHT }}>
                  <View style={{ justifyContent: 'space-between', paddingRight: 15, alignItems: 'flex-end', width: 65 }}>
                    <Text style={{ color: actualDynamicStyles.subText, fontSize: 11, fontWeight: '600' }}>{formatSecToHM(maxSec)}</Text>
                    <Text style={{ color: actualDynamicStyles.subText, fontSize: 11, fontWeight: '600' }}>{formatSecToHM(maxSec / 2)}</Text>
                    <Text style={{ color: actualDynamicStyles.subText, fontSize: 11, fontWeight: '600' }}>0分</Text>
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: actualDynamicStyles.border, paddingBottom: 5 }}>
                    {graphData.map((d, i) => {
                      const barHeight = maxSec > 0 ? (d.totalSec / maxSec) * (GRAPH_HEIGHT - 25) : 0;
                      const isToday = i === 6;
                      return (
                        <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                          <View style={{ 
                            height: barHeight, 
                            width: isLandscape ? 32 : 18, 
                            backgroundColor: isToday ? themeColor : (isAppDark ? '#3a3a3c' : '#d1d1d6'), 
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                            minHeight: d.totalSec > 0 ? 6 : 0
                          }} />
                        </View>
                      );
                    })}
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', marginLeft: 65, marginTop: 10 }}>
                  {graphData.map((d, i) => {
                    const isToday = i === 6;
                    return (
                      <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: isToday ? themeColor : actualDynamicStyles.subText, fontSize: 12, fontWeight: isToday ? 'bold' : 'normal' }}>{d.dayName}</Text>
                        <Text style={{ color: actualDynamicStyles.subText, fontSize: 10, marginTop: 2 }}>{d.label}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* 2. すべての履歴を確認するボタン */}
              <TouchableOpacity 
                style={{
                  backgroundColor: isAppDark ? '#1c1c1e' : '#f2f2f7',
                  paddingVertical: 18,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 35,
                  borderWidth: 1,
                  borderColor: actualDynamicStyles.border
                }}
                onPress={async () => {
                  try {
                    const res = await AsyncStorage.getItem('chordia_focus_history');
                    if (res) setFocusHistory(JSON.parse(res));
                  } catch (e) {}
                  setShowAllHistory(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: themeColor, fontSize: 16, fontWeight: 'bold' }}>すべての集中セッション履歴を確認する</Text>
              </TouchableOpacity>

              {/* 3. 週間合計時間 */}
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ color: actualDynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>この1週間の合計集中時間</Text>
                <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHM(weekTotalSec)}</Text>
              </View>

            </ScrollView>
          </View>
        )}
      </View>

      {!isFocusing && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', zIndex: 100 }]}>
          {currentSong && !isFullPlayer && activeTab !== 'FOCUS' && (
            <Animated.View style={[isLandscape ? styles.miniPlayerPosLandscape : [styles.commonWrapperPortrait, { height: MINI_PLAYER_HEIGHT }], { bottom: isLandscape ? (15 + insets.bottom) : (TAB_BAR_MARGIN + TAB_BAR_HEIGHT + MINI_PLAYER_GAP + insets.bottom), left: isLandscape ? miniPlayerLeft : 16, right: isLandscape ? (16 + LANDSCAPE_TAB_BAR_WIDTH + 16 + insets.right) : 16, shadowOpacity: isBlurBackground ? 0 : 0.1, elevation: isBlurBackground ? 0 : 10 }]}>
              <MiniPlayer currentSong={currentSong} isPlaying={isPlaying} dynamicStyles={actualDynamicStyles} onPress={() => { setIsFullPlayer(true); Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start(); }} togglePlayPause={togglePlayPause} handleNext={handleNext} />
            </Animated.View>
          )}
          <View style={isLandscape ?[styles.tabBarWrapperLandscape, { right: 16 + insets.right, top: 16 + insets.top, bottom: 16 + insets.bottom }] :[styles.commonWrapperPortrait, { bottom: TAB_BAR_MARGIN + insets.bottom, height: TAB_BAR_HEIGHT }]}>
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} themeColor={themeColor} isDark={isAppDark} isBlurBackground={isBlurBackground} showFocusTab={showFocusTab} />
          </View>
        </View>
      )}

      {/* フルスクリーン同期モーダル */}
      <Modal visible={isFullScreenSyncing} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.fullScreenModalOverlay}>
          <View style={[styles.fullScreenModalContent, { backgroundColor: actualDynamicStyles.card, paddingBottom: 25 }]}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={[styles.fullScreenModalText, { color: actualDynamicStyles.text, textAlign: 'center', marginBottom: 25 }]}>{syncProgress}</Text>
            
            <TouchableOpacity 
              style={{
                backgroundColor: '#ef4444',
                paddingVertical: 12,
                paddingHorizontal: 35,
                borderRadius: 25,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }}
              onPress={cancelSync}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'center' }}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* フルスクリーンプレイヤー */}
      <Modal visible={isFullPlayer} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <FullScreenPlayer dynamicStyles={actualDynamicStyles} themeColor={themeColor} currentSong={currentSong} isPlaying={isPlaying} playbackStatus={playbackStatus} sound={sound} playQueue={playQueue} currentIndex={currentIndex} loopMode={loopMode} isShuffle={isShuffle} showQueue={showQueue} showLyrics={showLyrics} toggleLoopMode={toggleLoopMode} toggleShuffleMode={toggleShuffleMode} setShowQueue={setShowQueue} setShowLyrics={setShowLyrics} handlePrev={handlePrev} togglePlayPause={togglePlayPause} handleNext={handleNext} slideAnim={slideAnim} queueTransitionAnim={queueTransitionAnim} closeFullPlayer={closeFullPlayer} toastVisible={toastVisible} toastMessage={toastMessage} toastAnim={toastAnim} />
      </Modal>

      {/* ★ 変更: ヘッダー高さと文字の位置を前の画面に揃え、戻るボタンのみを translateY で少し下へずらす */}
      <Modal visible={showAllHistory} animationType="fade" transparent={false} supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={{ flex: 1, backgroundColor: actualDynamicStyles.bg }}>
          
          <View style={[styles.navHeader, { paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0), borderBottomWidth: 1, borderBottomColor: actualDynamicStyles.border }]}>
            <View style={styles.navHeaderLeft}>
              <TouchableWithoutFeedback onPressIn={handleHistoryPressIn} onPressOut={handleHistoryPressOut} onPress={() => setShowAllHistory(false)}>
                  <Animated.View style={{ transform:[{ scale: historyBackButtonScale }, { translateY: 6 }] }}>
                      <View style={[styles.liquidGlassBackButton, { 
                          backgroundColor: isAppDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)',
                          borderColor: isAppDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                      }]}>
                          <BlurView intensity={isAppDark ? 50 : 80} tint={isAppDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                          <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
                      </View>
                  </Animated.View>
              </TouchableWithoutFeedback>
            </View>
            <Text style={[styles.navHeaderTitle, { color: actualDynamicStyles.text }]} numberOfLines={1}>すべての履歴</Text>
            <View style={styles.navHeaderRight} />
          </View>

          <FlatList
            data={focusHistory}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              padding: 20,
              paddingLeft: Math.max(insets?.left || 0, 20),
              paddingRight: Math.max(insets?.right || 0, 20),
              paddingBottom: (insets?.bottom || 20) + 50
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <Ionicons name="time-outline" size={80} color={actualDynamicStyles.border} />
                <Text style={{ color: actualDynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>履歴がありません</Text>
              </View>
            }
            renderItem={({ item }) => {
              const d = new Date(item.date);
              const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              return (
                <View style={{ 
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
                  backgroundColor: actualDynamicStyles.card, padding: 16, borderRadius: 16, marginBottom: 12,
                  borderWidth: 1, borderColor: actualDynamicStyles.border,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                      <Ionicons name="checkmark-done-circle" size={26} color={themeColor} />
                    </View>
                    <Text style={{ color: actualDynamicStyles.text, fontSize: 15, fontWeight: 'bold', flex: 1 }}>{dateStr}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: themeColor, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                      {formatSecToHMS(item.duration)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>
      </Modal>

      {/* アラートモーダル */}
      <Modal visible={!!customAlert} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
          <BlurView 
            intensity={isAppDark ? 75 : 95} 
            tint={isAppDark ? 'dark' : 'light'} 
            style={[styles.liquidAlertBox, { 
              borderColor: isAppDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.65)',
              backgroundColor: isAppDark ? 'rgba(25,25,25,0.7)' : 'rgba(255,255,255,0.6)',
            }]}
          >
            {customAlert && getAlertIcon(customAlert.title)}
            <Text style={[styles.liquidAlertTitle, { color: actualDynamicStyles.text }]}>{customAlert?.title}</Text>
            {customAlert?.message && <Text style={[styles.liquidAlertMessage, { color: actualDynamicStyles.subText }]}>{customAlert.message}</Text>}
            <View style={[styles.liquidAlertButtonGroup, { borderColor: isAppDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }]}>
              {customAlert?.buttons && customAlert.buttons.length > 0 ? (
                customAlert.buttons.map((btn: any, idx: number) => (
                  <TouchableOpacity 
                    key={idx} 
                    activeOpacity={0.7}
                    style={[styles.liquidAlertButton, { borderColor: isAppDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }, idx === customAlert.buttons.length - 1 && { borderRightWidth: 0 }]} 
                    onPress={() => {
                      setCustomAlert(null);
                      btn.onPress && btn.onPress();
                    }}
                  >
                    <Text style={[
                      styles.liquidAlertButtonText, 
                      { color: themeColor }, 
                      btn.style === 'destructive' && { color: '#ef4444' }, 
                      (btn.style === 'cancel' || btn.text === 'キャンセル') && { color: actualDynamicStyles.subText, fontWeight: 'normal' }
                    ]}>{btn.text || 'OK'}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity activeOpacity={0.7} style={[styles.liquidAlertButton, { borderRightWidth: 0 }]} onPress={() => setCustomAlert(null)}>
                  <Text style={[styles.liquidAlertButtonText, { color: themeColor }]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>
      </Modal>

      {toastVisible && !isFullPlayer && (
          <Animated.View style={[styles.toastContainer, { opacity: toastAnim, transform:[{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange:[20, 0] }) }] }]}><BlurView intensity={50} tint="dark" style={styles.toastBlur}><Text style={styles.toastText}>{toastMessage}</Text></BlurView></Animated.View>
      )}
    </View>
  );
};

export default function App() {
  useEffect(() => {
    try { TrackPlayer.registerPlaybackService(() => require('../../service')); } catch (e) {}
  }, []);
  return ( <SafeAreaProvider><AppContent /></SafeAreaProvider> );
}