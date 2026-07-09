import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { styles, TAB_BAR_HEIGHT } from '../styles/styles';

const INDICATOR_MARGIN = 6;

export const TabBar = ({ activeTab, setActiveTab, themeColor, isDark, isBlurBackground, showFocusTab }: any) => {
  const tabIndicatorAnim = useRef(new Animated.Value(1)).current;
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const tabs = [
    { key: 'SYNC', label: '同期', icon: 'cloud-download' },
    { key: 'PLAYER', label: '再生', icon: 'play-circle' },
    ...(showFocusTab ? [{ key: 'FOCUS', label: '作業', icon: 'timer' }] : []),
    { key: 'SETTINGS', label: '設定', icon: 'options' },
    { key: 'LICENSE', label: '情報', icon: 'information-circle' }
  ];

  const tabCount = tabs.length;

  useEffect(() => {
    const index = tabs.findIndex(t => t.key === activeTab);
    if (index !== -1) {
        Animated.spring(tabIndicatorAnim, { toValue: index, useNativeDriver: true, bounciness: 8 }).start();
    }
  }, [activeTab, showFocusTab]);

  const onLayout = (event: any) => {
    setContainerLayout({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height
    });
  };

  const tabWidth = containerLayout.width / tabCount;
  const indicatorWidth = tabWidth > 0 ? tabWidth - (INDICATOR_MARGIN * 2) : 0;
  const indicatorHeight = TAB_BAR_HEIGHT - (INDICATOR_MARGIN * 2);

  const tabHeight = containerLayout.height / tabCount;
  const indicatorHeightLandscape = tabHeight > 0 ? tabHeight - (INDICATOR_MARGIN * 2) : 0;
  const indicatorWidthLandscape = 70 - (INDICATOR_MARGIN * 2);

  return (
    <BlurView 
      intensity={60} 
      tint={isDark ? 'dark' : 'light'} 
      style={[
          isLandscape ? styles.tabBarContainerLandscape : styles.tabBarContainer, 
          { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
          isBlurBackground && { shadowOpacity: 0, elevation: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
      ]}
      onLayout={onLayout}
    >
      {(containerLayout.width > 0 && containerLayout.height > 0) && (
          <Animated.View 
              style={{ 
                  position: 'absolute',
                  top: INDICATOR_MARGIN,
                  left: INDICATOR_MARGIN,
                  width: isLandscape ? indicatorWidthLandscape : indicatorWidth,
                  height: isLandscape ? indicatorHeightLandscape : indicatorHeight,
                  backgroundColor: themeColor, 
                  borderRadius: (isLandscape ? indicatorWidthLandscape : indicatorHeight) / 2, 
                  transform: [
                      isLandscape 
                      ? { translateY: tabIndicatorAnim.interpolate({ 
                          inputRange: tabs.map((_, i) => i), 
                          outputRange: tabs.map((_, i) => tabHeight * i) 
                        }) }
                      : { translateX: tabIndicatorAnim.interpolate({ 
                          inputRange: tabs.map((_, i) => i), 
                          outputRange: tabs.map((_, i) => tabWidth * i) 
                        }) }
                  ] 
              }} 
          />
      )}
      {tabs.map((tab) => (
        <TouchableOpacity key={tab.key} style={isLandscape ? styles.tabItemLandscape : styles.tabItem} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
          <Ionicons name={tab.icon as any} size={20} color={activeTab === tab.key ? '#fff' : '#8e8e93'} />
          <Text style={[isLandscape ? styles.tabTextLandscape : styles.tabText, {color: activeTab === tab.key ? '#fff' : '#8e8e93', fontSize: 10}]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </BlurView>
  );
};