import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { styles, TAB_BAR_HEIGHT, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { t } from '../utils/i18n';

const INDICATOR_MARGIN = 6;

export const TabBar = ({ activeTab, setActiveTab, themeColor, themeTextColor, isDark, isBlurBackground, showFocusTab, showSyncTab, language = 'ja' }: any) => {
  const tabIndicatorAnim = useRef(new Animated.Value(1)).current;
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const textColor = themeTextColor || '#ffffff';

  const tabs = [
    ...(showSyncTab !== false ? [{ key: 'SYNC', label: t('tab_sync', language), icon: 'cloud-download' }] : []),
    { key: 'PLAYER', label: t('tab_player', language), icon: 'play-circle' },
    ...(showFocusTab ? [{ key: 'FOCUS', label: t('tab_focus', language), icon: 'timer' }] : []),
    { key: 'INFO', label: t('tab_info', language), icon: 'information-circle' }
  ];

  const tabCount = tabs.length;

  useEffect(() => {
    const index = tabs.findIndex(t => t.key === activeTab);
    if (index !== -1) {
        Animated.spring(tabIndicatorAnim, { toValue: index, useNativeDriver: true, bounciness: 8 }).start();
    }
  }, [activeTab, showFocusTab, showSyncTab, language]);

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
  const indicatorWidthLandscape = LANDSCAPE_TAB_BAR_WIDTH - (INDICATOR_MARGIN * 2);

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
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={isLandscape ? styles.tabItemLandscape : styles.tabItem} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
            <Ionicons name={tab.icon as any} size={20} color={isActive ? textColor : '#8e8e93'} />
            <Text style={[isLandscape ? styles.tabTextLandscape : styles.tabText, { color: isActive ? textColor : '#8e8e93', fontSize: 10 }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
};