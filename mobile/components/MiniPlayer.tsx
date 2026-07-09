import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { styles } from '../styles/styles';

const DEFAULT_ICON = require('../assets/images/icon.png');

export const MiniPlayer = ({ currentSong, isPlaying, dynamicStyles, onPress, togglePlayPause, handleNext }: any) => {
  return (
    <TouchableOpacity style={styles.miniPlayerCard} onPress={onPress} activeOpacity={0.9}>
      <BlurView intensity={90} tint={dynamicStyles.blur} style={styles.miniPlayerBlur}>
        <Image source={currentSong.localImageUri ? {uri: currentSong.localImageUri} : DEFAULT_ICON} style={styles.miniArt} />
        <View style={styles.miniInfo}>
          <Text style={[styles.miniTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={[styles.miniArtist, {color: dynamicStyles.text, opacity: 0.6}]} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <View style={styles.miniControls}>
          <TouchableOpacity onPress={togglePlayPause} style={styles.miniBtn}><Ionicons name={isPlaying ? "pause" : "play"} size={28} color={dynamicStyles.text} /></TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={styles.miniBtn}><Ionicons name="play-forward" size={24} color={dynamicStyles.text} /></TouchableOpacity>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};