import React, { useEffect, useMemo, useState } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, TextInput, 
  Keyboard, Platform, StyleSheet, Animated, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { styles } from '../../styles/styles';
import { MarqueeText } from '../MarqueeText';
import { t, LanguageCode } from '../../utils/i18n';
import { GlassActionButton } from '../ui/GlassActionButton';
import { getAudioDurationSeconds } from '../../utils/id3Parser';

const DEFAULT_ICON = require('../../assets/images/icon.png');
const DURATION_CACHE_KEY = 'chordia_song_durations_cache';

const formatCollectionTotalDuration = (totalSeconds: number, language: LanguageCode): string => {
  const safeSec = Math.max(0, totalSeconds);

  // 1時間未満: ◯分（分単位まで・切り捨てで60分にならないよう制御）
  if (safeSec < 3600) {
    const mins = Math.min(59, Math.floor(safeSec / 60));
    return t('duration_minutes', language).replace('{value}', String(mins));
  }

  // 1時間以上 24時間未満: ◯.◯時間（小数第一位まで・24.0へ繰り上がらないよう小数第1位切り捨て）
  if (safeSec < 86400) {
    const hours = (Math.floor((safeSec / 3600) * 10) / 10).toFixed(1);
    return t('duration_hours', language).replace('{value}', hours);
  }

  // 24時間以上: ◯.◯日（小数第一位まで）
  const days = (Math.floor((safeSec / 86400) * 10) / 10).toFixed(1);
  return t('duration_days', language).replace('{value}', days);
};

export const LibrarySongListView = ({
  dynamicStyles, themeColor, isDark, isLandscape, height, insets,
  songs, heroArtSource, heroTitle, hasBlurBackground,
  currentSelectionType, currentPlaylist, showPlaylistTypeIcon,
  searchQuery, setSearchQuery, isSearching, setIsSearching,
  startQueue, onPlayCollectionPress, openActionSheet,
  renderFloatingBackButton, flatListRefPortrait, flatListRefLandscape,
  AnimatedMenuButton, language = 'ja', collectionContext = null
}: any) => {

  const isPlaylist = currentSelectionType === 'PLAYLIST';
  const isSmartPlaylist = isPlaylist && currentPlaylist?.type === 'smart';
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { width } = useWindowDimensions();
  const searchExpandAnim = React.useRef(new Animated.Value(0)).current;

  const [cachedDurations, setCachedDurations] = useState<Record<string, number>>({});

  const onFocusSearch = () => setIsSearching(true);
  const onCancelSearch = () => { setIsSearching(false); setSearchQuery(''); Keyboard.dismiss(); };

  React.useEffect(() => {
    Animated.spring(searchExpandAnim, {
      toValue: isSearching ? 1 : 0,
      useNativeDriver: false,
      speed: 22,
      bounciness: 4,
    }).start();
  }, [isSearching, searchExpandAnim]);

  // song.duration が未保存の楽曲の再生時間をバックグラウンドで安全に解析・キャッシュ
  useEffect(() => {
    let cancelled = false;

    const resolveMissingDurations = async () => {
      if (!Array.isArray(songs) || songs.length === 0) return;

      let storedCache: Record<string, number> = {};
      try {
        const raw = await AsyncStorage.getItem(DURATION_CACHE_KEY);
        if (raw) storedCache = JSON.parse(raw);
      } catch (e) {}

      if (!cancelled && Object.keys(storedCache).length > 0) {
        setCachedDurations((prev) => ({ ...storedCache, ...prev }));
      }

      const missingSongs = songs.filter((s: any) => {
        if (!s?.localMusicUri) return false;
        const directDur = Number(s.duration) || 0;
        if (directDur > 0) return false;
        const cacheKey = s.musicFilename?.split(/[\\/]/).pop() || s.localMusicUri;
        return !(storedCache[cacheKey] > 0);
      });

      if (missingSongs.length === 0) return;

      const updatedCache = { ...storedCache };
      let hasNewEntries = false;

      for (const s of missingSongs) {
        if (cancelled) break;
        const cacheKey = s.musicFilename?.split(/[\\/]/).pop() || s.localMusicUri;
        const dur = await getAudioDurationSeconds(s.localMusicUri);
        if (dur > 0) {
          updatedCache[cacheKey] = dur;
          hasNewEntries = true;
          if (!cancelled) {
            setCachedDurations((prev) => ({ ...prev, [cacheKey]: dur }));
          }
        }
      }

      if (hasNewEntries) {
        try {
          await AsyncStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(updatedCache));
        } catch (e) {}
      }
    };

    void resolveMissingDurations();
    return () => { cancelled = true; };
  }, [songs]);

  const totalDurationSeconds = useMemo(() => {
    if (!Array.isArray(songs) || songs.length === 0) return 0;
    return songs.reduce((sum: number, s: any) => {
      const directDur = Number(s?.duration) || 0;
      if (directDur > 0) return sum + directDur;
      const cacheKey = s?.musicFilename?.split(/[\\/]/).pop() || s?.localMusicUri || '';
      const cached = Number(cachedDurations[cacheKey]) || 0;
      return sum + cached;
    }, 0);
  }, [songs, cachedDurations]);

  const collectionMetaText = useMemo(() => {
    const count = Array.isArray(songs) ? songs.length : 0;
    const countPart = (language === 'ja' || language === 'ko')
      ? `${count}${t('songs_count', language)}`
      : `${count} ${t('songs_count', language)}`;
    const durationPart = formatCollectionTotalDuration(totalDurationSeconds, language as LanguageCode);
    return `${countPart} • ${durationPart}`;
  }, [songs, totalDurationSeconds, language]);

  const searchControl = (
    <Animated.View
      style={{
        position: 'absolute',
        top: (insets?.top || 0) + (isPad ? 22 : 12),
        right: Math.max(insets?.right || 0, 16),
        zIndex: 40,
        width: searchExpandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [44, Math.min(Math.max(width - 32, 44), 360)],
        }),
        height: 44,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 13,
        overflow: 'hidden',
        backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'),
      }}
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
      {!isSearching ? (
        <TouchableOpacity
          onPress={onFocusSearch}
          accessibilityRole="button"
          accessibilityLabel={t('search_song_artist_placeholder', language)}
          style={{ width: 44, height: 44, marginLeft: -13, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="search" size={19} color={dynamicStyles.subText} />
        </TouchableOpacity>
      ) : (
        <>
          <Ionicons name="search" size={18} color={dynamicStyles.subText} style={{ marginRight: 8 }} />
          <TextInput
            autoFocus
            style={{ flex: 1, minWidth: 0, color: dynamicStyles.text, fontSize: 16 }}
            placeholder={t('search_song_artist_placeholder', language)}
            placeholderTextColor={dynamicStyles.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onBlur={() => { if (!searchQuery) setIsSearching(false); }}
          />
          <TouchableOpacity onPress={onCancelSearch} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={dynamicStyles.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );

  const landscapeArtSize = height * 0.4;
  const heroSectionElement = isSearching ? null : (
    <View style={isLandscape ? { padding: 10, alignItems: 'center', width: '100%' } : styles.plHero}>
      {/* アルバム・プレイリスト・アーティストすべてで一番上の楽曲等のカバーアートを表示 */}
      <Image 
        source={heroArtSource} 
        style={isLandscape ? { width: landscapeArtSize, height: landscapeArtSize, borderRadius: 12 } : styles.plHeroArt} 
      />
      <View style={{ width: '100%', paddingHorizontal: 20, alignItems: 'center', marginTop: isLandscape ? 10 : 15, minWidth: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>
          {showPlaylistTypeIcon && isPlaylist && (
            <Ionicons name={isSmartPlaylist ? "flash" : "musical-notes"} size={isLandscape ? 18 : 22} color={themeColor} style={{ marginRight: 8 }} />
          )}
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <MarqueeText text={heroTitle} align="center" style={[styles.plHeroTitle, { color: dynamicStyles.text, marginTop: 0, paddingHorizontal: 0 }, isLandscape && { fontSize: 18 }]} />
          </View>
        </View>
        <Text
          style={{
            color: dynamicStyles.subText,
            fontSize: isLandscape ? 12 : 13,
            fontWeight: '600',
            marginTop: 6,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
          numberOfLines={1}
        >
          {collectionMetaText}
        </Text>
      </View>
      
      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 10, marginTop: 15, paddingHorizontal: 10 }}>
        <GlassActionButton
          isDark={isDark}
          onPress={() => onPlayCollectionPress(songs, false)}
          style={[styles.plMainBtn, { maxWidth: 160, backgroundColor: useLiquidGlass || hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' }, (hasBlurBackground || useLiquidGlass) && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]}
          contentStyle={{ flexDirection: 'row', gap: 8 }}
        >
          {!useLiquidGlass && hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <Ionicons name="play" size={20} color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>{t('play_btn', language)}</Text>
        </GlassActionButton>
        <GlassActionButton
          isDark={isDark}
          onPress={() => onPlayCollectionPress(songs, true)}
          style={[styles.plMainBtn, { maxWidth: 160, backgroundColor: useLiquidGlass || hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' }, (hasBlurBackground || useLiquidGlass) && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]}
          contentStyle={{ flexDirection: 'row', gap: 8 }}
        >
          {!useLiquidGlass && hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <Ionicons name="shuffle" size={20} color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>{t('shuffle_btn', language)}</Text>
        </GlassActionButton>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {hasBlurBackground ? (
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100 }}>
          <Image source={heroArtSource} style={StyleSheet.absoluteFill} blurRadius={80} />
          <BlurView intensity={isDark ? 80 : 95} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </View>
      ) : (
        <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg }} />
      )}

      {renderFloatingBackButton()}
      {searchControl}
      
      {isLandscape ? (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {!isSearching && (
            <View style={{ flex: 1, justifyContent: 'center', paddingTop: 10, paddingLeft: Math.max(insets?.left || 0, 16) }}>
              {heroSectionElement}
            </View>
          )}
          <View style={{ flex: isSearching ? 1 : 1.5 }}>
            <FlatList
              ref={flatListRefLandscape} 
              data={songs}
              keyExtractor={(item) => item.localMusicUri}
              style={{ flex: 1 }}
              ListHeaderComponent={<View style={{ paddingTop: (insets?.top || 0) + (isPad ? 80 : 64) }} />}
              snapToOffsets={[0, 70]} 
              snapToEnd={false} 
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} 
                  onPress={() => startQueue(songs, item, undefined, collectionContext)}
                >
                  <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArt} />
                  <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <MarqueeText text={item.title} style={[styles.songTitle, { color: dynamicStyles.text }]} />
                    <MarqueeText text={item.artist} style={[styles.songSub, { color: dynamicStyles.subText, marginTop: 2 }]} />
                  </View>
                  <AnimatedMenuButton onPress={() => openActionSheet(item)} isDark={isDark} textStyle={dynamicStyles.text} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 + (insets?.bottom || 0), paddingRight: Math.max(insets?.right || 0, 16) }}
            />
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRefPortrait} 
          data={songs}
          keyExtractor={(item) => item.localMusicUri}
          style={StyleSheet.absoluteFill}
          ListHeaderComponent={<View style={{ paddingTop: (insets?.top || 0) + (isPad ? 80 : 64) }}>{heroSectionElement}</View>}
          snapToOffsets={[0, 70]} 
          snapToEnd={false} 
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} 
              onPress={() => startQueue(songs, item, undefined, collectionContext)}
            >
              <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArt} />
              <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <MarqueeText text={item.title} style={[styles.songTitle, { color: dynamicStyles.text }]} />
                <MarqueeText text={item.artist} style={[styles.songSub, { color: dynamicStyles.subText, marginTop: 2 }]} />
              </View>
              <AnimatedMenuButton onPress={() => openActionSheet(item)} isDark={isDark} textStyle={dynamicStyles.text} />
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 180 + (insets?.bottom || 0) }}
        />
      )}
    </View>
  );
};