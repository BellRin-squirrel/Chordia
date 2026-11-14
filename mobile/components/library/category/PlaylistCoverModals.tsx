import React, { useRef, useEffect } from 'react';
import { 
  View, Text, Image, TouchableOpacity, Modal, StyleSheet,
  TouchableWithoutFeedback, FlatList, Animated, Easing, Platform, type StyleProp, type ViewStyle 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { t } from '../../../utils/i18n';
import { getPlaylistSongs } from '../../../utils/playlistEvaluator';

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

interface PlaylistCoverModalsProps {
  coverPickerTarget: any;
  onCloseCoverPicker: (callback?: () => void) => void;
  songCoverPickerTarget: any;
  onCloseSongCoverPicker: () => void;
  onOpenSongCoverPicker: (target: any) => void;
  onPickFromLibrary: (target: any) => void;
  onPickFromCamera: (target: any) => void;
  onPickFromDocuments: (target: any) => void;
  onApplyCover: (target: any, uri: string | null) => void;
  allSongsCoverUri: string | null;
  localLibrary: any[];
  dynamicStyles: any;
  themeColor: string;
  isDark: boolean;
  insets: any;
  language?: string;
}

export const PlaylistCoverModals: React.FC<PlaylistCoverModalsProps> = ({
  coverPickerTarget,
  onCloseCoverPicker,
  songCoverPickerTarget,
  onCloseSongCoverPicker,
  onOpenSongCoverPicker,
  onPickFromLibrary,
  onPickFromCamera,
  onPickFromDocuments,
  onApplyCover,
  allSongsCoverUri,
  localLibrary,
  dynamicStyles,
  themeColor,
  isDark,
  insets,
  language = 'ja',
}) => {
  const sheetAnimCover = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (coverPickerTarget) {
      sheetAnimCover.setValue(0);
      Animated.spring(sheetAnimCover, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
    }
  }, [coverPickerTarget]);

  const closeCoverPickerWithAnim = (cb?: () => void) => {
    Animated.timing(sheetAnimCover, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      onCloseCoverPicker();
      if (cb) setTimeout(cb, Platform.OS === 'ios' ? 350 : 100);
    });
  };

  const songCoverPickerSongs = songCoverPickerTarget
    ? getPlaylistSongs(songCoverPickerTarget, localLibrary).filter((song: any) => song.localImageUri)
    : [];

  return (
    <>
      {/* カバー画像選択シート */}
      <Modal visible={!!coverPickerTarget} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => closeCoverPickerWithAnim()}>
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
                      closeCoverPickerWithAnim(() => onPickFromLibrary(target));
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
                      closeCoverPickerWithAnim(() => onPickFromCamera(target));
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
                      closeCoverPickerWithAnim(() => onPickFromDocuments(target));
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
                        closeCoverPickerWithAnim(() => onOpenSongCoverPicker(target));
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
                        closeCoverPickerWithAnim(() => onApplyCover(target, null));
                      }}
                    >
                      <Ionicons name="refresh-outline" size={22} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('reset_cover_image', language)}</Text>
                    </LiquidGlassMenuOption>
                  )}
                </View>

                <AnimatedCancelButton onPress={() => closeCoverPickerWithAnim()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* プレイリスト内楽曲カバー選択モーダル */}
      <Modal visible={!!songCoverPickerTarget} transparent animationType="fade" onRequestClose={onCloseSongCoverPicker}>
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
                      onCloseSongCoverPicker();
                      void onApplyCover(target, item.localImageUri);
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
            <TouchableOpacity onPress={onCloseSongCoverPicker} style={{ padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: dynamicStyles.border }}>
              <Text style={{ color: themeColor, fontWeight: '600' }}>{t('cancel', language)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};