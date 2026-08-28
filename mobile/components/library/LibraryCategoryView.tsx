import React, { useState, useMemo, useRef } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, Modal, 
  TouchableWithoutFeedback, TextInput, Alert, Animated, Easing, 
  KeyboardAvoidingView, Platform, useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { styles } from '../../styles/styles';
import { MarqueeText } from '../MarqueeText';
import { getPlaylistFirstArt, getPlaylistSongs } from '../../utils/playlistEvaluator';
import { SmartPlaylistEditorModal } from './SmartPlaylistEditorModal';
import { t } from '../../utils/i18n';

const DEFAULT_ICON = require('../../assets/images/icon.png');

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
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        transform: [{ scale }]
      }}>
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

  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [rowActionTarget, setRowActionTarget] = useState<any>(null);
  const [coverPickerTarget, setCoverPickerTarget] = useState<any>(null);
  const sheetAnimHeader = useRef(new Animated.Value(0)).current;
  const sheetAnimRow = useRef(new Animated.Value(0)).current;
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

  const data = isPlaylistsTab 
    ? [{ playlistName: t('all_songs_item', language), isAll: true, id: 'all_songs', type: 'normal' }, ...localPlaylists] 
    : category === 'ALBUMS' ? albumsList : artistsList;

  const openHeaderMenu = () => {
    setHeaderMenuVisible(true);
    sheetAnimHeader.setValue(0);
    Animated.spring(sheetAnimHeader, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const closeHeaderMenu = (callback?: () => void) => {
    Animated.timing(sheetAnimHeader, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setHeaderMenuVisible(false);
      if (callback) callback();
    });
  };

  const openRowActionSheet = (item: any) => {
    setRowActionTarget(item);
    sheetAnimRow.setValue(0);
    Animated.spring(sheetAnimRow, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const closeRowActionSheet = (callback?: () => void) => {
    Animated.timing(sheetAnimRow, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setRowActionTarget(null);
      if (callback) callback();
    });
  };

  const openCoverPickerSheet = (target: any) => {
    setCoverPickerTarget(target);
    sheetAnimCover.setValue(0);
    Animated.spring(sheetAnimCover, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
  };

  const closeCoverPickerSheet = (callback?: () => void) => {
    Animated.timing(sheetAnimCover, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setCoverPickerTarget(null);
      if (callback) callback();
    });
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
    Alert.alert(t('confirm', language), t('tracks_updated_alert', language).replace('{name}', editSongsTargetPl.playlistName));
  };

  const handleDuplicatePlaylist = async (targetPl: any) => {
    const newPl = {
      ...targetPl,
      id: 'pl_' + Date.now(),
      playlistName: `${targetPl.playlistName} (${t('keep_label', language).replace(/[<>]/g, '')})`,
    };

    const updated = [...localPlaylists, newPl];
    await AsyncStorage.setItem('local_playlists', JSON.stringify(updated));
    if (setLocalPlaylists) setLocalPlaylists(updated);

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
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

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

          return (
            <View>
              <TouchableOpacity 
                style={[styles.checkRow, { borderBottomWidth: 0, paddingVertical: 14 }]} 
                onPress={() => { 
                  if (isPlaylistsTab) { setCurrentSelectionType('PLAYLIST'); setCurrentPlaylist(item); }
                  else { setCurrentSelectionType('ARTIST'); setCurrentArtist(item.artistName); }
                  pushView('SONG_LIST'); 
                }}
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
                
                {isPlaylistsTab && !item.isAll ? (
                  <AnimatedMenuButton 
                    onPress={() => openRowActionSheet(item)}
                    isDark={isDark}
                    textStyle={dynamicStyles.text}
                  />
                ) : (
                  !isPlaylistsTab && <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
                )}
              </TouchableOpacity>

              {isPlaylistsTab && !isLast && (
                <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginLeft: 95, marginRight: 20 }} />
              )}
            </View>
          );
        }}
        contentContainerStyle={safePadding}
      />

      {/* 1. ヘッダー3点メニュー（通常 / スマートプレイリスト新規作成） */}
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
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      closeHeaderMenu(() => {
                        setNewPlaylistName('');
                        setCreateNameModalVisible(true);
                      });
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_new_playlist', language)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => {
                      closeHeaderMenu(() => {
                        setSmartEditorConfig({ visible: true, mode: 'CREATE', targetPlaylist: null });
                      });
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="flash-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_smart_playlist', language)}</Text>
                  </TouchableOpacity>
                </View>

                <AnimatedCancelButton onPress={() => closeHeaderMenu()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 2. 各プレイリスト行の3点メニュー */}
      <Modal visible={!!rowActionTarget} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeRowActionSheet()}>
          <Animated.View style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnimRow, 
            justifyContent: 'flex-end', paddingHorizontal: 15, 
            paddingTop: Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{ gap: 10, transform: [{ translateY: sheetAnimRow.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}>
                    <Image source={getPlaylistFirstArt(rowActionTarget, localLibrary)} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{rowActionTarget?.playlistName}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>{rowActionTarget?.type === 'smart' ? t('smart_playlist_label', language) : t('normal_playlist_label', language)}</Text>
                    </View>
                  </View>

                  {/* 1. 名前を変更 */}
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = rowActionTarget;
                      closeRowActionSheet(() => {
                        setRenameTarget(target);
                        setRenameInput(target.playlistName);
                      });
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="create-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('rename_playlist', language)}</Text>
                  </TouchableOpacity>

                  {/* 2. カバー画像を変更 */}
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = rowActionTarget;
                      closeRowActionSheet(() => openCoverPickerSheet(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="image-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('change_cover_image', language)}</Text>
                  </TouchableOpacity>

                  {rowActionTarget?.type === 'smart' ? (
                    <>
                      {/* 3. ルールを編集 */}
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => {
                            setSmartEditorConfig({ visible: true, mode: 'EDIT', targetPlaylist: target });
                          });
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="options-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_rules', language)}</Text>
                      </TouchableOpacity>

                      {/* 4. 通常のプレイリストに変更 */}
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => handleConvertToNormalPlaylist(target));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="swap-horizontal-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('convert_to_normal_playlist', language)}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* 3. プレイリストの曲を編集 */}
                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const target = rowActionTarget;
                          closeRowActionSheet(() => openEditPlaylistSongsModal(target));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="musical-notes-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_playlist_songs', language)}</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* 5. プレイリストを複製 */}
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = rowActionTarget;
                      closeRowActionSheet(() => handleDuplicatePlaylist(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="copy-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('duplicate_playlist', language)}</Text>
                  </TouchableOpacity>

                  {/* 6. 削除 */}
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => {
                      const target = rowActionTarget;
                      closeRowActionSheet(() => handleDeletePlaylist(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('delete_playlist', language)}</Text>
                  </TouchableOpacity>
                </View>

                <AnimatedCancelButton onPress={() => closeRowActionSheet()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
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
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <View style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border, alignItems: 'center' }}>
                    <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('set_cover_image_title', language)}</Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>{coverPickerTarget?.playlistName}</Text>
                  </View>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromLibrary(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="images-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('pick_from_photos', language)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromCamera(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="camera-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('take_photo', language)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: coverPickerTarget?.localCoverImageUri ? 1 : 0, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const target = coverPickerTarget;
                      closeCoverPickerSheet(() => pickFromDocuments(target));
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="folder-open-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('pick_from_files', language)}</Text>
                  </TouchableOpacity>

                  {coverPickerTarget?.localCoverImageUri && (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                      onPress={() => {
                        const target = coverPickerTarget;
                        closeCoverPickerSheet(() => applyCoverImage(target, null));
                      }}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="refresh-outline" size={22} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('reset_cover_image', language)}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <AnimatedCancelButton onPress={() => closeCoverPickerSheet()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
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
