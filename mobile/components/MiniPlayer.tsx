import React, { useRef } from 'react';
import { View, Image, TouchableOpacity, TouchableHighlight, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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

export const MiniPlayer = ({ currentSong, isPlaying, dynamicStyles, onPress, togglePlayPause, handleNext }: any) => {
  const isDark = dynamicStyles?.bg === '#000000';

  return (
    <TouchableOpacity style={styles.miniPlayerCard} onPress={onPress} activeOpacity={0.9}>
      <BlurView intensity={90} tint={dynamicStyles.blur} style={styles.miniPlayerBlur}>
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
      </BlurView>
    </TouchableOpacity>
  );
};