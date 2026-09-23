import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';
import { MarqueeText } from '../MarqueeText';
import { StagedSong } from './types';

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
  setActionSheetTargets: (targets: StagedSong[]) => void;
  handleRegisterAllStagedToLibrary: () => void;
  toggleSelectAll: () => void;
  selectedStagedList: StagedSong[];
  language: string;
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
  setActionSheetTargets,
  handleRegisterAllStagedToLibrary,
  toggleSelectAll,
  selectedStagedList,
  language,
}) => {
  if (stagedSongs.length === 0) {
    return (
      <View style={[styles.syncCard, { backgroundColor: dynamicStyles.card, margin: 0, paddingVertical: 32, alignItems: 'center' }]}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Ionicons name="folder-open-outline" size={32} color={themeColor} />
        </View>

        <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          {t('local_import_title', language)}
        </Text>
        <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
          {t('local_import_desc', language)}
        </Text>

        <TouchableOpacity 
          style={[styles.smallBtn, { backgroundColor: themeColor, width: '100%', maxWidth: 300 }]} 
          onPress={handlePickLocalMP3Files}
          disabled={isPickingOrParsing}
          activeOpacity={0.8}
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
        </TouchableOpacity>
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
            <TouchableOpacity 
              onPress={() => openEditModal(selectedStagedList)}
              style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: themeColor }}
            >
              <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                {t('edit_song_info', language)} ({selectedStagedList.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            onPress={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedSongIds(new Set());
            }}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
              backgroundColor: isSelectionMode ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb')
            }}
          >
            <Text style={{ color: isSelectionMode ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 12 }}>
              {isSelectionMode ? t('done_btn', language) : t('select_btn', language)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handlePickLocalMP3Files}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
          >
            <Ionicons name="add" size={16} color={themeColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 複数選択バー */}
      {isSelectionMode && (
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
        }}>
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

      {/* 楽曲リスト */}
      <View style={{ gap: 8 }}>
        {stagedSongs.map(item => {
          const isSelected = selectedSongIds.has(item.id);

          return (
            <TouchableOpacity
              key={item.id}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16,
                backgroundColor: dynamicStyles.card, borderWidth: 1,
                borderColor: isSelected ? themeColor : dynamicStyles.border,
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
                <TouchableOpacity 
                  onPress={() => setActionSheetTargets([item])}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color={dynamicStyles.text} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 「この情報で登録」確定ボタン */}
      <TouchableOpacity 
        style={[styles.smallBtn, { backgroundColor: themeColor, marginTop: 10, height: 52, borderRadius: 26 }]}
        onPress={handleRegisterAllStagedToLibrary}
        disabled={isRegistering}
        activeOpacity={0.8}
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
      </TouchableOpacity>
    </View>
  );
};