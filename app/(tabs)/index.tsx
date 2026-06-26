import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, StyleSheet, Text, TouchableOpacity, useColorScheme, useWindowDimensions, View, FlatList, ScrollView, LogBox } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}時間${m}分${sec}秒`;
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
    if (t.includes('エラー') || t.includes('失敗') || t.includes('拒否') || t.includes('切断')) {
      return <Ionicons name="alert-circle-outline" size={38} color="#ef4444" style={{ marginBottom: 12 }} />;
    }
    return <Ionicons name="information-circle-outline" size={38} color={themeColor} style={{ marginBottom: 12 }} />;
  };

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
          <View style={{ flex: 1, backgroundColor: actualDynamicStyles.bg, paddingTop: insets.top }}>
            <View style={[styles.headerBar, { backgroundColor: actualDynamicStyles.bg, borderBottomColor: 'transparent' }]}><Text style={[styles.headerTitle, { color: actualDynamicStyles.text }]}>情報</Text></View>
            <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
              <View style={{ justifyContent: 'center', alignItems: 'center', padding: 25 }}>
                <View style={[styles.licenseCard, { backgroundColor: actualDynamicStyles.card }]}>
                  <Text style={[styles.appNameLabel, { color: actualDynamicStyles.text }]}>Chordia iOS版</Text>
                  <Text style={styles.appVersionLabel}>v4.0.0-beta2</Text>
                  <View style={[styles.divider, { backgroundColor: actualDynamicStyles.bg, marginTop: 25 }]} />
                  <Text style={[styles.copyrightLabel, { color: actualDynamicStyles.text }]}>© 2026 BellRin</Text>
                </View>
              </View>

              <View style={{ paddingHorizontal: 25, marginTop: 10 }}>
                <Text style={{ color: actualDynamicStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>集中セッション履歴 (テスト用)</Text>
                {focusHistory.length === 0 ? (
                  <Text style={{ color: actualDynamicStyles.subText }}>履歴はありません。</Text>
                ) : (
                  focusHistory.map((item) => (
                    <View key={item.id} style={{ backgroundColor: actualDynamicStyles.card, padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: themeColor }}>
                      <Text style={{ color: actualDynamicStyles.text, fontWeight: 'bold' }}>{new Date(item.date).toLocaleString()}</Text>
                      <Text style={{ color: actualDynamicStyles.subText, fontSize: 14, marginTop: 4 }}>作業時間: {formatDuration(item.duration)}</Text>
                    </View>
                  ))
                )}
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

      <Modal visible={isFullScreenSyncing} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.fullScreenModalOverlay}>
          <View style={[styles.fullScreenModalContent, { backgroundColor: actualDynamicStyles.card }]}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={[styles.fullScreenModalText, { color: actualDynamicStyles.text }]}>{syncProgress}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={isFullPlayer} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <FullScreenPlayer dynamicStyles={actualDynamicStyles} themeColor={themeColor} currentSong={currentSong} isPlaying={isPlaying} playbackStatus={playbackStatus} sound={sound} playQueue={playQueue} currentIndex={currentIndex} loopMode={loopMode} isShuffle={isShuffle} showQueue={showQueue} showLyrics={showLyrics} toggleLoopMode={toggleLoopMode} toggleShuffleMode={toggleShuffleMode} setShowQueue={setShowQueue} setShowLyrics={setShowLyrics} handlePrev={handlePrev} togglePlayPause={togglePlayPause} handleNext={handleNext} slideAnim={slideAnim} queueTransitionAnim={queueTransitionAnim} closeFullPlayer={closeFullPlayer} toastVisible={toastVisible} toastMessage={toastMessage} toastAnim={toastAnim} />
      </Modal>

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