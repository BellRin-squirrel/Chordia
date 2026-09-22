import React, { useRef, useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, 
  Modal, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Alert, 
  TouchableWithoutFeedback, Keyboard, ScrollView, useWindowDimensions, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../styles/styles';
import { t } from '../utils/i18n';
import { syncMusicAndPlaylistsToCloud } from '../utils/chordiaSync';
import { MarqueeText } from './MarqueeText';
import { parseMp3Tags } from '../utils/id3Parser';

const DEFAULT_ICON = require('../assets/images/icon.png');

interface StagedSong {
  id: string;
  sourceUri: string;
  originalFileName: string;
  title: string;
  artist: string;
  album: string;
  coverUri: string | null;
}

// ★ アプリ起動中のみメモリ上に保持され、タブ切り替えでも維持・アプリ終了でリセットされる変数
let activeSyncModeMemory: 'LAN' | 'WAN' | 'LOCAL' = 'LAN';
let wanUrlInputMemory: string = '';
let stagedSongsMemory: StagedSong[] = [];

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      }}
    >
      <Ionicons name="ellipsis-horizontal" size={16} color={textStyle} />
    </TouchableOpacity>
  );
};

export const SyncScreen = ({ 
  dynamicStyles, themeColor, themeTextColor, syncStage, setSyncStage, 
  serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput, 
  showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls, 
  isSyncing, isDark, requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect, 
  setScannedQrData, clientInfo, insets, currentSong, language = 'ja',
  localLibrary = [], setLocalLibrary
}: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const bottomPadding = (currentSong ? 280 : 160) + (insets?.bottom || 0);
  const textColor = themeTextColor || '#ffffff';

  const isProcessingQr = useRef(false);

  // ★ アプリ終了まで開いたタブを維持するステート管理
  const [syncMode, setSyncModeState] = useState<'LAN' | 'WAN' | 'LOCAL'>(activeSyncModeMemory);
  const [wanUrlInput, setWanUrlInputState] = useState(wanUrlInputMemory);

  const setSyncMode = (mode: 'LAN' | 'WAN' | 'LOCAL') => {
    activeSyncModeMemory = mode;
    setSyncModeState(mode);
  };

  const setWanUrlInput = (url: string) => {
    wanUrlInputMemory = url;
    setWanUrlInputState(url);
  };
  
  const [stagedSongs, setStagedSongs] = useState<StagedSong[]>(stagedSongsMemory);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [isPickingOrParsing, setIsPickingOrParsing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [actionSheetTargets, setActionSheetTargets] = useState<StagedSong[] | null>(null);

  const [editingModalVisible, setEditingModalVisible] = useState(false);
  const [editingTargets, setEditingTargets] = useState<StagedSong[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editCoverUri, setEditCoverUri] = useState<string | null>(null);

  const keepStr = t('keep_label', language);

  const updateStagedMemory = (newList: StagedSong[]) => {
    stagedSongsMemory = newList;
    setStagedSongs(newList);
  };

  const selectAll = () => {
    const allIndices = new Set(pcPlaylists.map((_: any, i: number) => i));
    setSelectedPls(allIndices);
  };

  const deselectAll = () => {
    setSelectedPls(new Set());
  };

  const handlePickLocalMP3Files = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const validAssets = result.assets.filter(f => {
        const name = (f.name || '').toLowerCase();
        return name.endsWith('.mp3') || f.mimeType === 'audio/mpeg' || f.mimeType === 'audio/mp3';
      });

      if (validAssets.length === 0) {
        Alert.alert(t('alert_timer_error_title', language), t('local_import_only_mp3', language));
        return;
      }

      setIsPickingOrParsing(true);
      const timestamp = Date.now();
      const newStaged: StagedSong[] = [];

      for (let i = 0; i < validAssets.length; i++) {
        const file = validAssets[i];
        const rawName = file.name || `track_${timestamp}_${i}.mp3`;
        const titleFallback = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;

        const parsedTags = await parseMp3Tags(file.uri);

        newStaged.push({
          id: `staged_${timestamp}_${i}_${Math.random()}`,
          sourceUri: file.uri,
          originalFileName: rawName,
          title: parsedTags.title?.trim() || titleFallback,
          artist: parsedTags.artist?.trim() || 'Unknown Artist',
          album: parsedTags.album?.trim() || 'Local Files',
          coverUri: parsedTags.coverImageUri || null,
        });
      }

      updateStagedMemory([...newStaged, ...stagedSongs]);
      setIsPickingOrParsing(false);
    } catch (e: any) {
      setIsPickingOrParsing(false);
      Alert.alert(t('alert_timer_error_title', language), e?.message || 'Error choosing MP3 files');
    }
  };

  const openEditModal = (targets: StagedSong[]) => {
    if (!targets || targets.length === 0) return;
    const isMulti = targets.length > 1;
    const first = targets[0];

    const getCommon = (key: keyof StagedSong) => {
      if (!isMulti) return first[key] ?? '';
      const fVal = first[key];
      const allSame = targets.every(t => t[key] === fVal);
      return allSame ? (fVal ?? '') : keepStr;
    };

    setEditingTargets(targets);
    setEditTitle(String(getCommon('title')));
    setEditArtist(String(getCommon('artist')));
    setEditAlbum(String(getCommon('album')));
    setEditCoverUri(isMulti ? null : first.coverUri);
    setEditingModalVisible(true);
  };

  const saveEditedStagedSongs = () => {
    if (!editingTargets || editingTargets.length === 0) return;
    const idSet = new Set(editingTargets.map(t => t.id));

    const updated = stagedSongs.map(item => {
      if (idSet.has(item.id)) {
        return {
          ...item,
          title: editTitle !== keepStr ? editTitle.trim() || 'Untitled' : item.title,
          artist: editArtist !== keepStr ? editArtist.trim() || 'Unknown Artist' : item.artist,
          album: editAlbum !== keepStr ? editAlbum.trim() || 'Local Files' : item.album,
          coverUri: editCoverUri !== undefined && editCoverUri !== null ? editCoverUri : item.coverUri,
        };
      }
      return item;
    });

    updateStagedMemory(updated);
    setEditingModalVisible(false);
  };

  const pickCoverForEditing = async () => {
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
        setEditCoverUri(result.assets[0].uri);
      }
    } catch (e) {}
  };

  const removeStagedSongs = (targets: StagedSong[]) => {
    const idSet = new Set(targets.map(t => t.id));
    const remaining = stagedSongs.filter(s => !idSet.has(s.id));
    updateStagedMemory(remaining);
    setSelectedSongIds(new Set());
    setIsSelectionMode(false);
  };

  const handleRegisterAllStagedToLibrary = async () => {
    if (stagedSongs.length === 0) return;

    try {
      setIsRegistering(true);
      const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

      const newSongs: any[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < stagedSongs.length; i++) {
        const item = stagedSongs[i];
        const safeMusicName = `local_${timestamp}_${i}_${item.originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const destMusicUri = baseDir + safeMusicName;

        await FileSystem.copyAsync({
          from: item.sourceUri,
          to: destMusicUri,
        });

        let finalImageUri: string | null = null;
        if (item.coverUri) {
          const ext = item.coverUri.split('.').pop() || 'jpg';
          const safeCoverName = `cover_${timestamp}_${i}.${ext}`;
          finalImageUri = baseDir + safeCoverName;
          await FileSystem.copyAsync({
            from: item.coverUri,
            to: finalImageUri,
          });
        }

        newSongs.push({
          id: `local_song_${timestamp}_${i}`,
          title: item.title || 'Untitled',
          artist: item.artist || 'Unknown Artist',
          album: item.album || 'Local Files',
          musicFilename: safeMusicName,
          localMusicUri: destMusicUri,
          localImageUri: finalImageUri,
          addedAt: new Date().toISOString(),
        });
      }

      const currentLib = Array.isArray(localLibrary) ? [...localLibrary] : [];
      const updatedLib = [...newSongs, ...currentLib];

      await AsyncStorage.setItem('local_library', JSON.stringify(updatedLib));
      if (setLocalLibrary) {
        setLocalLibrary(updatedLib);
      }

      syncMusicAndPlaylistsToCloud();

      updateStagedMemory([]);
      setSelectedSongIds(new Set());
      setIsSelectionMode(false);
      setIsRegistering(false);

      Alert.alert(
        t('confirm', language),
        t('local_import_success', language).replace('{count}', String(newSongs.length))
      );
    } catch (e: any) {
      setIsRegistering(false);
      Alert.alert(t('alert_timer_error_title', language), e?.message || 'Error registering songs');
    }
  };

  const toggleSelectAll = () => {
    if (selectedSongIds.size === stagedSongs.length) {
      setSelectedSongIds(new Set());
    } else {
      setSelectedSongIds(new Set(stagedSongs.map(s => s.id)));
    }
  };

  const selectedStagedList = stagedSongs.filter(s => selectedSongIds.has(s.id));

  return (
    <View style={{flex:1, backgroundColor: dynamicStyles.bg}}>
      <View style={[styles.headerBar, {backgroundColor: dynamicStyles.bg, borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0)}]}>
        <Text style={[styles.headerTitle, {color: dynamicStyles.text}]}>{t('tab_sync', language)}</Text>
      </View>
      
      {syncStage === 'INPUT_IP' && (
        <ScrollView 
          style={{
            flex: 1,
            paddingLeft: Math.max(insets?.left || 0, 10),
            paddingRight: Math.max(insets?.right || 0, 10),
          }}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPadding }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
                {/* 画面上部タブバー（LAN同期 / WAN同期 / ローカルから追加） */}
                <View style={{ flexDirection: 'row', backgroundColor: dynamicStyles.card, borderRadius: 15, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <TouchableOpacity 
                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: syncMode === 'LAN' ? themeColor : 'transparent' }}
                    onPress={() => setSyncMode('LAN')}
                  >
                    <Text style={{ color: syncMode === 'LAN' ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>
                      {t('sync_mode_lan', language)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: syncMode === 'WAN' ? themeColor : 'transparent' }}
                    onPress={() => setSyncMode('WAN')}
                  >
                    <Text style={{ color: syncMode === 'WAN' ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>
                      {t('sync_mode_wan', language)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1.1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: syncMode === 'LOCAL' ? themeColor : 'transparent' }}
                    onPress={() => setSyncMode('LOCAL')}
                  >
                    <Text style={{ color: syncMode === 'LOCAL' ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }} numberOfLines={1}>
                      {t('sync_mode_local', language)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* タブバー直下の説明文 */}
                <View style={{ paddingHorizontal: 12, paddingBottom: 16, alignItems: 'center' }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
                    {syncMode === 'LAN' && t('sync_mode_lan_desc', language)}
                    {syncMode === 'WAN' && t('sync_mode_wan_desc', language)}
                    {syncMode === 'LOCAL' && t('local_import_desc', language)}
                  </Text>
                </View>

                {/* 1. ローカルから追加 */}
                {syncMode === 'LOCAL' && (
                  <View style={{ gap: 14 }}>
                    {stagedSongs.length === 0 ? (
                      <View style={[styles.syncCard, { backgroundColor: dynamicStyles.card, margin: 0, paddingVertical: 32, alignItems: 'center' }]}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `rgba(79, 70, 229, 0.12)`, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                          <Ionicons name="folder-open-outline" size={32} color={themeColor} />
                        </View>

                        <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
                          {t('local_import_title', language)}
                        </Text>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                          {t('local_import_desc', language)}
                        </Text>

                        <TouchableOpacity 
                          style={[styles.smallBtn, { backgroundColor: themeColor, width: '100%', maxWidth: 300 }]} 
                          onPress={handlePickLocalMP3Files}
                          disabled={isPickingOrParsing}
                          activeOpacity={0.8}
                        >
                          {isPickingOrParsing ? (
                            <ActivityIndicator color={textColor} />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="add-circle-outline" size={20} color={textColor} />
                              <Text style={[styles.btnText, { color: textColor }]}>
                                {t('local_import_btn', language)}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        {/* ツールバー */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
                              {t('local_import_staged_count', language)} ({stagedSongs.length})
                            </Text>
                            {isSelectionMode && selectedStagedList.length > 0 && (
                              <TouchableOpacity 
                                onPress={() => openEditModal(selectedStagedList)}
                                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: themeColor }}
                              >
                                <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                                  {t('edit_song_info', language)} ({selectedStagedList.length})
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity 
                              onPress={() => {
                                setIsSelectionMode(!isSelectionMode);
                                if (isSelectionMode) setSelectedSongIds(new Set());
                              }}
                              style={{
                                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
                                backgroundColor: isSelectionMode ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb')
                              }}
                            >
                              <Text style={{ color: isSelectionMode ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 12 }}>
                                {isSelectionMode ? t('done_btn', language) : t('select_btn', language)}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                              onPress={handlePickLocalMP3Files}
                              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                            >
                              <Ionicons name="add" size={16} color={themeColor} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* 複数選択バー */}
                        {isSelectionMode && (
                          <View style={{
                            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                          }}>
                            <TouchableOpacity onPress={toggleSelectAll}>
                              <Text style={{ color: themeColor, fontWeight: 'bold', fontSize: 12 }}>
                                {selectedSongIds.size === stagedSongs.length ? t('deselect_all', language) : t('select_all', language)}
                              </Text>
                            </TouchableOpacity>
                            <Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>
                              {selectedSongIds.size} / {stagedSongs.length}
                            </Text>
                          </View>
                        )}

                        {/* MP3タグ反映済み待機リスト */}
                        <View style={{ gap: 8 }}>
                          {stagedSongs.map(item => {
                            const isSelected = selectedSongIds.has(item.id);

                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16,
                                  backgroundColor: dynamicStyles.card, borderWidth: 1,
                                  borderColor: isSelected ? themeColor : dynamicStyles.border,
                                }}
                                onPress={() => {
                                  if (isSelectionMode) {
                                    const next = new Set(selectedSongIds);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    setSelectedSongIds(next);
                                  } else {
                                    openEditModal([item]);
                                  }
                                }}
                                activeOpacity={0.7}
                              >
                                {isSelectionMode && (
                                  <View style={{ marginRight: 10 }}>
                                    <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? themeColor : dynamicStyles.subText} />
                                  </View>
                                )}

                                <Image 
                                  source={item.coverUri ? { uri: item.coverUri } : DEFAULT_ICON} 
                                  style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} 
                                />

                                <View style={{ flex: 1, minWidth: 0, marginRight: 10, overflow: 'hidden' }}>
                                  <MarqueeText text={item.title || 'Untitled'} style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} />
                                  <View style={{ height: 2 }} />
                                  <MarqueeText text={`${item.artist || 'Unknown Artist'} • ${item.album || 'Local Files'}`} style={{ color: dynamicStyles.subText, fontSize: 12 }} />
                                  <Text style={{ color: dynamicStyles.subText, fontSize: 10, opacity: 0.6, marginTop: 1 }} numberOfLines={1}>
                                    {item.originalFileName}
                                  </Text>
                                </View>

                                {!isSelectionMode && (
                                  <AnimatedMenuButton 
                                    onPress={() => setActionSheetTargets([item])}
                                    isDark={isDark}
                                    textStyle={dynamicStyles.text}
                                  />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* 「この情報で登録」確定ボタン */}
                        <TouchableOpacity 
                          style={[styles.smallBtn, { backgroundColor: themeColor, marginTop: 10, height: 52, borderRadius: 26 }]}
                          onPress={handleRegisterAllStagedToLibrary}
                          disabled={isRegistering}
                          activeOpacity={0.8}
                        >
                          {isRegistering ? (
                            <ActivityIndicator color={textColor} />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons name="checkmark-done" size={20} color={textColor} />
                              <Text style={[styles.btnText, { color: textColor, fontSize: 16 }]}>
                                {t('local_import_register_btn', language)} ({stagedSongs.length} {t('songs_count', language)})
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {/* 2. PC同期 (LAN / WAN) 画面 */}
                {syncMode !== 'LOCAL' && (
                  <View style={[styles.syncCard, {backgroundColor: dynamicStyles.card, margin: 0}]}>
                      <View style={{alignItems: 'center', marginBottom: 15}}>
                        <Text style={{color: dynamicStyles.subText, fontSize: 12}}>
                          {t('this_device', language)}: {clientInfo?.deviceName || t('getting_info', language)} ({clientInfo?.osVersion || t('getting_info', language)})
                        </Text>
                      </View>

                      <TouchableOpacity style={[styles.smallBtn, {backgroundColor: '#34c759', marginBottom: 20}]} onPress={async () => { 
                          Keyboard.dismiss();
                          const granted = await requestCameraPermission(); 
                          if (granted) {
                            isProcessingQr.current = false;
                            setShowCamera(true);
                          }
                        }}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                          <Ionicons name="qr-code-outline" size={20} color="#fff" />
                          <Text style={styles.btnText}>{t('qr_auto_connect', language)}</Text>
                        </View>
                      </TouchableOpacity>
                      
                      <View style={{height: 1, backgroundColor: dynamicStyles.border, marginBottom: 20}} />
                      
                      {syncMode === 'LAN' ? (
                        <>
                          <Text style={{color: dynamicStyles.text, marginBottom: 10, fontWeight: 'bold'}}>{t('manual_connect_lan', language)}</Text>
                          <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                              <View style={{flex: 3}}>
                                  <Text style={{color: dynamicStyles.subText, fontSize: 11, marginBottom: 4}}>{t('ip_address', language)}</Text>
                                  <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0}]} placeholder="192.168.0.x" placeholderTextColor="#888" value={serverIp} onChangeText={setServerIp} keyboardType="decimal-pad" />
                              </View>
                              <View style={{flex: 1.2}}>
                                  <Text style={{color: dynamicStyles.subText, fontSize: 11, marginBottom: 4}}>{t('port', language)}</Text>
                                  <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0}]} placeholder="5000" placeholderTextColor="#888" value={serverPort} onChangeText={setServerPort} keyboardType="number-pad" maxLength={5} />
                              </View>
                          </View>
                          <TouchableOpacity style={[styles.smallBtn, {backgroundColor: themeColor}]} onPress={() => { Keyboard.dismiss(); requestAuthToPC(serverIp, serverPort); }}>
                            <Text style={[styles.btnText, { color: textColor }]}>{t('request_connect_pc', language)}</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Text style={{color: dynamicStyles.text, marginBottom: 10, fontWeight: 'bold'}}>{t('manual_connect_wan', language)}</Text>
                          <View style={{marginBottom: 10}}>
                              <Text style={{color: dynamicStyles.subText, fontSize: 11, marginBottom: 4}}>{t('wan_public_url_label', language)}</Text>
                              <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0}]} placeholder="https://xxxx.lhr.life" placeholderTextColor="#888" value={wanUrlInput} onChangeText={setWanUrlInput} autoCapitalize="none" keyboardType="url" />
                          </View>
                          <TouchableOpacity style={[styles.smallBtn, {backgroundColor: themeColor}]} onPress={() => { 
                            Keyboard.dismiss(); 
                            if (!wanUrlInput.trim() || (!wanUrlInput.startsWith('http://') && !wanUrlInput.startsWith('https://'))) {
                              Alert.alert(t('alert_timer_error_title', language), t('invalid_wan_url', language));
                              return;
                            }
                            setServerIp(wanUrlInput.trim());
                            setServerPort('');
                            requestAuthToPC(wanUrlInput.trim(), ''); 
                          }}>
                            <Text style={[styles.btnText, { color: textColor }]}>{t('wan_connect_btn', language)}</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {isSyncing && <ActivityIndicator color={themeColor} style={{marginTop:15}} />}
                  </View>
                )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {syncStage === 'AWAITING_APPROVAL' && (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40}}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={{color: dynamicStyles.text, marginTop: 20, textAlign: 'center', fontSize: 16, fontWeight: 'bold'}}>{t('awaiting_approval_msg', language)}</Text>
            <TouchableOpacity style={{marginTop: 40}} onPress={cancelSync}><Text style={{color: themeColor, fontSize: 16}}>{t('cancel', language)}</Text></TouchableOpacity>
        </View>
      )}

      {syncStage === 'AWAITING_CODE' && (
        <ScrollView 
          style={{
            flex: 1,
            paddingLeft: Math.max(insets?.left || 0, 10),
            paddingRight: Math.max(insets?.right || 0, 10),
          }}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomPadding }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View style={[styles.syncCard, {backgroundColor: dynamicStyles.card, margin: 0}]}>
                    <Text style={{color: dynamicStyles.text, marginBottom: 15, fontSize: 16, fontWeight: 'bold'}}>{t('awaiting_code_msg', language)}</Text>
                    <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 32, textAlign: 'center', letterSpacing: 8, fontWeight: '800'}]} placeholder="000000" placeholderTextColor="#888" maxLength={6} value={authCodeInput} onChangeText={setAuthCodeInput} keyboardType="number-pad" />
                    <TouchableOpacity style={[styles.smallBtn, {backgroundColor: themeColor, marginBottom: 10}]} onPress={() => { Keyboard.dismiss(); verifyAuthCode(serverIp, serverPort, authCodeInput); }}>
                      <Text style={[styles.btnText, { color: textColor }]}>{t('verify_code_btn', language)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={cancelSync}><Text style={{color: themeColor}}>{t('retry_btn', language)}</Text></TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {syncStage === 'READY' && (
        <View style={{flex: 1}}>
          <FlatList 
            data={pcPlaylists} 
            keyExtractor={(item, index) => item.playlistName + index} 
            numColumns={isLandscape ? 2 : 1}
            key={isLandscape ? 'grid' : 'list'}
            contentContainerStyle={{
              paddingLeft: Math.max(insets?.left || 0, 10),
              paddingRight: Math.max(insets?.right || 0, 10),
              paddingBottom: bottomPadding, 
              paddingTop: 10,
            }} 
            ListHeaderComponent={
                <View style={{paddingHorizontal: 20, paddingBottom: 10, gap: 10}}>
                   <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#6b7280' }]} onPress={disconnect}><Text style={styles.btnText}>{t('disconnect_btn', language)}</Text></TouchableOpacity>
                   <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} onPress={selectAll}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('select_all', language)}</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} onPress={deselectAll}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('deselect_all', language)}</Text></TouchableOpacity>
                   </View>
                </View>
            }
            renderItem={({item, index}) => (
              <TouchableOpacity style={[styles.checkRow, {backgroundColor: dynamicStyles.bg}, isLandscape && { flex: 0.5, margin: 5, borderRadius: 10, borderWidth: 0.5, borderColor: dynamicStyles.border }]} onPress={() => { const next = new Set(selectedPls); if (next.has(index)) next.delete(index); else next.add(index); setSelectedPls(next); }}>
                <Ionicons name={selectedPls.has(index) ? "checkbox" : "square-outline"} size={24} color={themeColor} />
                <Text style={[styles.rowTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.playlistName}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={pcPlaylists.length > 0 ? (
                    <View style={[styles.syncFooterContainer, isLandscape && { flexDirection: 'row', justifyContent: 'center', gap: 15 }]}>
                        <TouchableOpacity 
                          style={[styles.syncActionBtn, {backgroundColor: themeColor, flex: isLandscape ? 1 : 0, paddingHorizontal: 15}]} 
                          onPress={() => startSyncDownload('KEEP_DUPLICATES')}
                        >
                          <Text style={[styles.syncActionBtnText, { color: textColor, fontSize: 13, textAlign: 'center' }]} numberOfLines={2}>
                            {t('sync_keep_duplicates', language)}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.syncActionBtn, {backgroundColor: '#ef4444', flex: isLandscape ? 1 : 0, paddingHorizontal: 15}]} 
                          onPress={() => startSyncDownload('DELETE_ALL')}
                        >
                          <Text style={styles.syncActionBtnText}>{t('sync_delete_all', language)}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null
            }
          />
        </View>
      )}

      {/* 3点メニューアクションシート */}
      <Modal visible={!!actionSheetTargets} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => setActionSheetTargets(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', paddingHorizontal: 15, paddingBottom: 25 }}>
            <TouchableWithoutFeedback>
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const targets = actionSheetTargets;
                      setActionSheetTargets(null);
                      if (targets) openEditModal(targets);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="create-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>
                      {t('edit_song_info', language)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => {
                      const targets = actionSheetTargets;
                      setActionSheetTargets(null);
                      if (targets) removeStagedSongs(targets);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
                      {t('local_import_remove_staged', language)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={() => setActionSheetTargets(null)}
                  style={{ backgroundColor: dynamicStyles.card, borderRadius: 16, height: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dynamicStyles.border }}
                >
                  <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 楽曲情報編集モーダル */}
      <Modal visible={editingModalVisible} transparent animationType="none">
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ width: '100%', maxWidth: 440, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }}>
                {editingTargets.length > 1 ? t('edit_song_multi_title', language) : t('edit_song_title', language)}
              </Text>
              <TouchableOpacity onPress={() => setEditingModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <TouchableOpacity onPress={pickCoverForEditing} activeOpacity={0.8}>
                  <Image 
                    source={editCoverUri ? { uri: editCoverUri } : DEFAULT_ICON} 
                    style={{ width: 88, height: 88, borderRadius: 14, marginBottom: 8 }} 
                  />
                  <View style={{ position: 'absolute', bottom: 12, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={{ color: dynamicStyles.subText, fontSize: 11 }}>
                  {t('change_cover_image', language)}
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('song_title', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder={t('song_title_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>

                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('artist', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editArtist}
                    onChangeText={setEditArtist}
                    placeholder={t('artist_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>

                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('album', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editAlbum}
                    onChangeText={setEditAlbum}
                    placeholder={t('album_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
              <TouchableOpacity 
                style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setEditingModalVisible(false)}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 46, borderRadius: 23, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={saveEditedStagedSongs}
              >
                <Text style={{ color: textColor, fontWeight: 'bold' }}>{t('save', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* QRカメラモーダル */}
      {showCamera && (
          <Modal visible={true} transparent={false} animationType="slide" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
              <SafeAreaView style={{flex: 1, backgroundColor: '#000'}}>
                  <View style={{flex: 1, borderRadius: 20, overflow: 'hidden', margin: 10}}>
                      <CameraView 
                        style={StyleSheet.absoluteFill} 
                        onBarcodeScanned={async ({ data }) => {
                              if (isProcessingQr.current) return;
                              isProcessingQr.current = true;

                              try {
                                const qrData = JSON.parse(data);
                                if((qrData.ip && qrData.code) || qrData.wanUrl) { 
                                  setShowCamera(false);
                                  setScannedQrData(qrData); 
                                } else {
                                  throw new Error();
                                }
                              } catch(e) { 
                                Alert.alert(
                                  t('alert_timer_error_title', language), 
                                  t('invalid_qr_code', language),
                                  [{ text: t('confirm', language), onPress: () => { isProcessingQr.current = false; } }]
                                ); 
                              }
                          }} 
                      />
                  </View>
                  <TouchableOpacity style={{padding: 20, alignItems: 'center'}} onPress={() => setShowCamera(false)}><Text style={{color: '#fff', fontSize: 18}}>{t('cancel', language)}</Text></TouchableOpacity>
              </SafeAreaView>
          </Modal>
      )}
    </View>
  );
};