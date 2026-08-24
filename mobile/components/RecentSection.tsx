import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styles } from '../styles/styles';
import { MarqueeText } from './MarqueeText';

const DEFAULT_ICON = require('../assets/images/icon.png');

export const RecentSection = ({ 
  recentlyPlayedSongs, 
  recentlyPlayedCollections, 
  dynamicStyles, 
  themeColor, 
  onPlaySong, 
  onPlayCollection 
}: any) => {

  if (
    (!recentlyPlayedSongs || recentlyPlayedSongs.length === 0) && 
    (!recentlyPlayedCollections || recentlyPlayedCollections.length === 0)
  ) {
    return null;
  }

  const uniqueSongs = recentlyPlayedSongs ? recentlyPlayedSongs.filter((song: any, index: number, self: any[]) =>
    index === self.findIndex((s: any) => s.localMusicUri === song.localMusicUri)
  ) : [];

  const uniqueCollections = recentlyPlayedCollections ? recentlyPlayedCollections.filter((col: any, index: number, self: any[]) =>
    index === self.findIndex((c: any) => c.id === col.id)
  ) : [];

  return (
    <View style={styles.recentContainer}>
      {/* 最近再生した楽曲 */}
      {uniqueSongs.length > 0 && (
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.recentHeader, { color: dynamicStyles.text }]}>最近再生した楽曲</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {uniqueSongs.map((item: any, index: number) => {
              const itemKey = `recent-song-${item.localMusicUri || index}-${index}`;
              return (
                <TouchableOpacity 
                  key={itemKey} 
                  style={styles.recentSongItem} 
                  onPress={() => onPlaySong(item)}
                >
                  <Image 
                    source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} 
                    style={styles.recentSongImage} 
                  />
                  {/* ★ 自動スクロール */}
                  <MarqueeText 
                    text={item.title} 
                    style={[styles.recentSongTitle, { color: dynamicStyles.text }]} 
                  />
                  <MarqueeText 
                    text={item.artist} 
                    style={[styles.recentSongArtist, { color: dynamicStyles.subText, marginTop: 2 }]} 
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 最近再生したコレクション */}
      {uniqueCollections.length > 0 && (
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.recentHeader, { color: dynamicStyles.text }]}>最近再生したコレクション</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {uniqueCollections.map((item: any, index: number) => {
              const itemKey = `recent-col-${item.id || index}-${index}`;
              const title = item.data?.playlistName || item.data?.album || item.data?.artistName || item.title || 'コレクション';
              const subtitle = item.type === 'PLAYLIST' ? 'プレイリスト' : item.type === 'ALBUM' ? 'アルバム' : 'アーティスト';
              
              let imageSource = DEFAULT_ICON;
              if (item.art) {
                imageSource = typeof item.art === 'string' ? { uri: item.art } : item.art;
              }

              return (
                <TouchableOpacity 
                  key={itemKey} 
                  style={styles.recentSongItem} 
                  onPress={() => onPlayCollection(item)}
                >
                  <Image 
                    source={imageSource} 
                    style={[
                      styles.recentSongImage, 
                      item.type === 'ARTIST' && { borderRadius: 60 }
                    ]} 
                  />
                  {/* ★ 自動スクロール */}
                  <MarqueeText 
                    text={title} 
                    style={[styles.recentSongTitle, { color: dynamicStyles.text }]} 
                  />
                  <Text style={[styles.recentSongArtist, { color: dynamicStyles.subText, marginTop: 2 }]} numberOfLines={1}>
                    {subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};