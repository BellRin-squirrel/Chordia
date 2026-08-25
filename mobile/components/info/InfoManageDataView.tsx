import React, { useState, useMemo } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Animated, TextInput, 
  Image, Modal, TouchableWithoutFeedback, useWindowDimensions, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { MarqueeText } from '../MarqueeText';
import { getPlaylistFirstArt, getPlaylistSongs } from '../../utils/playlistEvaluator';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const InfoManageDataView = ({
  dynamicStyles, themeColor, textColor, isDark, isLandscape, safePadding, insets,
  localLibrary = [], setLocalLibrary, localPlaylists = [], setLocalPlaylists,
  showPlaylistTypeIcon, openEditSongs, renderHeader,
  AnimatedMenuButton, AnimatedCancelButton, sheetAnim, openActionSheet, closeActionSheet,
  actionSheetTargetSongs, songInfoModalTargetSongs, setSongInfoModalTargetSongs,
  addToPlaylistTargetSongs, setAddToPlaylistTargetSongs, getCommonValue
}: any) => {
  const { width } = useWindowDimensions();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongUris, setSelectedSongUris] = useState<Set<string>>(new Set());
  const [searchSongQuery, setSearchSongQuery] = useState('');

  const [selectedPlaylistsForTarget, setSelectedPlaylistsForTarget] = useState<Set<string>>(new Set());
  // ★ モーダル競合を防ぐためのインライン確認状態
  const [confirmingSmartConvert, setConfirmingSmartConvert] = useState(false);

  const filteredLibrary = useMemo(() => {
    if (!searchSongQuery.trim()) return localLibrary;
    const q = searchSongQuery.toLowerCase();
    return localLibrary.filter((s: any) => 
      s.title?.toLowerCase().includes(q) || 
      s.artist?.toLowerCase().includes(q) || 
      s.album?.toLowerCase().includes(q)
    );
  }, [localLibrary, searchSongQuery]);

  const availablePlaylistsForTarget = useMemo(() => {
    if (!addToPlaylistTargetSongs || !localPlaylists) return [];
    return localPlaylists.filter((pl: any) => !pl.isAll && pl.id !== 'all_songs');
  }, [addToPlaylistTargetSongs, localPlaylists]);

  // 「追加」ボタンタップ時の判定
  const handlePressAddBtn = () => {
    if (selectedPlaylistsForTarget.size === 0 || !addToPlaylistTargetSongs || addToPlaylistTargetSongs.length === 0) return;

    const targetPlaylists = localPlaylists.filter((pl: any) => selectedPlaylistsForTarget.has(pl.id));
    const hasSmart = targetPlaylists.some((pl: any) => pl.type === 'smart');

    if (hasSmart) {
      setConfirmingSmartConvert(true);
    } else {
      executeAddPlaylists();
    }
  };

  // ★ プレイリスト追加・変換の確定実行処理
  const executeAddPlaylists = async () => {
    try {
      const targetPlaylists = localPlaylists.filter((pl: any) => selectedPlaylistsForTarget.has(pl.id));
      const songFnames = addToPlaylistTargetSongs.map((s: any) => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean);

      let updatedPlaylists = [...localPlaylists];

      for (const pl of targetPlaylists) {
        let currentMusicList: string[] = [];

        if (pl.type === 'smart') {
          const currentSongs = getPlaylistSongs(pl, localLibrary);
          currentMusicList = currentSongs
            .map((s: any) => s.musicFilename?.split(/[\\/]/).pop())
            .filter(Boolean);
        } else {
          currentMusicList = Array.isArray(pl.music) ? pl.music : [];
        }

        const newMusicList = Array.from(new Set([...currentMusicList, ...songFnames]));

        updatedPlaylists = updatedPlaylists.map(p => {
          if (p.id === pl.id) {
            const { conditions, ...rest } = p;
            return { ...rest, type: 'normal', music: newMusicList };
          }
          return p;
        });
      }

      await AsyncStorage.setItem('local_playlists', JSON.stringify(updatedPlaylists));
      if (setLocalPlaylists) setLocalPlaylists(updatedPlaylists);
      
      closeAddToPlaylistModal();
    } catch (e: any) {
      console.error('[PlaylistAdd Error]', e);
      closeAddToPlaylistModal();
    }
  };

  const closeAddToPlaylistModal = () => {
    setAddToPlaylistTargetSongs(null);
    setSelectedPlaylistsForTarget(new Set());
    setConfirmingSmartConvert(false);
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
    } catch (e: any) {
      console.error('Delete error:', e);
    }
  };

  const confirmDeleteSongs = (songs: any[]) => {
    if (!songs || songs.length === 0) return;
    executeDeleteSongs(songs.map((s: any) => s.localMusicUri));
  };

  const toggleSelectAll = () => {
    if (selectedSongUris.size === filteredLibrary.length) {
      setSelectedSongUris(new Set());
    } else {
      setSelectedSongUris(new Set(filteredLibrary.map((s: any) => s.localMusicUri)));
    }
  };

  const selectedSongs = localLibrary.filter((s: any) => selectedSongUris.has(s.localMusicUri));

  const selectionHeaderBtn = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {isSelectionMode && (
        <AnimatedMenuButton 
          onPress={() => {
            if (selectedSongs.length > 0) openActionSheet(selectedSongs);
          }}
          isDark={isDark}
          textStyle={selectedSongs.length > 0 ? dynamicStyles.text : dynamicStyles.subText}
          disabled={selectedSongs.length === 0}
        />
      )}

      <TouchableOpacity 
        onPress={() => {
          setIsSelectionMode(!isSelectionMode);
          if (isSelectionMode) setSelectedSongUris(new Set());
        }}
        style={{
          paddingHorizontal: 14,
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
          flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, paddingHorizontal: 12,
          backgroundColor: dynamicStyles.card, borderWidth: 1, borderColor: dynamicStyles.border
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
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingVertical: 10,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderBottomWidth: 1, borderBottomColor: dynamicStyles.border
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
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16,
                backgroundColor: dynamicStyles.card, marginBottom: 8, borderWidth: 1,
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
                  <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? themeColor : dynamicStyles.subText} />
                </View>
              )}

              <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />

              <View style={{ flex: 1, minWidth: 0, marginRight: 10, overflow: 'hidden' }}>
                <MarqueeText text={item.title || 'Untitled'} style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} />
                <View style={{ height: 2 }} />
                <MarqueeText text={`${item.artist || 'Unknown'} • ${item.album || 'Unknown Album'}`} style={{ color: dynamicStyles.subText, fontSize: 12 }} />
              </View>

              {!isSelectionMode && (
                <AnimatedMenuButton 
                  onPress={() => openActionSheet([item])}
                  isDark={isDark}
                  textStyle={dynamicStyles.text}
                />
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* アクションメニュー */}
      <Modal visible={!!actionSheetTargetSongs} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeActionSheet()}>
          <Animated.View style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnim, 
            justifyContent: 'flex-end', paddingHorizontal: 15, 
            paddingTop: Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15 
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{ 
                gap: 10,
                transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }]
              }}>
                {(() => {
                  const isMulti = actionSheetTargetSongs && actionSheetTargetSongs.length > 1;
                  const first = actionSheetTargetSongs && actionSheetTargetSongs[0];
                  const previewArt = isMulti ? DEFAULT_ICON : (first?.localImageUri ? { uri: first.localImageUri } : DEFAULT_ICON);
                  const previewTitle = isMulti ? `複数選択 (${actionSheetTargetSongs?.length}曲)` : (first?.title || 'Untitled');
                  const previewSub = isMulti ? '複数選択' : (first?.artist || 'Unknown Artist');

                  return (
                    <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}>
                        <Image source={previewArt} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{previewTitle}</Text>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{previewSub}</Text>
                        </View>
                      </View>

                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const targets = actionSheetTargetSongs;
                          closeActionSheet(() => setAddToPlaylistTargetSongs(targets));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>プレイリストに追加</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const targets = actionSheetTargetSongs;
                          closeActionSheet(() => openEditSongs(targets || []));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="create-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>楽曲情報を編集</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                        onPress={() => {
                          const targets = actionSheetTargetSongs;
                          closeActionSheet(() => setSongInfoModalTargetSongs(targets));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="information-circle-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>情報を見る</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                        onPress={() => {
                          const targets = actionSheetTargetSongs;
                          closeActionSheet(() => confirmDeleteSongs(targets || []));
                        }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>ライブラリから楽曲を削除</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                <AnimatedCancelButton onPress={() => closeActionSheet()} dynamicStyles={dynamicStyles} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* タグ情報ポップアップ */}
      <Modal visible={!!songInfoModalTargetSongs} transparent animationType="none">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 440, maxHeight: isLandscape ? '85%' : '70%', flexShrink: 1, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="information-circle" size={22} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold' }}>タグ情報</Text>
              </View>
              <TouchableOpacity onPress={() => setSongInfoModalTargetSongs(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            {(() => {
              const songs = songInfoModalTargetSongs || [];
              const isMulti = songs.length > 1;
              const first = songs[0];
              const previewArt = isMulti ? DEFAULT_ICON : (first?.localImageUri ? { uri: first.localImageUri } : DEFAULT_ICON);
              const titleText = isMulti ? `複数選択 (${songs.length}曲)` : (first?.title || 'Unknown');
              const subText = isMulti ? '複数選択' : (first?.artist || 'Unknown');

              return (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 15 }}>
                  <View style={{ alignItems: 'center', marginBottom: 18 }}>
                    <Image source={previewArt} style={{ width: 90, height: 90, borderRadius: 14, marginBottom: 8 }} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>{titleText}</Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 2, textAlign: 'center' }}>{subText}</Text>
                  </View>

                  <View style={{ gap: 10, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', padding: 14, borderRadius: 16 }}>
                    {[
                      { l: '選択曲数', v: isMulti ? `${songs.length}曲` : undefined },
                      { l: 'アルバム', v: getCommonValue(songs, 'album', '複数のアルバム') },
                      { l: 'アーティスト', v: getCommonValue(songs, 'artist', '複数のアーティスト') },
                      { l: '作曲者', v: getCommonValue(songs, 'composer', '複数の作曲者') },
                      { l: 'ジャンル', v: getCommonValue(songs, 'genre', '複数のジャンル') },
                      { l: 'トラック番号', v: isMulti ? getCommonValue(songs, 'track', '様々な番号') : first?.track },
                      { l: 'ディスク番号', v: isMulti ? getCommonValue(songs, 'disc', '様々な番号') : first?.disc },
                      { l: 'リリース年', v: getCommonValue(songs, 'year', '複数のリリース年') },
                      { l: 'BPM', v: getCommonValue(songs, 'bpm', '様々なBPM') },
                      { l: 'ファイル名', v: isMulti ? undefined : first?.musicFilename?.split(/[\\/]/).pop() },
                      { l: '歌詞', v: isMulti ? (songs.filter((s: any) => !!s.lyric).length > 0 ? `${songs.filter((s: any) => !!s.lyric).length}曲に登録あり` : 'なし') : (first?.lyric ? '登録あり' : 'なし') },
                    ].filter(item => item.v !== undefined).map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <Text style={{ color: dynamicStyles.subText, fontSize: 13, width: 110 }}>{item.l}</Text>
                        <Text style={{ color: dynamicStyles.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={2}>
                          {item.v !== null && item.v !== '' ? String(item.v) : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ★ プレイリスト選択モーダル（インライン確認対応で衝突ゼロ） */}
      <Modal visible={!!addToPlaylistTargetSongs} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={{ 
          flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20)
        }}>
          <View style={{
            width: isLandscape ? Math.min(width * 0.9, 600) : '90%',
            maxHeight: isLandscape ? '85%' : '70%',
            flexShrink: 1,
            backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22,
            borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden'
          }}>
            {confirmingSmartConvert ? (
              /* ★ スマートプレイリスト変換のインライン確認画面 */
              <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Ionicons name="warning-outline" size={50} color="#f59e0b" style={{ marginBottom: 12 }} />
                <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
                  プレイリストの変換確認
                </Text>
                <Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 }}>
                  選択された中にスマートプレイリストが含まれています。{'\n'}
                  曲を追加すると通常プレイリストに変換され、条件による自動更新が行われなくなります。{'\n\n'}
                  <Text style={{ color: themeColor, fontWeight: 'bold' }}>※端末内の楽曲ファイルは削除されません</Text>
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                  <TouchableOpacity
                    style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setConfirmingSmartConvert(false)}
                  >
                    <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }}>戻る</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1.3, height: 48, borderRadius: 24, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}
                    onPress={executeAddPlaylists}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>変換して追加</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* 通常のプレイリスト選択一覧 */
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>プレイリストに追加</Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                      {addToPlaylistTargetSongs && addToPlaylistTargetSongs.length > 1 
                        ? `選択した ${addToPlaylistTargetSongs.length} 曲を追加するリストを選択` 
                        : `「${addToPlaylistTargetSongs?.[0]?.title || '曲'}」を追加するリストを選択`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeAddToPlaylistModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6}>
                    <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={availablePlaylistsForTarget}
                  keyExtractor={(item) => item.id}
                  style={{ marginVertical: 8, flexShrink: 1 }}
                  contentContainerStyle={{ paddingVertical: 8, paddingBottom: 15 }}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                      <Ionicons name="information-circle-outline" size={48} color={dynamicStyles.subText} />
                      <Text style={{ color: dynamicStyles.subText, marginTop: 12, fontSize: 14, fontWeight: 'bold', textAlign: 'center', lineHeight: 20 }}>
                        追加可能なプレイリストがありません
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSmart = item.type === 'smart';
                    const artSource = getPlaylistFirstArt(item, localLibrary);
                    const count = getPlaylistSongs(item, localLibrary).length;
                    const isSelected = selectedPlaylistsForTarget.has(item.id);

                    return (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
                          backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                          marginBottom: 10, borderWidth: 1, borderColor: isSelected ? themeColor : dynamicStyles.border
                        }}
                        onPress={() => {
                          const next = new Set(selectedPlaylistsForTarget);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedPlaylistsForTarget(next);
                        }}
                        activeOpacity={0.6}
                      >
                        <View style={{ marginRight: 12 }}>
                          <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? themeColor : dynamicStyles.subText} />
                        </View>
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
                      </TouchableOpacity>
                    );
                  }}
                />

                <TouchableOpacity
                  style={{
                    height: 50, borderRadius: 25, backgroundColor: selectedPlaylistsForTarget.size > 0 ? themeColor : '#6b7280',
                    justifyContent: 'center', alignItems: 'center', marginTop: 10,
                    opacity: selectedPlaylistsForTarget.size > 0 ? 1 : 0.5,
                  }}
                  disabled={selectedPlaylistsForTarget.size === 0}
                  onPress={handlePressAddBtn}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                    {selectedPlaylistsForTarget.size > 0 ? `${selectedPlaylistsForTarget.size} 個のリストに追加` : 'プレイリストを選択'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};