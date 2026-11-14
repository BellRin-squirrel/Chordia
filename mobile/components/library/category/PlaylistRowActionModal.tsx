import React from 'react';
import { 
  View, Text, Image, TouchableOpacity, Modal, StyleSheet,
  TouchableWithoutFeedback, Animated, ScrollView, Platform, type StyleProp, type ViewStyle 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { t } from '../../../utils/i18n';
import { getPlaylistFirstArt } from '../../../utils/playlistEvaluator';

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

interface PlaylistRowActionModalProps {
  target: any;
  originLayout: { x: number; y: number; width: number; height: number } | null;
  morphProgress: Animated.Value;
  onClose: (callback?: () => void) => void;
  onRename: (target: any) => void;
  onChangeCover: (target: any) => void;
  onEditRules: (target: any) => void;
  onConvertToNormal: (target: any) => void;
  onEditSongs: (target: any) => void;
  onDuplicate: (target: any) => void;
  onDelete: (target: any) => void;
  localLibrary: any[];
  dynamicStyles: any;
  themeColor: string;
  isDark: boolean;
  isLandscape: boolean;
  menuTopOffset: number;
  width: number;
  height: number;
  insets: any;
  language?: string;
}

export const PlaylistRowActionModal: React.FC<PlaylistRowActionModalProps> = ({
  target,
  originLayout,
  morphProgress,
  onClose,
  onRename,
  onChangeCover,
  onEditRules,
  onConvertToNormal,
  onEditSongs,
  onDuplicate,
  onDelete,
  localLibrary,
  dynamicStyles,
  themeColor,
  isDark,
  isLandscape,
  menuTopOffset,
  width,
  height,
  insets,
  language = 'ja',
}) => {
  if (!target) return null;

  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const menuSurfaceColor = useLiquidGlass
    ? (isDark ? 'rgba(32,32,36,0.78)' : 'rgba(248,248,252,0.82)')
    : dynamicStyles.card;

  const landscapeMenuColumns = width >= 900 ? 3 : 2;
  const rowMenuColumns = target.isAll ? 2 : landscapeMenuColumns;

  const targetCardWidth = Math.min(isLandscape ? 900 : 500, width - 24);
  const targetCardHeight = 96;

  const targetCenterX = width / 2;
  const targetCenterY = menuTopOffset + targetCardHeight / 2;

  const originCenterX = (originLayout?.x ?? (width / 2 - targetCardWidth / 2)) + (originLayout?.width ?? targetCardWidth) / 2;
  const originCenterY = (originLayout?.y ?? menuTopOffset) + (originLayout?.height ?? targetCardHeight) / 2;

  const startTranslateX = originCenterX - targetCenterX;
  const startTranslateY = originCenterY - targetCenterY;
  const startScaleX = (originLayout?.width ?? targetCardWidth) / targetCardWidth;
  const startScaleY = (originLayout?.height ?? targetCardHeight) / targetCardHeight;

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
    <Modal visible={!!target} transparent animationType="none" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <TouchableWithoutFeedback onPress={() => onClose()}>
        <Animated.View style={{ 
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.48)',
          opacity: morphProgress,
          justifyContent: 'flex-start',
          paddingHorizontal: 12,
          paddingTop: menuTopOffset,
          paddingBottom: Math.max(insets?.bottom || 0, 12) + 12,
        }}>
          <TouchableWithoutFeedback>
            <View style={{
              width: targetCardWidth,
              maxWidth: Math.min(isLandscape ? 900 : 500, width - 24),
              maxHeight: '100%',
              alignSelf: 'center',
              gap: 8,
            }}>
              <Animated.View style={{ transform: headerTransform }}>
                <View style={{
                  backgroundColor: menuSurfaceColor,
                  borderRadius: 28,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: dynamicStyles.border,
                }}>
                  {useLiquidGlass && (
                    <GlassView
                      pointerEvents="none"
                      glassEffectStyle="regular"
                      colorScheme={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, height: targetCardHeight }}>
                    <Image source={getPlaylistFirstArt(target, localLibrary)} style={{ width: 72, height: 72, borderRadius: 16, marginRight: 12 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: dynamicStyles.text, fontWeight: '700', fontSize: 17 }} numberOfLines={2}>{target.playlistName}</Text>
                      <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 4 }}>
                        {target.isAll ? t('all_songs_item', language) : (target.type === 'smart' ? t('smart_playlist_label', language) : t('normal_playlist_label', language))}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={dynamicStyles.subText} style={{ marginLeft: 8 }} />
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: menuOpacity, flexShrink: 1 }}>
                <View style={{
                  backgroundColor: menuSurfaceColor,
                  borderRadius: 26,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: dynamicStyles.border,
                }}>
                  {useLiquidGlass && (
                    <GlassView
                      pointerEvents="none"
                      glassEffectStyle="regular"
                      colorScheme={isDark ? 'dark' : 'light'}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <ScrollView
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    style={{
                      flexGrow: 0,
                      maxHeight: Math.max(120, height - menuTopOffset - Math.max(insets?.bottom || 0, 12) - 180),
                    }}
                    contentContainerStyle={[
                      { paddingVertical: 0 },
                      isLandscape && { flexDirection: 'row', flexWrap: 'wrap' },
                    ]}
                  >
                    {target.isAll ? (
                      <>
                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / rowMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => onClose(() => onChangeCover(target))}
                        >
                          <Ionicons name="image-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('change_cover_image', language)}</Text>
                        </LiquidGlassMenuOption>

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / rowMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                          onPress={() => onClose(() => onDuplicate(target))}
                        >
                          <Ionicons name="copy-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('duplicate_playlist', language)}</Text>
                        </LiquidGlassMenuOption>
                      </>
                    ) : (
                      <>
                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => onClose(() => onRename(target))}
                        >
                          <Ionicons name="create-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('rename_playlist', language)}</Text>
                        </LiquidGlassMenuOption>

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => onClose(() => onChangeCover(target))}
                        >
                          <Ionicons name="image-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('change_cover_image', language)}</Text>
                        </LiquidGlassMenuOption>

                        {target.type === 'smart' ? (
                          <>
                            <LiquidGlassMenuOption
                              isDark={isDark}
                              style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                              onPress={() => onClose(() => onEditRules(target))}
                            >
                              <Ionicons name="options-outline" size={22} color={themeColor} />
                              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_rules', language)}</Text>
                            </LiquidGlassMenuOption>

                            <LiquidGlassMenuOption
                              isDark={isDark}
                              style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                              onPress={() => onClose(() => onConvertToNormal(target))}
                            >
                              <Ionicons name="swap-horizontal-outline" size={22} color={themeColor} />
                              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('convert_to_normal_playlist', language)}</Text>
                            </LiquidGlassMenuOption>
                          </>
                        ) : (
                          <LiquidGlassMenuOption
                            isDark={isDark}
                            style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                            onPress={() => onClose(() => onEditSongs(target))}
                          >
                            <Ionicons name="musical-notes-outline" size={22} color={themeColor} />
                            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('edit_playlist_songs', language)}</Text>
                          </LiquidGlassMenuOption>
                        )}

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                          onPress={() => onClose(() => onDuplicate(target))}
                        >
                          <Ionicons name="copy-outline" size={22} color={themeColor} />
                          <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>{t('duplicate_playlist', language)}</Text>
                        </LiquidGlassMenuOption>

                        <LiquidGlassMenuOption
                          isDark={isDark}
                          style={{ width: isLandscape ? `${100 / landscapeMenuColumns}%` : undefined, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                          onPress={() => onClose(() => onDelete(target))}
                        >
                          <Ionicons name="trash-outline" size={22} color="#ef4444" />
                          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>{t('delete_playlist', language)}</Text>
                        </LiquidGlassMenuOption>
                      </>
                    )}
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};