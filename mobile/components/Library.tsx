import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, Animated, 
  StyleSheet, TouchableWithoutFeedback, useWindowDimensions, TextInput, Keyboard, Easing, 
  Modal, Alert, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { RecentSection } from './RecentSection';
import { MarqueeText } from './MarqueeText';
import { getPlaylistFirstArt, getPlaylistSongs } from '../utils/playlistEvaluator';

import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

const DEFAULT_ICON = require('../assets/images/icon.png');

const LIBRARY_MENU_ITEMS = [
  { title: 'プレイリスト', icon: 'musical-notes-outline' as const, view: 'PLAYLISTS' },
  { title: 'アルバム', icon: 'disc-outline' as const, view: 'ALBUMS' },
  { title: 'アーティスト', icon: 'mic-outline' as const, view: 'ARTISTS' },
];

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        marginLeft: 8,
        transform: [{ scale }]
      }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={textStyle} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const AnimatedCancelButton = ({ onPress, dynamicStyles }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={{
        backgroundColor: dynamicStyles.card,
        borderRadius: 16,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: dynamicStyles.border,
        transform: [{ scale }]
      }}>
        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>キャンセル</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const Library = ({ 
  dynamicStyles, themeColor, startQueue, currentSong, 
  localLibrary = [], setLocalLibrary, localPlaylists = [], setLocalPlaylists,
  setNavStackLength, insets, isDark,
  showPlaylistTypeIcon = true 
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

  const [listBackgroundArt, setListBackgroundArt] = useState<any>(null);
  const listBgOpacity = useRef(new Animated.Value(0)).current;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [actionSheetSong, setActionSheetSong] = useState<any>(null);
  const [songInfoModalTarget, setSongInfoModalTarget] = useState<any>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<any>(null);
  const [editingSong, setEditingSong] = useState<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [editDisc, setEditDisc] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editLyric, setEditLyric] = useState('');

  const flatListRefPortrait = useRef<FlatList>(null);
  const flatListRefLandscape = useRef<FlatList>(null);

  const safePadding = {
    paddingBottom: (isLandscape ? 50 : 180) + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 16) : 0,
    paddingRight: isLandscape ? (Math.max(insets?.right || 0, 16) + LANDSCAPE_TAB_BAR_WIDTH + 16) : 0,
  };

  const openActionSheet = (song: any) => {
    setActionSheetSong(song);
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 24,
      mass: 0.8,
      stiffness: 300,
    }).start();
  };

  const closeActionSheet = (callback?: () => void) => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setActionSheetSong(null);
      if (callback) callback();
    });
  };

  useEffect(() => {
    if (setNavStackLength) {
      setNavStackLength(navStack.length);
    }
  }, [navStack]);

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

  useEffect(() => {
    loadHistory();
  }, [currentSong, navStack]);

  useEffect(() => {
    Animated.timing(listBgOpacity, {
      toValue: listBackgroundArt ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [listBackgroundArt]);

  useEffect(() => {
    if (navStack.length === 3) {
      let heroArtSource = null;
      if (currentSelectionType === 'PLAYLIST') {
        heroArtSource = getPlaylistFirstArt(currentPlaylist, localLibrary);
      } else if (currentSelectionType === 'ALBUM') {
        heroArtSource = currentAlbum?.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON;
      } else if (currentSelectionType === 'ARTIST') {
        const songs = localLibrary.filter((s: any) => s.artist === currentArtist);
        heroArtSource = songs.length > 0 && songs[0].localImageUri ? { uri: songs[0].localImageUri } : DEFAULT_ICON;
      }
      if (heroArtSource && heroArtSource !== DEFAULT_ICON) {
        setListBackgroundArt(heroArtSource);
      } else {
        setListBackgroundArt(null);
      }

      setTimeout(() => {
        flatListRefPortrait.current?.scrollToOffset({ offset: 60, animated: false });
        flatListRefLandscape.current?.scrollToOffset({ offset: 60, animated: false });
      }, 50);

    } else {
      setListBackgroundArt(null);
    }
  }, [navStack, currentSelectionType, currentPlaylist, currentAlbum, currentArtist, artistsList, localLibrary]);

  const loadHistory = async () => {
    const rs = await AsyncStorage.getItem('recently_played_songs');
    const rc = await AsyncStorage.getItem('recently_played_collections');
    
    const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
    const fixUri = (uri: string | null | undefined) => {
        if (!uri) return uri;
        const fname = uri.split(/[\\/]/).pop();
        return fname ? baseDir + fname : uri;
    };

    if (rs) {
      const parsedRs = JSON.parse(rs).map((s: any) => ({
        ...s,
        localMusicUri: fixUri(s.localMusicUri),
        localImageUri: fixUri(s.localImageUri)
      }));
      setRecentlyPlayedSongs(parsedRs);
    }

    if (rc) {
      const parsedRc = JSON.parse(rc).map((c: any) => {
        if (c.art && c.art.uri) {
          c.art.uri = fixUri(c.art.uri);
        }
        if (c.type === 'PLAYLIST' && c.data && c.data.localCoverImageUri) {
          c.data.localCoverImageUri = fixUri(c.data.localCoverImageUri);
        }
        return c;
      });
      setRecentlyPlayedCollections(parsedRc);
    }
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
        const currentSongs = getPlaylistSongs(pl, localLibrary);
        return !currentSongs.some((s: any) => {
          const f = s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
          return f === targetFname;
        });
      } else {
        const musicList = Array.isArray(pl.music) ? pl.music : [];
        return !musicList.some((m: any) => {
          const pathStr = typeof m === 'string' ? m : (m?.musicFilename || m?.path || '');
          const f = pathStr.split(/[\\/]/).pop()?.toLowerCase();
          return f === targetFname;
        });
      }
    });
  }, [addToPlaylistSong, localPlaylists, localLibrary]);

  const handleAddSongToPlaylist = async (playlist: any, song: any) => {
    const songFname = song.musicFilename?.split(/[\\/]/).pop();
    if (!songFname) return;

    if (playlist.type === 'smart') {
      Alert.alert(
        'プレイリストの変換',
        `「${playlist.playlistName}」はスマートプレイリストです。\n手動で曲を追加すると通常のプレイリストに変換され、自動更新が行われなくなります。続行しますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { 
            text: '変換して追加', 
            style: 'destructive',
            onPress: async () => {
              try {
                const currentSongs = getPlaylistSongs(playlist, localLibrary);
                const currentFilenames = currentSongs
                  .map((s: any) => s.musicFilename?.split(/[\\/]/).pop())
                  .filter(Boolean);

                const newMusicList = Array.from(new Set([...currentFilenames, songFname]));

                const updatedPlaylists = localPlaylists.map((p: any) => {
                  if (p.id === playlist.id) {
                    const { conditions, ...rest } = p;
                    return {
                      ...rest,
                      type: 'normal',
                      music: newMusicList,
                    };
                  }
                  return p;
                });

                await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
                if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
                setAddToPlaylistSong(null);
                Alert.alert('完了', `「${playlist.playlistName}」を通常プレイリストに変換し、曲を追加しました。`);
              } catch (e: any) {
                Alert.alert('エラー', '追加に失敗しました: ' + e.message);
              }
            }
          }
        ]
      );
    } else {
      try {
        const currentMusicList = Array.isArray(playlist.music) ? playlist.music : [];
        const newMusicList = Array.from(new Set([...currentMusicList, songFname]));

        const updatedPlaylists = localPlaylists.map((p: any) => {
          if (p.id === playlist.id) {
            return {
              ...p,
              music: newMusicList,
            };
          }
          return p;
        });

        await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
        if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
        setAddToPlaylistSong(null);
        Alert.alert('追加完了', `「${playlist.playlistName}」に曲を追加しました。`);
      } catch (e: any) {
        Alert.alert('エラー', '追加に失敗しました: ' + e.message);
      }
    }
  };

  // ★ プレイリストからの曲削除（スマートプレイリストでも端末ファイルは削除されない旨を明記）
  const handleRemoveFromCurrentPlaylist = (song: any) => {
    if (!currentPlaylist || currentPlaylist.isAll || currentPlaylist.id === 'all_songs') return;
    const songFname = song.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
    if (!songFname) return;

    if (currentPlaylist.type === 'smart') {
      Alert.alert(
        'プレイリストの変換と削除',
        `「${currentPlaylist.playlistName}」はスマートプレイリストです。\n曲を個別削除すると通常のプレイリストに変換され、条件による自動更新が行われなくなります。\n(端末内の楽曲ファイルは削除されません)\n続行しますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '変換して削除',
            style: 'destructive',
            onPress: async () => {
              const currentSongs = getPlaylistSongs(currentPlaylist, localLibrary);
              const remainingFilenames = currentSongs
                .filter((s: any) => s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase() !== songFname)
                .map((s: any) => s.musicFilename?.split(/[\\/]/).pop())
                .filter(Boolean);

              const updatedPlaylists = localPlaylists.map((p: any) => {
                if (p.id === currentPlaylist.id) {
                  const { conditions, ...rest } = p;
                  return {
                    ...rest,
                    type: 'normal',
                    music: remainingFilenames,
                  };
                }
                return p;
              });

              await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
              if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
              const updatedCurrent = updatedPlaylists.find((p: any) => p.id === currentPlaylist.id);
              if (updatedCurrent) setCurrentPlaylist(updatedCurrent);

              Alert.alert('削除完了', `「${currentPlaylist.playlistName}」から曲を削除しました。`);
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'プレイリストから削除',
        `「${currentPlaylist.playlistName}」から「${song.title || 'この曲'}」を削除しますか？\n(端末内の楽曲ファイルは削除されません)`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除',
            style: 'destructive',
            onPress: async () => {
              const musicList = Array.isArray(currentPlaylist.music) ? currentPlaylist.music : [];
              const remainingFilenames = musicList.filter((m: any) => {
                const pathStr = typeof m === 'string' ? m : (m?.musicFilename || m?.path || '');
                return pathStr.split(/[\\/]/).pop()?.toLowerCase() !== songFname;
              });

              const updatedPlaylists = localPlaylists.map((p: any) => {
                if (p.id === currentPlaylist.id) {
                  return {
                    ...p,
                    music: remainingFilenames,
                  };
                }
                return p;
              });

              await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
              if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
              const updatedCurrent = updatedPlaylists.find((p: any) => p.id === currentPlaylist.id);
              if (updatedCurrent) setCurrentPlaylist(updatedCurrent);

              Alert.alert('削除完了', `「${currentPlaylist.playlistName}」から曲を削除しました。`);
            }
          }
        ]
      );
    }
  };

  // ★ ライブラリから楽曲を完全削除
  const handleDeleteSongPermanently = (song: any) => {
    Alert.alert(
      'ライブラリから楽曲を削除',
      `「${song.title || 'この曲'}」をライブラリおよび端末から完全に削除しますか？\n(この操作は取り消せません)`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              if (song.localMusicUri) {
                const info = await FileSystem.getInfoAsync(song.localMusicUri);
                if (info.exists) {
                  await FileSystem.deleteAsync(song.localMusicUri, { idempotent: true });
                }
              }

              const remainingLibrary = localLibrary.filter((s: any) => s.localMusicUri !== song.localMusicUri);
              const targetFname = song.musicFilename?.split(/[\\/]/).pop();

              const updatedPlaylists = localPlaylists.map((pl: any) => {
                if (pl.isAll || !pl.music) return pl;
                return {
                  ...pl,
                  music: pl.music.filter((m: string) => m.split(/[\\/]/).pop() !== targetFname)
                };
              });

              await AsyncStorage.setItem('local_library', JSON.stringify(remainingLibrary));
              await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
              if (setLocalLibrary) setLocalLibrary(remainingLibrary);
              if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);

              Alert.alert('削除完了', '楽曲データを削除しました。');
            } catch (e: any) {
              Alert.alert('エラー', '削除に失敗しました: ' + e.message);
            }
          }
        }
      ]
    );
  };

  const openEditSongModal = (song: any) => {
    setEditingSong(song);
    setEditTitle(song.title || '');
    setEditArtist(song.artist || '');
    setEditAlbum(song.album || '');
    setEditTrack(song.track ? String(song.track) : '');
    setEditDisc(song.disc ? String(song.disc) : '');
    setEditYear(song.year ? String(song.year) : '');
    setEditLyric(song.lyric || '');
  };

  const saveEditedSong = async () => {
    if (!editingSong) return;

    const updatedLibrary = localLibrary.map((s: any) => {
      if (s.localMusicUri === editingSong.localMusicUri) {
        return {
          ...s,
          title: editTitle.trim() || 'Untitled',
          artist: editArtist.trim() || 'Unknown Artist',
          album: editAlbum.trim() || 'Unknown Album',
          track: editTrack.trim() ? parseInt(editTrack.trim(), 10) : undefined,
          disc: editDisc.trim() ? parseInt(editDisc.trim(), 10) : undefined,
          year: editYear.trim() ? parseInt(editYear.trim(), 10) : undefined,
          lyric: editLyric,
        };
      }
      return s;
    });

    try {
      await AsyncStorage.setItem('local_library', JSON.stringify(updatedLibrary));
      if (setLocalLibrary) setLocalLibrary(updatedLibrary);
      setEditingSong(null);
      Alert.alert('保存完了', '楽曲情報を更新しました。');
    } catch (e: any) {
      Alert.alert('エラー', '保存に失敗しました: ' + e.message);
    }
  };

  const currentProgress = Animated.subtract(
    navAnim,
    Animated.divide(panX, width)
  );

  const layerBorderStyle = {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
  };

  const layer1Translate = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -width * 0.25, -width * 0.25],
    extrapolate: 'clamp'
  });
  
  const layer1Darken = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 0.4, 0.4], 
    extrapolate: 'clamp'
  });

  const layer2Translate = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [width, 0, -width * 0.25],
    extrapolate: 'clamp'
  });

  const layer2Darken = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 0, 0.4],
    extrapolate: 'clamp'
  });

  const layer3Translate = currentProgress.interpolate({
    inputRange: [1, 2],
    outputRange: [width, 0],
    extrapolate: 'clamp'
  });

  const pushView = (view: string) => {
    if (isNavAnimating.current) return;
    isNavAnimating.current = true;
    const next = navStack.length;
    setNavStack([...navStack, view]);
    Animated.spring(navAnim, { 
      toValue: next, 
      useNativeDriver: true, 
      stiffness: 300, 
      damping: 30,
      mass: 0.8,
      overshootClamping: true
    }).start(() => { isNavAnimating.current = false; });
  };

  const popView = () => {
    if (isNavAnimating.current || navStack.length <= 1) return;
    isNavAnimating.current = true;
    panX.setValue(0); 

    setSearchQuery('');
    setIsSearching(false);
    Keyboard.dismiss();

    const prev = navStack.length - 2;
    Animated.spring(navAnim, { 
      toValue: prev, 
      useNativeDriver: true, 
      stiffness: 300, 
      damping: 30,
      mass: 0.8,
      overshootClamping: true 
    }).start(() => {
      setNavStack(navStack.slice(0, -1));
      isNavAnimating.current = false;
    });
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;

    if (state === State.END || state === State.CANCELLED) {
      if (translationX > width / 4 || velocityX > 300) {
        if (isNavAnimating.current) return;
        isNavAnimating.current = true;

        Keyboard.dismiss();
        setSearchQuery('');
        setIsSearching(false);

        Animated.timing(panX, {
          toValue: width,
          duration: 250,
          easing: Easing.out(Easing.poly(4)),
          useNativeDriver: true
        }).start(() => {
          const nextStack = navStack.slice(0, -1);
          setNavStack(nextStack);
          panX.setValue(0);
          navAnim.setValue(nextStack.length - 1);
          isNavAnimating.current = false;
        });
      } else {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 300,
          damping: 30,
          mass: 0.8,
          overshootClamping: true
        }).start();
      }
    }
  };

  const handlePressIn = () => { Animated.spring(backButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handlePressOut = () => { Animated.spring(backButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const renderHeader = (title: string) => (
    <View style={[
      styles.navHeader, 
      { 
        paddingTop: insets?.top || 0, 
        height: 44 + (insets?.top || 0),
        paddingLeft: isLandscape ? Math.max(insets?.left || 0, 15) : 15,
        paddingRight: isLandscape ? Math.max(insets?.right || 0, 15) : 15,
      }
    ]}>
        <View style={styles.navHeaderLeft}>
            {navStack.length > 1 && (
                <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
                    <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
                        <View style={[styles.liquidGlassBackButton, { 
                            backgroundColor: isDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)',
                            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                        }]}>
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
    <View style={{
      position: 'absolute',
      top: 12,
      left: isLandscape ? Math.max(insets?.left || 0, 16) : 16,
      zIndex: 30,
    }}>
      <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
        <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
          <View style={[styles.liquidGlassBackButton, { 
            backgroundColor: isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.5)',
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
          }]}>
            <BlurView intensity={isDark ? 60 : 85} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );

  const onPlayCollectionPress = (songs: any[], shuffle: boolean) => {
    let collectionItem: any;
    if (currentSelectionType === 'PLAYLIST') {
      collectionItem = { 
        type: 'PLAYLIST', 
        data: currentPlaylist, 
        id: currentPlaylist.id, 
        art: getPlaylistFirstArt(currentPlaylist, localLibrary) 
      };
    } else if (currentSelectionType === 'ALBUM') {
      collectionItem = { 
        type: 'ALBUM', 
        data: currentAlbum, 
        id: `${currentAlbum.album}:::${currentAlbum.artist}`, 
        art: currentAlbum.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON 
      };
    } else if (currentSelectionType === 'ARTIST') {
      const artistData = artistsList.find(a => a.artistName === currentArtist);
      const songsOfArtist = localLibrary.filter((s: any) => s.artist === currentArtist);
      const art = songsOfArtist.length > 0 && songsOfArtist[0].localImageUri ? { uri: songsOfArtist[0].localImageUri } : DEFAULT_ICON;
      collectionItem = { type: 'ARTIST', data: artistData, id: currentArtist, art };
    }
    if (collectionItem) saveCollectionToHistory(collectionItem);
    startQueue(songs, undefined, shuffle);
  };

  const renderMenu = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
        
        <View style={[
          styles.headerBar, 
          { 
            borderBottomColor: 'transparent', 
            paddingTop: insets?.top || 0, 
            height: 44 + (insets?.top || 0),
            paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
            paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20,
          }
        ]}>
            <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>ライブラリ</Text>
        </View>
        <FlatList
          data={LIBRARY_MENU_ITEMS}
          keyExtractor={item => item.title}
          renderItem={({ item, index }) => (
              <TouchableOpacity style={[styles.menuRow, index !== 2 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} onPress={() => pushView(item.view)}>
              <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
              <Text style={[styles.menuRowTitle, { color: dynamicStyles.text }]}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
              </TouchableOpacity>
          )}
          ListFooterComponent={
              <RecentSection 
                recentlyPlayedSongs={recentlyPlayedSongs} 
                recentlyPlayedCollections={recentlyPlayedCollections} 
                dynamicStyles={dynamicStyles} 
                themeColor={themeColor}
                onPlaySong={(s: any) => startQueue([s], s, undefined)} 
                onPlayCollection={(item: any) => {
                  let songs: any[] = [];
                  if (item.type === 'PLAYLIST') {
                    songs = getPlaylistSongs(item.data, localLibrary);
                  } else if (item.type === 'ALBUM') {
                    songs = localLibrary.filter((s: any) => s.album === item.data.album && s.artist === item.data.artist);
                  } else if (item.type === 'ARTIST') {
                    songs = localLibrary.filter((s: any) => s.artist === item.data.artistName);
                  }
                  startQueue(songs, undefined, false);
                  saveCollectionToHistory(item);
                }}
              />
          }
          contentContainerStyle={safePadding}
        />
    </View>
  );

  const renderCategory = (category: string) => {
    const data = category === 'PLAYLISTS' ? [{ playlistName: 'すべての楽曲', isAll: true, id: 'all_songs', type: 'normal' }, ...localPlaylists] : category === 'ALBUMS' ? albumsList : artistsList;
    return (
      <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

        {renderHeader(category === 'PLAYLISTS' ? 'プレイリスト' : category === 'ALBUMS' ? 'アルバム' : 'アーティスト')}
        <FlatList
          key={category}
          data={data}
          numColumns={category === 'ALBUMS' ? 2 : 1}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => {
            if (category === 'ALBUMS') {
                return (
                    <TouchableOpacity style={styles.albumGridItem} onPress={() => { setCurrentSelectionType('ALBUM'); setCurrentAlbum(item); pushView('SONG_LIST'); }}>
                        <Image source={item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON} style={styles.albumGridImage} />
                        <View style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
                          <MarqueeText text={item.album} style={[styles.albumGridTitle, { color: dynamicStyles.text }]} />
                          <MarqueeText text={item.artist} style={[styles.albumGridArtist, { color: dynamicStyles.subText, marginTop: 2 }]} />
                        </View>
                    </TouchableOpacity>
                );
            }
            const title = category === 'PLAYLISTS' ? item.playlistName : item.artistName;
            const artSource = category === 'PLAYLISTS' ? getPlaylistFirstArt(item, localLibrary) : (item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON);
            const isSmart = category === 'PLAYLISTS' && item.type === 'smart';

            return (
                <TouchableOpacity style={[styles.checkRow, { borderBottomWidth: 0 }]} onPress={() => { 
                    if (category === 'PLAYLISTS') { setCurrentSelectionType('PLAYLIST'); setCurrentPlaylist(item); }
                    else { setCurrentSelectionType('ARTIST'); setCurrentArtist(item.artistName); }
                    pushView('SONG_LIST');
                }}>
                    <Image source={artSource} style={[styles.playlistIconArt, category === 'ARTISTS' && { borderRadius: 35 }]} />
                    <View style={{ flex: 1, marginLeft: 15, marginRight: 10, minWidth: 0, overflow: 'hidden' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {showPlaylistTypeIcon && category === 'PLAYLISTS' && (
                          <Ionicons 
                            name={isSmart ? "flash" : "musical-notes"} 
                            size={16} 
                            color={themeColor} 
                            style={{ marginRight: 6 }} 
                          />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <MarqueeText text={title} style={[styles.rowTitle, { color: dynamicStyles.text, marginLeft: 0 }]} />
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
                </TouchableOpacity>
            );
          }}
          contentContainerStyle={safePadding}
        />
      </View>
    );
  };

  const renderSongList = () => {
    let songs: any[] = [];
    let heroArtSource: any = DEFAULT_ICON;
    let heroTitle = "";
    const isPlaylist = currentSelectionType === 'PLAYLIST';
    const isSmartPlaylist = isPlaylist && currentPlaylist?.type === 'smart';

    if (isPlaylist) {
      songs = getPlaylistSongs(currentPlaylist, localLibrary);
      heroArtSource = getPlaylistFirstArt(currentPlaylist, localLibrary);
      heroTitle = currentPlaylist.playlistName;
    } else if (currentSelectionType === 'ALBUM') {
      songs = localLibrary.filter((s: any) => s.album === currentAlbum.album && s.artist === currentAlbum.artist);
      songs.sort((a, b) => (a.track || 0) - (b.track || 0)); 
      heroArtSource = currentAlbum.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON;
      heroTitle = currentAlbum.album;
    } else if (currentSelectionType === 'ARTIST') {
      songs = localLibrary.filter((s: any) => s.artist === currentArtist);
      songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
      heroArtSource = (songs.length > 0 && songs[0].localImageUri) ? { uri: songs[0].localImageUri } : DEFAULT_ICON;
      heroTitle = currentArtist || "";
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        songs = songs.filter(song => 
            song.title?.toLowerCase().includes(q) || 
            song.artist?.toLowerCase().includes(q) || 
            song.album?.toLowerCase().includes(q)
        );
    }
    
    const hasBlurBackground = heroArtSource !== DEFAULT_ICON;

    const onFocusSearch = () => {
        setIsSearching(true);
    };

    const onCancelSearch = () => {
        setIsSearching(false); 
        setSearchQuery(''); 
        Keyboard.dismiss(); 
    };

    const searchBarElement = (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', 
                borderRadius: 20, 
                paddingHorizontal: 15, 
                height: 40,
                width: '80%',
                maxWidth: 360,
            }}>
                <Ionicons name="search" size={18} color={dynamicStyles.subText} style={{ marginRight: 10 }} />
                <TextInput
                    style={{ flex: 1, color: dynamicStyles.text, fontSize: 16 }}
                    placeholder="曲名、アーティスト..."
                    placeholderTextColor={dynamicStyles.subText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={onFocusSearch}
                    onBlur={() => { if (!searchQuery) setIsSearching(false); }}
                />
                {isSearching && (
                    <TouchableOpacity onPress={onCancelSearch}>
                        <Ionicons name="close-circle" size={20} color={dynamicStyles.subText} style={{ marginLeft: 10 }} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const landscapeArtSize = height * 0.4;
    const heroSectionElement = isSearching ? null : (
        <View style={isLandscape ? { padding: 10, alignItems: 'center', width: '100%' } : styles.plHero}>
            {currentSelectionType !== 'ARTIST' && (
                <Image 
                    source={heroArtSource} 
                    style={isLandscape 
                        ? { width: landscapeArtSize, height: landscapeArtSize, borderRadius: 12 } 
                        : styles.plHeroArt
                    } 
                />
            )}
            <View style={{ width: '100%', paddingHorizontal: 20, alignItems: 'center', marginTop: isLandscape ? 10 : 15, minWidth: 0, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>
                {showPlaylistTypeIcon && isPlaylist && (
                  <Ionicons 
                    name={isSmartPlaylist ? "flash" : "musical-notes"} 
                    size={isLandscape ? 18 : 22} 
                    color={themeColor} 
                    style={{ marginRight: 8 }} 
                  />
                )}
                <View style={{ flexShrink: 1, minWidth: 0 }}>
                  <MarqueeText 
                    text={heroTitle}
                    align="center"
                    style={[
                        styles.plHeroTitle, 
                        { color: dynamicStyles.text, marginTop: 0, paddingHorizontal: 0 },
                        isLandscape && { fontSize: 18 }
                    ]} 
                  />
                </View>
              </View>
            </View>
            
            <View style={{
                flexDirection: 'row', 
                width: '100%', 
                justifyContent: 'center', 
                gap: 10, 
                marginTop: 15,
                paddingHorizontal: 10
            }}>
                <TouchableOpacity 
                    style={[
                        styles.plMainBtn, 
                        { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' },
                        hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
                    ]} 
                    onPress={() => onPlayCollectionPress(songs, false)}
                >
                    {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
                    <Ionicons name="play" size={20} color={isDark ? '#fff' : '#000'} />
                    <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>再生</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.plMainBtn, 
                        { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' },
                        hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
                    ]} 
                    onPress={() => onPlayCollectionPress(songs, true)}
                >
                    {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
                    <Ionicons name="shuffle" size={20} color={isDark ? '#fff' : '#000'} />
                    <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>シャッフル</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            {hasBlurBackground ? (
              <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100 }}>
                  <Image 
                    source={heroArtSource} 
                    style={StyleSheet.absoluteFill} 
                    blurRadius={80} 
                  />
                  <BlurView 
                    intensity={isDark ? 80 : 95} 
                    tint={isDark ? 'dark' : 'light'} 
                    style={StyleSheet.absoluteFill} 
                  />
              </View>
            ) : (
              <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg }} />
            )}

            {renderFloatingBackButton()}
            
            {isLandscape ? (
                <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
                    {!isSearching && (
                        <View style={{ flex: 1, justifyContent: 'center', paddingTop: 10, paddingLeft: isLandscape ? Math.max(insets?.left || 0, 16) : 0 }}>
                            {heroSectionElement}
                        </View>
                    )}
                    <View style={{ flex: isSearching ? 1 : 1.5 }}>
                        <FlatList
                            ref={flatListRefLandscape} 
                            data={songs}
                            keyExtractor={(item) => item.localMusicUri}
                            style={{ flex: 1 }}
                            ListHeaderComponent={
                                <View style={{ paddingTop: 10 }}>
                                    {searchBarElement}
                                </View>
                            }
                            snapToOffsets={[0, 70]} 
                            snapToEnd={false} 
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
                                    <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArt} />
                                    <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                        <MarqueeText text={item.title} style={[styles.songTitle, { color: dynamicStyles.text }]} />
                                        <MarqueeText text={item.artist} style={[styles.songSub, { color: dynamicStyles.subText, marginTop: 2 }]} />
                                    </View>
                                    <AnimatedMenuButton 
                                      onPress={() => openActionSheet(item)}
                                      isDark={isDark}
                                      textStyle={dynamicStyles.text}
                                    />
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{
                                paddingBottom: 40 + (insets?.bottom || 0),
                                paddingRight: isLandscape ? (Math.max(insets?.right || 0, 16) + LANDSCAPE_TAB_BAR_WIDTH + 16) : 0,
                            }}
                        />
                    </View>
                </View>
            ) : (
                <FlatList
                    ref={flatListRefPortrait} 
                    data={songs}
                    keyExtractor={(item) => item.localMusicUri}
                    style={StyleSheet.absoluteFill}
                    ListHeaderComponent={
                        <View style={{ paddingTop: 10 }}>
                            {searchBarElement}
                            {heroSectionElement}
                        </View>
                    }
                    snapToOffsets={[0, 70]} 
                    snapToEnd={false} 
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
                            <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArt} />
                            <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <MarqueeText text={item.title} style={[styles.songTitle, { color: dynamicStyles.text }]} />
                                <MarqueeText text={item.artist} style={[styles.songSub, { color: dynamicStyles.subText, marginTop: 2 }]} />
                            </View>
                            <AnimatedMenuButton 
                              onPress={() => openActionSheet(item)}
                              isDark={isDark}
                              textStyle={dynamicStyles.text}
                            />
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{
                        paddingBottom: 180 + (insets?.bottom || 0),
                    }}
                />
            )}

            {/* アクションメニュー */}
            <Modal visible={!!actionSheetSong} transparent animationType="none">
              <TouchableWithoutFeedback onPress={() => closeActionSheet()}>
                <Animated.View style={{ 
                  flex: 1, 
                  backgroundColor: 'rgba(0,0,0,0.6)', 
                  opacity: sheetAnim, 
                  justifyContent: 'flex-end', 
                  padding: 15, 
                  paddingBottom: 25 + (insets?.bottom || 0) 
                }}>
                  <TouchableWithoutFeedback>
                    <Animated.View style={{ 
                      gap: 10,
                      transform: [{
                        translateY: sheetAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [300, 0]
                        })
                      }]
                    }}>
                      <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}>
                          <Image source={actionSheetSong?.localImageUri ? { uri: actionSheetSong.localImageUri } : DEFAULT_ICON} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{actionSheetSong?.title || 'Untitled'}</Text>
                            <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{actionSheetSong?.artist || 'Unknown Artist'}</Text>
                          </View>
                        </View>

                        {/* 1. プレイリストに追加 */}
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => {
                            const target = actionSheetSong;
                            closeActionSheet(() => setAddToPlaylistSong(target));
                          }}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>プレイリストに追加</Text>
                        </TouchableOpacity>

                        {/* 2. 編集 */}
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => {
                            const target = actionSheetSong;
                            closeActionSheet(() => openEditSongModal(target));
                          }}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="create-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>楽曲情報を編集</Text>
                        </TouchableOpacity>

                        {/* 3. 情報を見る */}
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => {
                            const target = actionSheetSong;
                            closeActionSheet(() => setSongInfoModalTarget(target));
                          }}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="information-circle-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>情報を見る</Text>
                        </TouchableOpacity>

                        {/* 4. このプレイリストから削除 (プレイリスト表示時のみ) */}
                        {currentSelectionType === 'PLAYLIST' && !currentPlaylist?.isAll && (
                          <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                            onPress={() => {
                              const target = actionSheetSong;
                              closeActionSheet(() => handleRemoveFromCurrentPlaylist(target));
                            }}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>このプレイリストから削除</Text>
                          </TouchableOpacity>
                        )}

                        {/* ★ 5. ライブラリから楽曲を削除 */}
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                          onPress={() => {
                            const target = actionSheetSong;
                            closeActionSheet(() => handleDeleteSongPermanently(target));
                          }}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="trash-outline" size={22} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>ライブラリから楽曲を削除</Text>
                        </TouchableOpacity>
                      </View>

                      <AnimatedCancelButton 
                        onPress={() => closeActionSheet()}
                        dynamicStyles={dynamicStyles}
                      />
                    </Animated.View>
                  </TouchableWithoutFeedback>
                </Animated.View>
              </TouchableWithoutFeedback>
            </Modal>

            {/* 簡易MP3タグ情報ポップアップモーダル */}
            <Modal visible={!!songInfoModalTarget} transparent animationType="none">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="information-circle" size={22} color={themeColor} />
                      <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold' }}>タグ情報</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSongInfoModalTarget(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 15 }}>
                    <View style={{ alignItems: 'center', marginBottom: 18 }}>
                      <Image source={songInfoModalTarget?.localImageUri ? { uri: songInfoModalTarget.localImageUri } : DEFAULT_ICON} style={{ width: 90, height: 90, borderRadius: 14, marginBottom: 8 }} />
                      <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>{songInfoModalTarget?.title || 'Unknown'}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 2, textAlign: 'center' }}>{songInfoModalTarget?.artist || 'Unknown'}</Text>
                    </View>

                    <View style={{ gap: 10, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', padding: 14, borderRadius: 16 }}>
                      {[
                        { l: 'アルバム', v: songInfoModalTarget?.album },
                        { l: 'アルバムアーティスト', v: songInfoModalTarget?.album_artist || songInfoModalTarget?.albumArtist },
                        { l: '作曲者', v: songInfoModalTarget?.composer },
                        { l: 'ジャンル', v: songInfoModalTarget?.genre },
                        { l: 'トラック番号', v: songInfoModalTarget?.track },
                        { l: 'ディスク番号', v: songInfoModalTarget?.disc },
                        { l: 'リリース年', v: songInfoModalTarget?.year },
                        { l: 'BPM', v: songInfoModalTarget?.bpm },
                        { l: 'コメント', v: songInfoModalTarget?.comment },
                        { l: 'ファイル名', v: songInfoModalTarget?.musicFilename?.split(/[\\/]/).pop() },
                        { l: '歌詞', v: songInfoModalTarget?.lyric ? '登録あり' : 'なし' },
                      ].map((item, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 13, width: 110 }}>{item.l}</Text>
                          <Text style={{ color: dynamicStyles.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={2}>
                            {item.v !== undefined && item.v !== null && item.v !== '' ? String(item.v) : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* プレイリスト選択モーダル */}
            <Modal visible={!!addToPlaylistSong} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' }}>
                <View style={[
                  styles.modalOverlay,
                  { 
                    backgroundColor: 'transparent',
                    width: isLandscape ? Math.min(width * 0.9, 600) : '90%',
                    height: isLandscape ? Math.min(height * 0.9, 520) : '80%',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }
                ]}>
                  <View style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: dynamicStyles.card,
                    borderRadius: 24,
                    padding: 22,
                    borderWidth: 1.5,
                    borderColor: dynamicStyles.border,
                    overflow: 'hidden'
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>プレイリストに追加</Text>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }} numberOfLines={1}>「{addToPlaylistSong?.title || '曲'}」を追加するリストを選択</Text>
                      </View>
                      <TouchableOpacity onPress={() => setAddToPlaylistSong(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6}>
                        <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
                      </TouchableOpacity>
                    </View>

                    <FlatList
                      data={availablePlaylistsForSong}
                      keyExtractor={(item) => item.id}
                      style={{ marginVertical: 8, flex: 1 }}
                      contentContainerStyle={{ paddingVertical: 8, paddingBottom: 20 }}
                      ListEmptyComponent={
                        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 50 }}>
                          <Ionicons name="information-circle-outline" size={48} color={dynamicStyles.subText} />
                          <Text style={{ color: dynamicStyles.subText, marginTop: 12, fontSize: 14, fontWeight: 'bold', textAlign: 'center', lineHeight: 20 }}>
                            追加可能なプレイリストがありません{'\n'}(すでに全リストに追加済みです)
                          </Text>
                        </View>
                      }
                      renderItem={({ item }) => {
                        const isSmart = item.type === 'smart';
                        const artSource = getPlaylistFirstArt(item, localLibrary);
                        const count = getPlaylistSongs(item, localLibrary).length;

                        return (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: 12,
                              borderRadius: 14,
                              backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: dynamicStyles.border
                            }}
                            onPress={() => handleAddSongToPlaylist(item, addToPlaylistSong)}
                            activeOpacity={0.6}
                          >
                            <Image source={artSource?.uri ? { uri: artSource.uri } : DEFAULT_ICON} style={{ width: 46, height: 46, borderRadius: 8, marginRight: 12 }} />
                            <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {showPlaylistTypeIcon && (
                                  <Ionicons name={isSmart ? "flash" : "musical-notes"} size={14} color={themeColor} style={{ marginRight: 5 }} />
                                )}
                                <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>{item.playlistName}</Text>
                              </View>
                              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }}>{count}曲 {isSmart ? '• スマート' : ''}</Text>
                            </View>
                            <Ionicons name="add" size={22} color={themeColor} />
                          </TouchableOpacity>
                        );
                      }}
                    />
                  </View>
                </View>
              </View>
            </Modal>

            {/* 楽曲情報編集モーダル */}
            <Modal visible={!!editingSong} transparent animationType="none">
              <KeyboardAvoidingView 
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={{ width: '100%', maxWidth: 460, maxHeight: '85%', backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold' }}>楽曲情報を編集</Text>
                    <TouchableOpacity onPress={() => setEditingSong(null)}>
                      <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                    <View style={{ gap: 12 }}>
                      <View>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>曲名</Text>
                        <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editTitle} onChangeText={setEditTitle} placeholderTextColor={dynamicStyles.subText} />
                      </View>

                      <View>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>アーティスト</Text>
                        <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editArtist} onChangeText={setEditArtist} placeholderTextColor={dynamicStyles.subText} />
                      </View>

                      <View>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>アルバム</Text>
                        <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editAlbum} onChangeText={setEditAlbum} placeholderTextColor={dynamicStyles.subText} />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>トラック</Text>
                          <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editTrack} onChangeText={setEditTrack} keyboardType="number-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>ディスク</Text>
                          <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editDisc} onChangeText={setEditDisc} keyboardType="number-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>年</Text>
                          <TextInput style={{ height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }} value={editYear} onChangeText={setEditYear} keyboardType="number-pad" />
                        </View>
                      </View>

                      <View>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>歌詞</Text>
                        <TextInput style={{ minHeight: 80, maxHeight: 150, borderRadius: 12, padding: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 13, borderWidth: 1, borderColor: dynamicStyles.border, textAlignVertical: 'top' }} value={editLyric} onChangeText={setEditLyric} multiline />
                      </View>

                      <TouchableOpacity style={{ height: 48, borderRadius: 24, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 10 }} onPress={saveEditedSong}>
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>変更を保存</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>
        </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

      <PanGestureHandler
        activeOffsetX={[-500, 10]}
        failOffsetY={[-15, 15]}
        enabled={navStack.length > 1}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <View style={{ flex: 1 }}>
          
          {/* Layer 1: メニュー層 */}
          <Animated.View style={[StyleSheet.absoluteFill, { 
            zIndex: 1,
            backgroundColor: dynamicStyles.bg,
            transform: [{ translateX: layer1Translate }] 
          }]}>
            {renderMenu()}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer1Darken }]} />
          </Animated.View>
          
          {/* Layer 2: カテゴリ一覧層 */}
          {navStack.length > 1 && (
            <Animated.View 
                style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                  zIndex: 2,
                  backgroundColor: dynamicStyles.bg,
                  transform: [{ translateX: layer2Translate }] 
                }]}
            >
              {renderCategory(navStack[1])}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer2Darken }]} />
            </Animated.View>
          )}

          {/* Layer 3: 楽曲リスト層 */}
          {navStack.length > 2 && (
            <Animated.View 
                style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                  zIndex: 3,
                  backgroundColor: dynamicStyles.bg,
                  transform: [{ translateX: layer3Translate }] 
                }]}
            >
              {renderSongList()}
            </Animated.View>
          )}

        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};
