import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';

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
          <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 10 }}>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#6b7280' }]} onPress={disconnect}>
              <Text style={styles.btnText}>{t('disconnect_btn', language)}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} 
                onPress={selectAll}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('select_all', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} 
                onPress={deselectAll}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('deselect_all', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={[
              styles.checkRow, 
              { backgroundColor: dynamicStyles.bg }, 
              isLandscape && { flex: 0.5, margin: 5, borderRadius: 10, borderWidth: 0.5, borderColor: dynamicStyles.border }
            ]} 
            onPress={() => { 
              const next = new Set(selectedPls); 
              if (next.has(index)) next.delete(index); 
              else next.add(index); 
              setSelectedPls(next); 
            }}
          >
            <Ionicons name={selectedPls.has(index) ? 'checkbox' : 'square-outline'} size={24} color={themeColor} />
            <Text style={[styles.rowTitle, { color: dynamicStyles.text }]} numberOfLines={1}>{item.playlistName}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={pcPlaylists.length > 0 ? (
          <View style={[styles.syncFooterContainer, { maxWidth: 400, alignSelf: 'center' }]}>
            <TouchableOpacity 
              style={[styles.syncActionBtn, { backgroundColor: themeColor, height: 52, borderRadius: 26 }]} 
              onPress={startSyncDownload}
            >
              <Text style={[styles.syncActionBtnText, { color: textColor, fontSize: 16 }]}>
                {t('sync_start_btn', language)}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </View>
  );
};