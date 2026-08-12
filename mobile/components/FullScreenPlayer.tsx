import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TouchableHighlight, Animated, ScrollView, FlatList, StyleSheet, useWindowDimensions, Easing, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import TrackPlayer from 'react-native-track-player';
import { styles } from '../styles/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

// ★ AirPlay ライブラリの安全ダイナミックインポート
let AirPlayNativeButton: any = null;
if (Platform.OS === 'ios') {
  try {
    const airplayModule = require('react-native-airplay-btn') || require('react-native-airplay-button');
    AirPlayNativeButton = airplayModule.AirPlayButton || airplayModule.default || airplayModule;
  } catch (e) {
    console.warn("AirPlay Button library load error:", e);
  }
}

const DEFAULT_ICON = require('../assets/images/icon.png');

// 押し込み弾性スプリング効果付きのボタンラッパー
const BounceButton = ({ children, onPress, style, underlayColor, activeOpacity }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.64,
      useNativeDriver: true,
      speed: 20,
      bounciness: 2,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0, 
      useNativeDriver: true,
      speed: 20,
      bounciness: 2,
    }).start();
  };

  const flatStyle = StyleSheet.flatten(style) || {};
  const bRadius = flatStyle.borderRadius ?? 0;
  const bTopLeftRadius = flatStyle.borderTopLeftRadius ?? bRadius;
  const bBottomLeftRadius = flatStyle.borderBottomLeftRadius ?? bRadius;
  const bTopRightRadius = flatStyle.borderTopRightRadius ?? bRadius;
  const bBottomRightRadius = flatStyle.borderBottomRightRadius ?? bRadius;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style, { backgroundColor: 'transparent' }]}>
      <TouchableHighlight
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        underlayColor={underlayColor || "rgba(255,255,255,0.15)"}
        style={{ 
          width: '100%', 
          height: '100%', 
          borderTopLeftRadius: bTopLeftRadius, 
          borderBottomLeftRadius: bBottomLeftRadius,
          borderTopRightRadius: bTopRightRadius,
          borderBottomRightRadius: bBottomRightRadius,
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: flatStyle.backgroundColor ?? 'transparent'
        }}
        activeOpacity={activeOpacity ?? 0.85}
      >
        {children}
      </TouchableHighlight>
    </Animated.View>
  );
};

const MarqueeText = ({ text, style, containerWidth, align = 'center' }: { text: string, style: any, containerWidth: number, align?: 'center' | 'left' }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      setShouldScroll(true);
      startAnimation();
    } else {
      setShouldScroll(false);
      scrollAnim.setValue(0);
    }
  }, [text, textWidth, containerWidth]);

  const startAnimation = () => {
    scrollAnim.setValue(0);
    const duration = textWidth * 30;
    Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(scrollAnim, {
          toValue: -textWidth - 40,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  if (!text) return null;

  const isLeft = align === 'left';

  return (
    <View style={{ width: containerWidth, overflow: 'hidden', alignItems: isLeft ? 'flex-start' : 'center' }}>
      <Animated.View 
        style={{ 
          flexDirection: 'row', 
          justifyContent: shouldScroll ? 'flex-start' : (isLeft ? 'flex-start' : 'center'),
          width: shouldScroll ? undefined : '100%',
          transform: [{ translateX: scrollAnim }] 
        }}
      >
        <Text style={[style, !shouldScroll && { textAlign: isLeft ? 'left' : 'center' }]} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)} numberOfLines={1}>
          {text}
        </Text>
        {shouldScroll && <Text style={[style, { marginLeft: 40 }]}>{text}</Text>}
      </Animated.View>
    </View>
  );
};

export const FullScreenPlayer = ({
  dynamicStyles, themeColor, currentSong, isPlaying, playbackStatus, sound,
  playQueue, loopMode, isShuffle, showQueue, showLyrics,
  toggleLoopMode, toggleShuffleMode, setShowQueue, setShowLyrics,
  handlePrev, togglePlayPause, handleNext,
  slideAnim, queueTransitionAnim, closeFullPlayer,
  toastVisible, toastMessage, toastAnim
}: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  const transitionAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);

  const mainViewAnim = useRef(new Animated.Value(1)).current;
  const lyricsViewAnim = useRef(new Animated.Value(0)).current;
  const queueViewAnim = useRef(new Animated.Value(0)).current;

  const [isScrollAtTop, setIsScrollAtTop] = useState(true);
  
  const isIphone = Platform.OS === 'ios' && !Platform.isPad;
  const isIpad = Platform.OS === 'ios' && Platform.isPad;
  const isIphoneLandscape = isLandscape && isIphone;

  let btnScale = 1.0;
  if (isIphoneLandscape) {
    btnScale = 1.7;
  } else if (isIpad) {
    btnScale = 1.2;
  }

  useEffect(() => {
    const isMain = !showQueue && !showLyrics;
    Animated.parallel([
      Animated.timing(mainViewAnim, {
        toValue: isMain ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(lyricsViewAnim, {
        toValue: showLyrics ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(queueViewAnim, {
        toValue: showQueue ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showLyrics, showQueue]);

  useEffect(() => {
    const toValue = (showLyrics || showQueue) ? 1 : 0;
    Animated.spring(transitionAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  }, [showLyrics, showQueue]);

  useEffect(() => {
    scrollYRef.current = 0;
    setIsScrollAtTop(true);
  }, [showLyrics, showQueue]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: slideAnim } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { state, translationY, velocityX } = event.nativeEvent;

    if (state === State.END || state === State.CANCELLED) {
      if (translationY > 120 || velocityX > 500) {
        closeFullPlayer();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      }
    }
  };

  const formatMillis = (ms: number | undefined) => { if (!ms) return "0:00"; const totalSec = Math.floor(ms / 1000); const min = Math.floor(totalSec / 60); const sec = totalSec % 60; return `${min}:${sec < 10 ? '0' : ''}${sec}`; };

  const toggleLyrics = () => {
    if (showQueue) setShowQueue(false);
    setShowLyrics(!showLyrics);
  };

  const toggleQueue = () => {
    if (showLyrics) setShowLyrics(false);
    setShowQueue(!showQueue);
  };

  const renderControls = (iconSize: number, customStyle?: any) => {
    const mainIconSize = iconSize * 0.72 * btnScale; 
    const sideIconSize = iconSize * 0.48 * btnScale;

    const mainBtnSize = iconSize * 0.85 * btnScale;
    const sideBtnSize = iconSize * 0.65 * btnScale;

    return (
      <View style={[styles.fullControls, customStyle]}>
        <BounceButton
          onPress={handlePrev}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="play-skip-back" size={sideIconSize} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={togglePlayPause}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: mainBtnSize, height: mainBtnSize, borderRadius: mainBtnSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={mainIconSize} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={handleNext}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: sideBtnSize, height: sideBtnSize, borderRadius: sideBtnSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="play-skip-forward" size={sideIconSize} color="#fff" />
        </BounceButton>
      </View>
    );
  };

  const renderLeftColumnContent = (leftColumnWidth: number, landscapeArtSize: number) => {
    if (isIphoneLandscape) {
      const artSize = height * 0.21; 
      return (
        <View style={{ flex: 1, width: '100%', justifyContent: 'center', paddingHorizontal: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 15 }}>
            <Image
              source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
              style={{ width: artSize, height: artSize, borderRadius: 12 }}
            />
            <View style={{ flex: 1, marginLeft: 20, justifyContent: 'center' }}>
              <MarqueeText text={currentSong?.title} style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }} containerWidth={leftColumnWidth - artSize - 50} />
              <View style={{ height: 6 }} />
              <MarqueeText text={currentSong?.artist} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }} containerWidth={leftColumnWidth - artSize - 50} />
            </View>
          </View>
          <View style={styles.sliderWithTime}>
            <Slider style={{ width: '100%', height: 35 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
            <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
          </View>
          {renderControls(55, { width: '100%', marginTop: 5, justifyContent: 'space-around' })}
        </View>
      );
    } else {
      return (
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
            style={{ width: landscapeArtSize, height: landscapeArtSize, borderRadius: 16, marginBottom: 20 }}
          />
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
            <MarqueeText text={currentSong?.title} style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }} containerWidth={leftColumnWidth - 30} />
            <View style={{ height: 6 }} />
            <MarqueeText text={currentSong?.artist} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }} containerWidth={leftColumnWidth - 30} />
          </View>
          <View style={{ width: '100%' }}>
            <View style={styles.sliderWithTime}>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
              <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
            </View>
            {renderControls(70, { width: '100%', marginTop: 20, justifyContent: 'space-around' })}
          </View>
        </View>
      );
    }
  };

  const handleBar = (
    <PanGestureHandler
      activeOffsetY={[-500, 15]}
      failOffsetX={[-15, 15]}
      enabled={isLandscape}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View style={styles.swipeArea}>
        <View style={styles.fullPlayerHandle} />
      </Animated.View>
    </PanGestureHandler>
  );

  let contentLayout;
  if (isLandscape) {
    const leftColumnWidth = (width / 2.2) - 50;
    const landscapeArtSize = Math.min(leftColumnWidth * 0.75, height * 0.45);

    contentLayout = (
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
          <BounceButton
            onPress={toggleLyrics}
            underlayColor="rgba(255,255,255,0.15)"
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: showLyrics ? themeColor : 'transparent',
              justifyContent: 'center', alignItems: 'center'
            }}
          >
            <Ionicons name="musical-notes-outline" size={28} color="#fff" />
          </BounceButton>
        </View>

        <PanGestureHandler
          activeOffsetY={[-500, 15]}
          failOffsetX={[-15, 15]}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={{ width: leftColumnWidth, padding: 15, justifyContent: 'center', alignItems: 'center' }}>
            {renderLeftColumnContent(leftColumnWidth, landscapeArtSize)}
          </Animated.View>
        </PanGestureHandler>

        <View style={{ width: 1, 'backgroundColor': 'rgba(255,255,255,0.1)', marginVertical: 30 }} />

        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }) }]} pointerEvents={showLyrics ? 'none' : 'auto'}>
            <FlatList
              data={playQueue}
              keyExtractor={(item, index) => 'queue-h-' + index}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollYRef.current = y;
                setIsScrollAtTop(y <= 0);
              }}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <View style={styles.songRowQueue}>
                  <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArtQueue} />
                  <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: 'bold' }} numberOfLines={1}>{item.title}</Text><Text style={{ color: '#aaa' }} numberOfLines={1}>{item.artist}</Text></View>
                </View>
              )} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]} pointerEvents={showLyrics ? 'auto' : 'none'}>
            {currentSong?.lyric?.trim() ? (
              <ScrollView
                style={styles.lyricsScrollView}
                contentContainerStyle={{ paddingBottom: 30 }}
                onScroll={(e) => {
                  const y = e.nativeEvent.contentOffset.y;
                  scrollYRef.current = y;
                  setIsScrollAtTop(y <= 0);
                }}
                scrollEventThrottle={16}
              >
                <Text style={styles.lyricsText}>{currentSong?.lyric}</Text>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[styles.lyricsText, { opacity: 0.5, textAlign: 'center' }]}>歌詞が登録されていません</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    );
  } else {
    // 縦画面（Portrait）時の画面構成
    const artSizeBig = Math.min(width * 0.83, height * 0.40);

    const mainViewStyle = {
      opacity: mainViewAnim,
      transform: [{
        translateY: mainViewAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0]
        })
      }]
    };

    const lyricsViewStyle = {
      opacity: lyricsViewAnim,
      transform: [{
        translateY: lyricsViewAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0]
        })
      }]
    };

    const queueViewStyle = {
      opacity: queueViewAnim,
      transform: [{
        translateY: queueViewAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0]
        })
      }]
    };

    contentLayout = (
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        
        {/* 1. ★ 上部可変エリア (PanGestureHandlerを適用してスワイプダウン閉じるを可能にする) */}
        <PanGestureHandler
          activeOffsetY={[-500, 15]}
          failOffsetX={[-15, 15]}
          enabled={!showLyrics && !showQueue ? true : isScrollAtTop}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={{ flex: 1, width: '100%' }}>
            
            {/* (A) メイン画面 (カバーアート + タイトル/アーティスト) */}
            <Animated.View 
              style={[StyleSheet.absoluteFill, mainViewStyle, { justifyContent: 'center', alignItems: 'center' }]}
              pointerEvents={(!showQueue && !showLyrics) ? 'auto' : 'none'}
            >
              <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }}>
                <Image
                  source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
                  style={[styles.fullArtBase, {
                    width: artSizeBig,
                    height: artSizeBig,
                    borderRadius: 24,
                    marginBottom: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.35,
                    shadowRadius: 18,
                  }]}
                />
                <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <MarqueeText 
                    text={currentSong?.title} 
                    style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }} 
                    containerWidth={width - 50} 
                    align="center"
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 6, textAlign: 'center' }} numberOfLines={1}>
                    {currentSong?.artist}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* (B) 歌詞画面 */}
            <Animated.View 
              style={[StyleSheet.absoluteFill, lyricsViewStyle, { paddingHorizontal: 15, paddingTop: 10 }]}
              pointerEvents={showLyrics ? 'auto' : 'none'}
            >
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                width: '100%', 
                marginBottom: 12, 
                paddingBottom: 12, 
                paddingHorizontal: 5,
                borderBottomWidth: 1.5,
                borderBottomColor: 'rgba(255, 255, 255, 0.2)'
              }}>
                <Image
                  source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
                  style={{ width: 46, height: 46, borderRadius: 8, marginRight: 12 }}
                />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <MarqueeText 
                    text={currentSong?.title} 
                    style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'left' }} 
                    containerWidth={width - 30 - 46 - 12 - 10} 
                    align="left"
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, textAlign: 'left' }} numberOfLines={1}>
                    {currentSong?.artist}
                  </Text>
                </View>
              </View>

              {currentSong?.lyric?.trim() ? (
                <ScrollView
                  style={styles.lyricsScrollView}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    scrollYRef.current = y;
                    setIsScrollAtTop(y <= 0);
                  }}
                  scrollEventThrottle={16}
                >
                  <Text style={styles.lyricsText}>{currentSong?.lyric}</Text>
                </ScrollView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[styles.lyricsText, { opacity: 0.5, textAlign: 'center' }]}>歌詞が登録されていません</Text>
                </View>
              )}
            </Animated.View>

            {/* (C) キュー画面 */}
            <Animated.View 
              style={[StyleSheet.absoluteFill, queueViewStyle, { paddingHorizontal: 15, paddingTop: 10 }]}
              pointerEvents={showQueue ? 'auto' : 'none'}
            >
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                width: '100%', 
                marginBottom: 12, 
                paddingBottom: 12, 
                paddingHorizontal: 5,
                borderBottomWidth: 1.5,
                borderBottomColor: 'rgba(255, 255, 255, 0.2)'
              }}>
                <Image
                  source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
                  style={{ width: 46, height: 46, borderRadius: 8, marginRight: 12 }}
                />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}>
                  <MarqueeText 
                    text={currentSong?.title} 
                    style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', textAlign: 'left' }} 
                    containerWidth={width - 30 - 46 - 12 - 10} 
                    align="left"
                  />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2, textAlign: 'left' }} numberOfLines={1}>
                    {currentSong?.artist}
                  </Text>
                </View>
              </View>

              <FlatList
                data={playQueue}
                keyExtractor={(item, index) => 'queue-v-' + index}
                onScroll={(e) => {
                  const y = e.nativeEvent.contentOffset.y;
                  scrollYRef.current = y;
                  setIsScrollAtTop(y <= 0);
                }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <View style={styles.songRowQueue}>
                    <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArtQueue} />
                    <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: 'bold' }} numberOfLines={1}>{item.title}</Text><Text style={{ color: '#aaa' }} numberOfLines={1}>{item.artist}</Text></View>
                  </View>
                )} 
              />
            </Animated.View>

          </Animated.View>
        </PanGestureHandler>

        {/* 2. ★ 下部固定エリア (ここからはPanGestureHandlerの「外側」なのでネイティブタッチが100%通る) */}
        <View style={{ width: '100%', paddingTop: 10 }}>
          
          <View style={[styles.sliderWithTime, { paddingHorizontal: 10 }]}>
            <Slider style={{ width: '100%', height: 35 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
            <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
          </View>

          <View style={{ width: '100%', marginVertical: 10 }}>
            {renderControls(75, { width: '100%', justifyContent: 'space-around' })}
          </View>

          <View style={{ flexDirection: 'row', width: '100%', marginTop: 8, paddingHorizontal: 16, justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* 1. シャッフル */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <BounceButton
                onPress={toggleShuffleMode}
                underlayColor="rgba(255,255,255,0.15)"
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: isShuffle ? themeColor : 'transparent',
                  justifyContent: 'center', alignItems: 'center'
                }}
              >
                <Ionicons name="shuffle" size={22} color="#fff" />
              </BounceButton>
            </View>

            {/* 2. ループ */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <BounceButton
                onPress={toggleLoopMode}
                underlayColor="rgba(255,255,255,0.15)"
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: loopMode !== 'OFF' ? themeColor : 'transparent',
                  justifyContent: 'center', alignItems: 'center'
                }}
              >
                <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={22} color="#fff" />
                  {loopMode === 'ONE' && (
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', position: 'absolute', top: 2, right: 2 }}>1</Text>
                  )}
                </View>
              </BounceButton>
            </View>

            {/* 3. ★ AirPlay (ジェスチャーの妨害がないため、OS純正の機能として確実に動作する) */}
            {Platform.OS === 'ios' && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                  {/* バックグラウンドの見せかけアイコン */}
                  <MaterialIcons name="airplay" size={22} color="#fff" style={{ position: 'absolute' }} />
                  
                  {/* 本物のネイティブボタン */}
                  {AirPlayNativeButton && (
                    <View style={{ position: 'absolute', width: 44, height: 44, zIndex: 10, justifyContent: 'center', alignItems: 'center' }}>
                      <AirPlayNativeButton style={{ width: 44, height: 44, opacity: 0.1 }} />
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* 4. 歌詞 */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <BounceButton
                onPress={toggleLyrics}
                underlayColor="rgba(255,255,255,0.15)"
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: showLyrics ? themeColor : 'transparent',
                  justifyContent: 'center', alignItems: 'center'
                }}
              >
                <Ionicons name="musical-notes-outline" size={24} color="#fff" />
              </BounceButton>
            </View>

            {/* 5. キュー */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <BounceButton
                onPress={toggleQueue}
                underlayColor="rgba(255,255,255,0.15)"
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: showQueue ? themeColor : 'transparent',
                  justifyContent: 'center', alignItems: 'center'
                }}
              >
                <Ionicons name="list" size={24} color="#fff" />
              </BounceButton>
            </View>

          </View>
        </View>

      </View>
    );
  }

  const containerStyle = isIphoneLandscape
    ? { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' as const }
    : styles.fullPlayerContainer;

  const contentStyle = isIphoneLandscape
    ? { 
        flex: 1, 
        paddingLeft: Math.max(insets.left, 16), 
        paddingRight: Math.max(insets.right, 16), 
        paddingTop: Math.max(insets.top, 12), 
        paddingBottom: Math.max(insets.bottom, 16) 
      }
    : styles.fullPlayerContent;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.fullPlayerOverlay}>
        <Animated.View
          style={[containerStyle, { transform: [{ translateY: slideAnim }] }]}
        >
          <Image
            source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : null}
            style={StyleSheet.absoluteFill}
            blurRadius={60}
            pointerEvents="none"
          />

          <BlurView intensity={80} tint="dark" style={contentStyle}>
            {handleBar}
            {contentLayout}
          </BlurView>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
};