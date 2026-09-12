import { requireNativeModule } from 'expo-modules-core';

let NativeModule: any = null;
try {
  NativeModule = requireNativeModule('ChordiaEqualizer');
} catch (e) {
  // ネイティブビルド前や開発環境でもアプリをクラッシュさせない安全設計
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

export default {
  initEqualizer,
  setEqualizerEnabled,
  setEqualizerBands,
  applyEqualizerSettings,
};