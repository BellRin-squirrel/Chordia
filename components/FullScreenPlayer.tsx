import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, ScrollView, FlatList, StyleSheet, PanResponder, useWindowDimensions, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Slider from '@react-native-community/slider';
import { styles } from '../styles/styles';

const DEFAULT_ICON = require('../assets/images/icon.png');

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

  const transitionAnim = useRef(new Animated.Value(0)).current;
  const scrollYRef = useRef(0);
  const maxDyRef = useRef(0);

  // ★ シークバー領域の絶対座標を保持（ジェスチャ判定時にこの領域を除外）
  const sliderRectRef = useRef<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const sliderWrapRef = useRef<View>(null);

  // ★ 歌詞/キュースクロール領域の絶対座標を保持
  const subScrollRectRef = useRef<{ top: number; bottom: number; left: number; right: number } | null>(null);
  const subScrollWrapRef = useRef<View>(null);

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
    maxDyRef.current = 0;
    // レイアウト切替時に位置を再計測
    setTimeout(() => {
      sliderWrapRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          sliderRectRef.current = { top: y - 12, bottom: y + h + 12, left: x, right: x + w };
        }
      });
      subScrollWrapRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          subScrollRectRef.current = { top: y, bottom: y + h, left: x, right: x + w };
        }
      });
    }, 350);
  }, [showLyrics, showQueue, isLandscape, width, height]);

  const measureSlider = () => {
    requestAnimationFrame(() => {
      sliderWrapRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          sliderRectRef.current = { top: y - 12, bottom: y + h + 12, left: x, right: x + w };
        }
      });
    });
  };

  const measureSubScroll = () => {
    requestAnimationFrame(() => {
      subScrollWrapRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          subScrollRectRef.current = { top: y, bottom: y + h, left: x, right: x + w };
        }
      });
    });
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: (evt, g) => {
      const { pageX, pageY } = evt.nativeEvent;
      const isDownward = g.dy > 6;
      const isVertical = Math.abs(g.dy) > Math.abs(g.dx) * 1.3;

      if (!isDownward || !isVertical) return false;

      // タッチ開始時の絶対座標（pageY/X からジェスチャ移動量を逆算）
      const startY = pageY - g.dy;
      const startX = pageX - g.dx;

      // 1. シークバー領域は常に除外
      const sliderR = sliderRectRef.current;
      if (sliderR &&
          startY >= sliderR.top && startY <= sliderR.bottom &&
          startX >= sliderR.left && startX <= sliderR.right) {
        return false;
      }

      // 2. 歌詞/キュー表示中: スクロール領域内のタッチは、
      //    スクロール位置が最上部のときのみジェスチャ受付。それ以外はスクロール優先で除外。
      if (showLyrics || showQueue) {
        const subR = subScrollRectRef.current;
        if (subR &&
            startY >= subR.top && startY <= subR.bottom &&
            startX >= subR.left && startX <= subR.right) {
          if (scrollYRef.current > 0) return false;
        }
        return true;
      }

      // 3. メイン再生画面: シークバー以外の全域で下スワイプ受付
      return true;
    },

    onMoveShouldSetPanResponder: () => false,

    onPanResponderGrant: () => {},
    onPanResponderMove: (_, g) => {
      maxDyRef.current = Math.max(maxDyRef.current, g.dy);
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (maxDyRef.current > 120 || g.vy > 0.5) {
        closeFullPlayer();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      }
      maxDyRef.current = 0;
    },
    onPanResponderTerminate: () => {
      maxDyRef.current = 0;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => false,
  })).current;

  const formatMillis = (ms: number | undefined) => { if (!ms) return "0:00"; const totalSec = Math.floor(ms / 1000); const min = Math.floor(totalSec / 60); const sec = totalSec % 60; return `${min}:${sec < 10 ? '0' : ''}${sec}`; };

  const toggleLyrics = () => {
    if (showQueue) setShowQueue(false);
    setShowLyrics(!showLyrics);
  };

  const toggleQueue = () => {
    if (showLyrics) setShowLyrics(false);
    setShowQueue(!showQueue);
  };

  const renderControls = (iconSize: number, customStyle?: any) => (
    <View style={[styles.fullControls, customStyle]}>
      <TouchableOpacity onPress={handlePrev}><Ionicons name="play-skip-back" size={35} color="#fff" /></TouchableOpacity>
      <TouchableOpacity onPress={togglePlayPause}><Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={iconSize} color="#fff" /></TouchableOpacity>
      <TouchableOpacity onPress={handleNext}><Ionicons name="play-skip-forward" size={35} color="#fff" /></TouchableOpacity>
    </View>
  );

  const renderQueueToggles = (marginBottom: number = 15) => (
    <View style={[styles.queueTogglesWrapper, { marginBottom }]}>
      <TouchableOpacity style={[styles.toggleBtnSplit, styles.toggleLeft, { backgroundColor: isShuffle ? themeColor : 'rgba(255,255,255,0.1)' }]} onPress={toggleShuffleMode}><Ionicons name="shuffle" size={24} color="#fff" /></TouchableOpacity>
      <View style={styles.toggleDivider} />
      <TouchableOpacity style={[styles.toggleBtnSplit, styles.toggleRight, { backgroundColor: loopMode !== 'OFF' ? themeColor : 'rgba(255,255,255,0.1)' }]} onPress={toggleLoopMode}><Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={24} color="#fff" />{loopMode === 'ONE' && <Text style={styles.oneBadgeInline}>1</Text>}</TouchableOpacity>
    </View>
  );

  // ★ メイン画面下部用のコンパクトなシャッフル/ループ
  const renderInlineToggles = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, width: '100%' }}>
      <TouchableOpacity
        onPress={toggleShuffleMode}
        style={{
          width: 56, height: 40, borderRadius: 20,
          backgroundColor: isShuffle ? themeColor : 'rgba(255,255,255,0.12)',
          justifyContent: 'center', alignItems: 'center', marginHorizontal: 10
        }}
      >
        <Ionicons name="shuffle" size={22} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={toggleLoopMode}
        style={{
          width: 56, height: 40, borderRadius: 20,
          backgroundColor: loopMode !== 'OFF' ? themeColor : 'rgba(255,255,255,0.12)',
          justifyContent: 'center', alignItems: 'center', marginHorizontal: 10,
          flexDirection: 'row'
        }}
      >
        <Ionicons name={loopMode === 'ONE' ? "repeat-outline" : "repeat"} size={22} color="#fff" />
        {loopMode === 'ONE' && (
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 3 }}>1</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const mainOpacity = transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const subViewOpacity = transitionAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const mainTranslateX = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const subViewTranslateX = transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  let contentLayout;
  if (isLandscape) {
    // ★ iPad横画面: 左カラムを「アート上 / タイトル・アーティスト下」の縦並びに変更
    const leftColumnWidth = (width / 2.2) - 50;
    const landscapeArtSize = Math.min(leftColumnWidth * 0.75, height * 0.45);

    contentLayout = (
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity onPress={toggleLyrics}>
            <Ionicons name="musical-notes-outline" size={28} color={showLyrics ? themeColor : "rgba(255,255,255,0.6)"} />
          </TouchableOpacity>
        </View>
        <View style={{ width: leftColumnWidth, padding: 15, justifyContent: 'center', alignItems: 'center' }}>
          {/* ★ カバーアート(上) */}
          <Image
            source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON}
            style={{ width: landscapeArtSize, height: landscapeArtSize, borderRadius: 16, marginBottom: 20 }}
          />
          {/* ★ タイトル/アーティスト(下) */}
          <View style={{ width: '100%', alignItems: 'center', marginBottom: 20 }}>
            <MarqueeText text={currentSong?.title} style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }} containerWidth={leftColumnWidth - 30} />
            <View style={{ height: 6 }} />
            <MarqueeText text={currentSong?.artist} style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15 }} containerWidth={leftColumnWidth - 30} />
          </View>
          {/* シークバー & コントロール */}
          <View style={{ width: '100%' }}>
            <View ref={sliderWrapRef} onLayout={measureSlider} style={styles.sliderWithTime}>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
              <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
            </View>
            {renderControls(70, { width: '100%', marginTop: 20, justifyContent: 'space-around' })}
          </View>
        </View>
        <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 30 }} />
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: mainOpacity, transform: [{ translateX: mainTranslateX }] }]} pointerEvents={showLyrics ? 'none' : 'auto'}>
            {renderQueueToggles()}
            <View ref={showLyrics ? null : subScrollWrapRef} onLayout={showLyrics ? undefined : measureSubScroll} style={{ flex: 1 }}>
              <FlatList
                data={playQueue}
                keyExtractor={(item, index) => 'queue-h-' + index}
                onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <View style={styles.songRowQueue}>
                    <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArtQueue} />
                    <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: 'bold' }} numberOfLines={1}>{item.title}</Text><Text style={{ color: '#aaa' }} numberOfLines={1}>{item.artist}</Text></View>
                  </View>
                )} />
            </View>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { padding: 20, opacity: subViewOpacity, transform: [{ translateX: subViewTranslateX }] }]} pointerEvents={showLyrics ? 'auto' : 'none'}>
            {currentSong?.lyric?.trim() ? (
              <View ref={showLyrics ? subScrollWrapRef : null} onLayout={showLyrics ? measureSubScroll : undefined} style={{ flex: 1 }}>
                <ScrollView
                  style={styles.lyricsScrollView}
                  contentContainerStyle={{ paddingBottom: 30 }}
                  onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
                  scrollEventThrottle={16}
                >
                  <Text style={styles.lyricsText}>{currentSong?.lyric}</Text>
                </ScrollView>
              </View>
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
    // ★ 縦画面: カバーアートサイズを画面高さでも制限（iPad縦で下部見切れ対策）
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
              <View style={styles.mainTitlesCenter}>
                <Text style={styles.fullTitle} numberOfLines={1}>{currentSong?.title}</Text>
                <Text style={styles.fullArtist} numberOfLines={1}>{currentSong?.artist}</Text>
              </View>
              {/* ★ シークバー領域をrefで計測（ジェスチャ除外用） */}
              <View ref={sliderWrapRef} onLayout={measureSlider} style={styles.sliderWithTime}>
                <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={playbackStatus?.durationMillis || 100} value={playbackStatus?.positionMillis || 0} minimumTrackTintColor={themeColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor="#fff" onSlidingComplete={v => sound?.setPositionAsync(v)} />
                <View style={styles.timeRow}><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.positionMillis)}</Text><Text style={styles.timeLabel}>{formatMillis(playbackStatus?.durationMillis)}</Text></View>
              </View>
              {renderControls(80, { width: '100%', justifyContent: 'space-around' })}
              {/* ★ 再生コントロール下にシャッフル/ループを追加（縦画面のみ） */}
              {renderInlineToggles()}
            </View>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { opacity: subViewOpacity, transform: [{ translateX: subViewTranslateX }] }]} pointerEvents={(showLyrics || showQueue) ? 'auto' : 'none'}>
            <View style={[styles.queueViewArea, { paddingHorizontal: 20 }]}>
              {showLyrics ? (
                currentSong?.lyric?.trim() ? (
                  <View ref={subScrollWrapRef} onLayout={measureSubScroll} style={{ flex: 1 }}>
                    <ScrollView
                      style={styles.lyricsScrollView}
                      contentContainerStyle={{ paddingBottom: 30 }}
                      onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
                      scrollEventThrottle={16}
                    >
                      <Text style={styles.lyricsText}>{currentSong?.lyric}</Text>
                    </ScrollView>
                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[styles.lyricsText, { opacity: 0.5, textAlign: 'center' }]}>歌詞が登録されていません</Text>
                  </View>
                )
              ) : (
                <>
                  {renderQueueToggles()}
                  <View ref={subScrollWrapRef} onLayout={measureSubScroll} style={{ flex: 1 }}>
                    <FlatList
                      data={playQueue}
                      keyExtractor={(item, index) => 'queue-v-' + index}
                      onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
                      scrollEventThrottle={16}
                      renderItem={({ item }) => (
                        <View style={styles.songRowQueue}>
                          <Image source={item.localImageUri ? { uri: item.localImageUri } : DEFAULT_ICON} style={styles.smallArtQueue} />
                          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: 'bold' }} numberOfLines={1}>{item.title}</Text><Text style={{ color: '#aaa' }} numberOfLines={1}>{item.artist}</Text></View>
                        </View>
                      )} />
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        </View>

        <View style={styles.bottomButtonsRow}>
          <View style={styles.bottomButtonContainer}><TouchableOpacity onPress={toggleLyrics}><Ionicons name="musical-notes-outline" size={26} color={showLyrics ? themeColor : "rgba(255,255,255,0.6)"} /></TouchableOpacity></View>
          <View style={styles.bottomButtonContainer}><TouchableOpacity onPress={toggleQueue}><Ionicons name="list" size={26} color={showQueue ? themeColor : "rgba(255,255,255,0.6)"} /></TouchableOpacity></View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullPlayerOverlay}>
      <Animated.View
        style={[styles.fullPlayerContainer, { transform: [{ translateY: slideAnim }] }]}
        {...panResponder.panHandlers}
      >
        <Image
          source={currentSong?.localImageUri ? { uri: currentSong.localImageUri } : null}
          style={StyleSheet.absoluteFill}
          blurRadius={60}
          pointerEvents="none"
        />

        <BlurView intensity={80} tint="dark" style={styles.fullPlayerContent}>
          <View style={styles.swipeArea}>
            <View style={styles.fullPlayerHandle} />
          </View>
          {contentLayout}
          {toastVisible && (
            <Animated.View style={[styles.toastContainer, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
              <BlurView intensity={50} tint="dark" style={styles.toastBlur}><Text style={styles.toastText}>{toastMessage}</Text></BlurView>
            </Animated.View>
          )}
        </BlurView>
      </Animated.View>
    </View>
  );
};
