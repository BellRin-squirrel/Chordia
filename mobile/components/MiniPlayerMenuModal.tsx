import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import type { ViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const LiquidGlassMenuOption = ({ children, onPress, style, isDark }: any) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={useLiquidGlass ? 0.9 : 0.6}
      style={[style, { overflow: 'hidden' }]}
    >
      {useLiquidGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          isInteractive
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
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
  const menuSurfaceColor = useLiquidGlass
    ? (isDark ? 'rgba(32,32,36,0.78)' : 'rgba(248,248,252,0.82)')
    : dynamicStyles.card;
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [selectedPlaylistsForAdd, setSelectedPlaylistsForAdd] = useState<Set<string>>(new Set());
  const [confirmingSmartConvert, setConfirmingSmartConvert] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const songHeaderRef = useRef<ViewInstance>(null);
  const headerTranslateX = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const headerScaleX = useRef(new Animated.Value(1)).current;
  const headerScaleY = useRef(new Animated.Value(1)).current;
  const headerTransitionAnim = useRef(new Animated.Value(1)).current;
  const headerTransitionPending = useRef(false);

  // ★ メニューの表示位置をもっと下の方（見やすく指の届きやすい位置）に設定
  const menuTopOffset = isLandscape 
    ? Math.max(insets?.top || 0, 20) + 16 
    : Math.max((insets?.top || 0) + 75, height * 0.16);

  useEffect(() => {
    if (visible) {
      headerTransitionPending.current = !!origin;
      headerTranslateX.setValue(0);
      headerTranslateY.setValue(0);
      headerScaleX.setValue(1);
      headerScaleY.setValue(1);
      headerTransitionAnim.setValue(origin ? 0 : 1);
      sheetAnim.setValue(0);
      Animated.timing(sheetAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, origin, headerTranslateX, headerTranslateY, headerScaleX, headerScaleY, headerTransitionAnim, sheetAnim]);

  const animateSongHeaderIntoMenu = useCallback(() => {
    const header = songHeaderRef.current;
    if (!headerTransitionPending.current || !origin || !header) return;
    headerTransitionPending.current = false;
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
  }, [origin, headerTranslateX, headerTranslateY, headerScaleX, headerScaleY, headerTransitionAnim]);

  useEffect(() => {
    if (!visible || !origin) return;
    const frame = requestAnimationFrame(animateSongHeaderIntoMenu);
    return () => cancelAnimationFrame(frame);
  }, [visible, origin, animateSongHeaderIntoMenu]);

  const closeWithAnim = (callback?: () => void) => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
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

  return (
    <Modal visible={visible} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <TouchableWithoutFeedback onPress={() => closeWithAnim()}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            opacity: sheetAnim,
            justifyContent: mode === 'MENU' ? 'flex-start' : 'flex-end',
            paddingHorizontal: 12,
            paddingTop: mode === 'MENU' ? menuTopOffset : Math.max(insets?.top || 0, 20) + 10,
            paddingBottom: Math.max(insets?.bottom || 0, 20) + 15,
          }}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={{
                width: mode === 'MENU' && isLandscape ? Math.min(900, width - 24) : (mode === 'MENU' ? undefined : '100%'),
                maxWidth: width - 24,
                alignSelf: 'center',
                gap: mode === 'MENU' ? 8 : 10,
                maxHeight: '90%',
                transform: [
                  {
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }}
            >
              {mode === 'MENU' ? (
                <>
                  <View
                    style={{
                      backgroundColor: menuSurfaceColor,
                      borderRadius: 20,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: dynamicStyles.border,
                    }}
                  >
                    {useLiquidGlass && (
                      <GlassView
                        pointerEvents="none"
                        glassEffectStyle="regular"
                        colorScheme={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    {/* 楽曲ヘッダー */}
                    <Animated.View
                      ref={songHeaderRef}
                      onLayout={animateSongHeaderIntoMenu}
                      style={{
                        transform: [
                          { translateX: headerTranslateX },
                          { translateY: headerTranslateY },
                          { scaleX: headerScaleX },
                          { scaleY: headerScaleY },
                        ],
                        opacity: headerTransitionAnim,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: dynamicStyles.border,
                        }}
                      >
                        <Image
                          source={currentSong.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
                          style={{ width: 44, height: 44, borderRadius: 10, marginRight: 10 }}
                        />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 15 }} numberOfLines={1}>
                            {currentSong.title || 'Untitled'}
                          </Text>
                          <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                            {currentSong.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                      </View>
                    </Animated.View>

                    {/* ★ flexGrow: 0 で不要な縦伸びを防止し、下部余白を極限までコンパクトに */}
                    <ScrollView
                      bounces={false}
                      style={{ flexGrow: 0 }}
                      contentContainerStyle={[
                        { paddingBottom: 0 },
                        isLandscape && { flexDirection: 'row', flexWrap: 'wrap' },
                      ]}
                      showsVerticalScrollIndicator={false}
                    >
                      {/* 1. プレイリストに追加 */}
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          gap: 10,
                          width: isLandscape ? `${50}%` : undefined,
                          borderBottomWidth: 1,
                          borderBottomColor: dynamicStyles.border,
                        }}
                        onPress={() => setMode('ADD_TO_PLAYLIST')}
                      >
                        <Ionicons name="add-circle-outline" size={22} color={themeColor} />
                        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>
                          {t('add_to_playlist', language)}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                      </LiquidGlassMenuOption>

                      {/* 2. 移動 (親アコーディオン) */}
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          width: isLandscape ? `${50}%` : undefined,
                          borderBottomWidth: 1,
                          borderBottomColor: dynamicStyles.border,
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

                      {/* 移動の展開サブメニュー */}
                      {isNavExpanded && (
                        <View
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            borderBottomWidth: 1,
                            borderBottomColor: dynamicStyles.border,
                            width: isLandscape ? '100%' : undefined,
                            flexDirection: isLandscape ? 'row' : undefined,
                            flexWrap: isLandscape ? 'wrap' : undefined,
                          }}
                        >
                          {/* プレイリストに移動 */}
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              paddingLeft: 24,
                              gap: 10,
                              width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined,
                              borderBottomWidth: 1,
                              borderBottomColor: dynamicStyles.border,
                            }}
                            onPress={() => closeWithAnim(onNavigateToPlaylist)}
                          >
                            <Ionicons name="musical-notes-outline" size={20} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: '500' }}>
                              {t('navigate_to_playlist', language)}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                          </LiquidGlassMenuOption>

                          {/* アルバムに移動 */}
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              paddingLeft: 24,
                              gap: 10,
                              width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined,
                              borderBottomWidth: 1,
                              borderBottomColor: dynamicStyles.border,
                            }}
                            onPress={() => closeWithAnim(onNavigateToAlbum)}
                          >
                            <Ionicons name="disc-outline" size={20} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: '500' }}>
                              {t('navigate_to_album', language)}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
                          </LiquidGlassMenuOption>

                          {/* アーティストに移動 */}
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              paddingLeft: 24,
                              gap: 10,
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

                      {/* 3. ライブラリから削除（余計な下パディングなしでコンパクトに） */}
                      <LiquidGlassMenuOption
                        isDark={isDark}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          gap: 10,
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
                </>
              ) : (
                /* プレイリスト選択画面 */
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
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
