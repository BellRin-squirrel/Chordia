import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

let NativeModule: any = null;
try {
  NativeModule = requireNativeModule('ChordiaEqualizer');
} catch (e) {
  NativeModule = null;
}

export interface EqualizerApplyPayload {
  enabled: boolean;
  preamp: number;
  gains: number[];
}

export const initEqualizer = async (audioSessionId: number = 0): Promise<boolean> => {
  if (!NativeModule?.initEqualizer) return false;
  try {
    return await NativeModule.initEqualizer(audioSessionId);
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

// --- iOS ネイティブEQプレイヤー用ブリッジ関数 ---
export const loadAndPlayIOS = (filePath: string, startSeconds: number, autoPlay: boolean = true): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.loadAndPlay) return false;
  try {
    return NativeModule.loadAndPlay(filePath, startSeconds, autoPlay);
  } catch (e) {
    return false;
  }
};

export const pauseIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.pause) return false;
  try {
    return NativeModule.pause();
  } catch (e) {
    return false;
  }
};

export const playIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.play) return false;
  try {
    return NativeModule.play();
  } catch (e) {
    return false;
  }
};

export const stopIOS = (): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.stop) return false;
  try {
    return NativeModule.stop();
  } catch (e) {
    return false;
  }
};

export const seekToIOS = (seconds: number): boolean => {
  if (Platform.OS !== 'ios' || !NativeModule?.seekTo) return false;
  try {
    return NativeModule.seekTo(seconds);
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
  loadAndPlayIOS,
  pauseIOS,
  playIOS,
  stopIOS,
  seekToIOS,
  getPositionIOS,
  getDurationIOS,
  isPlayingIOS,
};