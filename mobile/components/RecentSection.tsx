import React, { memo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { styles } from '../styles/styles';

const DEFAULT_ICON = 'https://reactnative.dev/img/tiny_logo.png';

export const RecentSection = memo(({ recentlyPlayedSongs, recentlyPlayedCollections, dynamicStyles, onPlaySong, onPlayCollection }: any) => {
  if (recentlyPlayedSongs.length === 0 && recentlyPlayedCollections.length === 0) return null;

  return (
    <View>
      {recentlyPlayedSongs.length > 0 && (
        <View style={styles.recentContainer}>
          <Text style={[styles.recentHeader, {color: dynamicStyles.text}]}>最近再生した項目</Text>
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={recentlyPlayedSongs} keyExtractor={(item) => 'recent-song-' + item.localMusicUri} contentContainerStyle={{paddingHorizontal: 15}} renderItem={({item}) => (<TouchableOpacity style={styles.recentSongItem} onPress={() => onPlaySong(item)}><Image source={item.localImageUri ? {uri: item.localImageUri} : {uri: DEFAULT_ICON}} style={styles.recentSongImage} /><Text style={[styles.recentSongTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.title}</Text><Text style={[styles.recentSongArtist, {color: dynamicStyles.subText}]} numberOfLines={1}>{item.artist}</Text></TouchableOpacity>)} />
        </View>
      )}
      {recentlyPlayedCollections.length > 0 && (
        <View style={[styles.recentContainer, { marginTop: 10 }]}>
          <FlatList data={recentlyPlayedCollections} numColumns={2} keyExtractor={(item) => 'recent-coll-' + item.id} contentContainerStyle={{paddingHorizontal: 10}} renderItem={({item}) => (<TouchableOpacity style={styles.albumGridItem} onPress={() => onPlayCollection(item)}><Image source={item.art} style={styles.albumGridImage} /><Text style={[styles.albumGridTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.type === 'PLAYLIST' ? item.data.playlistName : item.type === 'ALBUM' ? item.data.album : item.data.artistName}</Text><Text style={[styles.albumGridArtist, {color: dynamicStyles.subText}]} numberOfLines={1}>{item.type === 'PLAYLIST' ? 'プレイリスト' : item.type === 'ALBUM' ? item.data.artist : 'アーティスト'}</Text></TouchableOpacity>)} />
        </View>
      )}
    </View>
  );
});