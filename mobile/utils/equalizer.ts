import { NativeModules, Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// ★ TrackPlayer と同じ React Native 標準の NativeModules から優先取得
let NativeModule: any = NativeModules.ChordiaEqualizer || NativeModules.chordia_equalizer;

if (!NativeModule) {
  try {
    NativeModule = requireNativeModule('ChordiaEqualizer');
  } catch (e1) {
    try {
      NativeModule = requireNativeModule('chordia-equalizer');
    } catch (e2) {}
  }
}

export interface EqualizerApplyPayload {
  enabled: boolean;
  preamp: number;
  gains: number[];
}

export const initEqualizer = async (audioSessionId: number = 0): Promise<boolean> => {
  if (!NativeModule?.initEqualizer) return false;
  try {
    const res = await NativeModule.initEqualizer(audioSessionId);
    return res !== false;
  } catch (e) {
    return false;
  }
};

export const setEqualizerEnabled = (enabled: boolean): void => {
  if (!NativeModule?.setEnabled) return;
  try {
    NativeModule.setEnabled(enabled);
  } catch (e) {}
};

export const setEqualizerBands = (gains: number[], preamp: number = 0): void => {
  if (!NativeModule?.setBands) return;
  try {
    NativeModule.setBands(gains, preamp);
  } catch (e) {}
};

export const applyEqualizerSettings = (payload: EqualizerApplyPayload): void => {
  if (!NativeModule) return;
  try {
    if (NativeModule.applySettings) {
      NativeModule.applySettings(payload.enabled, payload.preamp, payload.gains);
    } else {
      NativeModule.setEnabled?.(payload.enabled);
      NativeModule.setBands?.(payload.gains, payload.preamp);
    }
  } catch (e) {}
};

export const getEqualizerDebugInfo = (): any => {
  const registeredNativeModules = Object.keys(NativeModules || {});

  if (!NativeModule) {
    return {
      isNativeConnected: false,
      platform: Platform.OS,
      searchRoute: 'NativeModules & ExpoModules',
      availableNativeModulesInApp: registeredNativeModules,
      note: 'ChordiaEqualizer was not found in NativeModules or ExpoModules',
    };
  }

  try {
    const info = NativeModule.getDebugInfo ? NativeModule.getDebugInfo() : {};
    return {
      isNativeConnected: true,
      platform: Platform.OS,
      ...info,
      availableNativeModulesInApp: registeredNativeModules,
    };
  } catch (e: any) {
    return {
      isNativeConnected: true,
      platform: Platform.OS,
      errorCallingDebug: e?.message || String(e),
      availableNativeModulesInApp: registeredNativeModules,
    };
  }
};

export const loadAndPlayIOS = (filePath: string, startSeconds: number, autoPlay: boolean = true): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.loadAndPlay) return false;
  try {
    NativeModule.loadAndPlay(filePath, startSeconds, autoPlay);
    return true;
  } catch (e) {
    return false;
  }
};

export const pauseIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.pause) return false;
  try {
    NativeModule.pause();
    return true;
  } catch (e) {
    return false;
  }
};

export const playIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.play) return false;
  try {
    NativeModule.play();
    return true;
  } catch (e) {
    return false;
  }
};

export const stopIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.stop) return false;
  try {
    NativeModule.stop();
    return true;
  } catch (e) {
    return false;
  }
};

export const seekToIOS = (seconds: number): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.seekTo) return false;
  try {
    NativeModule.seekTo(seconds);
    return true;
  } catch (e) {
    return false;
  }
};

export const getPositionIOS = (): number => {
  if (Platform.OS !== 'ios' || !NativeModule?.getPosition) return 0;
  try {
    return NativeModule.getPosition();
  } catch (e) {
    return 0;
  }
};

export const getDurationIOS = (): number => {
  if (Platform.OS !== 'ios' || !NativeModule?.getDuration) return 0;
  try {
    return NativeModule.getDuration();
  } catch (e) {
    return 0;
  }
};

export const isPlayingIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.isPlaying) return false;
  try {
    return NativeModule.isPlaying();
  } catch (e) {
    return false;
  }
};

export default {
  initEqualizer,
  setEqualizerEnabled,
  setEqualizerBands,
  applyEqualizerSettings,
  getEqualizerDebugInfo,
  loadAndPlayIOS,
  pauseIOS,
  playIOS,
  stopIOS,
  seekToIOS,
  getPositionIOS,
  getDurationIOS,
  isPlayingIOS,
};