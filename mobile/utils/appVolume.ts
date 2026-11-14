import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_VOLUME_STORAGE_KEY = 'chordia_app_volume_multiplier_setting';

export type VolumeMultiplierType = 'NORMAL' | 'BOOST' | 'ATTENUATE';

export interface VolumeMultiplierSetting {
  type: VolumeMultiplierType;
  value: number; // 整数 (例: BOOSTなら 2 = 2倍、ATTENUATEなら 2 = 1/2倍)
  multiplier: number; // 実効倍率 (例: 1.0, 2.0, 0.5)
}

export const DEFAULT_VOLUME_SETTING: VolumeMultiplierSetting = {
  type: 'NORMAL',
  value: 1,
  multiplier: 1.0,
};

type VolumeChangeListener = (setting: VolumeMultiplierSetting) => void;
const volumeListeners: VolumeChangeListener[] = [];

export const addAppVolumeChangeListener = (fn: VolumeChangeListener) => {
  volumeListeners.push(fn);
  return () => {
    const idx = volumeListeners.indexOf(fn);
    if (idx !== -1) volumeListeners.splice(idx, 1);
  };
};

export const notifyAppVolumeChange = (setting: VolumeMultiplierSetting) => {
  volumeListeners.forEach((fn) => {
    try { fn(setting); } catch (e) {}
  });
};

export const getAppVolumeSetting = async (): Promise<VolumeMultiplierSetting> => {
  try {
    const raw = await AsyncStorage.getItem(APP_VOLUME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.multiplier === 'number' && Number.isFinite(parsed.multiplier)) {
        return parsed;
      }
    }
  } catch (e) {}
  return DEFAULT_VOLUME_SETTING;
};

export const saveAppVolumeSetting = async (setting: VolumeMultiplierSetting): Promise<void> => {
  try {
    await AsyncStorage.setItem(APP_VOLUME_STORAGE_KEY, JSON.stringify(setting));
  } catch (e) {}
  notifyAppVolumeChange(setting);
};