import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { RecentSection } from '../RecentSection';
import { getPlaylistSongs } from '../../utils/playlistEvaluator';
import { t } from '../../utils/i18n';

export const LibraryMenuView = ({
  dynamicStyles, themeColor, insets, isLandscape, safePadding,
  pushView, recentlyPlayedSongs, recentlyPlayedCollections,
  localLibrary, startQueue, saveCollectionToHistory, language = 'ja'
}: any) => {
  const menuItems = [
    { title: t('menu_playlists', language), icon: 'musical-notes-outline' as const, view: 'PLAYLISTS' },
    { title: t('menu_albums', language), icon: 'disc-outline' as const, view: 'ALBUMS' },
    { title: t('menu_artists', language), icon: 'mic-outline' as const, view: 'ARTISTS' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      
      <View style={[
        styles.headerBar, 
        { 
          borderBottomColor: 'transparent', 
          paddingTop: insets?.top || 0, 
          height: 44 + (insets?.top || 0),
          paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
          paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20,
        }
      ]}>
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>{t('tab_player', language)}</Text>
      </View>

      <FlatList
        data={menuItems}
        keyExtractor={item => item.view}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={[styles.menuRow, index !== 2 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} 
            onPress={() => pushView(item.view)}
          >
            <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
            <Text style={[styles.menuRowTitle, { color: dynamicStyles.text }]}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <RecentSection 
            recentlyPlayedSongs={recentlyPlayedSongs} 
            recentlyPlayedCollections={recentlyPlayedCollections} 
            dynamicStyles={dynamicStyles} 
            themeColor={themeColor}
            onPlaySong={(s: any) => startQueue([s], s, undefined)} 
            onPlayCollection={(item: any) => {
              let songs: any[] = [];
              if (item.type === 'PLAYLIST') {
                songs = getPlaylistSongs(item.data, localLibrary);
              } else if (item.type === 'ALBUM') {
                songs = localLibrary.filter((s: any) => s.album === item.data.album && s.artist === item.data.artist);
              } else if (item.type === 'ARTIST') {
                songs = localLibrary.filter((s: any) => s.artist === item.data.artistName);
              }
              startQueue(songs, undefined, false);
              saveCollectionToHistory(item);
            }}
            language={language}
          />
        }
        contentContainerStyle={safePadding}
      />
    </View>
  );
};