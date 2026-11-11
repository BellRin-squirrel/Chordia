import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeAudioLoudness } from './equalizer';

const getCacheKey = (uri: string) => {
  let hash = 2166136261;
  for (let index = 0; index < uri.length; index++) {
    hash ^= uri.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `chordia_sound_check_gain_${(hash >>> 0).toString(16)}`;
};

export const getSoundCheckGain = async (uri: string): Promise<number> => {
  const key = getCacheKey(uri);
  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    const value = JSON.parse(cached);
    if (value.uri === uri && typeof value.gainDb === 'number' && Number.isFinite(value.gainDb)) {
      return value.gainDb;
    }
  }

  const gainDb = await analyzeAudioLoudness(uri);
  await AsyncStorage.setItem(key, JSON.stringify({ uri, gainDb }));
  return gainDb;
};

export const gainDbToPlaybackVolume = (gainDb: number): number =>
  Math.max(0, Math.min(1, Math.pow(10, Math.min(0, gainDb) / 20)));
