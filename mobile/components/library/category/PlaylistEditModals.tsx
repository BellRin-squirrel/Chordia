import React, { useRef, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, Modal,
  TouchableWithoutFeedback, TextInput, Animated, Easing, 
  KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { t } from '../../../utils/i18n';

const DEFAULT_ICON = require('../../../assets/images/icon.png');

type LiquidGlassMenuOptionProps = {
  children: React.ReactNode;
  onPress: () => void;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
};

const LiquidGlassMenuOption = ({ children, onPress, style }: LiquidGlassMenuOptionProps) => {
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.6}>
      {children}
    </TouchableOpacity>
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

interface PlaylistEditModalsProps {
  headerMenuVisible: boolean;
  onCloseHeaderMenu: (callback?: () => void) => void;
  onOpenCreatePlaylistName: () => void;
  onOpenCreateSmartPlaylist: () => void;

  createNameModalVisible: boolean;
  newPlaylistName: string;
  setNewPlaylistName: (name: string) => void;
  onCloseCreateNameModal: () => void;
  onProceedToSongSelection: () => void;

  selectSongsModalVisible: boolean;
  filteredSongsForCreate: any[];
  selectedSongFilenames: Set<string>;
  setSelectedSongFilenames: (set: Set<string>) => void;
  songSearchQuery: string;
  setSongSearchQuery: (q: string) => void;
  onCloseSelectSongsModal: () => void;
  onCreatePlaylistSave: () => void;

  editSongsTargetPl: any;
  filteredSongsForEdit: any[];
  editSongsSelectedFilenames: Set<string>;
  setEditSongsSelectedFilenames: (set: Set<string>) => void;
  editSongsSearchQuery: string;
  setEditSongsSearchQuery: (q: string) => void;
  onCloseEditSongsModal: () => void;
  onSaveEditPlaylistSongs: () => void;

  renameTarget: any;
  renameInput: string;
  setRenameInput: (name: string) => void;
  onCloseRenameModal: () => void;
  onSaveRename: () => void;

  dynamicStyles: any;
  themeColor: string;
  isDark: boolean;
  isLandscape: boolean;
  width: number;
  insets: any;
  language?: string;
}

export const PlaylistEditModals: React.FC<PlaylistEditModalsProps> = ({
  headerMenuVisible,
  onCloseHeaderMenu,
  onOpenCreatePlaylistName,
  onOpenCreateSmartPlaylist,

  createNameModalVisible,
  newPlaylistName,
  setNewPlaylistName,
  onCloseCreateNameModal,
  onProceedToSongSelection,

  selectSongsModalVisible,
  filteredSongsForCreate,
  selectedSongFilenames,
  setSelectedSongFilenames,
  songSearchQuery,
  setSongSearchQuery,
  onCloseSelectSongsModal,
  onCreatePlaylistSave,

  editSongsTargetPl,
  filteredSongsForEdit,
  editSongsSelectedFilenames,
  setEditSongsSelectedFilenames,
  editSongsSearchQuery,
  setEditSongsSearchQuery,
  onCloseEditSongsModal,
  onSaveEditPlaylistSongs,

  renameTarget,
  renameInput,
  setRenameInput,
  onCloseRenameModal,
  onSaveRename,

  dynamicStyles,
  themeColor,
  isDark,
  isLandscape,
  width,
  insets,
  language = 'ja',
}) => {
  const sheetAnimHeader = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (headerMenuVisible) {
      sheetAnimHeader.setValue(0);
      Animated.spring(sheetAnimHeader, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
    }
  }, [headerMenuVisible]);

  const closeHeaderMenuWithAnim = (cb?: () => void) => {
    Animated.timing(sheetAnimHeader, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      onCloseHeaderMenu();
      if (cb) setTimeout(cb, Platform.OS === 'ios' ? 350 : 100);
    });
  };

  return (
    <>
      {/* 1. ヘッダー3点メニュー */}
      <Modal visible={headerMenuVisible} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeHeaderMenuWithAnim()}>
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
                    onPress={() => closeHeaderMenuWithAnim(onOpenCreatePlaylistName)}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_new_playlist', language)}</Text>
                  </LiquidGlassMenuOption>

                  <LiquidGlassMenuOption
                    isDark={isDark}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => closeHeaderMenuWithAnim(onOpenCreateSmartPlaylist)}
                  >
                    <Ionicons name="flash-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('create_smart_playlist', language)}</Text>
                  </LiquidGlassMenuOption>
                </View>

                <AnimatedCancelButton onPress={() => closeHeaderMenuWithAnim()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 2. 新規プレイリスト名 入力モーダル */}
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
                onPress={onCloseCreateNameModal}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 48, borderRadius: 24, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={onProceedToSongSelection}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t('next_select_songs', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. 新規プレイリストの楽曲選択モーダル */}
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
              <TouchableOpacity onPress={onCloseSelectSongsModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
              onPress={onCreatePlaylistSave}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                {t('create_playlist_with_count', language).replace('{count}', String(selectedSongFilenames.size))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. プレイリストの収録曲編集モーダル */}
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
              <TouchableOpacity onPress={onCloseEditSongsModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
              onPress={onSaveEditPlaylistSongs}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                {t('save_changes_with_count', language).replace('{count}', String(editSongsSelectedFilenames.size))}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. プレイリスト名 変更モーダル */}
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
                onPress={onCloseRenameModal}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 48, borderRadius: 24, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={onSaveRename}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>{t('save_changes_btn', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};