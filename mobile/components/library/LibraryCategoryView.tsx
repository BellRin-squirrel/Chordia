import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity,
  TouchableWithoutFeedback, Alert, Animated, Easing, 
  Platform, useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

import { MeasurableView } from './category/categoryTypes';
import { PlaylistRowActionModal } from './category/PlaylistRowActionModal';
import { PlaylistCoverModals } from './category/PlaylistCoverModals';
import { PlaylistEditModals } from './category/PlaylistEditModals';

const DEFAULT_ICON = require('../../assets/images/icon.png');

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{
        width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        overflow: 'hidden', transform: [{ scale }]
      }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={textStyle} />
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
  const libraryBgColor = isDark ? '#000000' : '#ffffff';

  const [allSongsCoverUri, setAllSongsCoverUri] = useState<string | null>(null);

  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [rowActionTarget, setRowActionTarget] = useState<any>(null);

  const [pressingPlaylistKey, setPressingPlaylistKey] = useState<string | null>(null);
  const [activeMorphRowKey, setActiveMorphRowKey] = useState<string | null>(null);
  const initialRowLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const isLongPressedRef = useRef(false);

  const playlistPressChargeScale = useRef(new Animated.Value(1)).current;
  const morphProgress = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const playlistRowRefs = useRef<Record<string, MeasurableView | null>>({});
  const rowActionOriginRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [coverPickerTarget, setCoverPickerTarget] = useState<any>(null);
  const [songCoverPickerTarget, setSongCoverPickerTarget] = useState<any>(null);

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
    visible: boolean; mode: 'CREATE' | 'EDIT'; targetPlaylist: any | null;
  }>({ visible: false, mode: 'CREATE', targetPlaylist: null });

  const isPlaylistsTab = category === 'PLAYLISTS';
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const menuTopOffset = isLandscape 
    ? Math.max(insets?.top || 0, 20) + (isPad ? 28 : 16)
    : Math.max((insets?.top || 0) + (isPad ? 95 : 75), height * 0.16);

  useEffect(() => {
    (async () => {
      try {
        const savedCover = await AsyncStorage.getItem('all_songs_cover_uri');
        if (savedCover) {
          const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
          const fname = savedCover.split(/[\\/]/).pop();
          setAllSongsCoverUri(fname ? baseDir + fname : savedCover);
        }
      } catch (e) {}
    })();
  }, []);

  const data = isPlaylistsTab 
    ? [{ playlistName: t('all_songs_item', language), isAll: true, id: 'all_songs', type: 'normal', localCoverImageUri: allSongsCoverUri }, ...localPlaylists] 
    : category === 'ALBUMS' ? albumsList : artistsList;

  const closeRowActionSheet = (callback?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.timing(morphProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setRowActionTarget(null);
      setActiveMorphRowKey(null);
      rowActionOriginRef.current = null;
      isClosingRef.current = false;
      if (callback) setTimeout(callback, Platform.OS === 'ios' ? 400 : 100);
    });
  };

  const openRowActionSheet = (item: any, originLayout?: { x: number; y: number; width: number; height: number }, rowKey?: string) => {
    isClosingRef.current = false;
    rowActionOriginRef.current = originLayout || null;
    if (rowKey) setActiveMorphRowKey(rowKey);
    setRowActionTarget(item);

    morphProgress.setValue(0);
    Animated.timing(morphProgress, {
      toValue: 1,
      duration: 250,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  };

  const startPlaylistPressPreview = (rowKey: string) => {
    isLongPressedRef.current = false;
    setPressingPlaylistKey(rowKey);
    playlistPressChargeScale.stopAnimation();
    playlistPressChargeScale.setValue(1);

    const row = playlistRowRefs.current[rowKey];
    if (row) {
      row.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        if (measuredWidth > 0 && measuredHeight > 0) {
          initialRowLayoutRef.current = { x, y, width: measuredWidth, height: measuredHeight };
        }
      });
    }

    Animated.timing(playlistPressChargeScale, {
      toValue: 1.04,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const resetPlaylistPressPreview = () => {
    if (!isLongPressedRef.current) {
      Animated.timing(playlistPressChargeScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setPressingPlaylistKey(null);
      });
    }
  };

  const handlePlaylistLongPress = (item: any, rowKey: string) => {
    isLongPressedRef.current = true;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}

    const triggerOpen = (x: number, y: number, measuredWidth: number, measuredHeight: number) => {
      playlistPressChargeScale.setValue(1);
      setPressingPlaylistKey(null);
      openRowActionSheet(item, { x, y, width: measuredWidth, height: measuredHeight }, rowKey);
    };

    const cached = initialRowLayoutRef.current;
    if (cached) {
      triggerOpen(cached.x, cached.y, cached.width, cached.height);
    } else {
      const rowRef = playlistRowRefs.current[rowKey];
      if (!rowRef) {
        openRowActionSheet(item, undefined, rowKey);
        return;
      }
      rowRef.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        triggerOpen(x, y, measuredWidth, measuredHeight);
      });
    }
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

      if (targetPl.isAll) {
        if (finalUri) await AsyncStorage.setItem('all_songs_cover_uri', finalUri);
        else await AsyncStorage.removeItem('all_songs_cover_uri');
        setAllSongsCoverUri(finalUri);
        if (setCurrentPlaylist) setCurrentPlaylist({ playlistName: t('all_songs_item', language), isAll: true, id: 'all_songs', type: 'normal', localCoverImageUri: finalUri });
      } else {
        const updated = localPlaylists.map((pl: any) => pl.id === targetPl.id ? { ...pl, localCoverImageUri: finalUri } : pl);
        await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
        if (setLocalPlaylists) setLocalPlaylists(updated);
        const updatedCurrent = updated.find((pl: any) => pl.id === targetPl.id);
        if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);
        syncMusicAndPlaylistsToCloud();
      }
      Alert.alert(t('confirm', language), sourceUri ? t('cover_updated', language) : t('cover_reset', language));
    } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
  };

  const pickFromLibrary = async (targetPl: any) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permission_required', language), t('permission_photos_desc', language)); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (!res.canceled && res.assets?.[0]?.uri) await applyCoverImage(targetPl, res.assets[0].uri);
    } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
  };

  const pickFromCamera = async (targetPl: any) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('permission_required', language), t('permission_camera_desc', language)); return; }
      const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (!res.canceled && res.assets?.[0]?.uri) await applyCoverImage(targetPl, res.assets[0].uri);
    } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
  };

  const pickFromDocuments = async (targetPl: any) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.[0]?.uri) await applyCoverImage(targetPl, res.assets[0].uri);
    } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
  };

  const handleCreatePlaylistSave = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const newPl = { id: 'pl_' + Date.now(), playlistName: name, type: 'normal', music: Array.from(selectedSongFilenames), sortBy: 'title', sortDesc: false };
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
      const newSmartPl = { id: 'smart_' + Date.now(), playlistName: name, type: 'smart', sortBy: 'title', sortDesc: false, conditions };
      const updated = [...localPlaylists, newSmartPl];
      await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
      if (setLocalPlaylists) setLocalPlaylists(updated);
      setSmartEditorConfig({ visible: false, mode: 'CREATE', targetPlaylist: null });
      syncMusicAndPlaylistsToCloud();
      Alert.alert(t('confirm', language), t('smart_playlist_created_alert', language).replace('{name}', name));
    } else {
      const target = smartEditorConfig.targetPlaylist;
      if (!target) return;
      const updated = localPlaylists.map((pl: any) => pl.id === target.id ? { ...pl, conditions } : pl);
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
    Alert.alert(t('convert_smart_confirm_title', language), t('convert_smart_confirm_desc', language).replace('{name}', targetPl.playlistName), [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('convert_confirm_btn', language), style: 'destructive', onPress: async () => {
          try {
            const currentFilenames = getPlaylistSongs(targetPl, localLibrary).map((sVal: any) => sVal.musicFilename?.split(/[\\/]/).pop()).filter(Boolean);
            const updated = localPlaylists.map((pl: any) => {
              if (pl.id === targetPl.id) {
                const { conditions, ...rest } = pl;
                return { ...rest, type: 'normal', music: currentFilenames };
              }
              return pl;
            });
            await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
            if (setLocalPlaylists) setLocalPlaylists(updated);
            const updatedCurrent = updated.find((pl: any) => pl.id === targetPl.id);
            if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);
            syncMusicAndPlaylistsToCloud();
            Alert.alert(t('confirm', language), t('convert_smart_done', language).replace('{name}', targetPl.playlistName));
          } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
        }
      }
    ]);
  };

  const handleSaveEditPlaylistSongs = async () => {
    if (!editSongsTargetPl) return;
    const updated = localPlaylists.map((pl: any) => pl.id === editSongsTargetPl.id ? { ...pl, music: Array.from(editSongsSelectedFilenames) } : pl);
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);
    const updatedCurrent = updated.find((pl: any) => pl.id === editSongsTargetPl.id);
    if (setCurrentPlaylist && updatedCurrent) setCurrentPlaylist(updatedCurrent);
    setEditSongsTargetPl(null);
    syncMusicAndPlaylistsToCloud();
    Alert.alert(t('confirm', language), t('tracks_updated_alert', language).replace('{name}', editSongsTargetPl.playlistName));
  };

  const handleDuplicatePlaylist = async (targetPl: any) => {
    let newPl: any;
    if (targetPl.isAll) {
      newPl = {
        id: 'pl_' + Date.now(),
        playlistName: `${targetPl.playlistName} (${t('keep_label', language).replace(/[<>]/g, '')})`,
        type: 'normal',
        music: localLibrary.map((s: any) => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean),
        sortBy: 'title', sortDesc: false, localCoverImageUri: allSongsCoverUri || null,
      };
    } else {
      newPl = { ...targetPl, id: 'pl_' + Date.now(), playlistName: `${targetPl.playlistName} (${t('keep_label', language).replace(/[<>]/g, '')})` };
    }
    const updated = [...localPlaylists, newPl];
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);
    syncMusicAndPlaylistsToCloud();
    Alert.alert(t('confirm', language), t('playlist_duplicated_alert', language).replace('{name}', newPl.playlistName));
  };

  const handleSaveRename = async () => {
    if (!renameTarget || !renameInput.trim()) return;
    const updated = localPlaylists.map((pl: any) => pl.id === renameTarget.id ? { ...pl, playlistName: renameInput.trim() } : pl);
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);
    setRenameTarget(null);
    setRenameInput('');
    syncMusicAndPlaylistsToCloud();
  };

  const handleDeletePlaylist = (targetPl: any) => {
    Alert.alert(t('delete_playlist_confirm_title', language), t('delete_playlist_confirm_desc', language).replace('{name}', targetPl.playlistName), [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete_confirm_btn', language), style: 'destructive', onPress: async () => {
          const updated = localPlaylists.filter((pl: any) => pl.id !== targetPl.id);
          await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
          if (setLocalPlaylists) setLocalPlaylists(updated);
          syncMusicAndPlaylistsToCloud();
        }
      }
    ]);
  };

  const filteredSongsForCreate = useMemo(() => {
    if (!songSearchQuery.trim()) return localLibrary;
    const q = songSearchQuery.toLowerCase();
    return localLibrary.filter((sVal: any) => sVal.title?.toLowerCase().includes(q) || sVal.artist?.toLowerCase().includes(q) || sVal.album?.toLowerCase().includes(q));
  }, [localLibrary, songSearchQuery]);

  const filteredSongsForEdit = useMemo(() => {
    if (!editSongsSearchQuery.trim()) return localLibrary;
    const q = editSongsSearchQuery.toLowerCase();
    return localLibrary.filter((sVal: any) => sVal.title?.toLowerCase().includes(q) || sVal.artist?.toLowerCase().includes(q) || sVal.album?.toLowerCase().includes(q));
  }, [localLibrary, editSongsSearchQuery]);

  const headerRightButton = isPlaylistsTab ? (
    <AnimatedMenuButton onPress={() => setHeaderMenuVisible(true)} isDark={isDark} textStyle={dynamicStyles.text} />
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
              <TouchableOpacity style={styles.albumGridItem} onPress={() => { setCurrentSelectionType('ALBUM'); setCurrentAlbum(item); pushView('SONG_LIST'); }}>
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

          const isRowPressing = pressingPlaylistKey === rowKey;
          const isRowHidden = activeMorphRowKey === rowKey;

          return (
            <Animated.View style={{
              backgroundColor: libraryBgColor,
              opacity: isRowHidden ? 0 : 1,
              transform: [{ scale: isRowPressing ? playlistPressChargeScale : 1 }],
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
                      <Ionicons name={isSmart ? "flash" : "musical-notes"} size={16} color={themeColor} style={{ marginRight: 6 }} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <MarqueeText text={title} style={[styles.rowTitle, { color: dynamicStyles.text, marginLeft: 0 }]} />
                    </View>
                  </View>
                </View>
                
                {isPlaylistsTab ? (
                  <AnimatedMenuButton onPress={() => openRowActionSheet(item, undefined, rowKey)} isDark={isDark} textStyle={dynamicStyles.text} />
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

      {/* 各プレイリスト行の3点メニュー＆モーフィングモーダル */}
      <PlaylistRowActionModal 
        target={rowActionTarget}
        originLayout={rowActionOriginRef.current}
        morphProgress={morphProgress}
        onClose={closeRowActionSheet}
        onRename={(t) => { setRenameTarget(t); setRenameInput(t.playlistName); }}
        onChangeCover={(t) => setCoverPickerTarget(t)}
        onEditRules={(t) => setSmartEditorConfig({ visible: true, mode: 'EDIT', targetPlaylist: t })}
        onConvertToNormal={handleConvertToNormalPlaylist}
        onEditSongs={(t) => {
          const fnames = (Array.isArray(t.music) ? t.music : []).map((m: any) => (typeof m === 'string' ? m : (m?.musicFilename || m?.path || '')).split(/[\\/]/).pop()).filter(Boolean);
          setEditSongsTargetPl(t);
          setEditSongsSelectedFilenames(new Set(fnames));
          setEditSongsSearchQuery('');
        }}
        onDuplicate={handleDuplicatePlaylist}
        onDelete={handleDeletePlaylist}
        localLibrary={localLibrary}
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        isDark={isDark}
        isLandscape={isLandscape}
        menuTopOffset={menuTopOffset}
        width={width}
        height={height}
        insets={insets}
        language={language}
      />

      {/* カバー画像設定・選択関連モーダル */}
      <PlaylistCoverModals 
        coverPickerTarget={coverPickerTarget}
        onCloseCoverPicker={() => setCoverPickerTarget(null)}
        songCoverPickerTarget={songCoverPickerTarget}
        onCloseSongCoverPicker={() => setSongCoverPickerTarget(null)}
        onOpenSongCoverPicker={(t) => setSongCoverPickerTarget(t)}
        onPickFromLibrary={pickFromLibrary}
        onPickFromCamera={pickFromCamera}
        onPickFromDocuments={pickFromDocuments}
        onApplyCover={applyCoverImage}
        allSongsCoverUri={allSongsCoverUri}
        localLibrary={localLibrary}
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        isDark={isDark}
        insets={insets}
        language={language}
      />

      {/* 新規作成・収録曲編集・名前変更関連モーダル */}
      <PlaylistEditModals 
        headerMenuVisible={headerMenuVisible}
        onCloseHeaderMenu={() => setHeaderMenuVisible(false)}
        onOpenCreatePlaylistName={() => { setNewPlaylistName(''); setCreateNameModalVisible(true); }}
        onOpenCreateSmartPlaylist={() => setSmartEditorConfig({ visible: true, mode: 'CREATE', targetPlaylist: null })}

        createNameModalVisible={createNameModalVisible}
        newPlaylistName={newPlaylistName}
        setNewPlaylistName={setNewPlaylistName}
        onCloseCreateNameModal={() => setCreateNameModalVisible(false)}
        onProceedToSongSelection={() => {
          if (!newPlaylistName.trim()) { Alert.alert(t('alert_timer_error_title', language), t('new_playlist_modal_desc', language)); return; }
          setCreateNameModalVisible(false);
          setSelectedSongFilenames(new Set());
          setSongSearchQuery('');
          setSelectSongsModalVisible(true);
        }}

        selectSongsModalVisible={selectSongsModalVisible}
        filteredSongsForCreate={filteredSongsForCreate}
        selectedSongFilenames={selectedSongFilenames}
        setSelectedSongFilenames={setSelectedSongFilenames}
        songSearchQuery={songSearchQuery}
        setSongSearchQuery={setSongSearchQuery}
        onCloseSelectSongsModal={() => setSelectSongsModalVisible(false)}
        onCreatePlaylistSave={handleCreatePlaylistSave}

        editSongsTargetPl={editSongsTargetPl}
        filteredSongsForEdit={filteredSongsForEdit}
        editSongsSelectedFilenames={editSongsSelectedFilenames}
        setEditSongsSelectedFilenames={setEditSongsSelectedFilenames}
        editSongsSearchQuery={editSongsSearchQuery}
        setEditSongsSearchQuery={setEditSongsSearchQuery}
        onCloseEditSongsModal={() => setEditSongsTargetPl(null)}
        onSaveEditPlaylistSongs={handleSaveEditPlaylistSongs}

        renameTarget={renameTarget}
        renameInput={renameInput}
        setRenameInput={setRenameInput}
        onCloseRenameModal={() => setRenameTarget(null)}
        onSaveRename={handleSaveRename}

        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        isDark={isDark}
        isLandscape={isLandscape}
        width={width}
        insets={insets}
        language={language}
      />

      {/* スマートプレイリスト作成・編集モーダル */}
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