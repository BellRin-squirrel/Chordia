import React, { useRef } from 'react';
import { View, Image, TouchableOpacity, TouchableHighlight, Animated, Easing, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import type { ViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { styles } from '../styles/styles';
import { MarqueeText } from './MarqueeText';

const DEFAULT_ICON = require('../assets/images/icon.png');

const BounceMiniButton = ({ children, onPress, isDark }: any) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.72,
      useNativeDriver: true,
      speed: 24,
      bounciness: 2,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 2,
    }).start();
  };

  const handlePress = (e: any) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPress?.(e);
  };

  return (
    <Animated.View style={{ transform: [{ scale }], backgroundColor: 'transparent' }}>
      <TouchableHighlight
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        underlayColor={isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)"}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
        }}
        activeOpacity={0.8}
      >
        {children}
      </TouchableHighlight>
    </Animated.View>
  );
};

export const MiniPlayer = ({ currentSong, isPlaying, dynamicStyles, onPress, onLongPress, togglePlayPause, handleNext, menuTargetY = 140, isHidden = false }: any) => {
  const isDark = dynamicStyles?.bg === '#000000';
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const { width } = useWindowDimensions();
  const playerRef = useRef<ViewInstance>(null);

  const pressActiveRef = useRef(false);
  const isLongPressedRef = useRef(false);
  const initialLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  const longPressTranslateX = useRef(new Animated.Value(0)).current;
  const longPressTranslateY = useRef(new Animated.Value(0)).current;
  const longPressScaleX = useRef(new Animated.Value(1)).current;
  const longPressScaleY = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isHidden) return;
    pressActiveRef.current = true;
    isLongPressedRef.current = false;
    longPressTranslateX.stopAnimation();
    longPressTranslateY.stopAnimation();
    longPressScaleX.stopAnimation();
    longPressScaleY.stopAnimation();
    longPressTranslateX.setValue(0);
    longPressTranslateY.setValue(0);
    longPressScaleX.setValue(1);
    longPressScaleY.setValue(1);

    playerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth > 0 && measuredHeight > 0) {
        initialLayoutRef.current = { x, y, width: measuredWidth, height: measuredHeight };
      }
    });

    Animated.parallel([
      Animated.timing(longPressScaleX, {
        toValue: 1.04,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(longPressScaleY, {
        toValue: 1.04,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    pressActiveRef.current = false;
    if (!isLongPressedRef.current) {
      Animated.parallel([
        Animated.timing(longPressScaleX, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(longPressScaleY, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(longPressTranslateX, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(longPressTranslateY, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  };

  const handleLongPress = () => {
    if (isHidden) return;
    isLongPressedRef.current = true;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const executeMorphMove = (x: number, y: number, measuredWidth: number, measuredHeight: number) => {
      const targetCardWidth = width - 24;
      const targetCardHeight = 68;

      const targetX = width / 2 - (x + measuredWidth / 2);
      const targetY = menuTargetY - (y + measuredHeight / 2);

      const targetScaleXVal = targetCardWidth / Math.max(measuredWidth, 1);
      const targetScaleYVal = targetCardHeight / Math.max(measuredHeight, 1);

      const snapEasing = Easing.bezier(0.16, 1, 0.3, 1);

      Animated.parallel([
        Animated.timing(longPressTranslateX, {
          toValue: targetX,
          duration: 220,
          easing: snapEasing,
          useNativeDriver: true,
        }),
        Animated.timing(longPressTranslateY, {
          toValue: targetY,
          duration: 220,
          easing: snapEasing,
          useNativeDriver: true,
        }),
        Animated.timing(longPressScaleX, {
          toValue: targetScaleXVal,
          duration: 220,
          easing: snapEasing,
          useNativeDriver: true,
        }),
        Animated.timing(longPressScaleY, {
          toValue: targetScaleYVal,
          duration: 220,
          easing: snapEasing,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onLongPress?.({
          x: width / 2 - targetCardWidth / 2,
          y: menuTargetY - targetCardHeight / 2,
          width: targetCardWidth,
          height: targetCardHeight,
        });

        setTimeout(() => {
          longPressTranslateX.setValue(0);
          longPressTranslateY.setValue(0);
          longPressScaleX.setValue(1);
          longPressScaleY.setValue(1);
        }, 120);
      });
    };

    const layout = initialLayoutRef.current;
    if (layout) {
      executeMorphMove(layout.x, layout.y, layout.width, layout.height);
    } else {
      playerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        executeMorphMove(x, y, measuredWidth, measuredHeight);
      });
    }
  };

  return (
    <Animated.View style={{
      opacity: isHidden ? 0 : 1,
      transform: [
        { translateX: longPressTranslateX },
        { translateY: longPressTranslateY },
        { scaleX: longPressScaleX },
        { scaleY: longPressScaleY },
      ],
    }} ref={playerRef} pointerEvents={isHidden ? 'none' : 'auto'}>
      <TouchableOpacity
        style={styles.miniPlayerCard}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        delayLongPress={300}
        activeOpacity={0.9}
      >
      {useLiquidGlass ? (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <BlurView intensity={90} tint={dynamicStyles.blur} style={StyleSheet.absoluteFill} />
      )}
      <View style={styles.miniPlayerBlur}>
        <Image source={currentSong.localImageUri ? { uri: currentSong.localImageUri } : DEFAULT_ICON} style={styles.miniArt} />
        
        <View style={[styles.miniInfo, { flex: 1, minWidth: 0, overflow: 'hidden' }]}>
          <MarqueeText 
            text={currentSong.title} 
            style={[styles.miniTitle, { color: dynamicStyles.text }]} 
          />
          <MarqueeText 
            text={currentSong.artist} 
            style={[styles.miniArtist, { color: dynamicStyles.text, opacity: 0.6, marginTop: 2 }]} 
          />
        </View>

        <View style={[styles.miniControls, { gap: 4 }]}>
          <BounceMiniButton onPress={togglePlayPause} isDark={isDark}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={26} color={dynamicStyles.text} />
          </BounceMiniButton>
          <BounceMiniButton onPress={handleNext} isDark={isDark}>
            <Ionicons name="play-forward" size={22} color={dynamicStyles.text} />
          </BounceMiniButton>
        </View>
      </View>
      </TouchableOpacity>
    </Animated.View>
  );
};