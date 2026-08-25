import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, Animated, StyleSheet, TouchableWithoutFeedback, 
  useWindowDimensions, Easing, Alert, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { getPlaylistFirstArt, getPlaylistSongs } from '../utils/playlistEvaluator';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

import { LibraryMenuView } from './library/LibraryMenuView';
import { LibraryCategoryView } from './library/LibraryCategoryView';
import { LibrarySongListView } from './library/LibrarySongListView';
import { LibraryModals } from './library/LibraryModals';

const DEFAULT_ICON = require('../assets/images/icon.png');

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{ width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', marginLeft: 8, transform: [{ scale }] }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={textStyle} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const AnimatedCancelButton = ({ onPress, dynamicStyles }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={{ backgroundColor: dynamicStyles.card, borderRadius: 16, height: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dynamicStyles.border, transform: [{ scale }] }}>
        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>キャンセル</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const Library = ({ 
  dynamicStyles, themeColor, startQueue, currentSong, 
  localLibrary = [], setLocalLibrary, localPlaylists = [], setLocalPlaylists,
  setNavStackLength, insets, isDark, showPlaylistTypeIcon = true 
}: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [navStack, setNavStack] = useState<string[]>(['MENU']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const backButtonScale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;

  const [recentlyPlayedSongs, setRecentlyPlayedSongs] = useState<any[]>([]);
  const [recentlyPlayedCollections, setRecentlyPlayedCollections] = useState<any[]>([]);
  
  const [currentSelectionType, setCurrentSelectionType] = useState<string | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<any>(null);
  const [currentAlbum, setCurrentAlbum] = useState<any>(null);
  const [currentArtist, setCurrentArtist] = useState<string | null>(null);
  const [albumsList, setAlbumsList] = useState<any[]>([]);
  const [artistsList, setArtistsList] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // モーダル用 State
  const [actionSheetSong, setActionSheetSong] = useState<any>(null);
  const [songInfoModalTarget, setSongInfoModalTarget] = useState<any>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<any>(null);
  const [selectedPlaylistsForAdd, setSelectedPlaylistsForAdd] = useState<Set<string>>(new Set());
  const [editingSong, setEditingSong] = useState<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [editDisc, setEditDisc] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editLyric, setEditLyric] = useState('');

  const flatListRefPortrait = useRef<any>(null);
  const flatListRefLandscape = useRef<any>(null);

  const safePadding = {
    paddingBottom: (isLandscape ? 50 : 180) + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 16) : 0,
    paddingRight: isLandscape ? (Math.max(insets?.right || 0, 16) + LANDSCAPE_TAB_BAR_WIDTH + 16) : 0,
  };

  const openActionSheet = (song: any) => {
    setActionSheetSong(song);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const closeActionSheet = (callback?: () => void) => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setActionSheetSong(null);
      if (callback) callback();
    });
  };

  const closeAddToPlaylistModal = () => {
    setAddToPlaylistSong(null);
    setSelectedPlaylistsForAdd(new Set());
  };

  useEffect(() => { if (setNavStackLength) setNavStackLength(navStack.length); }, [navStack]);

  useEffect(() => {
    if (!localLibrary) return;
    const aMap = new Map();
    const artMap = new Map();
    localLibrary.forEach((s: any) => {
      const ak = `${s.album}:::${s.artist}`;
      if (!aMap.has(ak)) aMap.set(ak, { album: s.album, artist: s.artist, songs: [] });
      aMap.get(ak).songs.push(s);
      if (!artMap.has(s.artist)) artMap.set(s.artist, []);
      artMap.get(s.artist).push(s);
    });
    setAlbumsList(Array.from(aMap.values()).map(a => ({ ...a, coverArt: [...a.songs].sort((x: any, y: any) => (x.title || '').localeCompare(y.title || '', 'ja'))[0]?.localImageUri })));
    setArtistsList(Array.from(artMap.entries()).map(([n, ss]) => ({ artistName: n, coverArt: [...(ss as any[])].sort((x: any, y: any) => (x.title || '').localeCompare(y.title || '', 'ja'))[0]?.localImageUri })));
  }, [localLibrary]);

  useEffect(() => { loadHistory(); }, [currentSong, navStack]);

  const loadHistory = async () => {
    const rs = await AsyncStorage.getItem('recently_played_songs');
    const rc = await AsyncStorage.getItem('recently_played_collections');
    const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
    const fixUri = (uri: string | null | undefined) => uri ? (uri.split(/[\\/]/).pop() ? baseDir + uri.split(/[\\/]/).pop() : uri) : uri;

    if (rs) setRecentlyPlayedSongs(JSON.parse(rs).map((s: any) => ({ ...s, localMusicUri: fixUri(s.localMusicUri), localImageUri: fixUri(s.localImageUri) })));
    if (rc) setRecentlyPlayedCollections(JSON.parse(rc).map((c: any) => ({ ...c, art: c.art?.uri ? { ...c.art, uri: fixUri(c.art.uri) } : c.art, data: c.data?.localCoverImageUri ? { ...c.data, localCoverImageUri: fixUri(c.data.localCoverImageUri) } : c.data })));
  };

  const saveCollectionToHistory = async (item: any) => {
    try {
      const rc = await AsyncStorage.getItem('recently_played_collections');
      let list = rc ? JSON.parse(rc) : [];
      list = [item, ...list.filter((c: any) => c.id !== item.id)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_collections', JSON.stringify(list));
      setRecentlyPlayedCollections(list);
    } catch (e) {}
  };

  const availablePlaylistsForSong = useMemo(() => {
    if (!addToPlaylistSong || !localPlaylists) return [];
    const targetFname = addToPlaylistSong.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
    if (!targetFname) return [];

    return localPlaylists.filter((pl: any) => {
      if (pl.isAll || pl.id === 'all_songs') return false;
      if (pl.type === 'smart') {
        return !getPlaylistSongs(pl, localLibrary).some((s: any) => s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase() === targetFname);
      }
      return !(Array.isArray(pl.music) ? pl.music : []).some((m: any) => (typeof m === 'string' ? m : (m?.musicFilename || m?.path || '')).split(/[\\/]/).pop()?.toLowerCase() === targetFname);
    });
  }, [addToPlaylistSong, localPlaylists, localLibrary]);

  const handleAddSongToPlaylists = async () => {
    if (selectedPlaylistsForAdd.size === 0 || !addToPlaylistSong) return;
    const targetPlaylists = localPlaylists.filter((pl: any) => selectedPlaylistsForAdd.has(pl.id));
    const hasSmart = targetPlaylists.some((pl: any) => pl.type === 'smart');
    const songFname = addToPlaylistSong.musicFilename?.split(/[\\/]/).pop();
    if (!songFname) return;

    const processAdd = async () => {
      try {
        let updatedPlaylists = [...localPlaylists];
        for (const pl of targetPlaylists) {
          const currentMusicList = pl.type === 'smart' 
            ? getPlaylistSongs(pl, localLibrary).map((s: any) => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean)
            : (Array.isArray(pl.music) ? pl.music : []);
          const newMusicList = Array.from(new Set([...currentMusicList, songFname]));
          updatedPlaylists = updatedPlaylists.map(p => p.id === pl.id ? { ...p, conditions: undefined, type: 'normal', music: newMusicList } : p);
        }
        await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
        if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
        setAddToPlaylistSong(null);
        setSelectedPlaylistsForAdd(new Set());
        Alert.alert('完了', '選択したプレイリストに楽曲を追加しました。');
      } catch (e: any) { Alert.alert('エラー', '追加に失敗しました: ' + e.message); }
    };

    if (hasSmart) {
      Alert.alert('プレイリストの変換', 'スマートプレイリストが含まれています。曲を追加すると通常プレイリストに変換されますが続行しますか？', [{ text: 'キャンセル', style: 'cancel' }, { text: '変換して追加', style: 'destructive', onPress: processAdd }]);
    } else { await processAdd(); }
  };

  const handleRemoveFromCurrentPlaylist = (song: any) => {
    if (!currentPlaylist || currentPlaylist.isAll || currentPlaylist.id === 'all_songs') return;
    const songFname = song.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
    if (!songFname) return;

    if (currentPlaylist.type === 'smart') {
      Alert.alert('プレイリストの変換と削除', `「${currentPlaylist.playlistName}」はスマートプレイリストです。\n曲を個別削除すると通常のプレイリストに変換されます。\n(端末内の楽曲ファイルは削除されません)\n続行しますか？`, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '変換して削除', style: 'destructive', onPress: async () => {
          const remainingFilenames = getPlaylistSongs(currentPlaylist, localLibrary).filter((s: any) => s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase() !== songFname).map((s: any) => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean);
          const updatedPlaylists = localPlaylists.map((p: any) => p.id === currentPlaylist.id ? { ...p, conditions: undefined, type: 'normal', music: remainingFilenames } : p);
          await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
          if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
          setCurrentPlaylist(updatedPlaylists.find((p: any) => p.id === currentPlaylist.id));
        }}
      ]);
    } else {
      Alert.alert('プレイリストから削除', `「${currentPlaylist.playlistName}」から「${song.title || 'この曲'}」を削除しますか？\n(端末内の楽曲ファイルは削除されません)`, [
        { text: 'キャンセル', style: 'cancel' },
        { text: '削除', style: 'destructive', onPress: async () => {
          const remainingFilenames = (Array.isArray(currentPlaylist.music) ? currentPlaylist.music : []).filter((m: any) => (typeof m === 'string' ? m : (m?.musicFilename || m?.path || '')).split(/[\\/]/).pop()?.toLowerCase() !== songFname);
          const updatedPlaylists = localPlaylists.map((p: any) => p.id === currentPlaylist.id ? { ...p, music: remainingFilenames } : p);
          await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
          if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
          setCurrentPlaylist(updatedPlaylists.find((p: any) => p.id === currentPlaylist.id));
        }}
      ]);
    }
  };

  const handleDeleteSongPermanently = (song: any) => {
    Alert.alert('ライブラリから楽曲を削除', `「${song.title || 'この曲'}」をライブラリおよび端末から完全に削除しますか？\n(この操作は取り消せません)`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: async () => {
        try {
          if (song.localMusicUri && (await FileSystem.getInfoAsync(song.localMusicUri)).exists) await FileSystem.deleteAsync(song.localMusicUri, { idempotent: true });
          const remainingLibrary = localLibrary.filter((s: any) => s.localMusicUri !== song.localMusicUri);
          const targetFname = song.musicFilename?.split(/[\\/]/).pop();
          const updatedPlaylists = localPlaylists.map((pl: any) => pl.isAll || !pl.music ? pl : { ...pl, music: pl.music.filter((m: string) => m.split(/[\\/]/).pop() !== targetFname) });
          await AsyncStorage.setItem('local_library', JSON.stringify(remainingLibrary));
          await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
          if (setLocalLibrary) setLocalLibrary(remainingLibrary);
          if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
        } catch (e: any) { Alert.alert('エラー', '削除に失敗しました: ' + e.message); }
      }}
    ]);
  };

  const openEditSongModal = (song: any) => {
    setEditingSong(song);
    setEditTitle(song.title || ''); setEditArtist(song.artist || ''); setEditAlbum(song.album || '');
    setEditTrack(song.track ? String(song.track) : ''); setEditDisc(song.disc ? String(song.disc) : '');
    setEditYear(song.year ? String(song.year) : ''); setEditLyric(song.lyric || '');
  };

  const saveEditedSong = async () => {
    if (!editingSong) return;
    const updatedLibrary = localLibrary.map((s: any) => s.localMusicUri === editingSong.localMusicUri ? {
      ...s, title: editTitle.trim() || 'Untitled', artist: editArtist.trim() || 'Unknown Artist', album: editAlbum.trim() || 'Unknown Album',
      track: editTrack.trim() ? parseInt(editTrack.trim(), 10) : undefined, disc: editDisc.trim() ? parseInt(editDisc.trim(), 10) : undefined,
      year: editYear.trim() ? parseInt(editYear.trim(), 10) : undefined, lyric: editLyric
    } : s);
    await AsyncStorage.setItem('local_library', JSON.stringify(updatedLibrary));
    if (setLocalLibrary) setLocalLibrary(updatedLibrary);
    setEditingSong(null);
  };

  const currentProgress = Animated.subtract(navAnim, Animated.divide(panX, width));
  const layerBorderStyle = { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' };
  const layer1Translate = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -width * 0.25, -width * 0.25], extrapolate: 'clamp' });
  const layer1Darken = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 0.4, 0.4], extrapolate: 'clamp' });
  const layer2Translate = currentProgress.interpolate({ inputRange: [0, 1, 2], outputRange: [width, 0, -width * 0.25], extrapolate: 'clamp' });
  // ★ 修正: outputRange の要素数を [0, 0, 0.4] に修正
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
    panX.setValue(0); setSearchQuery(''); setIsSearching(false); Keyboard.dismiss();
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
        Keyboard.dismiss(); setSearchQuery(''); setIsSearching(false);
        Animated.timing(panX, { toValue: width, duration: 250, easing: Easing.out(Easing.poly(4)), useNativeDriver: true }).start(() => {
          const nextStack = navStack.slice(0, -1);
          setNavStack(nextStack); panX.setValue(0); navAnim.setValue(nextStack.length - 1);
          isNavAnimating.current = false;
        });
      } else {
        Animated.spring(panX, { toValue: 0, useNativeDriver: true, stiffness: 300, damping: 30, mass: 0.8, overshootClamping: true }).start();
      }
    }
  };

  const handlePressIn = () => { Animated.spring(backButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handlePressOut = () => { Animated.spring(backButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const renderHeader = (title: string) => (
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
      <View style={styles.navHeaderRight} />
    </View>
  );

  const renderFloatingBackButton = () => (
    <View style={{ position: 'absolute', top: 12, left: isLandscape ? Math.max(insets?.left || 0, 16) : 16, zIndex: 30 }}>
      <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
        <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
          <View style={[styles.liquidGlassBackButton, { backgroundColor: isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.5)', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)' }]}>
            <BlurView intensity={isDark ? 60 : 85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );

  let songs: any[] = [];
  let heroArtSource: any = DEFAULT_ICON;
  let heroTitle = "";

  if (currentSelectionType === 'PLAYLIST') {
    songs = getPlaylistSongs(currentPlaylist, localLibrary);
    heroArtSource = getPlaylistFirstArt(currentPlaylist, localLibrary);
    heroTitle = currentPlaylist?.playlistName || '';
  } else if (currentSelectionType === 'ALBUM') {
    songs = localLibrary.filter((s: any) => s.album === currentAlbum?.album && s.artist === currentAlbum?.artist).sort((a: any, b: any) => (a.track || 0) - (b.track || 0));
    heroArtSource = currentAlbum?.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON;
    heroTitle = currentAlbum?.album || '';
  } else if (currentSelectionType === 'ARTIST') {
    songs = localLibrary.filter((s: any) => s.artist === currentArtist).sort((a: any, b: any) => (a.title || '').localeCompare(b.title || '', 'ja'));
    heroArtSource = songs.length > 0 && songs[0].localImageUri ? { uri: songs[0].localImageUri } : DEFAULT_ICON;
    heroTitle = currentArtist || '';
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    songs = songs.filter((song: any) => song.title?.toLowerCase().includes(q) || song.artist?.toLowerCase().includes(q) || song.album?.toLowerCase().includes(q));
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

      <PanGestureHandler activeOffsetX={[-500, 10]} failOffsetY={[-15, 15]} enabled={navStack.length > 1} onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer1Translate }] }]}>
            <LibraryMenuView 
              dynamicStyles={dynamicStyles} themeColor={themeColor} insets={insets} isLandscape={isLandscape} safePadding={safePadding}
              pushView={pushView} recentlyPlayedSongs={recentlyPlayedSongs} recentlyPlayedCollections={recentlyPlayedCollections}
              localLibrary={localLibrary} startQueue={startQueue} saveCollectionToHistory={saveCollectionToHistory}
            />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer1Darken }]} />
          </Animated.View>

          {navStack.length > 1 && (
            <Animated.View style={[StyleSheet.absoluteFill, layerBorderStyle, { zIndex: 2, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer2Translate }] }]}>
              <LibraryCategoryView 
                category={navStack[1]} dynamicStyles={dynamicStyles} themeColor={themeColor} safePadding={safePadding}
                localPlaylists={localPlaylists} albumsList={albumsList} artistsList={artistsList} localLibrary={localLibrary}
                showPlaylistTypeIcon={showPlaylistTypeIcon} setCurrentSelectionType={setCurrentSelectionType} setCurrentPlaylist={setCurrentPlaylist}
                setCurrentAlbum={setCurrentAlbum} setCurrentArtist={setCurrentArtist} pushView={pushView} renderHeader={renderHeader}
              />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer2Darken }]} />
            </Animated.View>
          )}

          {navStack.length > 2 && (
            <Animated.View style={[StyleSheet.absoluteFill, layerBorderStyle, { zIndex: 3, backgroundColor: dynamicStyles.bg, transform: [{ translateX: layer3Translate }] }]}>
              <LibrarySongListView 
                dynamicStyles={dynamicStyles} themeColor={themeColor} isDark={isDark} isLandscape={isLandscape} height={height} insets={insets}
                songs={songs} heroArtSource={heroArtSource} heroTitle={heroTitle} hasBlurBackground={heroArtSource !== DEFAULT_ICON}
                currentSelectionType={currentSelectionType} currentPlaylist={currentPlaylist} showPlaylistTypeIcon={showPlaylistTypeIcon}
                searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} setIsSearching={setIsSearching}
                startQueue={startQueue} onPlayCollectionPress={(s: any[], sh: boolean) => {
                  let item: any;
                  if (currentSelectionType === 'PLAYLIST') item = { type: 'PLAYLIST', data: currentPlaylist, id: currentPlaylist.id, art: getPlaylistFirstArt(currentPlaylist, localLibrary) };
                  else if (currentSelectionType === 'ALBUM') item = { type: 'ALBUM', data: currentAlbum, id: `${currentAlbum.album}:::${currentAlbum.artist}`, art: currentAlbum.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON };
                  else if (currentSelectionType === 'ARTIST') item = { type: 'ARTIST', data: artistsList.find((a: any) => a.artistName === currentArtist), id: currentArtist, art: songs.length > 0 && songs[0].localImageUri ? { uri: songs[0].localImageUri } : DEFAULT_ICON };
                  if (item) saveCollectionToHistory(item);
                  startQueue(s, undefined, sh);
                }}
                openActionSheet={openActionSheet} renderFloatingBackButton={renderFloatingBackButton}
                flatListRefPortrait={flatListRefPortrait} flatListRefLandscape={flatListRefLandscape}
                AnimatedMenuButton={AnimatedMenuButton}
              />
            </Animated.View>
          )}
        </View>
      </PanGestureHandler>

      <LibraryModals 
        dynamicStyles={dynamicStyles} themeColor={themeColor} textColor={themeColor} isDark={isDark} isLandscape={isLandscape} width={width} insets={insets}
        actionSheetSong={actionSheetSong} closeActionSheet={closeActionSheet} sheetAnim={sheetAnim}
        currentSelectionType={currentSelectionType} currentPlaylist={currentPlaylist} handleRemoveFromCurrentPlaylist={handleRemoveFromCurrentPlaylist} handleDeleteSongPermanently={handleDeleteSongPermanently}
        songInfoModalTarget={songInfoModalTarget} setSongInfoModalTarget={setSongInfoModalTarget}
        addToPlaylistSong={addToPlaylistSong} closeAddToPlaylistModal={closeAddToPlaylistModal} availablePlaylistsForSong={availablePlaylistsForSong}
        selectedPlaylistsForAdd={selectedPlaylistsForAdd} setSelectedPlaylistsForAdd={setSelectedPlaylistsForAdd} handleAddSongToPlaylists={handleAddSongToPlaylists}
        editingSong={editingSong} setEditingSong={setEditingSong} editTitle={editTitle} setEditTitle={setEditTitle} editArtist={editArtist} setEditArtist={setEditArtist}
        editAlbum={editAlbum} setEditAlbum={setEditAlbum} editTrack={editTrack} setEditTrack={setEditTrack} editDisc={editDisc} setEditDisc={setEditDisc}
        editYear={editYear} setEditYear={setEditYear} editLyric={editLyric} setEditLyric={setEditLyric} saveEditedSong={saveEditedSong}
        openEditSongModal={openEditSongModal} setAddToPlaylistSong={setAddToPlaylistSong} setSongInfoModalTargetSongs={setSongInfoModalTarget}
        showPlaylistTypeIcon={showPlaylistTypeIcon} localLibrary={localLibrary} AnimatedCancelButton={AnimatedCancelButton}
      />
    </GestureHandlerRootView>
  );
};