import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, Text, FlatList, ScrollView, Image, TouchableOpacity, Modal, Pressable, StyleSheet,
  TouchableWithoutFeedback, TextInput, Alert, Animated, Easing, 
  KeyboardAvoidingView, Platform, useWindowDimensions, type StyleProp, type ViewStyle
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { styles } from '../../styles/styles';
import { MarqueeText } from '../MarqueeText';
import { getPlaylistFirstArt, getPlaylistSongs } from '../../utils/playlistEvaluator';
import { SmartPlaylistEditorModal } from './SmartPlaylistEditorModal';
import { t } from '../../utils/i18n';
import { syncMusicAndPlaylistsToCloud } from '../../utils/chordiaSync';

const DEFAULT_ICON = require('../../assets/images/icon.png');

type LiquidGlassMenuOptionProps = {
  children: React.ReactNode;
  onPress: () => void;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
};
type MeasurableView = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

const LiquidGlassMenuOption = ({ children, onPress, style }: LiquidGlassMenuOptionProps) => {
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.6}>
      {children}
    </TouchableOpacity>
  );
};

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Platform.OS === 'ios' && isLiquidGlassAvailable() ? 'transparent' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
        overflow: 'hidden',
        transform: [{ scale }]
      }}>
        {Platform.OS === 'ios' && isLiquidGlassAvailable() && (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            isInteractive
            colorScheme={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
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
        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{label || 'キャンセル'}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export const LibraryCategoryView = ({
  category, dynamicStyles, themeColor, safePadding, insets,
  localPlaylists = [], setLocalPlaylists, albumsList, artistsList, localLibrary = [],
  showPlaylistTypeIcon, setCurrentSelectionType, setCurrentPlaylist,
  setCurrentAlbum, setCurrentArtist, pushView, renderHeader, isDark, language = 'ja'
}: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const landscapeMenuColumns = width >= 900 ? 3 : 2;
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const menuSurfaceColor = useLiquidGlass
    ? (isDark ? 'rgba(32,32,36,0.78)' : 'rgba(248,248,252,0.82)')
    : dynamicStyles.card;

  const libraryBgColor = isDark ? '#000000' : '#ffffff';

  const [allSongsCoverUri, setAllSongsCoverUri] = useState<string | null>(null);

  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [rowActionTarget, setRowActionTarget] = useState<any>(null);
  const rowMenuColumns = rowActionTarget?.isAll ? 2 : landscapeMenuColumns;
  const [pressedPlaylistKey, setPressedPlaylistKey] = useState<string | null>(null);
  const pressedPlaylistKeyRef = useRef<string | null>(null);
  const pressActiveRef = useRef(false);
  const isLongPressedRef = useRef(false);
  const initialRowLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const playlistPressTranslateX = useRef(new Animated.Value(0)).current;
  const playlistPressTranslateY = useRef(new Animated.Value(0)).current;
  const playlistPressScale = useRef(new Animated.Value(1)).current;
  const playlistRowRefs = useRef<Record<string, MeasurableView | null>>({});
  const rowActionOriginRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const rowActionHeaderRef = useRef<MeasurableView | null>(null);
  const rowActionTransitionPending = useRef(false);
  const [coverPickerTarget, setCoverPickerTarget] = useState<any>(null);
  const [songCoverPickerTarget, setSongCoverPickerTarget] = useState<any>(null);
  const sheetAnimHeader = useRef(new Animated.Value(0)).current;
  const sheetAnimRow = useRef(new Animated.Value(0)).current;
  const headerTranslateX = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerScaleX = useRef(new Animated.Value(1)).current;
  const headerScaleY = useRef(new Animated.Value(1)).current;
  const headerTransitionAnim = useRef(new Animated.Value(1)).current;
  const sheetAnimCover = useRef(new Animated.Value(0)).current;

  const [createNameModalVisible, setCreateNameModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectSongsModalVisible, setSelectSongsModalVisible] = useState(false);
  const [selectedSongFilenames, setSelectedSongFilenames] = useState<Set<string>>(new Set());
  const [songSearchQuery, setSongSearchQuery] = useState('');

  const [editSongsTargetPl, setEditSongsTargetPl] = useState<any>(null);
  const [editSongsSelectedFilenames, setEditSongsSelectedFilenames] = useState<Set<string>>(new Set());
  const [editSongsSearchQuery, setEditSongsSearchQuery] = useState('');

  const [renameTarget, setRenameTarget] = useState<any>(null);
  const [renameInput, setRenameInput] = useState('');

  const [smartEditorConfig, setSmartEditorConfig] = useState<{
    visible: boolean;
    mode: 'CREATE' | 'EDIT';
    targetPlaylist: any | null;
  }>({ visible: false, mode: 'CREATE', targetPlaylist: null });

  const isPlaylistsTab = category === 'PLAYLISTS';

  // ★ メニュー・プレビューを画面上部に張り付かせず「もっと下の方」に表示するオフセット
  const menuTopOffset = isLandscape 
    ? Math.max(insets?.top || 0, 20) + 16 
    : Math.max((insets?.top || 0) + 75, height * 0.16);

  // ★ 「すべての楽曲」専用カバー画像の読み込み
  useEffect(() => {
    (async () => {
      try {
        const savedCover = await AsyncStorage.getItem('all_songs_cover_uri');
        if (savedCover) {
          const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
          const fname = savedCover.split(/[\\/]/).pop();
          const resolved = fname ? baseDir + fname : savedCover;
          setAllSongsCoverUri(resolved);
        }
      } catch (e) {}
    })();
  }, []);

  const data = isPlaylistsTab 
    ? [{ playlistName: t('all_songs_item', language), isAll: true, id: 'all_songs', type: 'normal', localCoverImageUri: allSongsCoverUri }, ...localPlaylists] 
    : category === 'ALBUMS' ? albumsList : artistsList;

  const closeHeaderMenu = (callback?: () => void) => {
    Animated.timing(sheetAnimHeader, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setHeaderMenuVisible(false);
      if (callback) {
        setTimeout(callback, Platform.OS === 'ios' ? 400 : 100);
      }
    });
  };

  const closeRowActionSheet = (callback?: () => void) => {
    Animated.timing(sheetAnimRow, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setRowActionTarget(null);
      rowActionOriginRef.current = null;
      rowActionTransitionPending.current = false;
      if (callback) {
        setTimeout(callback, Platform.OS === 'ios' ? 400 : 100);
      }
    });
  };

  const closeCoverPickerSheet = (callback?: () => void) => {
    Animated.timing(sheetAnimCover, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setCoverPickerTarget(null);
      if (callback) {
        setTimeout(callback, Platform.OS === 'ios' ? 400 : 100);
      }
    });
  };

  const songCoverPickerSongs = songCoverPickerTarget
    ? getPlaylistSongs(songCoverPickerTarget, localLibrary).filter((song: any) => song.localImageUri)
    : [];

  const openHeaderMenu = () => {
    setHeaderMenuVisible(true);
    sheetAnimHeader.setValue(0);
    Animated.spring(sheetAnimHeader, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const openRowActionSheet = (item: any, origin?: { x: number; y: number; width: number; height: number }) => {
    rowActionOriginRef.current = origin || null;
    rowActionTransitionPending.current = !!origin;
    headerTranslateX.setValue(0);
    headerTranslateY.setValue(0);
    headerScaleX.setValue(1);
    headerScaleY.setValue(1);
    headerTransitionAnim.setValue(origin ? 0 : 1);
    setRowActionTarget(item);
    sheetAnimRow.setValue(0);
    Animated.timing(sheetAnimRow, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  // ★ プレイリスト長押しも「その場でプレビューチャージ」する方式に変更
  const startPlaylistPressPreview = (rowKey: string) => {
    pressActiveRef.current = true;
    isLongPressedRef.current = false;
    pressedPlaylistKeyRef.current = rowKey;

    playlistPressTranslateX.stopAnimation();
    playlistPressTranslateY.stopAnimation();
    playlistPressScale.stopAnimation();
    playlistPressTranslateX.setValue(0);
    playlistPressTranslateY.setValue(0);
    playlistPressScale.setValue(1);
    setPressedPlaylistKey(rowKey);

    const row = playlistRowRefs.current[rowKey];
    if (row) {
      row.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        if (measuredWidth > 0 && measuredHeight > 0) {
          initialRowLayoutRef.current = { x, y, width: measuredWidth, height: measuredHeight };
        }
      });
    }

    // 長押し中は位置を動かさず、その場でゆっく〜り少し拡大（プレビューチャージ）
    Animated.timing(playlistPressScale, {
      toValue: 1.05,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const resetPlaylistPressPreview = () => {
    pressActiveRef.current = false;
    if (!isLongPressedRef.current) {
      pressedPlaylistKeyRef.current = null;
      Animated.parallel([
        Animated.timing(playlistPressTranslateX, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(playlistPressTranslateY, { toValue: 0, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(playlistPressScale, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setPressedPlaylistKey(null);
      });
    }
  };

  const handlePlaylistLongPress = (item: any, rowKey: string) => {
    isLongPressedRef.current = true;

    // ★ 振動（Haptics）が鳴る
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const executeFastMove = (x: number, y: number, measuredWidth: number, measuredHeight: number) => {
      // 目標位置（もっと下の方）へ急移動
      const targetX = width / 2 - (x + measuredWidth / 2);
      const targetY = menuTopOffset + 52 - (y + measuredHeight / 2);
      const snapEasing = Easing.bezier(0.12, 0.95, 0.22, 1);

      Animated.parallel([
        Animated.timing(playlistPressTranslateX, {
          toValue: targetX,
          duration: 200,
          easing: snapEasing,
          useNativeDriver: true,
        }),
        Animated.timing(playlistPressTranslateY, {
          toValue: targetY,
          duration: 200,
          easing: snapEasing,
          useNativeDriver: true,
        }),
        Animated.timing(playlistPressScale, {
          toValue: 1.08,
          duration: 200,
          easing: snapEasing,
          useNativeDriver: true,
        }),
      ]).start(() => {
        openRowActionSheet(item, {
          x: width / 2 - measuredWidth / 2,
          y: menuTopOffset,
          width: measuredWidth,
          height: measuredHeight
        });

        setTimeout(() => {
          pressedPlaylistKeyRef.current = null;
          playlistPressTranslateX.setValue(0);
          playlistPressTranslateY.setValue(0);
          playlistPressScale.setValue(1);
          setPressedPlaylistKey(null);
        }, 120);
      });
    };

    const cached = initialRowLayoutRef.current;
    if (cached) {
      executeFastMove(cached.x, cached.y, cached.width, cached.height);
    } else {
      const rowRef = playlistRowRefs.current[rowKey];
      if (!rowRef) {
        openRowActionSheet(item);
        return;
      }
      rowRef.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        executeFastMove(x, y, measuredWidth, measuredHeight);
      });
    }
  };

  const animatePlaylistIntoMenu = () => {
    const origin = rowActionOriginRef.current;
    const header = rowActionHeaderRef.current;
    if (!rowActionTransitionPending.current || !origin || !header) return;
    rowActionTransitionPending.current = false;
    header.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      headerTranslateX.setValue(origin.x + origin.width / 2 - x - measuredWidth / 2);
      headerTranslateY.setValue(origin.y + origin.height / 2 - y - measuredHeight / 2);
      headerScaleX.setValue(origin.width / Math.max(measuredWidth, 1));
      headerScaleY.setValue(origin.height / Math.max(measuredHeight, 1));
      Animated.parallel([
        Animated.timing(headerTranslateX, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerTranslateY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerScaleX, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerScaleY, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerTransitionAnim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const openCoverPickerSheet = (target: any) => {
    setCoverPickerTarget(target);
    sheetAnimCover.setValue(0);
    Animated.spring(sheetAnimCover, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const applyCoverImage = async (targetPl: any, sourceUri: string | null) => {
    if (!targetPl) return;

    try {
      let finalUri = null;

      if (sourceUri) {
        const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
        
        const ext = sourceUri.split('.').pop() || 'jpg';
        const destUri = `${baseDir}cover_custom_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: sourceUri, to: destUri });
        finalUri = destUri;
      }

      // ★ 「すべての楽曲」のカバー画像保存・反映
      if (targetPl.isAll) {
        if (finalUri) {
          await AsyncStorage.setItem('all_songs_cover_uri', finalUri);
        } else {
          await AsyncStorage.removeItem('all_songs_cover_uri');
        }
        setAllSongsCoverUri(finalUri);

        if (setCurrentPlaylist) {
          setCurrentPlaylist({
            playlistName: t('all_songs_item', language),
            isAll: true,
            id: 'all_songs',
            type: 'normal',
            localCoverImageUri: finalUri
          });
        }
      } else {
        const updated = localPlaylists.map((pl: any) => {
          if (pl.id === targetPl.id) {
            return { ...pl, localCoverImageUri: finalUri };
          }
          return pl;
        });

        await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
        if (setLocalPlaylists) setLocalPlaylists(updated);

        const updatedCurrent = updated.find((pl: any) => pl.id === targetPl.id);
        if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);

        syncMusicAndPlaylistsToCloud();
      }

      Alert.alert(t('confirm', language), sourceUri ? t('cover_updated', language) : t('cover_reset', language));
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const pickFromLibrary = async (targetPl: any) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permission_required', language), t('permission_photos_desc', language));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyCoverImage(targetPl, result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const pickFromCamera = async (targetPl: any) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permission_required', language), t('permission_camera_desc', language));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyCoverImage(targetPl, result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const pickFromDocuments = async (targetPl: any) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await applyCoverImage(targetPl, result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const handleProceedToSongSelection = () => {
    if (!newPlaylistName.trim()) {
      Alert.alert(t('alert_timer_error_title', language), t('new_playlist_modal_desc', language));
      return;
    }
    setCreateNameModalVisible(false);
    setSelectedSongFilenames(new Set());
    setSongSearchQuery('');
    setSelectSongsModalVisible(true);
  };

  const handleCreatePlaylistSave = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;

    const newPl = {
      id: 'pl_' + Date.now(),
      playlistName: name,
      type: 'normal',
      music: Array.from(selectedSongFilenames),
      sortBy: 'title',
      sortDesc: false
    };

    const updated = [...localPlaylists, newPl];
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);

    syncMusicAndPlaylistsToCloud();

    setSelectSongsModalVisible(false);
    setNewPlaylistName('');
    setSelectedSongFilenames(new Set());
    Alert.alert(t('confirm', language), t('playlist_created_alert', language).replace('{name}', name));
  };

  const handleSaveSmartPlaylist = async (name: string, conditions: any) => {
    if (smartEditorConfig.mode === 'CREATE') {
      const newSmartPl = {
        id: 'smart_' + Date.now(),
        playlistName: name,
        type: 'smart',
        sortBy: 'title',
        sortDesc: false,
        conditions
      };
      const updated = [...localPlaylists, newSmartPl];
      await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
      if (setLocalPlaylists) setLocalPlaylists(updated);
      setSmartEditorConfig({ visible: false, mode: 'CREATE', targetPlaylist: null });

      syncMusicAndPlaylistsToCloud();

      Alert.alert(t('confirm', language), t('smart_playlist_created_alert', language).replace('{name}', name));
    } else {
      const target = smartEditorConfig.targetPlaylist;
      if (!target) return;

      const updated = localPlaylists.map((pl: any) => {
        if (pl.id === target.id) {
          return { ...pl, conditions };
        }
        return pl;
      });
      await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
      if (setLocalPlaylists) setLocalPlaylists(updated);

      const updatedCurrent = updated.find((pl: any) => pl.id === target.id);
      if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);

      setSmartEditorConfig({ visible: false, mode: 'EDIT', targetPlaylist: null });

      syncMusicAndPlaylistsToCloud();

      Alert.alert(t('confirm', language), t('rules_saved_alert', language).replace('{name}', target.playlistName));
    }
  };

  const handleConvertToNormalPlaylist = (targetPl: any) => {
    Alert.alert(
      t('convert_smart_confirm_title', language),
      t('convert_smart_confirm_desc', language).replace('{name}', targetPl.playlistName),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('convert_confirm_btn', language),
          style: 'destructive',
          onPress: async () => {
            try {
              const currentSongs = getPlaylistSongs(targetPl, localLibrary);
              const currentFilenames = currentSongs
                .map((sVal: any) => sVal.musicFilename?.split(/[\\/]/).pop())
                .filter(Boolean);

              const updated = localPlaylists.map((pl: any) => {
                if (pl.id === targetPl.id) {
                  const { conditions, ...rest } = pl;
                  return {
                    ...rest,
                    type: 'normal',
                    music: currentFilenames,
                  };
                }
                return pl;
              });

              await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
              if (setLocalPlaylists) setLocalPlaylists(updated);

              const updatedCurrent = updated.find((pl: any) => pl.id === targetPl.id);
              if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);

              syncMusicAndPlaylistsToCloud();

              Alert.alert(t('confirm', language), t('convert_smart_done', language).replace('{name}', targetPl.playlistName));
            } catch (e: any) {
              Alert.alert(t('alert_timer_error_title', language), e.message);
            }
          }
        }
      ]
    );
  };

  const openEditPlaylistSongsModal = (targetPl: any) => {
    const musicList = Array.isArray(targetPl.music) ? targetPl.music : [];
    const fnames = musicList.map((m: any) => {
      const pathStr = typeof m === 'string' ? m : (m?.musicFilename || m?.path || '');
      return pathStr.split(/[\\/]/).pop();
    }).filter(Boolean);

    setEditSongsTargetPl(targetPl);
    setEditSongsSelectedFilenames(new Set(fnames));
    setEditSongsSearchQuery('');
  };

  const handleSaveEditPlaylistSongs = async () => {
    if (!editSongsTargetPl) return;

    const updated = localPlaylists.map((pl: any) => {
      if (pl.id === editSongsTargetPl.id) {
        return {
          ...pl,
          music: Array.from(editSongsSelectedFilenames),
        };
      }
      return pl;
    });

    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);

    const updatedCurrent = updated.find((pl: any) => pl.id === editSongsTargetPl.id);
    if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);

    setEditSongsTargetPl(null);

    syncMusicAndPlaylistsToCloud();

    Alert.alert(t('confirm', language), t('tracks_updated_alert', language).replace('{name}', editSongsTargetPl.playlistName));
  };

  // ★ 「すべての楽曲」または通常・スマートプレイリストの複製
  const handleDuplicatePlaylist = async (targetPl: any) => {
    let newPl: any;

    if (targetPl.isAll) {
      const allMusicFilenames = localLibrary
        .map((s: any) => s.musicFilename?.split(/[\\/]/).pop())
        .filter(Boolean);

      newPl = {
        id: 'pl_' + Date.now(),
        playlistName: `${targetPl.playlistName} (${t('keep_label', language).replace(/[<>]/g, '')})`,
        type: 'normal',
        music: allMusicFilenames,
        sortBy: 'title',
        sortDesc: false,
        localCoverImageUri: allSongsCoverUri || null,
      };
    } else {
      newPl = {
        ...targetPl,
        id: 'pl_' + Date.now(),
        playlistName: `${targetPl.playlistName} (${t('keep_label', language).replace(/[<>]/g, '')})`,
      };
    }

    const updated = [...localPlaylists, newPl];
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);

    syncMusicAndPlaylistsToCloud();

    Alert.alert(t('confirm', language), t('playlist_duplicated_alert', language).replace('{name}', newPl.playlistName));
  };

  const handleSaveRename = async () => {
    if (!renameTarget || !renameInput.trim()) return;

    const updated = localPlaylists.map((pl: any) => {
      if (pl.id === renameTarget.id) {
        return { ...pl, playlistName: renameInput.trim() };
      }
      return pl;
    });

    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);

    setRenameTarget(null);
    setRenameInput('');

    syncMusicAndPlaylistsToCloud();
  };

  const handleDeletePlaylist = (targetPl: any) => {
    Alert.alert(
      t('delete_playlist_confirm_title', language),
      t('delete_playlist_confirm_desc', language).replace('{name}', targetPl.playlistName),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete_confirm_btn', language),
          style: 'destructive',
          onPress: async () => {
            const updated = localPlaylists.filter((pl: any) => pl.id !== targetPl.id);
            await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
            if (setLocalPlaylists) setLocalPlaylists(updated);

            syncMusicAndPlaylistsToCloud();
          }
        }
      ]
    );
  };

  const filteredSongsForCreate = useMemo(() => {
    if (!songSearchQuery.trim()) return localLibrary;
    const q = songSearchQuery.toLowerCase();
    return localLibrary.filter((sVal: any) => 
      sVal.title?.toLowerCase().includes(q) || sVal.artist?.toLowerCase().includes(q) || sVal.album?.toLowerCase().includes(q)
    );
  }, [localLibrary, songSearchQuery]);

  const filteredSongsForEdit = useMemo(() => {
    if (!editSongsSearchQuery.trim()) return localLibrary;
    const q = editSongsSearchQuery.toLowerCase();
    return localLibrary.filter((sVal: any) => 
      sVal.title?.toLowerCase().includes(q) || sVal.artist?.toLowerCase().includes(q) || sVal.album?.toLowerCase().includes(q)
    );
  }, [localLibrary, editSongsSearchQuery]);

  const headerRightButton = isPlaylistsTab ? (
    <AnimatedMenuButton 
      onPress={openHeaderMenu}
      isDark={isDark}
      textStyle={dynamicStyles.text}
    />
  ) : undefined;

  const getHeaderTitle = () => {
    if (category === 'PLAYLISTS') return t('cat_playlists', language);
    if (category === 'ALBUMS') return t('cat_albums', language);
    return t('cat_artists', language);
  };

  return (
    <View style={{ flex: 1, backgroundColor: libraryBgColor }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: libraryBgColor, zIndex: -1 }} />

      {renderHeader(getHeaderTitle(), headerRightButton)}

      <FlatList
        key={category}
        data={data}
        numColumns={category === 'ALBUMS' ? 2 : 1}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => {
          if (category === 'ALBUMS') {
            return (
              <TouchableOpacity 
                style={styles.albumGridItem} 
                onPress={() => { 
                  setCurrentSelectionType('ALBUM'); 
                  setCurrentAlbum(item); 
                  pushView('SONG_LIST'); 
                }}
              >
                <Image source={item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON} style={styles.albumGridImage} />
                <View style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
                  <MarqueeText text={item.album} style={[styles.albumGridTitle, { color: dynamicStyles.text }]} />
                  <MarqueeText text={item.artist} style={[styles.albumGridArtist, { color: dynamicStyles.subText, marginTop: 2 }]} />
                </View>
              </TouchableOpacity>
            );
          }

          const title = isPlaylistsTab ? item.playlistName : item.artistName;
          const artSource = isPlaylistsTab ? getPlaylistFirstArt(item, localLibrary) : (item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON);
          const isSmart = isPlaylistsTab && item.type === 'smart';
          const isLast = index === data.length - 1;
          const rowKey = String(item.id ?? index);

          return (
            <Animated.View style={{
              backgroundColor: libraryBgColor,
              transform: pressedPlaylistKey === rowKey
                ? [
                    { translateX: playlistPressTranslateX },
                    { translateY: playlistPressTranslateY },
                    { scale: playlistPressScale },
                  ]
                : [],
            }}>
              <TouchableOpacity 
                ref={(ref) => { playlistRowRefs.current[rowKey] = ref; }}
                style={[styles.checkRow, { borderBottomWidth: 0, paddingVertical: 14 }]} 
                onPressIn={isPlaylistsTab ? () => startPlaylistPressPreview(rowKey) : undefined}
                onPressOut={isPlaylistsTab ? resetPlaylistPressPreview : undefined}
                onPress={() => { 
                  if (isPlaylistsTab) resetPlaylistPressPreview();
                  if (isPlaylistsTab) { setCurrentSelectionType('PLAYLIST'); setCurrentPlaylist(item); }
                  else { setCurrentSelectionType('ARTIST'); setCurrentArtist(item.artistName); }
                  pushView('SONG_LIST'); 
                }}
                onLongPress={isPlaylistsTab ? () => handlePlaylistLongPress(item, rowKey) : undefined}
                delayLongPress={300}
              >
                <Image source={artSource} style={[styles.playlistIconArt, category === 'ARTISTS' && { borderRadius: 35 }]} />
                <View style={{ flex: 1, marginLeft: 15, marginRight: 10, minWidth: 0, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {showPlaylistTypeIcon && isPlaylistsTab && (
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
                
                {/* ★ すべての楽曲にも三点マークボタンを表示 */}
                {isPlaylistsTab ? (
                  <AnimatedMenuButton 
                    onPress={() => openRowActionSheet(item)}
                    isDark={isDark}
                    textStyle={dynamicStyles.text}
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
                )}
              </TouchableOpacity>

              {isPlaylistsTab && !isLast && (
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginLeft: 95, marginRight: 20 }} />
              )}
            </Animated.View>
          );
        }}
        contentContainerStyle={safePadding}
      />

      {/* 1. ヘッダー3点メニュー */}
      <Modal visible={headerMenuVisible} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeHeaderMenu()}>
          <Animated.View style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnimHeader, 
            justifyContent: 'flex-end', paddingHorizontal: 15, 
            paddingTop: Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{ gap: 10, transform: [{ translateY: sheetAnimHeader.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      closeHeaderMenu(() => {
                        setNewPlaylistName('');
                        setCreateNameModalVisible(true);
                      });
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_new_playlist', language)}</Text>
                  </LiquidGlassMenuOption>

                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => {
                      closeHeaderMenu(() => {
                        setSmartEditorConfig({ visible: true, mode: 'CREATE', targetPlaylist: null });
                      });
                    }}
                  >
                    <Ionicons name="flash-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_smart_playlist', language)}</Text>
                  </LiquidGlassMenuOption>
                </View>

                <AnimatedCancelButton onPress={() => closeHeaderMenu()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 2. 各プレイリスト行の3点メニュー（下の方にゆったり表示） */}
      <Modal visible={!!rowActionTarget} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <TouchableWithoutFeedback onPress={() => closeRowActionSheet()}>
          <Animated.View style={{ 
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.48)',
            opacity: sheetAnimRow,
            justifyContent: 'flex-start',
            paddingHorizontal: 12,
            paddingTop: menuTopOffset,
            paddingBottom: Math.max(insets?.bottom || 0, 12) + 12,
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{
                width: isLandscape ? Math.min(900, width - 24) : undefined,
                maxWidth: Math.min(isLandscape ? 900 : 500, width - 24),
                maxHeight: '100%',
                alignSelf: 'center',
                gap: 8,
                transform: [{ translateY: sheetAnimRow.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              }}>
                <Animated.View
                  ref={(ref) => { rowActionHeaderRef.current = ref; }}
                  onLayout={animatePlaylistIntoMenu}
                  style={{
                  transform: [
                    { translateX: headerTranslateX },
                    { translateY: headerTranslateY },
                    { scaleX: headerScaleX },
                    { scaleY: headerScaleY },
                  ],
                  opacity: headerTransitionAnim,
                }}>
                <View style={{
                  backgroundColor: menuSurfaceColor,
                  borderRadius: 28,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: dynamicStyles.border,
                }}>
                  {useLiquidGlass && (
                    <GlassView
                      pointerEvents="none"
                      glassEffectStyle="regular"
                      colorScheme={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, minHeight: 96 }}>
                    <Image source={getPlaylistFirstArt(rowActionTarget, localLibrary)} style={{ width: 72, height: 72, borderRadius: 16, marginRight: 12 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontWeight: '700', fontSize: 17 }} numberOfLines={2}>{rowActionTarget?.playlistName}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 4 }}>
                        {rowActionTarget?.isAll ? t('all_songs_item', language) : (rowActionTarget?.type === 'smart' ? t('smart_playlist_label', language) : t('normal_playlist_label', language))}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={dynamicStyles.subText} style={{ marginLeft: 8 }} />
                  </View>
                </View>
                </Animated.View>

                <View style={{
                  backgroundColor: menuSurfaceColor,
                  borderRadius: 26,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: dynamicStyles.border,
                  flexShrink: 1,
                }}>
                  {useLiquidGlass && (
                    <GlassView
                      pointerEvents="none"
                      glassEffectStyle="regular"
                      colorScheme={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <ScrollView
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    style={{
                      flexGrow: 0,
                      flexShrink: 1,
                      maxHeight: Math.max(
                        120,
                        height - menuTopOffset - Math.max(insets?.bottom || 0, 12) - 180
                      ),
                    }}
                    contentContainerStyle={[
                      { paddingVertical: 0 },
                      isLandscape && { flexDirection: 'row', flexWrap: 'wrap' },
                    ]}
                  >
                  {/* ★ 「すべての楽曲」の場合は、カバー画像変更と複製のみを表示 */}
                  {rowActionTarget?.isAll ? (
                    <>
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / rowMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => openCoverPickerSheet(target));
                        }}
                      >
                        <Ionicons name="image-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('change_cover_image', language)}</Text>
                      </LiquidGlassMenuOption>

                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / rowMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => handleDuplicatePlaylist(target));
                        }}
                      >
                        <Ionicons name="copy-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('duplicate_playlist', language)}</Text>
                      </LiquidGlassMenuOption>
                    </>
                  ) : (
                    <>
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => {
                            setRenameTarget(target);
                            setRenameInput(target.playlistName);
                          });
                        }}
                      >
                        <Ionicons name="create-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('rename_playlist', language)}</Text>
                      </LiquidGlassMenuOption>

                      {/* ★ カバー画像変更メニュー */}
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => openCoverPickerSheet(target));
                        }}
                      >
                        <Ionicons name="image-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('change_cover_image', language)}</Text>
                      </LiquidGlassMenuOption>

                      {rowActionTarget?.type === 'smart' ? (
                        <>
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                            onPress={() => {
                              const target = rowActionTarget;
                              closeRowActionSheet(() => {
                                setSmartEditorConfig({ visible: true, mode: 'EDIT', targetPlaylist: target });
                              });
                            }}
                          >
                            <Ionicons name="options-outline" size={22} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_rules', language)}</Text>
                          </LiquidGlassMenuOption>

                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                            onPress={() => {
                              const target = rowActionTarget;
                              closeRowActionSheet(() => handleConvertToNormalPlaylist(target));
                            }}
                          >
                            <Ionicons name="swap-horizontal-outline" size={22} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('convert_to_normal_playlist', language)}</Text>
                          </LiquidGlassMenuOption>
                        </>
                      ) : (
                        <>
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                            onPress={() => {
                              const target = rowActionTarget;
                              closeRowActionSheet(() => openEditPlaylistSongsModal(target));
                            }}
                          >
                            <Ionicons name="musical-notes-outline" size={22} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_playlist_songs', language)}</Text>
                          </LiquidGlassMenuOption>
                        </>
                      )}

                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => handleDuplicatePlaylist(target));
                        }}
                      >
                        <Ionicons name="copy-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('duplicate_playlist', language)}</Text>
                      </LiquidGlassMenuOption>

                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => handleDeletePlaylist(target));
                        }}
                      >
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('delete_playlist', language)}</Text>
                      </LiquidGlassMenuOption>
                    </>
                  )}
                  </ScrollView>
                </View>

              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 3. カバー画像選択ポップアップ */}
      <Modal visible={!!coverPickerTarget} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeCoverPickerSheet()}>
          <Animated.View style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnimCover, 
            justifyContent: 'flex-end', paddingHorizontal: 15, 
            paddingTop: Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{ gap: 10, transform: [{ translateY: sheetAnimCover.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
                <View style={{ backgroundColor: Platform.OS === 'ios' && isLiquidGlassAvailable() ? 'transparent' : dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: Platform.OS === 'ios' && isLiquidGlassAvailable() ? 0 : 1, borderColor: dynamicStyles.border, gap: Platform.OS === 'ios' && isLiquidGlassAvailable() ? 8 : 0 }}>
                  <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border, alignItems: 'center' }}>
                    <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('set_cover_image_title', language)}</Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>{coverPickerTarget?.playlistName}</Text>
                  </View>

                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromLibrary(target));
                    }}
                  >
                    <Ionicons name="images-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('pick_from_photos', language)}</Text>
                  </LiquidGlassMenuOption>

                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromCamera(target));
                    }}
                  >
                    <Ionicons name="camera-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('take_photo', language)}</Text>
                  </LiquidGlassMenuOption>

                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: (coverPickerTarget?.localCoverImageUri || (coverPickerTarget?.isAll && allSongsCoverUri)) ? 1 : 0, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromDocuments(target));
                    }}
                  >
                    <Ionicons name="folder-open-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('pick_from_files', language)}</Text>
                  </LiquidGlassMenuOption>

                  {getPlaylistSongs(coverPickerTarget, localLibrary).some((song: any) => song.localImageUri) && (
                    <LiquidGlassMenuOption
                      isDark={isDark}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                      onPress={() => {
                        const target = coverPickerTarget;
                        closeCoverPickerSheet(() => setSongCoverPickerTarget(target));
                      }}
                    >
                      <Ionicons name="musical-notes-outline" size={22} color={themeColor} />
                      <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('pick_cover_from_songs', language)}</Text>
                    </LiquidGlassMenuOption>
                  )}

                  {(coverPickerTarget?.localCoverImageUri || (coverPickerTarget?.isAll && allSongsCoverUri)) && (
                    <LiquidGlassMenuOption
                      isDark={isDark}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                      onPress={() => {
                        const target = coverPickerTarget;
                        closeCoverPickerSheet(() => applyCoverImage(target, null));
                      }}
                    >
                      <Ionicons name="refresh-outline" size={22} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('reset_cover_image', language)}</Text>
                    </LiquidGlassMenuOption>
                  )}
                </View>

                <AnimatedCancelButton onPress={() => closeCoverPickerSheet()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={!!songCoverPickerTarget} transparent animationType="fade" onRequestClose={() => setSongCoverPickerTarget(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 }}>
          <View style={{ maxHeight: '80%', backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
            <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', padding: 18 }}>{t('choose_song_cover_title', language)}</Text>
            {songCoverPickerSongs.length > 0 ? (
              <FlatList
                data={songCoverPickerSongs}
                keyExtractor={(song: any, index) => `${song.musicFilename || song.title}-${index}`}
                renderItem={({ item }: any) => (
                  <TouchableOpacity
                    onPress={() => {
                      const target = songCoverPickerTarget;
                      setSongCoverPickerTarget(null);
                      void applyCoverImage(target, item.localImageUri);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: dynamicStyles.border }}
                  >
                    <Image source={{ uri: item.localImageUri }} style={{ width: 48, height: 48, borderRadius: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: dynamicStyles.text, fontWeight: '600' }}>{item.title || 'Untitled'}</Text>
                      <Text numberOfLines={1} style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }}>{item.artist || 'Unknown Artist'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={dynamicStyles.subText} />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={{ color: dynamicStyles.subText, paddingHorizontal: 18, paddingBottom: 18 }}>{t('no_song_covers', language)}</Text>
            )}
            <TouchableOpacity onPress={() => setSongCoverPickerTarget(null)} style={{ padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: dynamicStyles.border }}>
              <Text style={{ color: themeColor, fontWeight: '600' }}>{t('cancel', language)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. 新規プレイリスト名 入力モーダル */}
      <Modal visible={createNameModalVisible} transparent animationType="none">
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border }}>
            <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' }}>
              {t('new_playlist_modal_title', language)}
            </Text>
            <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginBottom: 18, textAlign: 'center' }}>
              {t('new_playlist_modal_desc', language)}
            </Text>

            <TextInput 
              style={{
                height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 20
              }}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder={t('playlist_name_placeholder', language)}
              placeholderTextColor={dynamicStyles.subText}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setCreateNameModalVisible(false)}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 48, borderRadius: 24, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={handleProceedToSongSelection}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t('next_select_songs', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. 新規プレイリストの楽曲選択モーダル */}
      <Modal visible={selectSongsModalVisible} transparent animationType="none">
        <View style={{ 
          flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20)
        }}>
          <View style={{
            width: isLandscape ? Math.min(width * 0.9, 600) : '90%',
            maxHeight: isLandscape ? '85%' : '75%',
            flexShrink: 1, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22,
            borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>{t('add_songs_title', language)}</Text>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t('add_songs_desc', language).replace('{name}', newPlaylistName)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectSongsModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 10, paddingHorizontal: 10,
              backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 10
            }}>
              <Ionicons name="search" size={15} color={dynamicStyles.subText} style={{ marginRight: 6 }} />
              <TextInput 
                style={{ flex: 1, color: dynamicStyles.text, fontSize: 13 }}
                placeholder={t('search_song_placeholder', language)}
                placeholderTextColor={dynamicStyles.subText}
                value={songSearchQuery}
                onChangeText={setSongSearchQuery}
              />
            </View>

            <FlatList
              data={filteredSongsForCreate}
              keyExtractor={(item) => item.localMusicUri}
              style={{ marginVertical: 4, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 15 }}
              renderItem={({ item }) => {
                const fname = item.musicFilename?.split(/[\\/]/).pop();
                const isSelected = fname ? selectedSongFilenames.has(fname) : false;

                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12,
                      backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                      marginBottom: 8, borderWidth: 1, borderColor: isSelected ? themeColor : dynamicStyles.border
                    }}
                    onPress={() => {
                      if (!fname) return;
                      const next = new Set(selectedSongFilenames);
                      if (next.has(fname)) next.delete(fname);
                      else next.add(fname);
                      setSelectedSongFilenames(next);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={{ marginRight: 10 }}>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? themeColor : dynamicStyles.subText} />
                    </View>
                    <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{item.artist || 'Unknown'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity 
              style={{ height: 50, borderRadius: 25, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 10 }}
              onPress={handleCreatePlaylistSave}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                {t('create_playlist_with_count', language).replace('{count}', String(selectedSongFilenames.size))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 6. プレイリストの収録曲編集モーダル */}
      <Modal visible={!!editSongsTargetPl} transparent animationType="none">
        <View style={{ 
          flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20)
        }}>
          <View style={{
            width: isLandscape ? Math.min(width * 0.9, 600) : '90%',
            maxHeight: isLandscape ? '85%' : '75%',
            flexShrink: 1, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22,
            borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden'
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>{t('edit_playlist_songs_title', language)}</Text>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{t('edit_playlist_songs_desc', language).replace('{name}', editSongsTargetPl?.playlistName)}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditSongsTargetPl(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 10, paddingHorizontal: 10,
              backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 10
            }}>
              <Ionicons name="search" size={15} color={dynamicStyles.subText} style={{ marginRight: 6 }} />
              <TextInput 
                style={{ flex: 1, color: dynamicStyles.text, fontSize: 13 }}
                placeholder={t('search_song_placeholder', language)}
                placeholderTextColor={dynamicStyles.subText}
                value={editSongsSearchQuery}
                onChangeText={setEditSongsSearchQuery}
              />
            </View>

            <FlatList
              data={filteredSongsForEdit}
              keyExtractor={(item) => item.localMusicUri}
              style={{ marginVertical: 4, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 15 }}
              renderItem={({ item }) => {
                const fname = item.musicFilename?.split(/[\\/]/).pop();
                const isSelected = fname ? editSongsSelectedFilenames.has(fname) : false;

                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12,
                      backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                      marginBottom: 8, borderWidth: 1, borderColor: isSelected ? themeColor : dynamicStyles.border
                    }}
                    onPress={() => {
                      if (!fname) return;
                      const next = new Set(editSongsSelectedFilenames);
                      if (next.has(fname)) next.delete(fname);
                      else next.add(fname);
                      setEditSongsSelectedFilenames(next);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={{ marginRight: 10 }}>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={20} color={isSelected ? themeColor : dynamicStyles.subText} />
                    </View>
                    <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{item.artist || 'Unknown'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <TouchableOpacity 
              style={{ height: 50, borderRadius: 25, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 10 }}
              onPress={handleSaveEditPlaylistSongs}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                {t('save_changes_with_count', language).replace('{count}', String(editSongsSelectedFilenames.size))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. プレイリスト名 変更モーダル */}
      <Modal visible={!!renameTarget} transparent animationType="none">
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border }}>
            <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' }}>
              {t('rename_playlist_modal_title', language)}
            </Text>

            <TextInput 
              style={{
                height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                color: dynamicStyles.text, fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border, marginVertical: 18
              }}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder={t('new_name_placeholder', language)}
              placeholderTextColor={dynamicStyles.subText}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setRenameTarget(null)}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 48, borderRadius: 24, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={handleSaveRename}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t('save_changes_btn', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. スマートプレイリスト作成・編集モーダル */}
      <SmartPlaylistEditorModal 
        visible={smartEditorConfig.visible}
        mode={smartEditorConfig.mode}
        initialPlaylist={smartEditorConfig.targetPlaylist}
        onClose={() => setSmartEditorConfig({ visible: false, mode: 'CREATE', targetPlaylist: null })}
        onSave={handleSaveSmartPlaylist}
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        isDark={isDark}
        insets={insets}
        language={language}
      />
    </View>
  );
};
