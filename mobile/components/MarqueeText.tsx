import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Animated, Easing, StyleSheet, StyleProp, TextStyle, ViewStyle, AppState } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  speed?: number;
  delay?: number;
  spacing?: number;
  align?: 'left' | 'center' | 'right';
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  style,
  containerStyle,
  speed = 30,
  delay = 2000,
  spacing = 40,
  align = 'left'
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  // ★ バックグラウンド移行時は無限ループアニメーションを完全停止（Watchdog によるプロセス終了を防止）
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setIsAppActive(next === 'active');
    });
    return () => sub.remove();
  }, []);

  const isOverflow = containerWidth > 0 && textWidth > containerWidth + 2;

  useEffect(() => {
    scrollAnim.setValue(0);

    // アプリがバックグラウンドにいる間はアニメーションループを開始しない
    if (!isAppActive || !isOverflow || textWidth <= 0) return;

    const totalDistance = textWidth + spacing;
    const duration = (totalDistance / speed) * 1000;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(scrollAnim, {
          toValue: -totalDistance,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scrollAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isAppActive, isOverflow, textWidth, containerWidth, text, speed, delay, spacing]);

  if (!text) return null;

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const measureStyle: TextStyle = {
    ...flattenedStyle,
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    width: undefined,
    minWidth: undefined,
    maxWidth: undefined,
    margin: 0,
    marginLeft: 0,
    marginRight: 0,
    marginHorizontal: 0,
    padding: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingHorizontal: 0,
  };

  return (
    <View 
      style={[{ overflow: 'hidden', width: '100%', minWidth: 0, justifyContent: 'center' }, containerStyle]} 
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
    >
      <View 
        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: 10000, flexDirection: 'row', flexWrap: 'nowrap' }} 
        pointerEvents="none"
      >
        <Text 
          style={measureStyle} 
          numberOfLines={1}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w > 0) setTextWidth(w);
          }}
        >
          {text}
        </Text>
      </View>

      <Animated.View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          flexWrap: 'nowrap',
          alignSelf: isOverflow 
            ? 'flex-start' 
            : (align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start')),
          transform: [{ translateX: scrollAnim }] 
        }}
      >
        <Text 
          style={[
            style, 
            { flexShrink: 0 },
            isOverflow && { width: textWidth }
          ]} 
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {text}
        </Text>
        
        {isOverflow && (
          <Text 
            style={[
              style, 
              { marginLeft: spacing, flexShrink: 0, width: textWidth }
            ]} 
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            {text}
          </Text>
        )}
      </Animated.View>
    </View>
  );
};