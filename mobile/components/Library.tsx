import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, Animated, 
  StyleSheet, TouchableWithoutFeedback, PanResponder, useWindowDimensions, TextInput, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../styles/styles';
import { RecentSection } from './RecentSection';

const DEFAULT_ICON = require('../assets/images/icon.png');

const LIBRARY_MENU_ITEMS =[
  { title: 'プレイリスト', icon: 'musical-notes-outline' as const, view: 'PLAYLISTS' },
  { title: 'アルバム', icon: 'disc-outline' as const, view: 'ALBUMS' },
  { title: 'アーティスト', icon: 'mic-outline' as const, view: 'ARTISTS' },
];

export const Library = ({ dynamicStyles, themeColor, startQueue, currentSong, localLibrary, localPlaylists, setNavStackLength, insets, isDark }: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const[navStack, setNavStack] = useState<string[]>(['MENU']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const backButtonScale = useRef(new Animated.Value(1)).current;

  const panX = useRef(new Animated.Value(0)).current;

  const[recentlyPlayedSongs, setRecentlyPlayedSongs] = useState<any[]>([]);
  const[recentlyPlayedCollections, setRecentlyPlayedCollections] = useState<any[]>([]);
  
  const [currentSelectionType, setCurrentSelectionType] = useState<string | null>(null);
  const[currentPlaylist, setCurrentPlaylist] = useState<any>(null);
  const[currentAlbum, setCurrentAlbum] = useState<any>(null);
  const [currentArtist, setCurrentArtist] = useState<string | null>(null);
  const [albumsList, setAlbumsList] = useState<any[]>([]);
  const[artistsList, setArtistsList] = useState<any[]>([]);

  const[listBackgroundArt, setListBackgroundArt] = useState<any>(null);
  const listBgOpacity = useRef(new Animated.Value(0)).current;

  const [searchQuery, setSearchQuery] = useState('');
  const[isSearching, setIsSearching] = useState(false);

  const flatListRefPortrait = useRef<FlatList>(null);
  const flatListRefLandscape = useRef<FlatList>(null);

  useEffect(() => {
    if (setNavStackLength) {
      setNavStackLength(navStack.length);
    }
  }, [navStack]);

  useEffect(() => {
    if (!localLibrary) return;
    const aMap = new Map();
    const artMap = new Map();
    localLibrary.forEach((s: any) => {
      const ak = `${s.album}:::${s.artist}`;
      if(!aMap.has(ak)) aMap.set(ak, {album: s.album, artist: s.artist, songs:[]});
      aMap.get(ak).songs.push(s);
      if(!artMap.has(s.artist)) artMap.set(s.artist,[]);
      artMap.get(s.artist).push(s);
    });
    setAlbumsList(Array.from(aMap.values()).map(a => ({...a, coverArt: [...a.songs].sort((x:any,y:any)=>(x.title||'').localeCompare(y.title||'','ja'))[0]?.localImageUri})));
    setArtistsList(Array.from(artMap.entries()).map(([n, ss]) => ({artistName: n, coverArt: [...(ss as any[])].sort((x:any,y:any)=>(x.title||'').localeCompare(y.title||'','ja'))[0]?.localImageUri})));
  },[localLibrary]);

  useEffect(() => {
    loadHistory();
  }, [currentSong, navStack]);

  useEffect(() => {
    Animated.timing(listBgOpacity, {
      toValue: listBackgroundArt ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  },[listBackgroundArt]);

  useEffect(() => {
    if (navStack.length === 3) {
      let heroArtSource = null;
      if (currentSelectionType === 'PLAYLIST') {
        heroArtSource = getPlaylistFirstArt(currentPlaylist);
      } else if (currentSelectionType === 'ALBUM') {
        heroArtSource = currentAlbum?.coverArt ? { uri: currentAlbum.coverArt } : DEFAULT_ICON;
      } else if (currentSelectionType === 'ARTIST') {
        const songs = localLibrary.filter((s:any) => s.artist === currentArtist);
        heroArtSource = songs.length > 0 && songs[0].localImageUri ? { uri: songs[0].localImageUri } : DEFAULT_ICON;
      }
      if(heroArtSource && heroArtSource !== DEFAULT_ICON){
        setListBackgroundArt(heroArtSource);
      } else {
        setListBackgroundArt(null);
      }

      setTimeout(() => {
        flatListRefPortrait.current?.scrollToOffset({ offset: 60, animated: false });
        flatListRefLandscape.current?.scrollToOffset({ offset: 60, animated: false });
      }, 50);

    } else {
      setListBackgroundArt(null);
    }
  },[navStack, currentSelectionType, currentPlaylist, currentAlbum, currentArtist, artistsList]);

  const loadHistory = async () => {
    const rs = await AsyncStorage.getItem('recently_played_songs');
    const rc = await AsyncStorage.getItem('recently_played_collections');
    if (rs) setRecentlyPlayedSongs(JSON.parse(rs));
    if (rc) setRecentlyPlayedCollections(JSON.parse(rc));
  };

  const saveCollectionToHistory = async (item: any) => {
    try {
      const rc = await AsyncStorage.getItem('recently_played_collections');
      let list = rc ? JSON.parse(rc) : [];
      list =[item, ...list.filter((c: any) => c.id !== item.id)].slice(0, 10);
      await AsyncStorage.setItem('recently_played_collections', JSON.stringify(list));
      setRecentlyPlayedCollections(list);
    } catch (e) {}
  };

  const getPlaylistFirstArt = (playlist: any) => {
    if (!playlist) return DEFAULT_ICON;
    const songs = playlist.isAll 
      ? localLibrary 
      : localLibrary.filter((s:any) => playlist.music?.includes(s.musicFilename.split(/[\\/]/).pop()));
    
    if (songs.length > 0 && songs[0].localImageUri) {
      return { uri: songs[0].localImageUri };
    }
    return DEFAULT_ICON;
  };

  const pushView = (view: string) => {
    if (isNavAnimating.current) return;
    isNavAnimating.current = true;
    const next = navStack.length;
    setNavStack([...navStack, view]);
    Animated.spring(navAnim, { toValue: next, useNativeDriver: true, overshootClamping: true, stiffness: 400, damping: 35 }).start(() => { isNavAnimating.current = false; });
  };

  const popView = () => {
    if (isNavAnimating.current || navStack.length <= 1) return;
    isNavAnimating.current = true;
    panX.setValue(0); 
    
    setSearchQuery('');
    setIsSearching(false);
    Keyboard.dismiss();

    const prev = navStack.length - 2;
    Animated.spring(navAnim, { toValue: prev, useNativeDriver: true, overshootClamping: true, stiffness: 400, damping: 35 }).start(() => {
      setNavStack(navStack.slice(0, -1));
      isNavAnimating.current = false;
    });
  };
  
  const navPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (_, gestureState) => {
      if (navStack.length <= 1 || isNavAnimating.current) return false;
      return gestureState.dx > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
    },
    onPanResponderMove: (_, gestureState) => {
      panX.setValue(Math.max(0, gestureState.dx));
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > width / 4 || gestureState.vx > 0.3) {
        if (isNavAnimating.current) return;
        isNavAnimating.current = true;

        Keyboard.dismiss();
        setSearchQuery('');
        setIsSearching(false);

        Animated.timing(panX, {
          toValue: width,
          duration: 200,
          useNativeDriver: true
        }).start(() => {
          const nextStack = navStack.slice(0, -1);
          setNavStack(nextStack);
          panX.setValue(0);
          navAnim.setValue(nextStack.length - 1);
          isNavAnimating.current = false;
        });
      } else {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          tension: 40,
          friction: 8
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  })).current;

  const handlePressIn = () => { Animated.spring(backButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handlePressOut = () => { Animated.spring(backButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const renderHeader = (title: string) => (
    <View style={[styles.navHeader, { paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0) }]}>
        <View style={styles.navHeaderLeft}>
            {navStack.length > 1 && (
                <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
                    <Animated.View style={{ transform:[{ scale: backButtonScale }] }}>
                        <View style={[styles.liquidGlassBackButton, { 
                            backgroundColor: isDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)',
                            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                        }]}>
                            <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                            <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
                        </View>
                    </Animated.View>
                </TouchableWithoutFeedback>
            )}
        </View>
        <Text style={[styles.navHeaderTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{title}</Text>
        <View style={styles.navHeaderRight} />
    </View>
  );

  const onPlayCollectionPress = (songs: any[], shuffle: boolean) => {
    let collectionItem: any;
    if (currentSelectionType === 'PLAYLIST') {
      collectionItem = { type: 'PLAYLIST', data: currentPlaylist, id: currentPlaylist.id, art: getPlaylistFirstArt(currentPlaylist) };
    } else if (currentSelectionType === 'ALBUM') {
      // ★ 修正: 末尾の不要なセミコロンを取り除きました
      collectionItem = { type: 'ALBUM', data: currentAlbum, id: `${currentAlbum.album}:::${currentAlbum.artist}`, art: currentAlbum.coverArt ? {uri: currentAlbum.coverArt} : DEFAULT_ICON };
    } else if (currentSelectionType === 'ARTIST') {
      const artistData = artistsList.find(a => a.artistName === currentArtist);
      const songsOfArtist = localLibrary.filter((s:any) => s.artist === currentArtist);
      const art = songsOfArtist.length > 0 && songsOfArtist[0].localImageUri ? {uri: songsOfArtist[0].localImageUri} : DEFAULT_ICON;
      collectionItem = { type: 'ARTIST', data: artistData, id: currentArtist, art };
    }
    if (collectionItem) saveCollectionToHistory(collectionItem);
    startQueue(songs, undefined, shuffle);
  };

  const renderMenu = () => (
    <View style={{flex: 1, backgroundColor: dynamicStyles.bg}}>
        <FlatList
        data={LIBRARY_MENU_ITEMS}
        keyExtractor={item => item.title}
        ListHeaderComponent={<View style={[styles.headerBar, {borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0)}]}><Text style={[styles.headerTitle, {color: dynamicStyles.text}]}>ライブラリ</Text></View>}
        renderItem={({item, index}) => (
            <TouchableOpacity style={[styles.menuRow, index !== 2 && {borderBottomWidth:0.5, borderBottomColor: dynamicStyles.border}]} onPress={() => pushView(item.view)}>
            <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
            <Text style={[styles.menuRowTitle, {color: dynamicStyles.text}]}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
            </TouchableOpacity>
        )}
        ListFooterComponent={
            <RecentSection 
            recentlyPlayedSongs={recentlyPlayedSongs} 
            recentlyPlayedCollections={recentlyPlayedCollections} 
            dynamicStyles={dynamicStyles} 
            themeColor={themeColor}
            onPlaySong={(s:any)=>startQueue([s], s, undefined)} 
            onPlayCollection={(item: any) => {
                let songs: any[] =[];
                if (item.type === 'PLAYLIST') {
                songs = item.data.isAll ? localLibrary : localLibrary.filter((s:any) => item.data.music?.includes(s.musicFilename.split(/[\\/]/).pop()));
                const sortBy = item.data.sortBy || 'title';
                const sortDesc = item.data.sortDesc || false;
                songs.sort((a, b) => {
                  let valA = a[sortBy] || '';
                  let valB = b[sortBy] || '';
                  if (['track', 'disc', 'year', 'bpm'].includes(sortBy)) {
                    valA = parseInt(valA) || 0; valB = parseInt(valB) || 0;
                  } else {
                    valA = String(valA).toLowerCase(); valB = String(valB).toLowerCase();
                  }
                  if (valA < valB) return sortDesc ? 1 : -1;
                  if (valA > valB) return sortDesc ? -1 : 1;
                  return 0;
                });
                } else if (item.type === 'ALBUM') {
                songs = localLibrary.filter((s:any) => s.album === item.data.album && s.artist === item.data.artist);
                } else if (item.type === 'ARTIST') {
                songs = localLibrary.filter((s:any) => s.artist === item.data.artistName);
                }
                startQueue(songs, undefined, false);
                saveCollectionToHistory(item);
            }}
            />
        }
        contentContainerStyle={{paddingBottom: 180}}
        />
    </View>
  );

  const renderCategory = (category: string) => {
    const data = category === 'PLAYLISTS' ?[{playlistName: 'すべての楽曲', isAll: true, id: 'all_songs'}, ...localPlaylists] : category === 'ALBUMS' ? albumsList : artistsList;
    return (
      <View style={{flex: 1, backgroundColor: dynamicStyles.bg}}>
        {renderHeader(category === 'PLAYLISTS' ? 'プレイリスト' : category === 'ALBUMS' ? 'アルバム' : 'アーティスト')}
        <FlatList
          key={category}
          data={data}
          numColumns={category === 'ALBUMS' ? 2 : 1}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({item}) => {
            if(category === 'ALBUMS') {
                return (
                    <TouchableOpacity style={styles.albumGridItem} onPress={() => { setCurrentSelectionType('ALBUM'); setCurrentAlbum(item); pushView('SONG_LIST'); }}>
                        <Image source={item.coverArt ? {uri: item.coverArt} : DEFAULT_ICON} style={styles.albumGridImage} />
                        <Text style={[styles.albumGridTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.album}</Text>
                        <Text style={[styles.albumGridArtist, {color: dynamicStyles.subText}]} numberOfLines={1}>{item.artist}</Text>
                    </TouchableOpacity>
                );
            }
            const title = category === 'PLAYLISTS' ? item.playlistName : item.artistName;
            const artSource = category === 'PLAYLISTS' ? getPlaylistFirstArt(item) : (item.coverArt ? {uri: item.coverArt} : DEFAULT_ICON);
            return (
                <TouchableOpacity style={[styles.checkRow, {borderBottomWidth:0}]} onPress={() => { 
                    if(category === 'PLAYLISTS') { setCurrentSelectionType('PLAYLIST'); setCurrentPlaylist(item); }
                    else { setCurrentSelectionType('ARTIST'); setCurrentArtist(item.artistName); }
                    pushView('SONG_LIST');
                }}>
                    <Image source={artSource} style={[styles.playlistIconArt, category === 'ARTISTS' && {borderRadius: 35}]} />
                    <Text style={[styles.rowTitle, {color: dynamicStyles.text}]}>{title}</Text>
                    <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
                </TouchableOpacity>
            );
          }}
          contentContainerStyle={{paddingBottom: 180}}
        />
      </View>
    );
  };

  const renderSongList = () => {
    let songs: any[] =[];
    let heroArtSource: any = DEFAULT_ICON;
    let heroTitle = "";
    let heroSubtitle = "";

    if (currentSelectionType === 'PLAYLIST') {
      songs = currentPlaylist.isAll ? localLibrary : localLibrary.filter((s:any) => currentPlaylist.music?.includes(s.musicFilename.split(/[\\/]/).pop()));
      
      const sortBy = currentPlaylist.sortBy || 'title';
      const sortDesc = currentPlaylist.sortDesc || false;
      
      songs.sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';

        if (['track', 'disc', 'year', 'bpm'].includes(sortBy)) {
          valA = parseInt(valA) || 0;
          valB = parseInt(valB) || 0;
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });

      heroArtSource = getPlaylistFirstArt(currentPlaylist);
      heroTitle = currentPlaylist.playlistName;
    } else if (currentSelectionType === 'ALBUM') {
      songs = localLibrary.filter((s:any) => s.album === currentAlbum.album && s.artist === currentAlbum.artist);
      songs.sort((a, b) => (a.track || 0) - (b.track || 0)); 
      heroArtSource = currentAlbum.coverArt ? {uri: currentAlbum.coverArt} : DEFAULT_ICON;
      heroTitle = currentAlbum.album;
      heroSubtitle = currentAlbum.artist;
    } else if (currentSelectionType === 'ARTIST') {
      songs = localLibrary.filter((s:any) => s.artist === currentArtist);
      songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
      heroArtSource = (songs.length > 0 && songs[0].localImageUri) ? { uri: songs[0].localImageUri } : DEFAULT_ICON;
      heroTitle = currentArtist || "";
    }

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        songs = songs.filter(song => 
            song.title?.toLowerCase().includes(q) || 
            song.artist?.toLowerCase().includes(q) || 
            song.album?.toLowerCase().includes(q)
        );
    }
    
    const hasBlurBackground = heroArtSource !== DEFAULT_ICON;

    const onFocusSearch = () => {
        setIsSearching(true);
    };

    const onCancelSearch = () => {
        setIsSearching(false); 
        setSearchQuery(''); 
        Keyboard.dismiss(); 
    };

    const searchBarElement = (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, width: '100%', height: 60, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', borderRadius: 20, paddingHorizontal: 15, height: 40 }}>
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
                    style={isLandscape 
                        ? { width: landscapeArtSize, height: landscapeArtSize, borderRadius: 12 } 
                        : styles.plHeroArt
                    } 
                />
            )}
            <Text 
                style={[
                    styles.plHeroTitle, 
                    { color: dynamicStyles.text, marginTop: isLandscape ? 10 : 15 },
                    isLandscape && { fontSize: 18 }
                ]} 
                numberOfLines={1}
            >
                {heroTitle}
            </Text>
            
            <View style={{
                flexDirection: 'row', 
                width: '100%', 
                justifyContent: 'center', 
                gap: 10, 
                marginTop: 15,
                paddingHorizontal: 10
            }}>
                <TouchableOpacity 
                    style={[
                        styles.plMainBtn, 
                        { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' },
                        hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
                    ]} 
                    onPress={() => onPlayCollectionPress(songs, false)}
                >
                    {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
                    <Ionicons name="play" size={20} color={isDark ? '#fff' : '#000'} />
                    <Text style={[styles.plMainBtnText, {color: isDark ? '#fff' : '#000', fontSize: 14}]}>再生</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.plMainBtn, 
                        { backgroundColor: hasBlurBackground ? 'transparent' : dynamicStyles.card, overflow: 'hidden' },
                        hasBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
                    ]} 
                    onPress={() => onPlayCollectionPress(songs, true)}
                >
                    {hasBlurBackground && <BlurView intensity={isDark ? 30 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
                    <Ionicons name="shuffle" size={20} color={isDark ? '#fff' : '#000'} />
                    <Text style={[styles.plMainBtnText, {color: isDark ? '#fff' : '#000', fontSize: 14}]}>シャッフル</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={{flex: 1}}>
            {hasBlurBackground ? (
              <View style={StyleSheet.absoluteFill}>
                  <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: '#000', zIndex: -2 }} />
                  <Image source={heroArtSource} style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, opacity: 0.8 }} blurRadius={80} />
                  <BlurView intensity={isDark ? 80 : 95} tint={isDark ? 'dark' : 'light'} style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100 }} />
              </View>
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: dynamicStyles.bg }]} />
            )}

            {renderHeader(currentSelectionType === 'PLAYLIST' ? 'プレイリスト' : currentSelectionType === 'ALBUM' ? 'アルバム' : 'アーティスト')}
            
            {isLandscape ? (
                <View style={{ flex: 1, flexDirection: 'row' }}>
                    {!isSearching && (
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            {heroSectionElement}
                        </View>
                    )}
                    <View style={{ flex: isSearching ? 1 : 1.5 }}>
                        <FlatList
                            ref={flatListRefLandscape} 
                            data={songs}
                            keyExtractor={(item) => item.localMusicUri}
                            ListHeaderComponent={searchBarElement}
                            snapToOffsets={[0, 60]} 
                            snapToEnd={false} 
                            renderItem={({item}) => (
                                <TouchableOpacity style={[styles.songRow, {borderBottomWidth:0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
                                    <Image source={item.localImageUri ? {uri: item.localImageUri} : DEFAULT_ICON} style={styles.smallArt} />
                                    <View style={{flex: 1}}>
                                        <Text style={[styles.songTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.title}</Text>
                                        <Text style={[styles.songSub, {color: dynamicStyles.subText}]} numberOfLines={1}>{item.artist}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{paddingBottom: 100}}
                        />
                    </View>
                </View>
            ) : (
                <FlatList
                    ref={flatListRefPortrait} 
                    data={songs}
                    keyExtractor={(item) => item.localMusicUri}
                    ListHeaderComponent={
                        <View>
                            {searchBarElement}
                            {heroSectionElement}
                        </View>
                    }
                    snapToOffsets={[0, 60]} 
                    snapToEnd={false} 
                    renderItem={({item}) => (
                        <TouchableOpacity style={[styles.songRow, {borderBottomWidth:0, backgroundColor: 'transparent' }]} onPress={() => startQueue(songs, item, undefined)}>
                            <Image source={item.localImageUri ? {uri: item.localImageUri} : DEFAULT_ICON} style={styles.smallArt} />
                            <View style={{flex: 1}}>
                                <Text style={[styles.songTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.title}</Text>
                                <Text style={[styles.songSub, {color: dynamicStyles.subText}]} numberOfLines={1}>{item.artist}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{paddingBottom: 180}}
                />
            )}
        </View>
    );
  };

  return (
    <View style={{flex: 1, backgroundColor: 'transparent'}} {...navPanResponder.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, { 
        zIndex: 1,
        transform:[{ 
          translateX: Animated.add(
            navAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }),
            panX
          ) 
        }] 
      }]}>
        {renderMenu()}
      </Animated.View>
      
      {navStack.length > 1 && (
        <Animated.View 
            style={[StyleSheet.absoluteFill, { 
              zIndex: 2,
              transform:[{ 
                translateX: Animated.add(
                  navAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [width, 0, -width] }),
                  panX
                )
             }] 
            }]}
        >
          {renderCategory(navStack[1])}
        </Animated.View>
      )}

      {navStack.length > 2 && (
        <Animated.View 
            style={[StyleSheet.absoluteFill, { 
              zIndex: 3,
              transform:[{
                translateX: Animated.add(
                  navAnim.interpolate({ inputRange: [1, 2], outputRange: [width, 0] }),
                  panX
                )
            }] 
        }]}
        >
          {renderSongList()}
        </Animated.View>
      )}
    </View>
  );
};