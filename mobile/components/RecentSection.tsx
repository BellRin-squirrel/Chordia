import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styles } from '../styles/styles';

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

  // ★ 重複する楽曲を除外 (localMusicUri ベースでユニーク化)
  const uniqueSongs = recentlyPlayedSongs ? recentlyPlayedSongs.filter((song: any, index: number, self: any[]) =>
    index === self.findIndex((s: any) => s.localMusicUri === song.localMusicUri)
  ) : [];

  // ★ 重複するコレクションを除外 (id ベースでユニーク化)
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
              // ★ キーを確実にユニーク化
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
                  <Text style={[styles.recentSongTitle, { color: dynamicStyles.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.recentSongArtist, { color: dynamicStyles.subText }]} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 最近再生したコレクション (アルバム/アーティスト/プレイリスト) */}
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
                      item.type === 'ARTIST' && { borderRadius: 60 } // アーティストは丸型
                    ]} 
                  />
                  <Text style={[styles.recentSongTitle, { color: dynamicStyles.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={[styles.recentSongArtist, { color: dynamicStyles.subText }]} numberOfLines={1}>
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