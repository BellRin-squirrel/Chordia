export interface StagedSong {
  id: string;
  sourceUri: string;
  originalFileName: string;
  title: string;
  artist: string;
  album: string;
  coverUri: string | null;
}

// アプリ起動中のみメモリ上に保持され、タブ移動しても保持・アプリ終了でリセット
export let activeSyncModeMemory: 'LAN' | 'WAN' | 'LOCAL' = 'LAN';
export let wanUrlInputMemory: string = '';
export let stagedSongsMemory: StagedSong[] = [];

export const setActiveSyncModeMemory = (mode: 'LAN' | 'WAN' | 'LOCAL') => {
  activeSyncModeMemory = mode;
};

export const setWanUrlInputMemory = (url: string) => {
  wanUrlInputMemory = url;
};

export const setStagedSongsMemory = (songs: StagedSong[]) => {
  stagedSongsMemory = songs;
};