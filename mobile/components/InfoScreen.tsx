import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Animated, StyleSheet, 
  TouchableWithoutFeedback, useWindowDimensions, Easing 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { t } from '../utils/i18n';

import { InfoSettingsView } from './info/InfoSettingsView';
import { InfoStatisticsView, InfoAllHistoryView, InfoPlaybackHistoryView } from './info/InfoStatisticsView';
import { InfoManageDataView } from './info/InfoManageDataView';
import { InfoEditSongView } from './info/InfoEditSongView';
import { InfoLicenseView } from './info/InfoLicenseView';

const HISTORY_KEY = 'chordia_focus_history';

const AnimatedMenuButton = ({ onPress, isDark, textStyle, disabled = false }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => { if (!disabled) Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start(); };
  const handlePressOut = () => { if (!disabled) Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start(); };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={disabled}>
      <Animated.View style={{ width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', opacity: disabled ? 0.4 : 1, transform: [{ scale }] }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={textStyle} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const AnimatedCancelButton = ({ onPress, dynamicStyles, label }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={{ backgroundColor: dynamicStyles.card, borderRadius: 16, height: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dynamicStyles.border, transform: [{ scale }] }}>
        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{label || 'キャンセル'}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const InfoScreen = ({ 
  dynamicStyles, themeColor, themeTextColor, isCustomTheme, 
  themeR, themeG, themeB, recentColors, setThemeR, setThemeG, setThemeB, 
  showRGBModal, setShowRGBModal, saveColor, applyCustomColor, 
  insets, audioEngine, changeAudioEngine, showFocusTab, toggleFocusTab, 
  showSyncTab, toggleSyncTab, showPlaylistTypeIcon = true, toggleShowPlaylistTypeIcon,
  language = 'ja', changeLanguage,
  localLibrary = [], setLocalLibrary, localPlaylists = [], setLocalPlaylists,
  isDark, isLandscape 
}: any) => {
  const { width } = useWindowDimensions();
  const textColor = themeTextColor || '#ffffff';

  const [navStack, setNavStack] = useState<string[]>(['MENU']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const backButtonScale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;

  const [focusHistory, setFocusHistory] = useState<any[]>([]);

  const [actionSheetTargetSongs, setActionSheetTargetSongs] = useState<any[] | null>(null);
  const [songInfoModalTargetSongs, setSongInfoModalTargetSongs] = useState<any[] | null>(null);
  const [addToPlaylistTargetSongs, setAddToPlaylistTargetSongs] = useState<any[] | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [editingTargetSongs, setEditingTargetSongs] = useState<any[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [editDisc, setEditDisc] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editLyric, setEditLyric] = useState('');

  const menuItems = [
    { title: t('menu_settings', language), icon: 'options-outline' as const, view: 'SETTINGS', sub: t('menu_settings_sub', language) },
    { title: t('menu_statistics', language), icon: 'stats-chart-outline' as const, view: 'STATISTICS', sub: t('menu_statistics_sub', language) },
    { title: t('menu_manage_data', language), icon: 'server-outline' as const, view: 'MANAGE_DATA', sub: t('menu_manage_data_sub', language) },
    { title: t('menu_license', language), icon: 'document-text-outline' as const, view: 'LICENSE', sub: t('menu_license_sub', language) },
  ];

  const openActionSheet = (songs: any[]) => {
    if (!songs || songs.length === 0) return;
    setActionSheetTargetSongs(songs);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const closeActionSheet = (callback?: () => void) => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setActionSheetTargetSongs(null);
      if (callback) callback();
    });
  };

  const loadHistory = async () => {
    try {
      const res = await AsyncStorage.getItem(HISTORY_KEY);
      if (res) setFocusHistory(JSON.parse(res));
    } catch (e) {}
  };

  useEffect(() => { loadHistory(); }, []);

  const getCommonValue = (songs: any[], key: string, fallback: string = '<維持>') => {
    if (!songs || songs.length === 0) return '';
    if (songs.length === 1) {
      const val = songs[0][key];
      return val !== undefined && val !== null ? String(val) : '';
    }
    const firstVal = songs[0][key] ?? '';
    const allSame = songs.every(s => (s[key] ?? '') === firstVal);
    return allSame ? (firstVal !== '' ? String(firstVal) : '') : fallback;
  };

  const openEditSongs = (songs: any[]) => {
    setEditingTargetSongs(songs);
    const isMulti = songs.length > 1;
    const keepStr = t('keep_label', language);
    setEditTitle(getCommonValue(songs, 'title', isMulti ? keepStr : ''));
    setEditArtist(getCommonValue(songs, 'artist', isMulti ? keepStr : ''));
    setEditAlbum(getCommonValue(songs, 'album', isMulti ? keepStr : ''));
    setEditTrack(getCommonValue(songs, 'track', isMulti ? keepStr : ''));
    setEditDisc(getCommonValue(songs, 'disc', isMulti ? keepStr : ''));
    setEditYear(getCommonValue(songs, 'year', isMulti ? keepStr : ''));
    setEditLyric(getCommonValue(songs, 'lyric', isMulti ? keepStr : ''));
    pushView('EDIT_SONG');
  };

  const saveEditedSongs = async () => {
    if (!editingTargetSongs || editingTargetSongs.length === 0) return;
    const targetUriSet = new Set(editingTargetSongs.map(s => s.localMusicUri));
    const keepStr = t('keep_label', language);

    const updatedLibrary = localLibrary.map((s: any) => {
      if (targetUriSet.has(s.localMusicUri)) {
        const updated = { ...s };
        if (editTitle !== keepStr) updated.title = editTitle.trim() || 'Untitled';
        if (editArtist !== keepStr) updated.artist = editArtist.trim() || 'Unknown Artist';
        if (editAlbum !== keepStr) updated.album = editAlbum.trim() || 'Unknown Album';
        if (editTrack !== keepStr) updated.track = editTrack.trim() ? parseInt(editTrack.trim(), 10) : undefined;
        if (editDisc !== keepStr) updated.disc = editDisc.trim() ? parseInt(editDisc.trim(), 10) : undefined;
        if (editYear !== keepStr) updated.year = editYear.trim() ? parseInt(editYear.trim(), 10) : undefined;
        if (editLyric !== keepStr) updated.lyric = editLyric;
        return updated;
      }
      return s;
    });

    try {
      await AsyncStorage.setItem('local_library', JSON.stringify(updatedLibrary));
      if (setLocalLibrary) setLocalLibrary(updatedLibrary);
      popView();
    } catch (e: any) {}
  };

  const currentProgress = Animated.subtract(navAnim, Animated.divide(panX, width));
  const layerBorderStyle = { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' };
  const layer1Translate = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -width * 0.25, -width * 0.25], extrapolate: 'clamp' });
  const layer1Darken = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.4, 0.4], extrapolate: 'clamp' });
  const layer2Translate = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [width, 0, -width * 0.25], extrapolate: 'clamp' });
  const layer2Darken = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0, 0.4], extrapolate: 'clamp' });
  const layer3Translate = currentProgress.interpolate({ inputRange: [1, 2], outputRange: [width, 0], extrapolate: 'clamp' });

  const pushView = (view: string) => {
    if (isNavAnimating.current) return;
    isNavAnimating.current = true;
    const next = navStack.length;
    setNavStack([...navStack, view]);
    Animated.spring(navAnim, { toValue: next, useNativeDriver: true, stiffness: 300, damping: 30, mass: 0.8, overshootClamping: true }).start(() => { isNavAnimating.current = false; });
  };

  const popView = () => {
    if (isNavAnimating.current || navStack.length <= 1) return;
    isNavAnimating.current = true;
    panX.setValue(0);
    const prev = navStack.length - 2;
    Animated.spring(navAnim, { toValue: prev, useNativeDriver: true, stiffness: 300, damping: 30, mass: 0.8, overshootClamping: true }).start(() => {
      setNavStack(navStack.slice(0, -1));
      isNavAnimating.current = false;
    });
  };

  const onGestureEvent = Animated.event([{ nativeEvent: { translationX: panX } }], { useNativeDriver: true });
  const onHandlerStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;
    if (state === State.END || state === State.CANCELLED) {
      if (translationX > width / 4 || velocityX > 300) {
        if (isNavAnimating.current) return;
        isNavAnimating.current = true;
        Animated.timing(panX, { toValue: width, duration: 250, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }).start(() => {
          const nextStack = navStack.slice(0, -1);
          setNavStack(nextStack);
          panX.setValue(0);
          navAnim.setValue(nextStack.length - 1);
          isNavAnimating.current = false;
        });
      } else {
        Animated.spring(panX, { toValue: 0, useNativeDriver: true, stiffness: 300, damping: 30, mass: 0.8, overshootClamping: true }).start();
      }
    }
  };

  const handlePressIn = () => { Animated.spring(backButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handlePressOut = () => { Animated.spring(backButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const renderHeader = (title: string, rightElement?: React.ReactNode) => (
    <View style={[styles.navHeader, { paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0), paddingLeft: isLandscape ? Math.max(insets?.left || 0, 15) : 15, paddingRight: isLandscape ? Math.max(insets?.right || 0, 15) : 15 }]}>
      <View style={styles.navHeaderLeft}>
        {navStack.length > 1 && (
          <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
            <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
              <View style={[styles.liquidGlassBackButton, { backgroundColor: isDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)', borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)' }]}>
                <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}
      </View>
      <Text style={[styles.navHeaderTitle, { color: dynamicStyles.text }]} numberOfLines={1}>{title}</Text>
      <View style={[styles.navHeaderRight, { width: undefined, minWidth: 60, alignItems: 'flex-end', justifyContent: 'center' }]}>
        {rightElement}
      </View>
    </View>
  );

  const safePadding = {
    paddingBottom: (isLandscape ? 50 : 180) + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
    paddingRight: isLandscape ? (Math.max(insets?.right || 0, 20) + LANDSCAPE_TAB_BAR_WIDTH + 16) : 20,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

      <PanGestureHandler activeOffsetX={[-500, 10]} failOffsetY={[-15, 15]} enabled={navStack.length > 1} onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
        <View style={{ flex: 1 }}>
          {/* Layer 1: メインメニュー */}
          <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer1Translate }] }]}>
            <View style={[styles.headerBar, { borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0), paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20, paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20 }]}>
              <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>{t('tab_info', language)}</Text>
            </View>
            <FlatList
              data={menuItems}
              keyExtractor={item => item.view}
              renderItem={({ item, index }) => (
                <TouchableOpacity style={[styles.menuRow, index !== menuItems.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} onPress={() => pushView(item.view)}>
                  <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.menuRowTitle, { color: dynamicStyles.text }]}>{item.title}</Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
                </TouchableOpacity>
              )}
              contentContainerStyle={safePadding}
            />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer1Darken }]} />
          </Animated.View>

          {/* Layer 2: 設定 / 統計 / データを管理 / ライセンス */}
          {navStack.length > 1 && (
            <Animated.View style={[StyleSheet.absoluteFill, layerBorderStyle, { zIndex: 2, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer2Translate }] }]}>
              {navStack[1] === 'SETTINGS' && (
                <InfoSettingsView 
                  dynamicStyles={dynamicStyles} themeColor={themeColor} textColor={textColor} isCustomTheme={isCustomTheme} isDark={isDark}
                  themeR={themeR} themeG={themeG} themeB={themeB} recentColors={recentColors} setThemeR={setThemeR} setThemeG={setThemeG} setThemeB={setThemeB}
                  showRGBModal={showRGBModal} setShowRGBModal={setShowRGBModal} saveColor={saveColor} applyCustomColor={applyCustomColor}
                  audioEngine={audioEngine} changeAudioEngine={changeAudioEngine} showFocusTab={showFocusTab} toggleFocusTab={toggleFocusTab}
                  showSyncTab={showSyncTab} toggleSyncTab={toggleSyncTab} showPlaylistTypeIcon={showPlaylistTypeIcon} toggleShowPlaylistTypeIcon={toggleShowPlaylistTypeIcon}
                  language={language} changeLanguage={changeLanguage}
                  renderHeader={renderHeader} safePadding={safePadding} isLandscape={isLandscape}
                />
              )}
              {navStack[1] === 'STATISTICS' && (
                <InfoStatisticsView 
                  dynamicStyles={dynamicStyles} themeColor={themeColor} isDark={isDark} isLandscape={isLandscape} safePadding={safePadding}
                  focusHistory={focusHistory} pushView={pushView} renderHeader={renderHeader}
                  language={language}
                />
              )}
              {navStack[1] === 'MANAGE_DATA' && (
                <InfoManageDataView 
                  dynamicStyles={dynamicStyles} themeColor={themeColor} textColor={textColor} isDark={isDark} isLandscape={isLandscape} safePadding={safePadding} insets={insets}
                  localLibrary={localLibrary} setLocalLibrary={setLocalLibrary} localPlaylists={localPlaylists} setLocalPlaylists={setLocalPlaylists}
                  showPlaylistTypeIcon={showPlaylistTypeIcon} openEditSongs={openEditSongs} renderHeader={renderHeader}
                  AnimatedMenuButton={AnimatedMenuButton} AnimatedCancelButton={AnimatedCancelButton}
                  sheetAnim={sheetAnim} openActionSheet={openActionSheet} closeActionSheet={closeActionSheet}
                  actionSheetTargetSongs={actionSheetTargetSongs} songInfoModalTargetSongs={songInfoModalTargetSongs} setSongInfoModalTargetSongs={setSongInfoModalTargetSongs}
                  addToPlaylistTargetSongs={addToPlaylistTargetSongs} setAddToPlaylistTargetSongs={setAddToPlaylistTargetSongs} getCommonValue={getCommonValue}
                  language={language}
                />
              )}
              {navStack[1] === 'LICENSE' && (
                <InfoLicenseView dynamicStyles={dynamicStyles} themeColor={themeColor} isDark={isDark} safePadding={safePadding} renderHeader={renderHeader} language={language} />
              )}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer2Darken }]} />
            </Animated.View>
          )}

          {/* Layer 3: 集中全履歴 / 楽曲再生履歴 / 楽曲情報編集 */}
          {navStack.length > 2 && (
            <Animated.View style={[StyleSheet.absoluteFill, layerBorderStyle, { zIndex: 3, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer3Translate }] }]}>
              {navStack[2] === 'STATS_ALL' && (
                <InfoAllHistoryView dynamicStyles={dynamicStyles} themeColor={themeColor} focusHistory={focusHistory} safePadding={safePadding} renderHeader={renderHeader} language={language} />
              )}
              {navStack[2] === 'PLAY_HISTORY' && (
                <InfoPlaybackHistoryView dynamicStyles={dynamicStyles} themeColor={themeColor} safePadding={safePadding} renderHeader={renderHeader} language={language} />
              )}
              {navStack[2] === 'EDIT_SONG' && (
                <InfoEditSongView 
                  dynamicStyles={dynamicStyles} themeColor={themeColor} textColor={textColor} safePadding={safePadding}
                  editingTargetSongs={editingTargetSongs} editTitle={editTitle} setEditTitle={setEditTitle} editArtist={editArtist} setEditArtist={setEditArtist}
                  editAlbum={editAlbum} setEditAlbum={setEditAlbum} editTrack={editTrack} setEditTrack={setEditTrack} editDisc={editDisc} setEditDisc={setEditDisc}
                  editYear={editYear} setEditYear={setEditYear} editLyric={editLyric} setEditLyric={setEditLyric} saveEditedSongs={saveEditedSongs} renderHeader={renderHeader}
                  language={language}
                />
              )}
            </Animated.View>
          )}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};