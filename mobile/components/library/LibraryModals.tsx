import React, { useState } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Animated, Image, 
  Modal, TouchableWithoutFeedback, ScrollView, TextInput, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlaylistFirstArt, getPlaylistSongs } from '../../utils/playlistEvaluator';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const LibraryModals = ({
  dynamicStyles, themeColor, isDark, isLandscape, width, insets,
  actionSheetSong, closeActionSheet, sheetAnim,
  currentSelectionType, currentPlaylist, handleRemoveFromCurrentPlaylist, handleDeleteSongPermanently,
  songInfoModalTarget, setSongInfoModalTarget,
  addToPlaylistSong, closeAddToPlaylistModal, availablePlaylistsForSong,
  selectedPlaylistsForAdd, setSelectedPlaylistsForAdd, handleAddSongToPlaylists,
  editingSong, setEditingSong, editTitle, setEditTitle, editArtist, setEditArtist,
  editAlbum, setEditAlbum, editTrack, setEditTrack, editDisc, setEditDisc,
  editYear, setEditYear, editLyric, setEditLyric, saveEditedSong,
  openEditSongModal, setAddToPlaylistSong,
  showPlaylistTypeIcon, localLibrary, AnimatedCancelButton
}: any) => {

  const [confirmingSmartConvert, setConfirmingSmartConvert] = useState(false);

  const handlePressAddBtn = () => {
    if (selectedPlaylistsForAdd.size === 0 || !addToPlaylistSong) return;
    const targetPlaylists = availablePlaylistsForSong.filter((pl: any) => selectedPlaylistsForAdd.has(pl.id));
    const hasSmart = targetPlaylists.some((pl: any) => pl.type === 'smart');

    if (hasSmart) {
      setConfirmingSmartConvert(true);
    } else {
      handleAddSongToPlaylists();
    }
  };

  const onConfirmConvertAndAdd = () => {
    setConfirmingSmartConvert(false);
    handleAddSongToPlaylists();
  };

  return (
    <>
      {/* 1. アクションメニュー */}
      <Modal visible={!!actionSheetSong} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeActionSheet()}>
          <Animated.View style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnim, 
            justifyContent: 'flex-end', paddingHorizontal: 15, 
            paddingTop: Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15
          }}>
            <TouchableWithoutFeedback>
              <Animated.View style={{ gap: 10, transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}>
                    <Image source={actionSheetSong?.localImageUri ? { uri: actionSheetSong.localImageUri } : DEFAULT_ICON} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{actionSheetSong?.title || 'Untitled'}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{actionSheetSong?.artist || 'Unknown Artist'}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }} onPress={() => { const target = actionSheetSong; closeActionSheet(() => setAddToPlaylistSong(target)); }} activeOpacity={0.6}>
                    <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>プレイリストに追加</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }} onPress={() => { const target = actionSheetSong; closeActionSheet(() => openEditSongModal(target)); }} activeOpacity={0.6}>
                    <Ionicons name="create-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>楽曲情報を編集</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: (currentSelectionType === 'PLAYLIST' && !currentPlaylist?.isAll) ? 1 : 0, borderBottomColor: dynamicStyles.border }} onPress={() => { const target = actionSheetSong; closeActionSheet(() => setSongInfoModalTarget(target)); }} activeOpacity={0.6}>
                    <Ionicons name="information-circle-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>情報を見る</Text>
                  </TouchableOpacity>

                  {currentSelectionType === 'PLAYLIST' && !currentPlaylist?.isAll && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }} onPress={() => { const target = actionSheetSong; closeActionSheet(() => handleRemoveFromCurrentPlaylist(target)); }} activeOpacity={0.6}>
                      <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>このプレイリストから削除</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }} onPress={() => { const target = actionSheetSong; closeActionSheet(() => handleDeleteSongPermanently(target)); }} activeOpacity={0.6}>
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>ライブラリから楽曲を削除</Text>
                  </TouchableOpacity>
                </View>

                <AnimatedCancelButton onPress={() => closeActionSheet()} dynamicStyles={dynamicStyles} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 2. タグ情報ポップアップ */}
      <Modal visible={!!songInfoModalTarget} transparent animationType="none">
        <View style={{ 
          flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', 
          paddingHorizontal: 20, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20) 
        }}>
          <View style={{ width: '100%', maxWidth: 440, maxHeight: isLandscape ? '85%' : '70%', flexShrink: 1, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
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

      {/* ★ 3. プレイリスト選択モーダル（インライン確認対応） */}
      <Modal visible={!!addToPlaylistSong} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
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
              /* インライン確認画面 */
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
                    onPress={onConfirmConvertAndAdd}
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
                    <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }} numberOfLines={1}>「{addToPlaylistSong?.title || '曲'}」を追加するリストを選択</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setConfirmingSmartConvert(false); closeAddToPlaylistModal(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6}>
                    <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={availablePlaylistsForSong}
                  keyExtractor={(item) => item.id}
                  style={{ marginVertical: 8, flexShrink: 1 }}
                  contentContainerStyle={{ paddingVertical: 8, paddingBottom: 15 }}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
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
                    const isSelected = selectedPlaylistsForAdd.has(item.id);

                    return (
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
                          backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                          marginBottom: 10, borderWidth: 1, borderColor: isSelected ? themeColor : dynamicStyles.border
                        }}
                        onPress={() => {
                          const next = new Set(selectedPlaylistsForAdd);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedPlaylistsForAdd(next);
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
                    height: 50, borderRadius: 25, backgroundColor: selectedPlaylistsForAdd.size > 0 ? themeColor : '#6b7280',
                    justifyContent: 'center', alignItems: 'center', marginTop: 10,
                    opacity: selectedPlaylistsForAdd.size > 0 ? 1 : 0.5,
                  }}
                  disabled={selectedPlaylistsForAdd.size === 0}
                  onPress={handlePressAddBtn}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                    {selectedPlaylistsForAdd.size > 0 ? `${selectedPlaylistsForAdd.size} 個のリストに追加` : 'プレイリストを選択'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 4. 楽曲情報編集モーダル */}
      <Modal visible={!!editingSong} transparent animationType="none">
        <KeyboardAvoidingView 
          style={{ 
            flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', 
            paddingHorizontal: 20, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20) 
          }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ width: '100%', maxWidth: 460, maxHeight: isLandscape ? '85%' : '70%', flexShrink: 1, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
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
    </>
  );
};