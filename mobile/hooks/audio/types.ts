import { Platform } from 'react-native';
import { State as RNTPState } from 'react-native-track-player';

export interface PlayCollectionContext {
  type: 'PLAYLIST' | 'ALBUM' | 'ARTIST';
  playlistID: string;
  playlistName: string;
}

export type AudioEngineType = 'expo-av' | 'rntp';
export type LoopModeType = 'OFF' | 'ALL' | 'ONE';

// Android / RNTP の戻り値（オブジェクトまたは文字列/enum）を安全に判定
export const isStatePlaying = (stateValOrObj: any): boolean => {
  if (stateValOrObj === undefined || stateValOrObj === null) return false;
  const s = (typeof stateValOrObj === 'object' && stateValOrObj !== null)
    ? (stateValOrObj.state ?? stateValOrObj)
    : stateValOrObj;
  return s === RNTPState.Playing || s === 'playing';
};

// Android の expo-audio (ExoPlayer) で FileNotFoundException を防ぐパス解決
export const resolveExpoAudioSource = (rawUri: string): any => {
  if (!rawUri) return '';
  if (rawUri.startsWith('http://') || rawUri.startsWith('https://')) {
    return { uri: rawUri };
  }
  if (Platform.OS === 'android') {
    return rawUri.replace(/^file:\/+/i, '/');
  }
  return { uri: rawUri };
};