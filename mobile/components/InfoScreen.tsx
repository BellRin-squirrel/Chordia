import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Animated, StyleSheet, 
  TouchableWithoutFeedback, useWindowDimensions, ScrollView, Switch, 
  Modal, Linking, Easing, TextInput, Alert, Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { MarqueeText } from './MarqueeText';
import { getPlaylistFirstArt, getPlaylistSongs } from '../utils/playlistEvaluator';

const DEFAULT_ICON = require('../assets/images/icon.png');
const HISTORY_KEY = 'chordia_focus_history';
const GRAPH_HEIGHT = 180;

const PRESET_COLORS = [
  { r: 79, g: 70, b: 229 }, { r: 0, g: 122, b: 255 }, { r: 52, g: 199, b: 89 },
  { r: 255, g: 45, b: 85 }, { r: 255, g: 149, b: 0 }, { r: 175, g: 82, b: 222 },
  { r: 255, g: 167, b: 255 }, { r: 255, g: 204, b: 0 }, { r: 90, g: 200, b: 250 },
];

const INFO_MENU_ITEMS = [
  { title: '設定', icon: 'options-outline' as const, view: 'SETTINGS', sub: 'テーマカラー・再生エンジン・動作設定' },
  { title: '統計', icon: 'stats-chart-outline' as const, view: 'STATISTICS', sub: '集中セッションと活動履歴の分析' },
  { title: 'データを管理', icon: 'server-outline' as const, view: 'MANAGE_DATA', sub: '保存済み楽曲の確認・編集・一括削除' },
  { title: 'ライセンス・バージョン', icon: 'document-text-outline' as const, view: 'LICENSE', sub: 'Chordia について・開発情報' },
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

export const InfoScreen = ({ 
  dynamicStyles, themeColor, themeTextColor, isCustomTheme, 
  themeR, themeG, themeB, recentColors, setThemeR, setThemeG, setThemeB, 
  showRGBModal, setShowRGBModal, saveColor, applyCustomColor, 
  insets, audioEngine, changeAudioEngine, showFocusTab, toggleFocusTab, 
  showSyncTab, toggleSyncTab, showPlaylistTypeIcon = true, toggleShowPlaylistTypeIcon,
  localLibrary = [], setLocalLibrary, localPlaylists = [], setLocalPlaylists,
  isDark, isLandscape 
}: any) => {
  const { width, height } = useWindowDimensions();
  const textColor = themeTextColor || '#ffffff';

  const [navStack, setNavStack] = useState<string[]>(['MENU']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const backButtonScale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;

  const [focusHistory, setFocusHistory] = useState<any[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongUris, setSelectedSongUris] = useState<Set<string>>(new Set());
  const [searchSongQuery, setSearchSongQuery] = useState('');

  const [actionSheetSong, setActionSheetSong] = useState<any>(null);
  const [songInfoModalTarget, setSongInfoModalTarget] = useState<any>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const [editingSong, setEditingSong] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [editDisc, setEditDisc] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editLyric, setEditLyric] = useState('');

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
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await AsyncStorage.getItem(HISTORY_KEY);
      if (res) setFocusHistory(JSON.parse(res));
    } catch (e) {}
  };

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
      return { 
        date: d, 
        totalSec, 
        label: `${d.getMonth() + 1}/${d.getDate()}`, 
        dayName: dayNames[d.getDay()],
        fullDateLabel: `${d.getMonth() + 1}月${d.getDate()}日(${dayNames[d.getDay()]})`
      };
    });
  };

  const formatSecToHMS = (sec: number) => {
    const total = Math.round(sec);
    if (total <= 0) return '0秒';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  };

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const selectedDayData = selectedDayIndex !== null ? graphData[selectedDayIndex] : null;

  const filteredLibrary = useMemo(() => {
    if (!searchSongQuery.trim()) return localLibrary;
    const q = searchSongQuery.toLowerCase();
    return localLibrary.filter((s: any) => 
      s.title?.toLowerCase().includes(q) || 
      s.artist?.toLowerCase().includes(q) || 
      s.album?.toLowerCase().includes(q)
    );
  }, [localLibrary, searchSongQuery]);

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

  const openEditSong = (song: any) => {
    setEditingSong(song);
    setEditTitle(song.title || '');
    setEditArtist(song.artist || '');
    setEditAlbum(song.album || '');
    setEditTrack(song.track ? String(song.track) : '');
    setEditDisc(song.disc ? String(song.disc) : '');
    setEditYear(song.year ? String(song.year) : '');
    setEditLyric(song.lyric || '');
    pushView('EDIT_SONG');
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
      Alert.alert('保存完了', '楽曲情報を更新しました。');
      popView();
    } catch (e: any) {
      Alert.alert('エラー', '保存に失敗しました: ' + e.message);
    }
  };

  const executeDeleteSongs = async (urisToDelete: string[]) => {
    if (urisToDelete.length === 0) return;

    try {
      const uriSet = new Set(urisToDelete);
      const remainingLibrary = localLibrary.filter((s: any) => !uriSet.has(s.localMusicUri));

      for (const uri of urisToDelete) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch (e) {}
      }

      const deletedFilenames = new Set(
        localLibrary
          .filter((s: any) => uriSet.has(s.localMusicUri))
          .map((s: any) => s.musicFilename?.split(/[\\/]/).pop())
          .filter(Boolean)
      );

      const updatedPlaylists = localPlaylists.map((pl: any) => {
        if (pl.isAll || !pl.music) return pl;
        return {
          ...pl,
          music: pl.music.filter((m: string) => !deletedFilenames.has(m.split(/[\\/]/).pop()))
        };
      });

      await AsyncStorage.setItem('local_library', JSON.stringify(remainingLibrary));
      await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
      if (setLocalLibrary) setLocalLibrary(remainingLibrary);
      if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);

      setSelectedSongUris(new Set());
      setIsSelectionMode(false);

      Alert.alert('削除完了', `${urisToDelete.length}曲の楽曲データを削除しました。`);
    } catch (e: any) {
      Alert.alert('エラー', '削除処理中にエラーが発生しました: ' + e.message);
    }
  };

  const confirmDeleteSelected = () => {
    const count = selectedSongUris.size;
    if (count === 0) {
      Alert.alert('選択されていません', '削除する楽曲を選択してください。');
      return;
    }

    Alert.alert(
      'ライブラリから楽曲を一括削除',
      `選択した ${count} 曲をライブラリおよび端末から完全に削除しますか？\n(この操作は取り消せません)`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除する', 
          style: 'destructive', 
          onPress: () => executeDeleteSongs(Array.from(selectedSongUris)) 
        }
      ]
    );
  };

  // ★ 単曲削除の文言も統一
  const confirmDeleteSingle = (song: any) => {
    Alert.alert(
      'ライブラリから楽曲を削除',
      `「${song.title || 'Untitled'}」をライブラリおよび端末から完全に削除しますか？\n(この操作は取り消せません)`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除する', 
          style: 'destructive', 
          onPress: () => executeDeleteSongs([song.localMusicUri]) 
        }
      ]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSongUris.size === filteredLibrary.length) {
      setSelectedSongUris(new Set());
    } else {
      setSelectedSongUris(new Set(filteredLibrary.map((s: any) => s.localMusicUri)));
    }
  };

  const currentProgress = Animated.subtract(navAnim, Animated.divide(panX, width));

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

    if (navStack.length === 2) {
      setIsSelectionMode(false);
      setSelectedSongUris(new Set());
      setSearchSongQuery('');
    }

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

        if (navStack.length === 2) {
          setIsSelectionMode(false);
          setSelectedSongUris(new Set());
          setSearchSongQuery('');
        }

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

  const renderHeader = (title: string, rightElement?: React.ReactNode) => (
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

  // 1. メインメニュー
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
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>情報</Text>
      </View>
      <FlatList
        data={INFO_MENU_ITEMS}
        keyExtractor={item => item.view}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={[styles.menuRow, index !== INFO_MENU_ITEMS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} 
            onPress={() => pushView(item.view)}
          >
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
    </View>
  );

  // 2. 設定画面
  const renderSettings = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('設定')}
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0 }]}>テーマカラーを選択</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 15 }}>
          {PRESET_COLORS.map((c, i) => (
            <TouchableOpacity 
              key={i} 
              onPress={() => saveColor(c.r, c.g, c.b, false)} 
              style={[styles.colorPreset, { backgroundColor: `rgb(${c.r},${c.g},${c.b})` }, !isCustomTheme && themeR === c.r && themeG === c.g && { borderWidth: 3, borderColor: dynamicStyles.text }]} 
            />
          ))}
          <TouchableOpacity 
            onPress={() => setShowRGBModal(true)} 
            style={[styles.colorPreset, isCustomTheme && { borderWidth: 3, borderColor: dynamicStyles.text }]}
          >
            {isCustomTheme ? (
              <View style={{ flex: 1, backgroundColor: themeColor, borderRadius: 25 }} />
            ) : (
              <LinearGradient colors={['#FF9A9E', '#A18CD1', '#84FAB0', '#F6D365']} style={{ flex: 1, borderRadius: 25 }} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>再生エンジン (再起動推奨)</Text>
        <View style={{ flexDirection: 'row', backgroundColor: dynamicStyles.card, borderRadius: 25, overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: dynamicStyles.border }}>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'rntp' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('rntp')}
          >
            <Text style={{ color: audioEngine === 'rntp' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>RNTP (標準)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'expo-av' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('expo-av')}
          >
            <Text style={{ color: audioEngine === 'expo-av' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>Expo-Audio (BGM用)</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
          【RNTP】ロック画面・AirPods操作対応。他アプリの音声と干渉します。{"\n"}
          【Expo-Audio】他アプリと同時に再生(ミックス)可能。ロック画面操作は不可。
        </Text>

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>機能設定</Text>
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 15, marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>同期タブ</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>PC版Chordiaとのデータ同期専用タブを表示します</Text>
            </View>
            <Switch 
              value={showSyncTab} 
              onValueChange={(val) => toggleSyncTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>作業(Focus)モード</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>勉強や仕事に集中するための専用タブを表示します</Text>
            </View>
            <Switch 
              value={showFocusTab} 
              onValueChange={(val) => toggleFocusTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>プレイリストの種類を明記</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>通常(🎵)とスマートプレイリスト(⚡)の識別アイコンを表示します</Text>
            </View>
            <Switch 
              value={showPlaylistTypeIcon} 
              onValueChange={(val) => toggleShowPlaylistTypeIcon(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // 3. 統計画面
  const renderStatistics = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('統計')}
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <Text style={{ color: dynamicStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>活動記録</Text>
        
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold' }}>過去7日間の集中時間</Text>
            {selectedDayData && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold' }}>
                  {selectedDayData.fullDateLabel}: {formatSecToHMS(selectedDayData.totalSec)}
                </Text>
              </View>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', height: GRAPH_HEIGHT }}>
            <View style={{ justifyContent: 'space-between', paddingRight: 15, alignItems: 'flex-end', width: 75 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>{formatSecToHMS(maxSec)}</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>{formatSecToHMS(Math.round(maxSec / 2))}</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>0秒</Text>
            </View>
            
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: dynamicStyles.border, paddingBottom: 5 }}>
              {graphData.map((d, i) => {
                const barHeight = maxSec > 0 ? (d.totalSec / maxSec) * (GRAPH_HEIGHT - 25) : 0;
                const isSelected = selectedDayIndex === i;
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={{ alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}
                    onPress={() => setSelectedDayIndex(i)}
                    activeOpacity={0.7}
                  >
                    <View style={{ 
                      height: barHeight, 
                      width: isLandscape ? 32 : 18, 
                      backgroundColor: isSelected 
                        ? themeColor 
                        : (d.totalSec > 0 ? (isDark ? '#48484a' : '#c7c7cc') : (isDark ? '#2c2c2e' : '#e5e5ea')), 
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      minHeight: d.totalSec > 0 ? 6 : 0,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: '#ffffff',
                    }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', marginLeft: 75, marginTop: 10 }}>
            {graphData.map((d, i) => {
              const isSelected = selectedDayIndex === i;
              return (
                <TouchableOpacity 
                  key={i} 
                  style={{ alignItems: 'center', flex: 1 }}
                  onPress={() => setSelectedDayIndex(i)}
                >
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal' }}>{d.dayName}</Text>
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 10, marginTop: 2, fontWeight: isSelected ? '600' : 'normal' }}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity 
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: 'center',
            marginBottom: 35,
            borderWidth: 1,
            borderColor: dynamicStyles.border
          }}
          onPress={async () => {
            await loadHistory();
            pushView('STATS_ALL');
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: themeColor, fontSize: 16, fontWeight: 'bold' }}>すべての集中セッション履歴を確認する</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>この1週間の合計集中時間</Text>
          <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(weekTotalSec)}</Text>
        </View>
      </ScrollView>
    </View>
  );

  // 4. データ管理画面
  const renderManageData = () => {
    const selectionHeaderBtn = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {isSelectionMode && (
          <TouchableOpacity
            onPress={confirmDeleteSelected}
            disabled={selectedSongUris.size === 0}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: selectedSongUris.size > 0 ? '#ef4444' : (isDark ? '#2c2c2e' : '#e5e7eb'),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: selectedSongUris.size > 0 ? 1 : 0.5,
            }}
          >
            <Ionicons name="trash-outline" size={14} color={selectedSongUris.size > 0 ? '#fff' : dynamicStyles.subText} />
            <Text style={{
              color: selectedSongUris.size > 0 ? '#fff' : dynamicStyles.subText,
              fontWeight: 'bold',
              fontSize: 13,
            }}>
              削除{selectedSongUris.size > 0 ? `(${selectedSongUris.size})` : ''}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => {
            setIsSelectionMode(!isSelectionMode);
            if (isSelectionMode) setSelectedSongUris(new Set());
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 14,
            backgroundColor: isSelectionMode ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb'),
          }}
        >
          <Text style={{ 
            color: isSelectionMode ? textColor : dynamicStyles.text, 
            fontWeight: 'bold', 
            fontSize: 13 
          }}>
            {isSelectionMode ? '完了' : '選択'}
          </Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
        {renderHeader('データを管理', selectionHeaderBtn)}

        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 40,
            borderRadius: 12,
            paddingHorizontal: 12,
            backgroundColor: dynamicStyles.card,
            borderWidth: 1,
            borderColor: dynamicStyles.border
          }}>
            <Ionicons name="search" size={16} color={dynamicStyles.subText} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, color: dynamicStyles.text, fontSize: 14 }}
              placeholder="楽曲名やアーティスト名で検索..."
              placeholderTextColor={dynamicStyles.subText}
              value={searchSongQuery}
              onChangeText={setSearchSongQuery}
              clearButtonMode="while-editing"
            />
            {searchSongQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchSongQuery('')}>
                <Ionicons name="close-circle-sharp" size={16} color={dynamicStyles.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isSelectionMode && (
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderBottomWidth: 1,
            borderBottomColor: dynamicStyles.border
          }}>
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={{ color: themeColor, fontWeight: 'bold', fontSize: 13 }}>
                {selectedSongUris.size === filteredLibrary.length ? 'すべて解除' : 'すべて選択'}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>
              選択中: <Text style={{ color: themeColor, fontWeight: 'bold' }}>{selectedSongUris.size}</Text> / {filteredLibrary.length}曲
            </Text>
          </View>
        )}

        <FlatList
          data={filteredLibrary}
          keyExtractor={(item) => item.localMusicUri}
          contentContainerStyle={safePadding}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Ionicons name="musical-notes-outline" size={70} color={dynamicStyles.border} />
              <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 15, fontWeight: 'bold' }}>
                {searchSongQuery ? '該当する楽曲が見つかりません' : '保存されている楽曲がありません'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedSongUris.has(item.localMusicUri);

            return (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: dynamicStyles.card,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: isSelected ? themeColor : dynamicStyles.border,
                }}
                onPress={() => {
                  if (isSelectionMode) {
                    const next = new Set(selectedSongUris);
                    if (next.has(item.localMusicUri)) next.delete(item.localMusicUri);
                    else next.add(item.localMusicUri);
                    setSelectedSongUris(next);
                  }
                }}
                activeOpacity={0.7}
              >
                {isSelectionMode && (
                  <View style={{ marginRight: 12 }}>
                    <Ionicons 
                      name={isSelected ? "checkbox" : "square-outline"} 
                      size={22} 
                      color={isSelected ? themeColor : dynamicStyles.subText} 
                    />
                  </View>
                )}

                <Image 
                  source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} 
                  style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} 
                />

                <View style={{ flex: 1, minWidth: 0, marginRight: 10, overflow: 'hidden' }}>
                  <MarqueeText 
                    text={item.title || 'Untitled'} 
                    style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} 
                  />
                  <View style={{ height: 2 }} />
                  <MarqueeText 
                    text={`${item.artist || 'Unknown'} • ${item.album || 'Unknown Album'}`} 
                    style={{ color: dynamicStyles.subText, fontSize: 12 }} 
                  />
                </View>

                {!isSelectionMode && (
                  <AnimatedMenuButton 
                    onPress={() => openActionSheet(item)}
                    isDark={isDark}
                    textStyle={dynamicStyles.text}
                  />
                )}
              </TouchableOpacity>
            );
          }}
        />

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
                        closeActionSheet(() => openEditSong(target));
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

                    {/* ★ 4. ライブラリから楽曲を削除 */}
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                      onPress={() => {
                        const target = actionSheetSong;
                        closeActionSheet(() => confirmDeleteSingle(target));
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
      </View>
    );
  };

  // 5. 楽曲情報編集画面 (Layer 3)
  const renderEditSong = () => {
    const saveHeaderBtn = (
      <TouchableOpacity 
        onPress={saveEditedSong}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 14,
          backgroundColor: themeColor,
        }}
      >
        <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 13 }}>
          保存
        </Text>
      </TouchableOpacity>
    );

    return (
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: dynamicStyles.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
        {renderHeader('楽曲情報を編集', saveHeaderBtn)}

        <ScrollView contentContainerStyle={[safePadding, { paddingTop: 15 }]}>
          <View style={{ alignItems: 'center', marginBottom: 25 }}>
            <Image 
              source={editingSong?.localImageUri ? { uri: editingSong.localImageUri } : DEFAULT_ICON} 
              style={{ width: 110, height: 110, borderRadius: 16, shadowOpacity: 0.15, shadowRadius: 8, marginBottom: 10 }} 
            />
            <Text style={{ color: dynamicStyles.subText, fontSize: 11 }}>
              {editingSong?.musicFilename?.split(/[\\/]/).pop() || 'File'}
            </Text>
          </View>

          <View style={{ gap: 15 }}>
            <View>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>曲名</Text>
              <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: dynamicStyles.border }} value={editTitle} onChangeText={setEditTitle} placeholder="曲名を入力" placeholderTextColor={dynamicStyles.subText} />
            </View>

            <View>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>アーティスト</Text>
              <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border }} value={editArtist} onChangeText={setEditArtist} placeholder="アーティスト名を入力" placeholderTextColor={dynamicStyles.subText} />
            </View>

            <View>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>アルバム</Text>
              <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border }} value={editAlbum} onChangeText={setEditAlbum} placeholder="アルバム名を入力" placeholderTextColor={dynamicStyles.subText} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>トラック番号</Text>
                <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border }} value={editTrack} onChangeText={setEditTrack} placeholder="1" placeholderTextColor={dynamicStyles.subText} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>ディスク番号</Text>
                <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border }} value={editDisc} onChangeText={setEditDisc} placeholder="1" placeholderTextColor={dynamicStyles.subText} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>リリース年</Text>
                <TextInput style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border }} value={editYear} onChangeText={setEditYear} placeholder="2026" placeholderTextColor={dynamicStyles.subText} keyboardType="number-pad" />
              </View>
            </View>

            <View style={{ marginTop: 5 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>歌詞 (Lyrics)</Text>
              <TextInput style={{ minHeight: 120, maxHeight: 200, borderRadius: 14, padding: 14, backgroundColor: dynamicStyles.card, color: dynamicStyles.text, fontSize: 14, lineHeight: 20, borderWidth: 1, borderColor: dynamicStyles.border, textAlignVertical: 'top' }} value={editLyric} onChangeText={setEditLyric} placeholder="歌詞を入力..." placeholderTextColor={dynamicStyles.subText} multiline />
            </View>

            <TouchableOpacity style={{ height: 52, borderRadius: 26, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 15, shadowColor: themeColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }} onPress={saveEditedSong}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>変更を保存</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // 6. ライセンス・バージョン画面
  const renderLicense = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('ライセンス・バージョン')}
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 20, alignItems: 'center' }]}>
        <View style={[styles.licenseCard, { backgroundColor: dynamicStyles.card, borderWidth: 1, borderColor: dynamicStyles.border }]}>
          <Ionicons name="musical-notes" size={48} color={themeColor} style={{ marginBottom: 12 }} />
          <Text style={[styles.appNameLabel, { color: dynamicStyles.text }]}>Chordia Mobile版</Text>
          <Text style={styles.appVersionLabel}>v5.1.0</Text>
          <View style={[styles.divider, { backgroundColor: dynamicStyles.border, marginVertical: 20 }]} />
          <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 15 }}>Chordia は PC 版ライブラリとのシームレスな同期と没入感のある音楽再生・作業集中環境を提供する音楽プレイヤーアプリです。</Text>
          <Text style={[styles.copyrightLabel, { color: dynamicStyles.text }]}>© 2026 BellRin</Text>
          <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }} onPress={() => Linking.openURL('https://github.com/BellRin-squirrel/Chordia')}>
            <Ionicons name="logo-github" size={18} color="#8957e5" />
            <Text style={{ color: '#8957e5', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }}>GitHub Repository</Text>
            <Ionicons name="open-outline" size={12} color="#8957e5" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // 7. 集中履歴全件画面 (Layer 3)
  const renderAllHistory = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('すべての履歴')}
      <FlatList
        data={focusHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={safePadding}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="time-outline" size={80} color={dynamicStyles.border} />
            <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>履歴がありません</Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.date);
          const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: dynamicStyles.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: dynamicStyles.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                  <Ionicons name="checkmark-done-circle" size={26} color={themeColor} />
                </View>
                <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', flex: 1 }}>{dateStr}</Text>
              </View>
              <Text style={{ color: themeColor, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(item.duration)}</Text>
            </View>
          );
        }}
      />
    </View>
  );

  const modalContentWidth = isLandscape ? Math.min(width * 0.9, 600) : width * 0.85;

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
          
          {/* Layer 2: 設定 / 統計 / データを管理 / ライセンス */}
          {navStack.length > 1 && (
            <Animated.View 
              style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                zIndex: 2,
                backgroundColor: dynamicStyles.bg,
                transform: [{ translateX: layer2Translate }] 
              }]}
            >
              {navStack[1] === 'SETTINGS' && renderSettings()}
              {navStack[1] === 'STATISTICS' && renderStatistics()}
              {navStack[1] === 'MANAGE_DATA' && renderManageData()}
              {navStack[1] === 'LICENSE' && renderLicense()}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer2Darken }]} />
            </Animated.View>
          )}

          {/* Layer 3: 統計の全履歴 / 楽曲情報編集 */}
          {navStack.length > 2 && (
            <Animated.View 
              style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                zIndex: 3,
                backgroundColor: dynamicStyles.bg,
                transform: [{ translateX: layer3Translate }] 
              }]}
            >
              {navStack[2] === 'STATS_ALL' && renderAllHistory()}
              {navStack[2] === 'EDIT_SONG' && renderEditSong()}
            </Animated.View>
          )}

        </View>
      </PanGestureHandler>

      {/* カスタムRGBモーダル */}
      <Modal visible={showRGBModal} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={100} tint={dynamicStyles.blur} style={[styles.rgbModalContent, { width: modalContentWidth, padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: dynamicStyles.text, marginBottom: isLandscape ? 10 : 20, fontSize: isLandscape ? 16 : 18 }]}>カスタムカラー設定</Text>
            <View style={{ flexDirection: isLandscape ? 'row' : 'column', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', marginRight: isLandscape ? 25 : 0, marginBottom: isLandscape ? 0 : 20 }}>
                <View style={[styles.colorBoxBig, { backgroundColor: themeColor, width: isLandscape ? 100 : 120, height: isLandscape ? 100 : 120 }]} />
                <Text style={[styles.rgbText, { color: dynamicStyles.text, marginTop: 8, fontSize: 14 }]}>{themeColor}</Text>
              </View>
              <View style={{ flex: isLandscape ? 1 : 0, width: '100%' }}>
                {[{ l: 'R', v: themeR, s: setThemeR, c: '#ef4444' }, { l: 'G', v: themeG, s: setThemeG, c: '#10b981' }, { l: 'B', v: themeB, s: setThemeB, c: '#3b82f6' }].map((item, i) => (
                  <View key={i} style={[styles.sliderRow, { marginBottom: isLandscape ? 5 : 10 }]}>
                    <Text style={[styles.sliderLabel, { color: item.c, width: 20 }]}>{item.l}</Text>
                    <Slider style={{ flex: 1 }} minimumValue={0} maximumValue={255} step={1} value={item.v} onValueChange={item.s} />
                  </View>
                ))}
                {recentColors.length > 0 && (
                  <View style={{ marginTop: isLandscape ? 10 : 15 }}>
                    <Text style={[styles.subLabel, { color: dynamicStyles.subText, fontSize: 12 }]}>最近の設定</Text>
                    <View style={styles.recentRow}>
                      {recentColors.map((rc: any, idx: number) => (
                        <TouchableOpacity key={idx} onPress={() => { setThemeR(rc.r); setThemeG(rc.g); setThemeB(rc.b); }} style={[styles.recentCircle, { backgroundColor: `rgb(${rc.r},${rc.g},${rc.b})`, width: 24, height: 24 }]} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.modalBtnRow, { marginTop: isLandscape ? 15 : 25 }]}>
              <TouchableOpacity onPress={() => setShowRGBModal(false)} style={styles.modalBtnCancel}><Text style={{ color: '#8e8e93' }}>キャンセル</Text></TouchableOpacity>
              <TouchableOpacity onPress={applyCustomColor} style={[styles.modalBtnApply, { backgroundColor: themeColor }]}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>設定</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};
