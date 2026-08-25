import React from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, TextInput, 
  Keyboard, StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../../styles/styles';
import { MarqueeText } from '../MarqueeText';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const LibrarySongListView = ({
  dynamicStyles, themeColor, isDark, isLandscape, height, insets,
  songs, heroArtSource, heroTitle, hasBlurBackground,
  currentSelectionType, currentPlaylist, showPlaylistTypeIcon,
  searchQuery, setSearchQuery, isSearching, setIsSearching,
  startQueue, onPlayCollectionPress, openActionSheet,
  renderFloatingBackButton, flatListRefPortrait, flatListRefLandscape,
  AnimatedMenuButton
}: any) => {

  const isPlaylist = currentSelectionType === 'PLAYLIST';
  const isSmartPlaylist = isPlaylist && currentPlaylist?.type === 'smart';

  const onFocusSearch = () => setIsSearching(true);
  const onCancelSearch = () => { setIsSearching(false); setSearchQuery(''); Keyboard.dismiss(); };

  const searchBarElement = (
    <View style={{ paddingHorizontal: 20, paddingVertical: 10, width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ 
        flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', 
        borderRadius: 20, paddingHorizontal: 15, height: 40, width: '80%', maxWidth: 360,
      }}>
        <Ionicons name="search" size={18} color={dynamicStyles.subText} style={{ marginRight: 10 }} />
        <TextInput
          style={{ flex: 1, color: dynamicStyles.text, fontSize: 16 }}
          placeholder="曲名、アーティスト..."
          placeholderTextColor={dynamicStyles.subText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={onFocusSearch}
          onBlur={() => { if (!searchQuery) setIsSearching(false); }}
        />
        {isSearching && (
          <TouchableOpacity onPress={onCancelSearch}>
            <Ionicons name="close-circle" size={20} color={dynamicStyles.subText} style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const landscapeArtSize = height * 0.4;
  const heroSectionElement = isSearching ? null : (
    <View style={isLandscape ? { padding: 10, alignItems: 'center', width: '100%' } : styles.plHero}>
      {currentSelectionType !== 'ARTIST' && (
        <Image 
          source={heroArtSource} 
          style={isLandscape ? { width: landscapeArtSize, height: landscapeArtSize, borderRadius: 12 } : styles.plHeroArt} 
        />
      )}
      <View style={{ width: '100%', paddingHorizontal: 20, alignItems: 'center', marginTop: isLandscape ? 10 : 15, minWidth: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>
          {showPlaylistTypeIcon && isPlaylist && (
            <Ionicons name={isSmartPlaylist ? "flash" : "musical-notes"} size={isLandscape ? 18 : 22} color={themeColor} style={{ marginRight: 8 }} />
          )}
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <MarqueeText text={heroTitle} align="center" style={[styles.plHeroTitle, { color: dynamicStyles.text, marginTop: 0, paddingHorizontal: 0 }, isLandscape && { fontSize: 18 }]} />
          </View>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 10, marginTop: 15, paddingHorizontal: 10 }}>
        <TouchableOpacity 
          style={[styles.plMainBtn, { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' }, hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} 
          onPress={() => onPlayCollectionPress(songs, false)}
        >
          {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <Ionicons name="play" size={20} color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>再生</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.plMainBtn, { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' }, hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} 
          onPress={() => onPlayCollectionPress(songs, true)}
        >
          {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
          <Ionicons name="shuffle" size={20} color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.plMainBtnText, { color: isDark ? '#fff' : '#000', fontSize: 14 }]}>シャッフル</Text>
        </TouchableOpacity>
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
              ListHeaderComponent={<View style={{ paddingTop: 10 }}>{searchBarElement}</View>}
              snapToOffsets={[0, 70]} 
              snapToEnd={false} 
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
                  <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArt} />
                  <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <MarqueeText text={item.title} style={[styles.songTitle, { color: dynamicStyles.text }]} />
                    <MarqueeText text={item.artist} style={[styles.songSub, { color: dynamicStyles.subText, marginTop: 2 }]} />
                  </View>
                  <AnimatedMenuButton onPress={() => openActionSheet(item)} isDark={isDark} textStyle={dynamicStyles.text} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 40 + (insets?.bottom || 0), paddingRight: (Math.max(insets?.right || 0, 16) + LANDSCAPE_TAB_BAR_WIDTH + 16) }}
            />
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRefPortrait} 
          data={songs}
          keyExtractor={(item) => item.localMusicUri}
          style={StyleSheet.absoluteFill}
          ListHeaderComponent={<View style={{ paddingTop: 10 }}>{searchBarElement}{heroSectionElement}</View>}
          snapToOffsets={[0, 70]} 
          snapToEnd={false} 
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.songRow, { borderBottomWidth: 0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
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