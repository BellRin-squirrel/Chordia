import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, TouchableHighlight, Animated, ScrollView, FlatList, StyleSheet, useWindowDimensions, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { styles } from '../styles/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';

const DEFAULT_ICON = require('../assets/images/icon.png');

// 押し込み弾性スプリング効果付きのボタンラッパー
const BounceButton = ({ children, onPress, style, underlayColor, activeOpacity }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    // ★ 修正1: ユーザー指示に合わせ、ボタンを押した瞬間「24%縮小（0.76倍）」に戻します
    // ★ 修正2: アニメーションの効果速度を2倍（従来の10から「20」に変更し、軽快な反応に最適化）
    Animated.spring(scale, {
      toValue: 0.76, 
      useNativeDriver: true,
      speed: 20,     // 2倍のスピード（効果時間1/2）
      bounciness: 2,
    }).start();
  };

  const handlePressOut = () => {
    // 復帰スピードも2倍速（スピードを20に設定）で小気味よくバウンド復帰
    Animated.spring(scale, {
      toValue: 1.0, 
      useNativeDriver: true,
      speed: 20,     // 2倍のスピード
      bounciness: 2,
    }).start();
  };

  // スタイルのフラット展開 (トグルの片側角丸、全体の丸み、背景色の自動マッピング)
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

const MarqueeText = ({ text, style, containerWidth }: { text: string, style: any, containerWidth: number }) => {
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

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: scrollAnim }] }}>
        <Text style={style} onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)} numberOfLines={1}>{text}</Text>
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
  const maxDyRef = useRef(0);

  const [isScrollAtTop, setIsScrollAtTop] = useState(true);
  
  const isIphone = Platform.OS === 'ios' && !Platform.isPad;
  const isIpad = Platform.OS === 'ios' && Platform.isPad;
  const isIphoneLandscape = isLandscape && isIphone;
  const isIpadPortrait = isIpad && !isLandscape; 

  let btnScale = 1.0;
  if (isIphoneLandscape) {
    btnScale = 1.7;
  } else if (isIpad) {
    btnScale = 1.2;
  }

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

  // アニメーションの補間
  const mainOpacity = transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const subViewOpacity = transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const mainTranslateX = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const subViewTranslateX = transitionAnim.interpolate({ inputRange: [0, 1], outputRange:[30, 0] });

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: slideAnim } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { state, translationY, velocityY } = event.nativeEvent;

    if (state === State.END || state === State.CANCELLED) {
      console.log(`[Gesture End] translationY: ${translationY}, velocityY: ${velocityY}`);
      if (translationY > 120 || velocityY > 500) {
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

  const renderQueueToggles = (marginBottom: number = 15) => (
    <View style={[styles.queueTogglesWrapper, { marginBottom }]}>
      <BounceButton
        onPress={toggleShuffleMode}
        style={[styles.toggleBtnSplit, styles.toggleLeft, { backgroundColor: isShuffle ? themeColor : 'rgba(255,255,255,0.1)' }]}
        underlayColor="rgba(255,255,255,0.25)"
      >
        <Ionicons name="shuffle" size={24} color="#fff" />
      </BounceButton>
      <View style={styles.toggleDivider} />
      <BounceButton
        onPress={toggleLoopMode}
        style={[styles.toggleBtnSplit, styles.toggleRight, { backgroundColor: loopMode !== 'OFF' ? themeColor : 'rgba(255,255,255,0.1)' }]}
        underlayColor="rgba(255,255,255,0.25)"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={24} color="#fff" />
          {loopMode === 'ONE' && <Text style={styles.oneBadgeInline}>1</Text>}
        </View>
      </BounceButton>
    </View>
  );

  const renderInlineToggles = () => {
    if (isIpadPortrait) return null;
    const toggleSize = 48; 
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, width: '100%' }}>
        <BounceButton
          onPress={toggleShuffleMode}
          underlayColor="rgba(255,255,255,0.15)"
          style={{
            width: toggleSize, height: toggleSize, borderRadius: toggleSize / 2,
            backgroundColor: isShuffle ? themeColor : 'transparent',
            justifyContent: 'center', alignItems: 'center', marginHorizontal: 15
          }}
        >
          <Ionicons name="shuffle" size={22} color="#fff" />
        </BounceButton>
        <BounceButton
          onPress={toggleLoopMode}
          underlayColor="rgba(255,255,255,0.15)"
          style={{
            width: toggleSize, height: toggleSize, borderRadius: toggleSize / 2,
            backgroundColor: loopMode !== 'OFF' ? themeColor : 'transparent',
            justifyContent: 'center', alignItems: 'center', marginHorizontal: 15
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={22} color="#fff" />
            {loopMode === 'ONE' && (
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', position: 'absolute', top: 5, right: 5 }}>1</Text>
            )}
          </View>
        </BounceButton>
      </View>
    );
  };

  const renderIpadPortraitControls = () => {
    const baseSize = 80 * 1.2; 
    const iconScale = 1.2;
    const mainSize = baseSize;       
    const sideSize = baseSize * 0.75; 
    const toggleSize = baseSize * 0.6; 

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 40, marginTop: 25 }}>
        <BounceButton
          onPress={toggleShuffleMode}
          underlayColor="rgba(255,255,255,0.15)"
          style={{
            width: toggleSize, height: toggleSize, borderRadius: toggleSize / 2,
            backgroundColor: isShuffle ? themeColor : 'transparent',
            justifyContent: 'center', alignItems: 'center'
          }}
        >
          <Ionicons name="shuffle" size={24 * iconScale} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={handlePrev}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: sideSize, height: sideSize, borderRadius: sideSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="play-skip-back" size={28 * iconScale} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={togglePlayPause}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: mainSize, height: mainSize, borderRadius: mainSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={45 * iconScale} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={handleNext}
          underlayColor="rgba(255,255,255,0.15)"
          style={{ width: sideSize, height: sideSize, borderRadius: sideSize / 2, justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="play-skip-forward" size={28 * iconScale} color="#fff" />
        </BounceButton>

        <BounceButton
          onPress={toggleLoopMode}
          underlayColor="rgba(255,255,255,0.15)"
          style={{
            width: toggleSize, height: toggleSize, borderRadius: toggleSize / 2,
            backgroundColor: loopMode !== 'OFF' ? themeColor : 'transparent',
            justifyContent: 'center', alignItems: 'center'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={24 * iconScale} color="#fff" />
            {loopMode === 'ONE' && (
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', position: 'absolute', top: 6, right: 6 }}>1</Text>
            )}
          </View>
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
            style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons name="musical-notes-outline" size={28} color={showLyrics ? themeColor : "rgba(255,255,255,0.6)"} />
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

        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 30 }} />

        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: mainOpacity, transform: [{ translateX: mainTranslateX }] }]} pointerEvents={showLyrics ? 'none' : 'auto'}>
            {renderQueueToggles()}
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
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: subViewOpacity, transform: [{ translateX: subViewTranslateX }] }]} pointerEvents={showLyrics ? 'auto' : 'none'}>
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
    const artSizeBig = Math.min(width * 0.8, height * 0.4);
    const artSizeSmall = 60;
    const artSizeAnim = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [artSizeBig, artSizeSmall] });
    const artRadiusAnim = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 8] });

    contentLayout = (
      <View style={{ flex: 1 }}>
        <View
          style={[styles.fullHeaderContainer, { justifyContent: (showQueue || showLyrics) ? 'flex-start' : 'center' }]}
        >
          <Animated.Image
            source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
            style={[styles.fullArtBase, {
              width: artSizeAnim,
              height: artSizeAnim,
              borderRadius: artRadiusAnim,
            }]}
          />
          {(showQueue || showLyrics) && (
            <Animated.View style={[styles.sideTitleArea, { opacity: transitionAnim }]}>
              <Text style={styles.queueTitle} numberOfLines={1}>{currentSong?.title}</Text>
              <Text style={[styles.queueArtist, { color: '#aaa', fontSize: 14, marginTop: 2 }]} numberOfLines={1}>{currentSong?.artist}</Text>
            </Animated.View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: mainOpacity, transform: [{ translateX: mainTranslateX }] }]} pointerEvents={(showLyrics || showQueue) ? 'none' : 'auto'}>
            <View style={styles.mainPlaybackLayout}>
              {/* アーティスト名とシークバーの間隔を最適化 */}
              <View style={{ width: '100%', alignItems: 'center' }}>
                <View style={styles.mainTitlesCenter}>
                  <Text style={styles.fullTitle} numberOfLines={1}>{currentSong?.title}</Text>
                  <Text style={[styles.fullArtist, { marginBottom: 16 }]} numberOfLines={1}>{currentSong?.artist}</Text>
                </View>

                <View style={styles.sliderWithTime}>
                  <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
                  <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
                </View>
              </View>

              <View style={{ width: '100%' }}>
                {isIpadPortrait ? renderIpadPortraitControls() : (
                  <>
                    {renderControls(80, { width: '100%', justifyContent: 'space-around' })}
                    {renderInlineToggles()}
                  </>
                )}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: subViewOpacity, transform: [{ translateX: subViewTranslateX }] }]} pointerEvents={(showLyrics || showQueue) ? 'auto' : 'none'}>
            <View style={[styles.queueViewArea, { paddingHorizontal: 20 }]}>
              {showLyrics ? (
                currentSong?.lyric?.trim() ? (
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
                )
              ) : (
                <>
                  {renderQueueToggles()}
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
                    )} />
                </>
              )}
            </View>
          </Animated.View>
        </View>

        <View style={styles.bottomButtonsRow}>
          <View style={styles.bottomButtonContainer}>
            <BounceButton
              onPress={toggleLyrics}
              underlayColor="rgba(255,255,255,0.15)"
              style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="musical-notes-outline" size={26} color={showLyrics ? themeColor : "rgba(255,255,255,0.6)"} />
            </BounceButton>
          </View>
          <View style={styles.bottomButtonContainer}>
            <BounceButton
              onPress={toggleQueue}
              underlayColor="rgba(255,255,255,0.15)"
              style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="list" size={26} color={showQueue ? themeColor : "rgba(255,255,255,0.6)"} />
            </BounceButton>
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
        <PanGestureHandler
          activeOffsetY={[-500, 15]}
          failOffsetX={[-15, 15]}
          enabled={!isLandscape ? (!showLyrics && !showQueue ? true : isScrollAtTop) : false}
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
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
              {toastVisible && (
                <Animated.View style={[styles.toastContainer, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                  <BlurView intensity={50} tint="dark" style={styles.toastBlur}><Text style={styles.toastText}>{toastMessage}</Text></BlurView>
                </Animated.View>
              )}
            </BlurView>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </GestureHandlerRootView>
  );
};