import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';
import { GlassActionButton } from '../ui/GlassActionButton';

interface SyncPlaylistsViewProps {
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  isLandscape: boolean;
  pcPlaylists: any[];
  selectedPls: Set<number>;
  setSelectedPls: (set: Set<number>) => void;
  selectAll: () => void;
  deselectAll: () => void;
  disconnect: () => void;
  startSyncDownload: () => void;
  bottomPadding: number;
  insets: any;
  language: string;
}

export const SyncPlaylistsView: React.FC<SyncPlaylistsViewProps> = ({
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  isLandscape,
  pcPlaylists,
  selectedPls,
  setSelectedPls,
  selectAll,
  deselectAll,
  disconnect,
  startSyncDownload,
  bottomPadding,
  insets,
  language,
}) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  return (
    <View style={{ flex: 1 }}>
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
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
            {/* 接続を解除ボタン（赤背景＋LiquidGlassデザイン） */}
            <GlassActionButton
              isDark={isDark}
              glassTintColor="rgba(239, 68, 68, 0.85)"
              style={[
                styles.smallBtn, 
                { 
                  backgroundColor: useLiquidGlass ? 'transparent' : '#ef4444',
                  borderRadius: 25,
                  overflow: 'hidden'
                }
              ]} 
              onPress={disconnect}
            >
              <Text style={[styles.btnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                {t('disconnect_btn', language)}
              </Text>
            </GlassActionButton>

            {/* すべて選択・すべて解除ボタン */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassActionButton
                isDark={isDark}
                style={[
                  styles.smallBtn, 
                  { 
                    backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#e5e7eb'), 
                    flex: 1, 
                    height: 42,
                    borderRadius: 21,
                    overflow: 'hidden'
                  }
                ]} 
                onPress={selectAll}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('select_all', language)}</Text>
              </GlassActionButton>

              <GlassActionButton
                isDark={isDark}
                style={[
                  styles.smallBtn, 
                  { 
                    backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#e5e7eb'), 
                    flex: 1, 
                    height: 42,
                    borderRadius: 21,
                    overflow: 'hidden'
                  }
                ]} 
                onPress={deselectAll}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('deselect_all', language)}</Text>
              </GlassActionButton>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isSelected = selectedPls.has(index);

          return (
            <TouchableOpacity 
              style={[
                styles.checkRow, 
                { 
                  backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card,
                  borderRadius: 14,
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: dynamicStyles.border,
                  overflow: 'hidden',
                }, 
                isLandscape && { flex: 0.5, margin: 6 }
              ]} 
              onPress={() => { 
                const next = new Set(selectedPls); 
                if (next.has(index)) next.delete(index); 
                else next.add(index); 
                setSelectedPls(next); 
              }}
              activeOpacity={0.7}
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
              {/* 背景は青くせず、チェックボックスのみ切り替え */}
              <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={24} color={themeColor} />
              <Text style={[styles.rowTitle, { color: dynamicStyles.text }]} numberOfLines={1}>
                {item.playlistName}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={pcPlaylists.length > 0 ? (
          <View style={[styles.syncFooterContainer, { maxWidth: 400, alignSelf: 'center', marginTop: 8 }]}>
            {/* 同期を開始するボタン */}
            <GlassActionButton
              isDark={isDark}
              glassTintColor={themeColor}
              style={[
                styles.syncActionBtn, 
                { 
                  backgroundColor: useLiquidGlass ? 'transparent' : themeColor, 
                  height: 52, 
                  borderRadius: 26,
                  overflow: 'hidden' 
                }
              ]} 
              onPress={startSyncDownload}
            >
              <Text style={[styles.syncActionBtnText, { color: textColor, fontSize: 16 }]}>
                {t('sync_start_btn', language)}
              </Text>
            </GlassActionButton>
          </View>
        ) : null}
      />
    </View>
  );
};
