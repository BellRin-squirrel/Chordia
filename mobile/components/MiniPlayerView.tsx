import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { getPlaylistFirstArt, getPlaylistSongs } from '../utils/playlistEvaluator';
import { LanguageCode, t } from '../utils/i18n';

const DEFAULT_ICON = require('../assets/images/icon.png');

interface MiniPlayerMenuModalProps {
  visible: boolean;
  onClose: () => void;
  origin?: { x: number; y: number; width: number; height: number } | null;
  currentSong: any;
  localPlaylists: any[];
  localLibrary: any[];
  dynamicStyles: any;
  themeColor: string;
  isDark: boolean;
  insets: any;
  isLandscape: boolean;
  width: number;
  height: number;
  language?: LanguageCode;
  showPlaylistTypeIcon?: boolean;
  onNavigateToPlaylist: () => void;
  onNavigateToAlbum: () => void;
  onNavigateToArtist: () => void;
  onDeleteFromLibrary: () => void;
  onAddSongToPlaylists: (selectedPlaylistIds: Set<string>) => Promise<void>;
}

const LiquidGlassMenuOption = ({ children, onPress, style }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
};

export const MiniPlayerMenuModal: React.FC<MiniPlayerMenuModalProps> = ({
  visible,
  onClose,
  origin,
  currentSong,
  localPlaylists,
  localLibrary,
  dynamicStyles,
  themeColor,
  isDark,
  insets,
  isLandscape,
  width,
  height,
  language = 'ja',
  showPlaylistTypeIcon,
  onNavigateToPlaylist,
  onNavigateToAlbum,
  onNavigateToArtist,
  onDeleteFromLibrary,
  onAddSongToPlaylists,
}) => {
  const [mode, setMode] = useState<'MENU' | 'ADD_TO_PLAYLIST'>('MENU');
  const landscapeMenuColumns = width >= 900 ? 3 : 2;
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [selectedPlaylistsForAdd, setSelectedPlaylistsForAdd] = useState<Set<string>>(new Set());
  const [confirmingSmartConvert, setConfirmingSmartConvert] = useState(false);

  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const menuTopOffset = isLandscape 
    ? Math.max(insets?.top || 0, 20) + (isPad ? 28 : 16)
    : Math.max((insets?.top || 0) + (isPad ? 95 : 75), height * 0.16);

  const morphProgress = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  // プレイリストプレビューと完全一致させるカードサイズ
  const targetCardWidth = Math.min(isLandscape ? 900 : 500, width - 24);
  const targetCardHeight = 96;

  const targetCenterX = width / 2;
  const targetCenterY = menuTopOffset + targetCardHeight / 2;

  const originCenterX = (origin?.x ?? (width / 2 - targetCardWidth / 2)) + (origin?.width ?? targetCardWidth) / 2;
  const originCenterY = (origin?.y ?? (height - 120)) + (origin?.height ?? targetCardHeight) / 2;

  const startTranslateX = originCenterX - targetCenterX;
  const startTranslateY = originCenterY - targetCenterY;
  const startScaleX = (origin?.width ?? targetCardWidth) / targetCardWidth;
  const startScaleY = (origin?.height ?? targetCardHeight) / targetCardHeight;

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      morphProgress.setValue(0);
      Animated.timing(morphProgress, {
        toValue: 1,
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const closeWithAnim = (callback?: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.timing(morphProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setMode('MENU');
      setIsNavExpanded(true);
      setSelectedPlaylistsForAdd(new Set());
      setConfirmingSmartConvert(false);
      onClose();
      if (callback) callback();
    });
  };

  if (!visible || !currentSong) return null;

  const availablePlaylistsForSong = (localPlaylists || []).filter((pl: any) => {
    if (pl.isAll || pl.id === 'all_songs') return false;
    const targetFname = currentSong.musicFilename?.split(/[\\/]/).pop()?.toLowerCase();
    if (!targetFname) return false;

    if (pl.type === 'smart') {
      return !getPlaylistSongs(pl, localLibrary).some(
        (s: any) => s.musicFilename?.split(/[\\/]/).pop()?.toLowerCase() === targetFname
      );
    }
    return !(Array.isArray(pl.music) ? pl.music : []).some(
      (m: any) => (typeof m === 'string' ? m : (m?.musicFilename || m?.path || '')).split(/[\\/]/).pop()?.toLowerCase() === targetFname
    );
  });

  const handlePressConfirmAdd = () => {
    if (selectedPlaylistsForAdd.size === 0) return;
    const targetPlaylists = availablePlaylistsForSong.filter((pl: any) => selectedPlaylistsForAdd.has(pl.id));
    const hasSmart = targetPlaylists.some((pl: any) => pl.type === 'smart');

    if (hasSmart) {
      setConfirmingSmartConvert(true);
    } else {
      executeAddPlaylists();
    }
  };

  const executeAddPlaylists = async () => {
    setConfirmingSmartConvert(false);
    await onAddSongToPlaylists(selectedPlaylistsForAdd);
    closeWithAnim();
  };

  const headerTransform = [
    {
      translateX: morphProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [startTranslateX, 0],
      }),
    },
    {
      translateY: morphProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [startTranslateY, 0],
      }),
    },
    {
      scaleX: morphProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [startScaleX, 1],
      }),
    },
    {
      scaleY: morphProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [startScaleY, 1],
      }),
    },
  ];

  const menuOpacity = morphProgress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.2, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <TouchableWithoutFeedback onPress={() => closeWithAnim()}>
        <Animated.View
          style={{
            flex: 1,
            opacity: morphProgress,
            justifyContent: mode === 'MENU' ? 'flex-start' : 'flex-end',
            paddingHorizontal: 12,
            paddingTop: mode === 'MENU' ? menuTopOffset : Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15,
          }}
        >
          {/* 背景全体を優しくぼかすコンテキストメニュー風オーバーレイ */}
          <BlurView
            intensity={isDark ? 28 : 22}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.22)' }]}
          />

          <TouchableWithoutFeedback>
            <View
              style={{
                width: mode === 'MENU' ? targetCardWidth : undefined,
                maxWidth: Math.min(isLandscape ? 900 : 500, width - 24),
                alignSelf: 'center',
                gap: 10,
                maxHeight: '90%',
              }}
            >
              {mode === 'MENU' ? (
                <>
                  {/* プレビューカード（プレイリストプレビューと完全一致の96px・72x72アートUI） */}
                  <Animated.View style={{ transform: headerTransform }}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => closeWithAnim(onNavigateToAlbum)}
                      style={{
                        borderRadius: 26,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: isDark ? 0.4 : 0.18,
                        shadowRadius: 20,
                        elevation: 10,
                      }}
                    >
                      {useLiquidGlass ? (
                        <GlassView
                          pointerEvents="none"
                          glassEffectStyle="regular"
                          colorScheme={isDark ? 'dark' : 'light'}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : (
                        <BlurView
                          intensity={isDark ? 85 : 95}
                          tint={isDark ? 'dark' : 'light'}
                          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(30,30,34,0.72)' : 'rgba(255,255,255,0.72)' }]}
                        />
                      )}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          height: targetCardHeight,
                        }}
                      >
                        <Image
                          source={currentSong.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
                          style={{ width: 72, height: 72, borderRadius: 16, marginRight: 12 }}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: dynamicStyles.text, fontWeight: '700', fontSize: 17 }} numberOfLines={2}>
                            {currentSong.title || 'Untitled'}
                          </Text>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 4 }} numberOfLines={1}>
                            {currentSong.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={22} color={dynamicStyles.subText} style={{ marginLeft: 8 }} />
                      </View>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* 下部メニュー一覧コンテナ（フロストガラス質感） */}
                  <Animated.View style={{ opacity: menuOpacity }}>
                    <View
                      style={{
                        borderRadius: 24,
                        overflow: 'hidden',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: isDark ? 0.45 : 0.2,
                        shadowRadius: 24,
                        elevation: 12,
                      }}
                    >
                      {useLiquidGlass ? (
                        <GlassView
                          pointerEvents="none"
                          glassEffectStyle="regular"
                          colorScheme={isDark ? 'dark' : 'light'}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : (
                        <BlurView
                          intensity={isDark ? 85 : 95}
                          tint={isDark ? 'dark' : 'light'}
                          style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(30,30,34,0.72)' : 'rgba(255,255,255,0.72)' }]}
                        />
                      )}

                      <ScrollView
                        bounces={false}
                        style={{ flexGrow: 0 }}
                        contentContainerStyle={[
                          { paddingVertical: 0 },
                          isLandscape && { flexDirection: 'row', flexWrap: 'wrap' },
                        ]}
                        showsVerticalScrollIndicator={false}
                      >
                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            gap: 12,
                            width: isLandscape ? `${50}%` : undefined,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                          }}
                          onPress={() => setMode('ADD_TO_PLAYLIST')}
                        >
                          <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>
                            {t('add_to_playlist', language)}
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                        </LiquidGlassMenuOption>

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 14,
                            width: isLandscape ? `${50}%` : undefined,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                          }}
                          onPress={() => setIsNavExpanded((prev) => !prev)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Ionicons name="arrow-redo-outline" size={22} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>
                              {t('menu_navigate', language)}
                            </Text>
                          </View>
                          <Ionicons name={isNavExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={dynamicStyles.subText} />
                        </LiquidGlassMenuOption>

                        {isNavExpanded && (
                          <View
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                              borderBottomWidth: StyleSheet.hairlineWidth,
                              borderBottomColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                              width: isLandscape ? '100%' : undefined,
                              flexDirection: isLandscape ? 'row' : undefined,
                              flexWrap: isLandscape ? 'wrap' : undefined,
                            }}
                          >
                            <LiquidGlassMenuOption
                              isDark={isDark}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                paddingLeft: 24,
                                gap: 12,
                                width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined,
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                              }}
                              onPress={() => closeWithAnim(onNavigateToPlaylist)}
                            >
                              <Ionicons name="musical-notes-outline" size={20} color={themeColor} />
                              <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: '500' }}>
                                {t('navigate_to_playlist', language)}
                              </Text>
                              <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                            </LiquidGlassMenuOption>

                            <LiquidGlassMenuOption
                              isDark={isDark}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                paddingLeft: 24,
                                gap: 12,
                                width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined,
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                              }}
                              onPress={() => closeWithAnim(onNavigateToAlbum)}
                            >
                              <Ionicons name="disc-outline" size={20} color={themeColor} />
                              <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: '500' }}>
                                {t('navigate_to_album', language)}
                              </Text>
                              <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                            </LiquidGlassMenuOption>

                            <LiquidGlassMenuOption
                              isDark={isDark}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                paddingLeft: 24,
                                gap: 12,
                                width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined,
                              }}
                              onPress={() => closeWithAnim(onNavigateToArtist)}
                            >
                              <Ionicons name="mic-outline" size={20} color={themeColor} />
                              <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: '500' }}>
                                {t('navigate_to_artist', language)}
                              </Text>
                              <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                            </LiquidGlassMenuOption>
                          </View>
                        )}

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            gap: 12,
                            width: isLandscape ? `${50}%` : undefined,
                          }}
                          onPress={() => closeWithAnim(onDeleteFromLibrary)}
                        >
                          <Ionicons name="trash-outline" size={22} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
                            {t('delete_from_library_menu', language)}
                          </Text>
                        </LiquidGlassMenuOption>
                      </ScrollView>
                    </View>
                  </Animated.View>
                </>
              ) : (
                <View
                  style={{
                    backgroundColor: dynamicStyles.card,
                    borderRadius: 24,
                    padding: 20,
                    borderWidth: 1.5,
                    borderColor: dynamicStyles.border,
                    maxHeight: isLandscape ? '85%' : '75%',
                    overflow: 'hidden',
                  }}
                >
                  {confirmingSmartConvert ? (
                    <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                      <Ionicons name="warning-outline" size={50} color="#f59e0b" style={{ marginBottom: 12 }} />
                      <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
                        {t('smart_convert_confirm_title', language)}
                      </Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 }}>
                        {t('smart_convert_confirm_desc', language)}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                        <TouchableOpacity
                          style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                          onPress={() => setConfirmingSmartConvert(false)}
                        >
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }}>{t('back', language)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1.3, height: 48, borderRadius: 24, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}
                          onPress={executeAddPlaylists}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{t('convert_and_add', language)}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>
                            {t('add_to_playlist', language)}
                          </Text>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                            {`「${currentSong.title || 'Track'}」`}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setMode('MENU')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6}>
                          <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
                        </TouchableOpacity>
                      </View>

                      <FlatList
                        data={availablePlaylistsForSong}
                        keyExtractor={(item) => item.id}
                        style={{ marginVertical: 8, flexShrink: 1 }}
                        contentContainerStyle={{ paddingVertical: 4, paddingBottom: 15 }}
                        ListEmptyComponent={
                          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 36 }}>
                            <Ionicons name="information-circle-outline" size={44} color={dynamicStyles.subText} />
                            <Text style={{ color: dynamicStyles.subText, marginTop: 12, fontSize: 14, fontWeight: 'bold', textAlign: 'center', lineHeight: 20 }}>
                              {t('no_available_playlists', language)}
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
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                borderRadius: 14,
                                backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7',
                                marginBottom: 10,
                                borderWidth: 1,
                                borderColor: isSelected ? themeColor : dynamicStyles.border,
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
                                <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={22} color={isSelected ? themeColor : dynamicStyles.subText} />
                              </View>
                              <Image source={artSource?.uri ? { uri: artSource.uri } : DEFAULT_ICON} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                              <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  {showPlaylistTypeIcon && (
                                    <Ionicons name={isSmart ? 'flash' : 'musical-notes'} size={14} color={themeColor} style={{ marginRight: 5 }} />
                                  )}
                                  <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} numberOfLines={1}>
                                    {item.playlistName}
                                  </Text>
                                </View>
                                <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>
                                  {`${count} ${t('songs_count_suffix', language)}`}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        }}
                      />

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={() => setMode('MENU')}
                        >
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }}>
                            {t('back', language)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1.3,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: selectedPlaylistsForAdd.size > 0 ? themeColor : (isDark ? '#3a3a3c' : '#d1d5db'),
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                          onPress={handlePressConfirmAdd}
                          disabled={selectedPlaylistsForAdd.size === 0}
                        >
                          <Text style={{ color: selectedPlaylistsForAdd.size > 0 ? '#fff' : dynamicStyles.subText, fontWeight: 'bold', fontSize: 14 }}>
                            {selectedPlaylistsForAdd.size > 0
                              ? `${t('add_btn', language)} (${selectedPlaylistsForAdd.size})`
                              : t('select_playlist_btn', language)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
