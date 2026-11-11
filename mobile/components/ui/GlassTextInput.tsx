import React from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  type ColorValue,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type GlassTextInputProps = Omit<TextInputProps, 'style'> & {
  isDark: boolean;
  backgroundColor: ColorValue;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const GlassTextInput = ({
  isDark,
  backgroundColor,
  containerStyle,
  inputStyle,
  ...textInputProps
}: GlassTextInputProps) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: useLiquidGlass ? 'transparent' : backgroundColor,
          overflow: 'hidden',
        },
      ]}
    >
      {useLiquidGlass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          isInteractive
          colorScheme={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      )}
      <TextInput
        {...textInputProps}
        style={[
          {
            flex: 1,
            width: '100%',
            backgroundColor: 'transparent',
            borderWidth: 0,
          },
          inputStyle,
        ]}
      />
    </View>
  );
};
