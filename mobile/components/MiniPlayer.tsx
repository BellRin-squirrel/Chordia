import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { styles } from '../styles/styles';
import { MarqueeText } from './MarqueeText';

const DEFAULT_ICON = require('../assets/images/icon.png');

export const MiniPlayer = ({ currentSong, isPlaying, dynamicStyles, onPress, togglePlayPause, handleNext }: any) => {
  return (
    <TouchableOpacity style={styles.miniPlayerCard} onPress={onPress} activeOpacity={0.9}>
      <BlurView intensity={90} tint={dynamicStyles.blur} style={styles.miniPlayerBlur}>
        <Image source={currentSong.localImageUri ? {uri: currentSong.localImageUri} : DEFAULT_ICON} style={styles.miniArt} />
        
        {/* ★ miniInfo に flex: 1, minWidth: 0, overflow: 'hidden' を適用して幅を確実に固定 */}
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

        <View style={styles.miniControls}>
          <TouchableOpacity onPress={togglePlayPause} style={styles.miniBtn}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={28} color={dynamicStyles.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={styles.miniBtn}>
            <Ionicons name="play-forward" size={24} color={dynamicStyles.text} />
          </TouchableOpacity>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
};