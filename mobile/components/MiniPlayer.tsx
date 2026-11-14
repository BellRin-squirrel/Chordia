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

export const MiniPlayer = ({ 
  currentSong, isPlaying, dynamicStyles, onPress, onLongPress, 
  togglePlayPause, handleNext, menuTargetY = 140, isHidden = false 
}: any) => {
  const isDark = dynamicStyles?.bg === '#000000';
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const playerRef = useRef<ViewInstance>(null);

  const isLongPressedRef = useRef(false);
  const initialLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const chargeScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isHidden) return;
    isLongPressedRef.current = false;
    chargeScale.stopAnimation();
    chargeScale.setValue(1);

    playerRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (measuredWidth > 0 && measuredHeight > 0) {
        initialLayoutRef.current = { x, y, width: measuredWidth, height: measuredHeight };
      }
    });

    Animated.timing(chargeScale, {
      toValue: 1.04,
      duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (!isLongPressedRef.current) {
      Animated.timing(chargeScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  };

  const handleLongPress = () => {
    if (isHidden) return;
    isLongPressedRef.current = true;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const triggerOpen = (x: number, y: number, w: number, h: number) => {
      onLongPress?.({ x, y, width: w, height: h });
      chargeScale.setValue(1);
    };

    const layout = initialLayoutRef.current;
    if (layout) {
      triggerOpen(layout.x, layout.y, layout.width, layout.height);
    } else {
      playerRef.current?.measureInWindow((x, y, w, h) => {
        triggerOpen(x, y, w, h);
      });
    }
  };

  return (
    <Animated.View 
      style={{
        opacity: isHidden ? 0 : 1,
        transform: [{ scale: chargeScale }],
      }} 
      ref={playerRef} 
      pointerEvents={isHidden ? 'none' : 'auto'}
    >
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
