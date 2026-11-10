import React from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type GlassActionButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  isDark: boolean;
  disabled?: boolean;
  glassTintColor?: ColorValue;
};

export const GlassActionButton = ({
  children,
  onPress,
  style,
  contentStyle,
  isDark,
  disabled,
  glassTintColor,
}: GlassActionButtonProps) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  return (
    <TouchableOpacity
      style={[style, useLiquidGlass && { backgroundColor: 'transparent', overflow: 'hidden' }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {useLiquidGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={isDark ? 'dark' : 'light'}
          tintColor={glassTintColor}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[{ alignItems: 'center', justifyContent: 'center' }, contentStyle]}>
        {children}
      </View>
    </TouchableOpacity>
  );
};
