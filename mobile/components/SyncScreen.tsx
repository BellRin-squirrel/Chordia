import React, { useRef, useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  KeyboardAvoidingView, Platform, Alert, TouchableWithoutFeedback, 
  Keyboard, ScrollView, useWindowDimensions 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { styles } from '../styles/styles';
import { t } from '../utils/i18n';
import { syncMusicAndPlaylistsToCloud } from '../utils/chordiaSync';
import { parseMp3Tags } from '../utils/id3Parser';
import { 
  StagedSong, 
  activeSyncModeMemory, 
  wanUrlInputMemory, 
  stagedSongsMemory,
  setActiveSyncModeMemory,
  setWanUrlInputMemory,
  setStagedSongsMemory 
} from './sync/types';
import { SyncConnectionView } from './sync/SyncConnectionView';
import { SyncLocalImportView } from './sync/SyncLocalImportView';
import { SyncPlaylistsView } from './sync/SyncPlaylistsView';
import { SyncConflictModal } from './sync/SyncConflictModal';
import { SyncModals } from './sync/SyncModals';

export const SyncScreen = ({ 
  dynamicStyles, themeColor, themeTextColor, syncStage, setSyncStage, 
  serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput, 
  showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls, 
  isSyncing, isDark, requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect, 
  setScannedQrData, clientInfo, insets, currentSong, language = 'ja',
  localLibrary = [], setLocalLibrary,
  activeConflictSet, resolveCurrentConflict
}: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const bottomPadding = (currentSong ? 280 : 160) + (insets?.bottom || 0);
  const textColor = themeTextColor || '#ffffff';

  const isProcessingQr = useRef(false);

  const [syncMode, setSyncModeState] = useState<'LAN' | 'WAN' | 'LOCAL'>(activeSyncModeMemory);
  const [wanUrlInput, setWanUrlInputState] = useState(wanUrlInputMemory);

  const setSyncMode = (mode: 'LAN' | 'WAN' | 'LOCAL') => {
    setActiveSyncModeMemory(mode);
    setSyncModeState(mode);
  };

  const setWanUrlInput = (url: string) => {
    setWanUrlInputMemory(url);
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
    setStagedSongsMemory(newList);
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

      if (result.canceled || !result.assets || result.assets.length === 0) return;

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
      const skippedDuplicates: { title: string; artist: string; album: string }[] = [];

      const existingKeys = new Set<string>();
      for (const s of localLibrary) {
        const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}:::${(s.album || '').trim().toLowerCase()}`;
        existingKeys.add(key);
      }
      for (const s of stagedSongs) {
        const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}:::${(s.album || '').trim().toLowerCase()}`;
        existingKeys.add(key);
      }

      for (let i = 0; i < validAssets.length; i++) {
        const file = validAssets[i];
        const rawName = file.name || `track_${timestamp}_${i}.mp3`;
        const titleFallback = rawName.substring(0, rawName.lastIndexOf('.')) || rawName;

        const parsedTags = await parseMp3Tags(file.uri);
        const resolvedTitle = parsedTags.title?.trim() || titleFallback;
        const resolvedArtist = parsedTags.artist?.trim() || 'Unknown Artist';
        const resolvedAlbum = parsedTags.album?.trim() || 'Local Files';

        const identityKey = `${resolvedTitle.toLowerCase()}:::${resolvedArtist.toLowerCase()}:::${resolvedAlbum.toLowerCase()}`;

        if (existingKeys.has(identityKey)) {
          skippedDuplicates.push({ title: resolvedTitle, artist: resolvedArtist, album: resolvedAlbum });
          continue;
        }

        existingKeys.add(identityKey);

        newStaged.push({
          id: `staged_${timestamp}_${i}_${Math.random()}`,
          sourceUri: file.uri,
          originalFileName: rawName,
          title: resolvedTitle,
          artist: resolvedArtist,
          album: resolvedAlbum,
          coverUri: parsedTags.coverImageUri || null,
        });
      }

      updateStagedMemory([...newStaged, ...stagedSongs]);
      setIsPickingOrParsing(false);

      if (skippedDuplicates.length > 0) {
        const details = skippedDuplicates
          .map(d => `・${d.title} - ${d.artist} (${d.album})`)
          .join('\n');
        setTimeout(() => {
          Alert.alert(
            t('local_import_skipped_title', language),
            `${t('local_import_skipped_desc', language)}\n\n${details}`
          );
        }, 150);
      }
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
          origin: 'local',
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
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[styles.headerBar, { backgroundColor: dynamicStyles.bg, borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0) }]}>
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>{t('tab_sync', language)}</Text>
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
              {/* 画面上部タブバー */}
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

              {/* タブ直下の説明文 */}
              <View style={{ paddingHorizontal: 12, paddingBottom: 16, alignItems: 'center' }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
                  {syncMode === 'LAN' && t('sync_mode_lan_desc', language)}
                  {syncMode === 'WAN' && t('sync_mode_wan_desc', language)}
                  {syncMode === 'LOCAL' && t('local_import_desc', language)}
                </Text>
              </View>

              {/* 1. ローカルから追加 */}
              {syncMode === 'LOCAL' && (
                <SyncLocalImportView 
                  dynamicStyles={dynamicStyles}
                  themeColor={themeColor}
                  textColor={textColor}
                  isDark={isDark}
                  stagedSongs={stagedSongs}
                  isSelectionMode={isSelectionMode}
                  setIsSelectionMode={setIsSelectionMode}
                  selectedSongIds={selectedSongIds}
                  setSelectedSongIds={setSelectedSongIds}
                  isPickingOrParsing={isPickingOrParsing}
                  isRegistering={isRegistering}
                  handlePickLocalMP3Files={handlePickLocalMP3Files}
                  openEditModal={openEditModal}
                  setActionSheetTargets={setActionSheetTargets}
                  handleRegisterAllStagedToLibrary={handleRegisterAllStagedToLibrary}
                  toggleSelectAll={toggleSelectAll}
                  selectedStagedList={selectedStagedList}
                  language={language}
                />
              )}

              {/* 2. PC同期 (LAN / WAN) */}
              {syncMode !== 'LOCAL' && (
                <SyncConnectionView 
                  dynamicStyles={dynamicStyles}
                  themeColor={themeColor}
                  textColor={textColor}
                  isDark={isDark}
                  syncMode={syncMode}
                  clientInfo={clientInfo}
                  serverIp={serverIp}
                  setServerIp={setServerIp}
                  serverPort={serverPort}
                  setServerPort={setServerPort}
                  wanUrlInput={wanUrlInput}
                  setWanUrlInput={setWanUrlInput}
                  requestCameraPermission={requestCameraPermission}
                  setShowCamera={setShowCamera}
                  isProcessingQr={isProcessingQr}
                  requestAuthToPC={requestAuthToPC}
                  isSyncing={isSyncing}
                  language={language}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {syncStage === 'AWAITING_APPROVAL' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={{ color: dynamicStyles.text, marginTop: 20, textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
            {t('awaiting_approval_msg', language)}
          </Text>
          <TouchableOpacity style={{ marginTop: 40 }} onPress={cancelSync}>
            <Text style={{ color: themeColor, fontSize: 16 }}>{t('cancel', language)}</Text>
          </TouchableOpacity>
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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={[styles.syncCard, { backgroundColor: dynamicStyles.card, margin: 0 }]}>
                <Text style={{ color: dynamicStyles.text, marginBottom: 15, fontSize: 16, fontWeight: 'bold' }}>
                  {t('awaiting_code_msg', language)}
                </Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 32, textAlign: 'center', letterSpacing: 8, fontWeight: '800' }]} 
                  placeholder="000000" 
                  placeholderTextColor="#888" 
                  maxLength={6} 
                  value={authCodeInput} 
                  onChangeText={setAuthCodeInput} 
                  keyboardType="number-pad" 
                />
                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: themeColor, marginBottom: 10 }]} onPress={() => verifyAuthCode(serverIp, serverPort, authCodeInput)}>
                  <Text style={[styles.btnText, { color: textColor }]}>{t('verify_code_btn', language)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={cancelSync}>
                  <Text style={{ color: themeColor }}>{t('retry_btn', language)}</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {/* プレイリスト選択画面 */}
      {syncStage === 'READY' && (
        <SyncPlaylistsView 
          dynamicStyles={dynamicStyles}
          themeColor={themeColor}
          textColor={textColor}
          isDark={isDark}
          isLandscape={isLandscape}
          pcPlaylists={pcPlaylists}
          selectedPls={selectedPls}
          setSelectedPls={setSelectedPls}
          selectAll={selectAll}
          deselectAll={deselectAll}
          disconnect={disconnect}
          startSyncDownload={startSyncDownload}
          bottomPadding={bottomPadding}
          insets={insets}
          language={language}
        />
      )}

      {/* 重複解決モーダル */}
      <SyncConflictModal 
        activeConflictSet={activeConflictSet}
        resolveCurrentConflict={resolveCurrentConflict}
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        textColor={textColor}
        isDark={isDark}
        language={language}
      />

      {/* 編集モーダル・アクションシート・QRカメラモーダル */}
      <SyncModals 
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        textColor={textColor}
        isDark={isDark}
        actionSheetTargets={actionSheetTargets}
        setActionSheetTargets={setActionSheetTargets}
        openEditModal={openEditModal}
        removeStagedSongs={removeStagedSongs}
        editingModalVisible={editingModalVisible}
        setEditingModalVisible={setEditingModalVisible}
        editingTargets={editingTargets}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editArtist={editArtist}
        setEditArtist={setEditArtist}
        editAlbum={editAlbum}
        setEditAlbum={setEditAlbum}
        editCoverUri={editCoverUri}
        pickCoverForEditing={pickCoverForEditing}
        saveEditedStagedSongs={saveEditedStagedSongs}
        showCamera={showCamera}
        setShowCamera={setShowCamera}
        onBarcodeScanned={async ({ data }) => {
          if (isProcessingQr.current) return;
          isProcessingQr.current = true;
          try {
            const qrData = JSON.parse(data);
            if ((qrData.ip && qrData.code) || qrData.wanUrl) {
              setShowCamera(false);
              setScannedQrData(qrData);
            } else {
              throw new Error();
            }
          } catch (e) {
            Alert.alert(
              t('alert_timer_error_title', language),
              t('invalid_qr_code', language),
              [{ text: t('confirm', language), onPress: () => { isProcessingQr.current = false; } }]
            );
          }
        }}
        language={language}
      />
    </View>
  );
};