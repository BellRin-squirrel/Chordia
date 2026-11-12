import React, { useState, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, Image, ActivityIndicator, 
  Platform, StyleSheet, Modal, Pressable, Alert, useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';
import { MarqueeText } from '../MarqueeText';
import { StagedSong } from './types';
import { GlassActionButton } from '../ui/GlassActionButton';

const DEFAULT_ICON = require('../../assets/images/icon.png');

interface SyncLocalImportViewProps {
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  stagedSongs: StagedSong[];
  isSelectionMode: boolean;
  setIsSelectionMode: (val: boolean) => void;
  selectedSongIds: Set<string>;
  setSelectedSongIds: (ids: Set<string>) => void;
  isPickingOrParsing: boolean;
  isRegistering: boolean;
  handlePickLocalMP3Files: () => void;
  openEditModal: (targets: StagedSong[]) => void;
  removeStagedSongs: (targets: StagedSong[]) => void;
  handleRegisterAllStagedToLibrary: () => void;
  toggleSelectAll: () => void;
  selectedStagedList: StagedSong[];
  language: string;
}

interface MenuPopoverConfig {
  targetSong: StagedSong;
  anchor: { x: number; y: number; width: number; height: number };
}

export const SyncLocalImportView: React.FC<SyncLocalImportViewProps> = ({
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  stagedSongs,
  isSelectionMode,
  setIsSelectionMode,
  selectedSongIds,
  setSelectedSongIds,
  isPickingOrParsing,
  isRegistering,
  handlePickLocalMP3Files,
  openEditModal,
  removeStagedSongs,
  handleRegisterAllStagedToLibrary,
  toggleSelectAll,
  selectedStagedList,
  language,
}) => {
  const { width, height } = useWindowDimensions();
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const [popoverConfig, setPopoverConfig] = useState<MenuPopoverConfig | null>(null);
  const menuBtnRefs = useRef<Record<string, View | null>>({});

  const handleOpenRowMenu = (item: StagedSong) => {
    const btnRef = menuBtnRefs.current[item.id];
    if (btnRef) {
      btnRef.measureInWindow((x, y, w, h) => {
        setPopoverConfig({
          targetSong: item,
          anchor: { x, y, width: w, height: h },
        });
      });
    }
  };

  const handleCancelAllStaged = () => {
    Alert.alert(
      t('cancel', language),
      language === 'ja'
        ? '追加待ちの曲をすべて破棄してキャンセルしますか？'
        : 'Discard all pending tracks and cancel?',
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete_confirm_btn', language),
          style: 'destructive',
          onPress: () => {
            removeStagedSongs(stagedSongs);
            setIsSelectionMode(false);
          },
        },
      ]
    );
  };

  if (stagedSongs.length === 0) {
    return (
      <View style={[
        styles.syncCard, 
        { 
          backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, 
          margin: 0, 
          paddingVertical: 32, 
          alignItems: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: dynamicStyles.border,
        }
      ]}>
        {useLiquidGlass && (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="folder-open-outline" size={32} color={themeColor} />
        </View>

        <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          {t('local_import_title', language)}
        </Text>
        <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
          {t('local_import_desc', language)}
        </Text>

        <GlassActionButton
          isDark={isDark}
          glassTintColor={themeColor}
          style={[styles.smallBtn, { backgroundColor: useLiquidGlass ? 'transparent' : themeColor, width: '100%', maxWidth: 300 }]} 
          onPress={handlePickLocalMP3Files}
          disabled={isPickingOrParsing}
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
        </GlassActionButton>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {/* ツールバー */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
            {t('local_import_staged_count', language)} ({stagedSongs.length})
          </Text>
          {isSelectionMode && selectedStagedList.length > 0 && (
            <GlassActionButton 
              isDark={isDark}
              glassTintColor={themeColor}
              onPress={() => openEditModal(selectedStagedList)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: useLiquidGlass ? 'transparent' : themeColor, overflow: 'hidden' }}
            >
              <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                {t('edit_song_info', language)} ({selectedStagedList.length})
              </Text>
            </GlassActionButton>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* 登録キャンセルボタン */}
          <GlassActionButton
            isDark={isDark}
            glassTintColor="rgba(239, 68, 68, 0.25)"
            onPress={handleCancelAllStaged}
            style={[s.uniformToolbarBtn, {
              backgroundColor: useLiquidGlass ? 'transparent' : 'rgba(239,68,68,0.12)',
            }]}
          >
            <Ionicons name="close" size={15} color="#ef4444" style={{ marginRight: 2 }} />
            <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 12 }}>
              {t('cancel', language)}
            </Text>
          </GlassActionButton>

          {/* 選択 / 完了ボタン（LiquidGlassデザインを常時維持＆完了時はテーマカラー） */}
          <GlassActionButton
            isDark={isDark}
            glassTintColor={isSelectionMode ? themeColor : undefined}
            onPress={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedSongIds(new Set());
            }}
            style={[s.uniformToolbarBtn, {
              backgroundColor: useLiquidGlass 
                ? 'transparent' 
                : (isSelectionMode ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb')),
            }]}
          >
            <Text style={{ 
              color: isSelectionMode ? textColor : dynamicStyles.text, 
              fontWeight: 'bold', 
              fontSize: 12 
            }}>
              {isSelectionMode ? t('done_btn', language) : t('select_btn', language)}
            </Text>
          </GlassActionButton>

          {/* 楽曲追加ボタン（選択ボタンと同一形状・サイズ、テーマカラーLiquidGlass） */}
          <GlassActionButton
            isDark={isDark}
            glassTintColor={themeColor}
            onPress={handlePickLocalMP3Files}
            style={[s.uniformToolbarBtn, {
              backgroundColor: useLiquidGlass ? 'transparent' : themeColor,
            }]}
          >
            <Ionicons name="add" size={15} color={textColor} style={{ marginRight: 2 }} />
            <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
              {t('tab_sync', language)}
            </Text>
          </GlassActionButton>
        </View>
      </View>

      {/* 複数選択バー */}
      {isSelectionMode && (
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
          backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
          borderWidth: 1, borderColor: dynamicStyles.border, overflow: 'hidden'
        }}>
          {useLiquidGlass && (
            <GlassView
              pointerEvents="none"
              glassEffectStyle="regular"
              colorScheme={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
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

      {/* 楽曲リスト（行コンテナ＆メニューボタンのLiquidGlass対応） */}
      <View style={{ gap: 8 }}>
        {stagedSongs.map(item => {
          const isSelected = selectedSongIds.has(item.id);

          return (
            <TouchableOpacity
              key={item.id}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16,
                backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, 
                borderWidth: 1,
                borderColor: isSelected ? themeColor : dynamicStyles.border,
                overflow: 'hidden',
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
              {useLiquidGlass && (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  isInteractive
                  colorScheme={isDark ? 'dark' : 'light'}
                  tintColor={isSelected ? themeColor : undefined}
                  style={StyleSheet.absoluteFill}
                />
              )}

              {isSelectionMode && (
                <View style={{ marginRight: 10 }}>
                  <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={22} color={isSelected ? themeColor : dynamicStyles.subText} />
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
                <View 
                  ref={ref => { menuBtnRefs.current[item.id] = ref; }}
                  collapsable={false}
                >
                  <GlassActionButton 
                    isDark={isDark}
                    onPress={() => handleOpenRowMenu(item)}
                    style={{
                      width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
                      backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                      overflow: 'hidden'
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={dynamicStyles.text} />
                  </GlassActionButton>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 「この情報で登録」確定ボタン */}
      <GlassActionButton 
        isDark={isDark}
        glassTintColor={themeColor}
        style={[
          styles.smallBtn, 
          { 
            backgroundColor: useLiquidGlass ? 'transparent' : themeColor, 
            marginTop: 10, 
            height: 52, 
            borderRadius: 26,
            overflow: 'hidden' 
          }
        ]}
        onPress={handleRegisterAllStagedToLibrary}
        disabled={isRegistering}
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
      </GlassActionButton>

      {/* 曲ごとの近接 LiquidGlass ポップオーバーメニュー */}
      <Modal
        visible={popoverConfig !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPopoverConfig(null)}
      >
        <View style={StyleSheet.absoluteFill}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setPopoverConfig(null)} 
          />
          {popoverConfig && (() => {
            const menuWidth = 200;
            const menuHeight = 100;
            const left = Math.max(16, Math.min(popoverConfig.anchor.x + popoverConfig.anchor.width - menuWidth, width - menuWidth - 16));
            const belowTop = popoverConfig.anchor.y + popoverConfig.anchor.height + 6;
            const top = belowTop + menuHeight <= height - 16
              ? belowTop
              : Math.max(16, popoverConfig.anchor.y - menuHeight - 6);

            return (
              <View
                style={[
                  s.popoverContainer,
                  {
                    top,
                    left,
                    width: menuWidth,
                    borderColor: dynamicStyles.border,
                    backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.25,
                    shadowRadius: 14,
                    elevation: 12,
                  }
                ]}
              >
                {useLiquidGlass && (
                  <GlassView
                    pointerEvents="none"
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                
                {/* 1. 楽曲情報編集 */}
                <TouchableOpacity
                  style={[s.popoverItem, { borderBottomColor: dynamicStyles.border }]}
                  onPress={() => {
                    const song = popoverConfig.targetSong;
                    setPopoverConfig(null);
                    openEditModal([song]);
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="create-outline" size={18} color={themeColor} />
                  <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: '600' }}>
                    {t('edit_song_info', language)}
                  </Text>
                </TouchableOpacity>

                {/* 2. 削除 */}
                <TouchableOpacity
                  style={[s.popoverItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    const song = popoverConfig.targetSong;
                    setPopoverConfig(null);
                    removeStagedSongs([song]);
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
                    {t('local_import_remove_staged', language)}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  uniformToolbarBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  popoverContainer: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
