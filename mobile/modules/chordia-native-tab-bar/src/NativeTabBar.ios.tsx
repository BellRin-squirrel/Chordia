import { requireNativeView } from 'expo';
import type { ColorValue, NativeSyntheticEvent, ViewProps } from 'react-native';

export type NativeTab = {
  key: string;
  title: string;
  icon: string;
  selectedIcon: string;
};

type NativeTabSelectedEvent = NativeSyntheticEvent<{ key: string }>;

export type NativeTabBarProps = ViewProps & {
  tabs: NativeTab[];
  selectedKey: string;
  tintColor: ColorValue;
  unselectedTintColor: ColorValue;
  onTabSelected: (event: NativeTabSelectedEvent) => void;
};

export default requireNativeView<NativeTabBarProps>('ChordiaNativeTabBar', 'NativeTabBar');
