import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View, LogBox, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as Network from 'expo-network';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ViewInstance } from 'react-native';

import TrackPlayer from 'react-native-track-player';

import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useLibraryData } from '../../hooks/useLibraryData';
import { useSync } from '../../hooks/useSync';

import { FocusScreen } from '../../components/FocusScreen';
import { FullScreenPlayer } from '../../components/FullScreenPlayer';
import { Library } from '../../components/Library';
import { MiniPlayer } from '../../components/MiniPlayer';
import { MiniPlayerMenuModal } from '../../components/MiniPlayerMenuModal';
import { InfoScreen } from '../../components/InfoScreen';
import { SyncScreen } from '../../components/SyncScreen';
import { TabBar } from '../../components/TabBar';
import { LanguageSelectModal } from '../../components/LanguageSelectModal';
import { styles, TAB_BAR_HEIGHT } from '../../styles/styles';
import { LanguageCode, t } from '../../utils/i18n';
import * as FileSystem from 'expo-file-system/legacy';
import { getPlaylistSongs } from '../../utils/playlistEvaluator';
import { 
  verifyChordiaSyncSession, 
  syncMusicAndPlaylistsToCloud, 
  registerToastListener, 
  processOfflineQueue 
} from '../../utils/chordiaSync';

export type TabType = 'SYNC' | 'PLAYER' | 'FOCUS' | 'INFO';
export type FocusStageType = 'SETUP' | 'GUIDE' | 'FOCUS';

const TAB_BAR_BOTTOM = 0;
const MINI_PLAYER_GAP = 6;
const MINI_PLAYER_HEIGHT = 58;

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
  'The objective-c `getSleepTimerProgress',
  'The objective-c `setSleepTimer',
  'The objective-c `sleepWhenActiveTrackReachesEnd',
  'The objective-c `clearSleepTimer'
]);

try {
  TrackPlayer.registerPlaybackService(() => require('../../service'));
} catch (e) {
  console.warn('[RNTP] registerPlaybackService error:', e);
}

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<TabType>('PLAYER');
  const [focusStage, setFocusStage] = useState<FocusStageType>('SETUP');
  
  const [playerResetTrigger, setPlayerResetTrigger] = useState(0);
  const [infoResetTrigger, setInfoResetTrigger] = useState(0);
  const [playerOpeningFrame, setPlayerOpeningFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [customAlert, setCustomAlert] = useState<{title: string, message?: string, buttons?: any[]} | null>(null);
  const miniPlayerRef = useRef<ViewInstance>(null);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const useNativeTabBar = Platform.OS === 'ios' && isLiquidGlassAvailable();

  // ★ メニュー目標Y位置をもっと下の方（見やすく操作しやすい位置）に統一
  const menuTargetY = isLandscape 
    ? Math.max(insets.top, 20) + 40 
    : Math.max(insets.top + 75, height * 0.16);

  const {
    isDark, appearanceMode, changeAppearanceMode, soundCheckEnabled, changeSoundCheckEnabled, dynamicStyles, themeColor, themeTextColor, themeR, themeG, themeB, setThemeR, setThemeG, setThemeB,
    isCustomTheme, recentColors, showRGBModal, setShowRGBModal,
    saveColor, applyCustomColor, localLibrary, setLocalLibrary, localPlaylists, setLocalPlaylists,
    showFocusTab, toggleFocusTab, showSyncTab, toggleSyncTab,
    showPlaylistTypeIcon, toggleShowPlaylistTypeIcon,
    language, isLanguageSelected, changeLanguage
  } = useLibraryData();

  const {
    sound, audioEngine, changeAudioEngine,
    isPlaying, currentSong, playbackStatus, playQueue, currentIndex,
    loopMode, toggleLoopMode, isShuffle, toggleShuffleMode,
    isFullPlayer, setIsFullPlayer, showQueue, setShowQueue, showLyrics, setShowLyrics,
    toastVisible, toastMessage, toastAnim, showToast,
    navStackLength, setNavStackLength,
    startQueue, handleNext, handlePrev, togglePlayPause, stopPlayback,
    slideAnim, queueTransitionAnim, closeFullPlayer,
    currentContext,
  } = useAudioPlayer(soundCheckEnabled);

  const [isMiniPlayerMenuVisible, setIsMiniPlayerMenuVisible] = useState(false);
  const [miniPlayerMenuOrigin, setMiniPlayerMenuOrigin] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [libraryNavigateTarget, setLibraryNavigateTarget] = useState<any>(null);

  const openMiniPlayerMenu = (origin?: { x: number; y: number; width: number; height: number }) => {
    if (origin) {
      setMiniPlayerMenuOrigin(origin);
      setIsMiniPlayerMenuVisible(true);
      return;
    }
    const miniPlayer = miniPlayerRef.current;
    if (!miniPlayer) {
      setMiniPlayerMenuOrigin(null);
      setIsMiniPlayerMenuVisible(true);
      return;
    }
    miniPlayer.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setMiniPlayerMenuOrigin({ x, y, width: measuredWidth, height: measuredHeight });
      setIsMiniPlayerMenuVisible(true);
    });
  };

  const closeMiniPlayerMenu = () => {
    setIsMiniPlayerMenuVisible(false);
    setMiniPlayerMenuOrigin(null);
  };

  const handleMiniPlayerNavigatePlaylist = () => {
    setIsMiniPlayerMenuVisible(false);
    if (!currentSong) return;

    let targetPl: any = null;
    if (currentContext && currentContext.type === 'PLAYLIST' && currentContext.playlistID) {
      targetPl = localPlaylists.find((p: any) => p.id === currentContext.playlistID);
    }

    if (!targetPl) {
      const targetFname = currentSong.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
      targetPl = localPlaylists.find((p: any) => {
        if (p.isAll || p.id === 'all_songs') return false;
        if (p.type === 'smart') {
          return getPlaylistSongs(p, localLibrary).some((s: any) => s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase() === targetFname);
        }
        return (Array.isArray(p.music) ? p.music : []).some((m: any) => 
          (typeof m === 'string' ? m : (m?.musicFilename || m?.path || '')).split(/[\\/]/).pop()?.toLowerCase() === targetFname
        );
      });
    }

    if (!targetPl) {
      targetPl = localPlaylists.find((p: any) => p.isAll || p.id === 'all_songs') || {
        id: 'all_songs',
        playlistName: t('all_songs_item', language),
        isAll: true,
      };
    }

    setActiveTab('PLAYER');
    setLibraryNavigateTarget({
      category: 'PLAYLISTS',
      type: 'PLAYLIST',
      data: targetPl,
      timestamp: Date.now(),
    });
  };

  const handleMiniPlayerNavigateAlbum = () => {
    setIsMiniPlayerMenuVisible(false);
    if (!currentSong) return;

    const targetAlbum = {
      album: currentSong.album || 'Unknown Album',
      artist: currentSong.artist || 'Unknown Artist',
      coverArt: currentSong.localImageUri,
    };

    setActiveTab('PLAYER');
    setLibraryNavigateTarget({
      category: 'ALBUMS',
      type: 'ALBUM',
      data: targetAlbum,
      timestamp: Date.now(),
    });
  };

  const handleMiniPlayerNavigateArtist = () => {
    setIsMiniPlayerMenuVisible(false);
    if (!currentSong) return;

    const targetArtist = currentSong.artist || 'Unknown Artist';

    setActiveTab('PLAYER');
    setLibraryNavigateTarget({
      category: 'ARTISTS',
      type: 'ARTIST',
      data: targetArtist,
      timestamp: Date.now(),
    });
  };

  const handleMiniPlayerDeleteFromLibrary = () => {
    if (!currentSong) return;
    const songToDelete = currentSong;
    Alert.alert(
      t('delete_song_permanently_title', language),
      t('delete_song_permanently_desc', language).replace('{name}', songToDelete.title || 'Track'),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete_confirm_btn', language),
          style: 'destructive',
          onPress: async () => {
            try {
              if (songToDelete.localMusicUri && (await FileSystem.getInfoAsync(songToDelete.localMusicUri)).exists) {
                await FileSystem.deleteAsync(songToDelete.localMusicUri, { idempotent: true });
              }
              const remainingLibrary = localLibrary.filter((s: any) => s.localMusicUri !== songToDelete.localMusicUri);
              const targetFname = songToDelete.musicFilename?.split(/[\\/]/).pop();
              const updatedPlaylists = localPlaylists.map((pl: any) =>
                pl.isAll || !pl.music
                  ? pl
                  : { ...pl, music: pl.music.filter((m: string) => m.split(/[\\/]/).pop() !== targetFname) }
              );

              await AsyncStorage.setItem('local_library', JSON.stringify(remainingLibrary));
              await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
              setLocalLibrary(remainingLibrary);
              setLocalPlaylists(updatedPlaylists);
              syncMusicAndPlaylistsToCloud();

              if (currentSong?.localMusicUri === songToDelete.localMusicUri) {
                if (remainingLibrary.length > 0) {
                  handleNext();
                } else {
                  await stopPlayback();
                }
              }
              showToast(t('delete_from_library_done', language));
            } catch (e: any) {
              Alert.alert(t('alert_timer_error_title', language), e.message);
            }
          },
        },
      ]
    );
  };

  const handleMiniPlayerAddToPlaylists = async (selectedIds: Set<string>) => {
    if (!currentSong || selectedIds.size === 0) return;
    const targetPlaylists = localPlaylists.filter((pl: any) => selectedIds.has(pl.id));
    const songFname = currentSong.musicFilename?.split(/[\\/]/).pop();
    if (!songFname) return;

    try {
      let updatedPlaylists = [...localPlaylists];
      for (const pl of targetPlaylists) {
        const currentMusicList = pl.type === 'smart'
          ? getPlaylistSongs(pl, localLibrary).map((s: any) => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean)
          : (Array.isArray(pl.music) ? pl.music : []);
        const newMusicList = Array.from(new Set([...currentMusicList, songFname]));
        updatedPlaylists = updatedPlaylists.map((p: any) =>
          p.id === pl.id ? { ...p, conditions: undefined, type: 'normal', music: newMusicList } : p
        );
      }
      await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
      setLocalPlaylists(updatedPlaylists);
      syncMusicAndPlaylistsToCloud();
      showToast(t('added_to_playlists_done', language));
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const {
    syncStage, setSyncStage, serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput,
    showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls,
    syncProgress, isSyncing, isFullScreenSyncing, requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect,
    setScannedQrData, clientInfo,
    activeConflictSet, resolveCurrentConflict
  } = useSync({ 
    closeFullPlayer, 
    stopAndUnloadPlayer: async () => { await TrackPlayer.stop(); },
    localLibrary, setLocalLibrary, setLocalPlaylists,
    language
  });

  useEffect(() => {
    registerToastListener((msg) => {
      showToast(msg);
    }, language);
  }, [showToast, language]);

  useEffect(() => {
    processOfflineQueue();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        processOfflineQueue();
      }
    });

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        processOfflineQueue();
      }
    }, 20000);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const handleTabPress = (tabKey: string) => {
    if (tabKey !== 'SYNC' && tabKey !== 'PLAYER' && tabKey !== 'FOCUS' && tabKey !== 'INFO') return;
    setActiveTab(tabKey);
    if (tabKey === 'PLAYER') {
      setPlayerResetTrigger(prev => prev + 1);
    } else if (tabKey === 'INFO') {
      setInfoResetTrigger(prev => prev + 1);
    } else if (tabKey === 'FOCUS') {
      if (focusStage === 'GUIDE') {
        setFocusStage('SETUP');
      }
    }
  };

  const openFullPlayer = () => {
    const showPlayer = (frame: { x: number; y: number; width: number; height: number } | null) => {
      setPlayerOpeningFrame(frame);
      if (frame) {
        slideAnim.setValue(0);
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      }
      setIsFullPlayer(true);
    };

    if (!miniPlayerRef.current) {
      showPlayer(null);
      return;
    }

    miniPlayerRef.current.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      showPlayer(measuredWidth > 0 && measuredHeight > 0 ? { x, y, width: measuredWidth, height: measuredHeight } : null);
    });
  };

  useEffect(() => {
    (async () => {
      const isValid = await verifyChordiaSyncSession(false, language);
      if (isValid) {
        syncMusicAndPlaylistsToCloud();
      }
    })();
  }, [activeTab, language]);

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

  const isFocusing = activeTab === 'FOCUS' && focusStage === 'FOCUS';
  const isAppDark = isDark;
  const rootBgColor = isFocusing ? '#000000' : (isAppDark ? '#000000' : '#f2f2f7');
  const statusBarStyle = (isFocusing || isAppDark) ? 'light' : 'dark';

  const actualDynamicStyles = {
    bg: isAppDark ? '#000000' : '#f2f2f7',
    card: isAppDark ? '#1c1c1e' : '#ffffff',
    text: isAppDark ? '#ffffff' : '#000000',
    subText: '#8e8e93',
    border: isAppDark ? '#38383a' : '#d1d1d6',
    blur: isAppDark ? 'dark' as const : 'light' as const,
  };

  useEffect(() => {
    if (!showFocusTab && activeTab === 'FOCUS') {
      setActiveTab('PLAYER');
    }
  }, [showFocusTab]);

  useEffect(() => {
    if (!showSyncTab && activeTab === 'SYNC') {
      setActiveTab('PLAYER');
    }
  }, [showSyncTab]);

  const getAlertIcon = (title: string) => {
    const tStr = title.toLowerCase();
    if (tStr.includes('完了') || tStr.includes('成功') || tStr.includes('設定変更') || tStr.includes('承認') || tStr.includes('success') || tStr.includes('done') || tStr.includes('complete')) {
      return <Ionicons name="checkmark-circle-outline" size={38} color={themeColor} style={{ marginBottom: 12 }} />;
    }
    if (tStr.includes('エラー') || tStr.includes('失敗') || tStr.includes('拒否') || tStr.includes('切断') || tStr.includes('停止') || tStr.includes('error') || tStr.includes('fail') || tStr.includes('stopped') || tStr.includes('disconnected') || tStr.includes('rejected')) {
      return <Ionicons name="alert-circle-outline" size={38} color="#ef4444" style={{ marginBottom: 12 }} />;
    }
    return <Ionicons name="information-circle-outline" size={38} color={themeColor} style={{ marginBottom: 12 }} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: rootBgColor }]}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: rootBgColor, zIndex: -1 }} />
      <StatusBar barStyle={statusBarStyle === 'light' ? 'light-content' : 'dark-content'} />
      
      <View style={{ flex: 1, backgroundColor: rootBgColor }}>
        {showSyncTab && activeTab === 'SYNC' && (
          <SyncScreen 
            dynamicStyles={actualDynamicStyles} 
            themeColor={themeColor} 
            themeTextColor={themeTextColor} 
            syncStage={syncStage} 
            setSyncStage={setSyncStage} 
            serverIp={serverIp} 
            setServerIp={setServerIp} 
            serverPort={serverPort} 
            setServerPort={setServerPort} 
            authCodeInput={authCodeInput} 
            setAuthCodeInput={setAuthCodeInput} 
            showCamera={showCamera} 
            setShowCamera={setShowCamera} 
            requestCameraPermission={requestCameraPermission} 
            pcPlaylists={pcPlaylists} 
            selectedPls={selectedPls} 
            setSelectedPls={setSelectedPls} 
            isSyncing={isSyncing} 
            isDark={isAppDark} 
            requestAuthToPC={requestAuthToPC} 
            verifyAuthCode={verifyAuthCode} 
            startSyncDownload={startSyncDownload} 
            cancelSync={cancelSync} 
            disconnect={disconnect} 
            setScannedQrData={setScannedQrData} 
            clientInfo={clientInfo} 
            insets={insets} 
            currentSong={currentSong}
            language={language}
            localLibrary={localLibrary}
            setLocalLibrary={setLocalLibrary}
            activeConflictSet={activeConflictSet}
            resolveCurrentConflict={resolveCurrentConflict}
          />
        )}
        {activeTab === 'PLAYER' && (
          <Library 
            dynamicStyles={actualDynamicStyles} 
            themeColor={themeColor} 
            startQueue={startQueue} 
            currentSong={currentSong} 
            localLibrary={localLibrary} 
            setLocalLibrary={setLocalLibrary} 
            localPlaylists={localPlaylists} 
            setLocalPlaylists={setLocalPlaylists} 
            setNavStackLength={setNavStackLength} 
            insets={insets} 
            isDark={isAppDark} 
            showPlaylistTypeIcon={showPlaylistTypeIcon}
            language={language}
            showToast={showToast}
            resetTrigger={playerResetTrigger}
            libraryNavigateTarget={libraryNavigateTarget}
          />
        )}
        {showFocusTab && activeTab === 'FOCUS' && (
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
            language={language} 
          />
        )}
        {activeTab === 'INFO' && (
          <InfoScreen 
            dynamicStyles={actualDynamicStyles} 
            themeColor={themeColor} 
            themeTextColor={themeTextColor} 
            isCustomTheme={isCustomTheme} 
            themeR={themeR} 
            themeG={themeG} 
            themeB={themeB} 
            recentColors={recentColors} 
            setThemeR={setThemeR} 
            setThemeG={setThemeG} 
            setThemeB={setThemeB} 
            showRGBModal={showRGBModal} 
            setShowRGBModal={setShowRGBModal} 
            saveColor={saveColor} 
            applyCustomColor={applyCustomColor} 
            appearanceMode={appearanceMode}
            changeAppearanceMode={changeAppearanceMode}
            soundCheckEnabled={soundCheckEnabled}
            changeSoundCheckEnabled={changeSoundCheckEnabled}
            insets={insets} 
            audioEngine={audioEngine} 
            changeAudioEngine={changeAudioEngine} 
            showFocusTab={showFocusTab} 
            toggleFocusTab={toggleFocusTab} 
            showSyncTab={showSyncTab} 
            toggleSyncTab={toggleSyncTab} 
            showPlaylistTypeIcon={showPlaylistTypeIcon} 
            toggleShowPlaylistTypeIcon={toggleShowPlaylistTypeIcon} 
            language={language} 
            changeLanguage={changeLanguage} 
            localLibrary={localLibrary} 
            setLocalLibrary={setLocalLibrary} 
            localPlaylists={localPlaylists} 
            setLocalPlaylists={setLocalPlaylists} 
            isDark={isAppDark} 
            isLandscape={isLandscape} 
            resetTrigger={infoResetTrigger}
          />
        )}
      </View>

      {!isFocusing && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none', zIndex: 100 }]}>
          {currentSong && !isFullPlayer && !isLandscape && (
            <Animated.View style={[
              styles.commonWrapperPortrait,
              {
                left: '4%',
                right: undefined,
                width: '92%',
                height: MINI_PLAYER_HEIGHT,
                bottom: TAB_BAR_BOTTOM + TAB_BAR_HEIGHT + (useNativeTabBar ? insets.bottom : 0) + MINI_PLAYER_GAP,
                shadowOpacity: 0.1, 
                elevation: 10 
              }
            ]}>
              <View ref={miniPlayerRef} collapsable={false} style={{ width: '100%' }}>
                <MiniPlayer
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  dynamicStyles={actualDynamicStyles}
                  onPress={openFullPlayer}
                  onLongPress={openMiniPlayerMenu}
                  menuTargetY={menuTargetY}
                  togglePlayPause={togglePlayPause}
                  handleNext={handleNext}
                />
              </View>
            </Animated.View>
          )}

          {!isLandscape && (
            <View style={[
              styles.commonWrapperPortrait,
              {
                bottom: TAB_BAR_BOTTOM,
                height: TAB_BAR_HEIGHT + (useNativeTabBar ? insets.bottom : 0),
                justifyContent: 'flex-end',
              },
            ]}>
              <TabBar 
                activeTab={activeTab} 
                setActiveTab={handleTabPress} 
                themeColor={themeColor} 
                themeTextColor={themeTextColor} 
                isDark={isAppDark} 
                isBlurBackground={false} 
                showFocusTab={showFocusTab} 
                showSyncTab={showSyncTab} 
                bottomInset={useNativeTabBar ? insets.bottom : 0}
                language={language}
              />
            </View>
          )}

          {isLandscape && (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: TAB_BAR_BOTTOM,
                height: TAB_BAR_HEIGHT + (useNativeTabBar ? insets.bottom : 0),
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: currentSong && !isFullPlayer ? '50%' : '100%', height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 8 }}>
                <TabBar
                  activeTab={activeTab}
                  setActiveTab={handleTabPress}
                  themeColor={themeColor}
                  themeTextColor={themeTextColor}
                  isDark={isAppDark}
                  isBlurBackground={false}
                  showFocusTab={showFocusTab}
                  showSyncTab={showSyncTab}
                  bottomInset={useNativeTabBar ? insets.bottom : 0}
                  language={language}
                />
              </View>
              {currentSong && !isFullPlayer && (
                <View style={{ width: '50%', height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 20 }}>
                  <View ref={miniPlayerRef} collapsable={false} style={{ width: '100%' }}>
                    <MiniPlayer
                      currentSong={currentSong}
                      isPlaying={isPlaying}
                      dynamicStyles={actualDynamicStyles}
                      onPress={openFullPlayer}
                      onLongPress={openMiniPlayerMenu}
                      menuTargetY={menuTargetY}
                      togglePlayPause={togglePlayPause}
                      handleNext={handleNext}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <Modal visible={isFullScreenSyncing} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.fullScreenModalOverlay}>
          <View style={[styles.fullScreenModalContent, { backgroundColor: actualDynamicStyles.card, paddingBottom: 25 }]}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={[styles.fullScreenModalText, { color: actualDynamicStyles.text, textAlign: 'center', marginBottom: 25 }]}>{syncProgress}</Text>
            
            <TouchableOpacity
              style={{
                backgroundColor: useNativeTabBar ? 'transparent' : '#ef4444',
                paddingVertical: 12,
                paddingHorizontal: 35,
                borderRadius: 25,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }}
              onPress={cancelSync}
            >
              {useNativeTabBar && (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  isInteractive
                  tintColor="rgba(239,68,68,0.28)"
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'center' }}>{t('cancel', language)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isFullPlayer} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <FullScreenPlayer 
          dynamicStyles={actualDynamicStyles} 
          themeColor={themeColor} 
          themeTextColor={themeTextColor} 
          currentSong={currentSong} 
          isPlaying={isPlaying} 
          playbackStatus={playbackStatus} 
          sound={sound} 
          playQueue={playQueue} 
          currentIndex={currentIndex} 
          loopMode={loopMode} 
          isShuffle={isShuffle} 
          showQueue={showQueue} 
          showLyrics={showLyrics} 
          toggleLoopMode={toggleLoopMode} 
          toggleShuffleMode={toggleShuffleMode} 
          setShowQueue={setShowQueue} 
          setShowLyrics={setShowLyrics} 
          handlePrev={handlePrev} 
          togglePlayPause={togglePlayPause} 
          handleNext={handleNext} 
          slideAnim={slideAnim} 
          queueTransitionAnim={queueTransitionAnim} 
          closeFullPlayer={closeFullPlayer} 
          toastVisible={toastVisible} 
          toastMessage={toastMessage} 
          toastAnim={toastAnim} 
          currentContext={currentContext}
          openingFrame={playerOpeningFrame}
          language={language}
        />
      </Modal>

      <Modal visible={!!customAlert} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
          <View style={[styles.liquidAlertBox, { overflow: 'hidden' }]}>
            {useNativeTabBar ? (
              <GlassView
                pointerEvents="none"
                glassEffectStyle="regular"
                colorScheme={isAppDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <BlurView
                intensity={isAppDark ? 75 : 95}
                tint={isAppDark ? 'dark' : 'light'}
                style={[StyleSheet.absoluteFill, {
                  borderColor: isAppDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.65)',
                  backgroundColor: isAppDark ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.6)',
                }]}
              />
            )}
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
                      (btn.style === 'cancel' || btn.text === 'キャンセル' || btn.text === t('cancel', language)) && { color: actualDynamicStyles.subText, fontWeight: 'normal' }
                    ]}>{btn.text || 'OK'}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <TouchableOpacity activeOpacity={0.7} style={[styles.liquidAlertButton, { borderRightWidth: 0 }]} onPress={() => setCustomAlert(null)}>
                  <Text style={[styles.liquidAlertButtonText, { color: themeColor }]}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <LanguageSelectModal 
        visible={isLanguageSelected === false}
        currentLanguage={language}
        onSelectLanguage={(newLang: LanguageCode) => {
          changeLanguage(newLang);
        }}
        onClose={() => setCustomAlert(null)}
        dynamicStyles={actualDynamicStyles}
        themeColor={themeColor}
        textColor={themeTextColor}
        isDark={isAppDark}
        canClose={false}
      />

      {toastVisible && !isFullPlayer && (
        <Animated.View 
          style={[
            styles.toastContainerTopRight, 
            { 
              top: insets.top + (isLandscape ? 8 : 12),
              right: 16,
              opacity: toastAnim, 
              transform: [
                { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
                { scale: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }
              ] 
            }
          ]}
        >
          <BlurView 
            intensity={isAppDark ? 80 : 90} 
            tint={isAppDark ? 'dark' : 'light'} 
            style={[
              styles.toastBlurNew, 
              { 
                borderColor: isAppDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isAppDark ? 'rgba(24,24,27,0.85)' : 'rgba(255,255,255,0.88)',
              }
            ]}
          >
            <View style={[styles.toastIconBox, { backgroundColor: `rgba(${themeR || 79}, ${themeG || 70}, ${themeB || 229}, 0.16)` }]}>
              <Ionicons name="cloud-offline-outline" size={18} color={themeColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text 
                style={[styles.toastTextNew, { color: actualDynamicStyles.text }]}
                numberOfLines={2}
              >
                {toastMessage}
              </Text>
            </View>
          </BlurView>
        </Animated.View>
      )}

      <MiniPlayerMenuModal
        visible={isMiniPlayerMenuVisible}
        onClose={closeMiniPlayerMenu}
        origin={miniPlayerMenuOrigin}
        currentSong={currentSong}
        localPlaylists={localPlaylists}
        localLibrary={localLibrary}
        dynamicStyles={actualDynamicStyles}
        themeColor={themeColor}
        isDark={isAppDark}
        insets={insets}
        isLandscape={isLandscape}
        width={width}
        height={height}
        language={language}
        showPlaylistTypeIcon={showPlaylistTypeIcon}
        onNavigateToPlaylist={handleMiniPlayerNavigatePlaylist}
        onNavigateToAlbum={handleMiniPlayerNavigateAlbum}
        onNavigateToArtist={handleMiniPlayerNavigateArtist}
        onDeleteFromLibrary={handleMiniPlayerDeleteFromLibrary}
        onAddSongToPlaylists={handleMiniPlayerAddToPlaylists}
      />
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
