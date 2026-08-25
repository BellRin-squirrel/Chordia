import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { MarqueeText } from '../MarqueeText';
import { getPlaylistFirstArt } from '../../utils/playlistEvaluator';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const LibraryCategoryView = ({
  category, dynamicStyles, themeColor, safePadding,
  localPlaylists, albumsList, artistsList, localLibrary,
  showPlaylistTypeIcon, setCurrentSelectionType, setCurrentPlaylist,
  setCurrentAlbum, setCurrentArtist, pushView, renderHeader
}: any) => {
  const data = category === 'PLAYLISTS' 
    ? [{ playlistName: 'すべての楽曲', isAll: true, id: 'all_songs', type: 'normal' }, ...localPlaylists] 
    : category === 'ALBUMS' ? albumsList : artistsList;

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

      {renderHeader(category === 'PLAYLISTS' ? 'プレイリスト' : category === 'ALBUMS' ? 'アルバム' : 'アーティスト')}

      <FlatList
        key={category}
        data={data}
        numColumns={category === 'ALBUMS' ? 2 : 1}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => {
          if (category === 'ALBUMS') {
            return (
              <TouchableOpacity 
                style={styles.albumGridItem} 
                onPress={() => { 
                  setCurrentSelectionType('ALBUM'); 
                  setCurrentAlbum(item); 
                  pushView('SONG_LIST'); 
                }}
              >
                <Image source={item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON} style={styles.albumGridImage} />
                <View style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
                  <MarqueeText text={item.album} style={[styles.albumGridTitle, { color: dynamicStyles.text }]} />
                  <MarqueeText text={item.artist} style={[styles.albumGridArtist, { color: dynamicStyles.subText, marginTop: 2 }]} />
                </View>
              </TouchableOpacity>
            );
          }

          const title = category === 'PLAYLISTS' ? item.playlistName : item.artistName;
          const artSource = category === 'PLAYLISTS' ? getPlaylistFirstArt(item, localLibrary) : (item.coverArt ? { uri: item.coverArt } : DEFAULT_ICON);
          const isSmart = category === 'PLAYLISTS' && item.type === 'smart';

          return (
            <TouchableOpacity 
              style={[styles.checkRow, { borderBottomWidth: 0 }]} 
              onPress={() => { 
                if (category === 'PLAYLISTS') { setCurrentSelectionType('PLAYLIST'); setCurrentPlaylist(item); }
                else { setCurrentSelectionType('ARTIST'); setCurrentArtist(item.artistName); }
                pushView('SONG_LIST'); 
              }}
            >
              <Image source={artSource} style={[styles.playlistIconArt, category === 'ARTISTS' && { borderRadius: 35 }]} />
              <View style={{ flex: 1, marginLeft: 15, marginRight: 10, minWidth: 0, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {showPlaylistTypeIcon && category === 'PLAYLISTS' && (
                    <Ionicons 
                      name={isSmart ? "flash" : "musical-notes"} 
                      size={16} 
                      color={themeColor} 
                      style={{ marginRight: 6 }} 
                    />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <MarqueeText text={title} style={[styles.rowTitle, { color: dynamicStyles.text, marginLeft: 0 }]} />
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={safePadding}
      />
    </View>
  );
};