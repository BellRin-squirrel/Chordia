import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { styles } from '../styles/styles';
import { MarqueeText } from './MarqueeText';
import { t } from '../utils/i18n';

const DEFAULT_ICON = require('../assets/images/icon.png');

export const RecentSection = ({ 
  recentlyPlayedSongs, 
  recentlyPlayedCollections, 
  mostPlayedSongs = [],
  dynamicStyles, 
  themeColor, 
  onPlaySong, 
  onPlayCollection,
  onPlayMostPlayed,
  language = 'ja',
  localLibrary = []
}: any) => {

  const uniqueSongs = recentlyPlayedSongs ? recentlyPlayedSongs.filter((song: any, index: number, self: any[]) =>
    index === self.findIndex((s: any) => s.localMusicUri === song.localMusicUri)
  ) : [];

  const uniqueCollections = recentlyPlayedCollections ? recentlyPlayedCollections.filter((col: any, index: number, self: any[]) => {
    if (index !== self.findIndex((c: any) => c.id === col.id)) return false;
    
    const isAllSongs = col.id === 'all_songs' || col.data?.id === 'all_songs' || col.data?.isAll;
    if (isAllSongs && (!localLibrary || localLibrary.length === 0)) {
      return false;
    }
    
    return true;
  }) : [];

  if (
    uniqueSongs.length === 0 && 
    uniqueCollections.length === 0 && 
    (!mostPlayedSongs || mostPlayedSongs.length === 0)
  ) {
    return null;
  }

  const getRankBadgeColor = (idx: number) => {
    switch (idx) {
      case 0: return '#f59e0b'; // 1位: ゴールド
      case 1: return '#94a3b8'; // 2位: シルバー
      case 2: return '#b45309'; // 3位: ブロンズ
      default: return 'rgba(0,0,0,0.65)';
    }
  };

  return (
    <View style={styles.recentContainer}>
      {/* 1. 再生回数が多い曲トップ10（横スクロール・左が1位） */}
      {mostPlayedSongs && mostPlayedSongs.length > 0 && (
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.recentHeader, { color: dynamicStyles.text }]}>
            {t('most_played_songs', language)}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {mostPlayedSongs.map((item: any, index: number) => {
              const itemKey = `most-played-${item.song?.localMusicUri || index}-${index}`;
              const song = item.song;

              return (
                <TouchableOpacity 
                  key={itemKey} 
                  style={s.itemWrapper} 
                  onPress={() => onPlayMostPlayed ? onPlayMostPlayed(song) : onPlaySong(song)}
                  activeOpacity={0.7}
                >
                  <View style={s.imageContainer}>
                    <Image 
                      source={song?.localImageUri ? { uri: song.localImageUri } : DEFAULT_ICON} 
                      style={s.fixedImage} 
                      resizeMode="cover"
                    />
                    {/* 左上順位バッジ */}
                    <View style={[s.rankBadge, { backgroundColor: getRankBadgeColor(index) }]}>
                      <Text style={s.rankBadgeText}>{index + 1}</Text>
                    </View>
                  </View>
                  <MarqueeText 
                    text={song?.title || 'Untitled'} 
                    style={[styles.recentSongTitle, { color: dynamicStyles.text, width: 120 }]} 
                  />
                  <MarqueeText 
                    text={song?.artist || 'Unknown Artist'} 
                    style={[styles.recentSongArtist, { color: dynamicStyles.subText, marginTop: 2, width: 120 }]} 
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 2. 最近再生した楽曲 */}
      {uniqueSongs.length > 0 && (
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.recentHeader, { color: dynamicStyles.text }]}>{t('recent_played_songs', language)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {uniqueSongs.map((item: any, index: number) => {
              const itemKey = `recent-song-${item.localMusicUri || index}-${index}`;
              return (
                <TouchableOpacity 
                  key={itemKey} 
                  style={s.itemWrapper} 
                  onPress={() => onPlaySong(item)}
                  activeOpacity={0.7}
                >
                  <View style={s.imageContainer}>
                    <Image 
                      source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} 
                      style={s.fixedImage} 
                      resizeMode="cover"
                    />
                  </View>
                  <MarqueeText 
                    text={item.title} 
                    style={[styles.recentSongTitle, { color: dynamicStyles.text, width: 120 }]} 
                  />
                  <MarqueeText 
                    text={item.artist} 
                    style={[styles.recentSongArtist, { color: dynamicStyles.subText, marginTop: 2, width: 120 }]} 
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. 最近再生したコレクション */}
      {uniqueCollections.length > 0 && (
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.recentHeader, { color: dynamicStyles.text }]}>{t('recent_played_collections', language)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {uniqueCollections.map((item: any, index: number) => {
              const itemKey = `recent-col-${item.id || index}-${index}`;
              const title = item.data?.playlistName || item.data?.album || item.data?.artistName || item.title || t('collection_label', language);
              const subtitle = item.type === 'PLAYLIST' ? t('playlist_label', language) : item.type === 'ALBUM' ? t('album_label', language) : t('artist_label', language);
              
              let imageSource = DEFAULT_ICON;
              if (item.art) {
                imageSource = typeof item.art === 'string' ? { uri: item.art } : item.art;
              }

              const isArtist = item.type === 'ARTIST';

              return (
                <TouchableOpacity 
                  key={itemKey} 
                  style={s.itemWrapper} 
                  onPress={() => onPlayCollection(item)}
                  activeOpacity={0.7}
                >
                  <View style={[s.imageContainer, isArtist && { borderRadius: 60 }]}>
                    <Image 
                      source={imageSource} 
                      style={[s.fixedImage, isArtist && { borderRadius: 60 }]} 
                      resizeMode="cover"
                    />
                  </View>
                  <MarqueeText 
                    text={title} 
                    style={[styles.recentSongTitle, { color: dynamicStyles.text, width: 120 }]} 
                  />
                  <Text style={[styles.recentSongArtist, { color: dynamicStyles.subText, marginTop: 2, width: 120 }]} numberOfLines={1}>
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

const s = StyleSheet.create({
  itemWrapper: {
    width: 120,
    maxWidth: 120,
    marginRight: 14,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
    position: 'relative',
  },
  fixedImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
});