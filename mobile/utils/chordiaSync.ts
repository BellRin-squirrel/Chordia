import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import DeviceInfo from 'react-native-device-info';
import { HTTP_X_ACCESS_KEY, CHORDIA_SYNC_API_URL, APP_VERSION } from '../constants/config';
import { LanguageCode, t } from './i18n';
import { getPlaylistSongs } from './playlistEvaluator';

export const ACCOUNT_STORAGE_KEY = 'chordia_sync_account';
const PENDING_PLAY_HISTORY_KEY = 'chordia_pending_play_history';
const PENDING_WORK_HISTORY_KEY = 'chordia_pending_work_history';

export type DeletePeriod = '1day' | '1week' | '1month' | '1year' | 'all';

export interface RegisterAuthResponse { success: boolean; sid?: string; error?: string; }
export interface CheckAuthStatusResponse { success: boolean; status?: 'authenticated' | 'unauthenticated' | 'expired'; error?: string; }
export interface LogoutResponse { success: boolean; error?: string; }
export interface RegisterMusicItem { title: string; artist: string; album: string; lyric: string; }
export interface RegisterMusicListResponse { success: boolean; error?: string; }
export interface RegisterPlaylistResponse { success: boolean; error?: string; }
export interface PlayHistoryItem { title: string; artist: string; album: string; device?: string; date?: string; }
export interface LoadPlayHistoryResponse { success: boolean; history?: PlayHistoryItem[]; error?: string; }
export interface WorkHistoryItem { end: string; time: string; device?: string; }
export interface LoadWorkHistoryResponse { success: boolean; history?: WorkHistoryItem[]; error?: string; }
export interface DeleteHistoryResponse { success: boolean; error?: string; }

export const getDeviceModelName = (): string => {
  let modelName = Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
  try {
    const expoModel = Device.modelName;
    const rnModel = DeviceInfo.getModel();
    if (rnModel && !rnModel.includes(',')) modelName = rnModel;
    else if (expoModel && !expoModel.includes(',')) modelName = expoModel;
    else if (rnModel) modelName = rnModel;
  } catch (e) {}
  return modelName;
};

export const getDeviceOsInfo = (): string => {
  return Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`;
};

const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs: number = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('通信がタイムアウトしました。インターネット接続を確認してください。');
    throw new Error('インターネットに接続できません。ネットワーク設定を確認してください。');
  }
};

export const generateAuthCode = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
};

export const parseSyncDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date(0);
  if (dateStr.includes('T') || dateStr.includes('-')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  const parts = dateStr.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 5) return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  return new Date(0);
};

export const getCutoffDate = (period: DeletePeriod): Date => {
  if (period === 'all') return new Date(8640000000000000);
  const now = new Date();
  switch (period) {
    case '1day': now.setDate(now.getDate() - 1); break;
    case '1week': now.setDate(now.getDate() - 7); break;
    case '1month': now.setMonth(now.getMonth() - 1); break;
    case '1year': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now;
};

export const parseDurationToSeconds = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  return parseInt(timeStr, 10) || 0;
};

export const formatWorkSessionEndTime = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d}.${h}.${min}`;
};

export const formatWorkDuration = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export const registerAuthCodeApi = async (username: string, device: string, code: string, model?: string): Promise<RegisterAuthResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'registerAuthenticationCode', code, username: username.trim(), device: device.trim(), model: (model || getDeviceModelName()).trim(), OS: getDeviceOsInfo(), chordiaV: `Chordia Mobile ${APP_VERSION}` }),
    }, 10000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    if (data.sid) return { success: true, sid: String(data.sid) };
    return { success: false, error: '有効なセッションIDが取得できませんでした' };
  } catch (e: any) { return { success: false, error: e?.message || 'インターネット接続を確認してください' }; }
};

export const checkAuthStatusApi = async (sid: string, name: string, device: string): Promise<CheckAuthStatusResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'checkAlreadyLogin', SID: sid, name: name.trim(), device: device.trim() }),
    }, 5000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    if (data.status) return { success: true, status: data.status };
    return { success: false, error: '認証ステータスを取得できませんでした' };
  } catch (e: any) { return { success: false, error: e?.message || '通信エラーが発生しました' }; }
};

export const verifyChordiaSyncSession = async (showWarning = true, language: LanguageCode = 'ja'): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return false;
    const account = JSON.parse(raw);
    if (!account?.sid || !account?.username) return false;

    const res = await checkAuthStatusApi(account.sid, account.username, account.deviceName || '');
    if (res.success && res.status === 'authenticated') return true;

    console.warn('[Chordia Sync] ❌ 認証が無効でした。認証情報を破棄します:', res);
    await AsyncStorage.removeItem(ACCOUNT_STORAGE_KEY);
    if (showWarning) Alert.alert(t('sync_auth_error_title', language), t('account_auth_invalid_warning', language));
    return false;
  } catch (e) { return false; }
};

export const logoutApi = async (sid: string, name: string, device: string): Promise<LogoutResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'logout', SID: sid, name: name.trim(), device: device.trim() }),
    }, 8000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) { return { success: false, error: e?.message || 'ログアウト通信に失敗しました' }; }
};

export const registerMusicListApi = async (sid: string, musicList: RegisterMusicItem[]): Promise<RegisterMusicListResponse> => {
  console.log(`[MusicList API] 📡 所有楽曲一覧を送信中... (全 ${musicList.length} 曲)`);
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'registerMusicList', SID: sid, musicList }),
    }, 20000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || '楽曲一覧の送信に失敗しました' };
  }
};

export const registerPlaylistApi = async (sid: string, playlist: any[]): Promise<RegisterPlaylistResponse> => {
  console.log(`[Playlist API] 📡 プレイリスト一覧を送信中... (全 ${playlist.length} 件)`);
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'registerPlaylist', SID: sid, playlist }),
    }, 20000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'プレイリストの送信に失敗しました' };
  }
};

export const syncMusicAndPlaylistsToCloud = async (): Promise<void> => {
  try {
    const rawAccount = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!rawAccount) return;
    const account = JSON.parse(rawAccount);
    if (!account?.sid) return;

    const sid = account.sid;
    let localLibraryList: any[] = [];
    const localLibraryRaw = await AsyncStorage.getItem('local_library');
    if (localLibraryRaw) {
      localLibraryList = JSON.parse(localLibraryRaw);
      const musicList: RegisterMusicItem[] = localLibraryList.map((s: any) => ({
        title: s.title || 'Untitled',
        artist: s.artist || 'Unknown Artist',
        album: s.album || 'Unknown Album',
        lyric: s.lyric || '',
      }));
      await registerMusicListApi(sid, musicList);
    }

    const localPlaylistsRaw = await AsyncStorage.getItem('local_playlists');
    if (localPlaylistsRaw) {
      const rawPlaylists: any[] = JSON.parse(localPlaylistsRaw);
      const formattedPlaylists: any[] = [];
      for (const pl of rawPlaylists) {
        if (!pl || pl.isAll || pl.id === 'all_songs') continue;
        if (pl.type === 'smart') {
          formattedPlaylists.push({
            id: pl.id,
            playlistName: pl.playlistName || 'Untitled Playlist',
            sortBy: pl.sortBy || 'title',
            sortDesc: !!pl.sortDesc,
            type: 'smart',
            conditions: pl.conditions || { type: 'group', match: 'all', items: [] },
          });
        } else {
          const matchedSongs = getPlaylistSongs(pl, localLibraryList);
          const musics = matchedSongs.map((s: any) => ({
            title: s.title || 'Untitled',
            artist: s.artist || 'Unknown Artist',
          }));
          formattedPlaylists.push({
            id: pl.id,
            playlistName: pl.playlistName || 'Untitled Playlist',
            sortBy: pl.sortBy || 'title',
            sortDesc: !!pl.sortDesc,
            type: 'normal',
            musics,
          });
        }
      }
      await registerPlaylistApi(sid, formattedPlaylists);
    }
  } catch (e) {
    console.warn('[Chordia Sync] 楽曲・プレイリスト同期エラー:', e);
  }
};

export const loadAllPlayHistoryApi = async (sid: string): Promise<LoadPlayHistoryResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'loadAllPlayHistory', SID: sid }),
    }, 10000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    if (Array.isArray(data.history)) return { success: true, history: data.history };
    return { success: true, history: [] };
  } catch (e: any) { return { success: false, error: e?.message || 'インターネット接続を確認してください' }; }
};

export const loadAllWorkHistoryApi = async (sid: string): Promise<LoadWorkHistoryResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'loadAllWorkHistory', SID: sid }),
    }, 10000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    if (Array.isArray(data.history)) return { success: true, history: data.history };
    return { success: true, history: [] };
  } catch (e: any) { return { success: false, error: e?.message || 'インターネット接続を確認してください' }; }
};

export const deletePlayHistorySingleApi = async (sid: string, item: PlayHistoryItem): Promise<DeleteHistoryResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'deletePlayHistory', SID: sid, title: item.title || '', artist: item.artist || '', album: item.album || '', device: item.device || '', date: item.date || '' }),
    }, 6000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) { return { success: false, error: e?.message || '削除通信に失敗しました' }; }
};

export const deletePlayHistoryBatchApi = async (sid: string, itemsToDelete: PlayHistoryItem[]): Promise<{ success: boolean; deletedCount: number }> => {
  let deletedCount = 0;
  for (let i = 0; i < itemsToDelete.length; i++) {
    const res = await deletePlayHistorySingleApi(sid, itemsToDelete[i]);
    if (res.success) deletedCount++;
  }
  return { success: deletedCount === itemsToDelete.length, deletedCount };
};

export const deleteWorkHistorySingleApi = async (sid: string, item: WorkHistoryItem): Promise<DeleteHistoryResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'deleteWorkHistory', SID: sid, time: item.time || '', end: item.end || '', device: item.device || '' }),
    }, 6000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) { return { success: false, error: e?.message || '削除通信に失敗しました' }; }
};

export const deleteWorkHistoryBatchApi = async (sid: string, itemsToDelete: WorkHistoryItem[]): Promise<{ success: boolean; deletedCount: number }> => {
  let deletedCount = 0;
  for (let i = 0; i < itemsToDelete.length; i++) {
    const res = await deleteWorkHistorySingleApi(sid, itemsToDelete[i]);
    if (res.success) deletedCount++;
  }
  return { success: deletedCount === itemsToDelete.length, deletedCount };
};

export const addPlayHistoryApi = async (sid: string, title: string, artist: string, album: string): Promise<void> => {
  const currentItem = { title: title || 'Untitled', artist: artist || 'Unknown', album: album || 'Unknown', sid };
  let queue: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(PENDING_PLAY_HISTORY_KEY);
    if (raw) queue = JSON.parse(raw);
  } catch (e) {}
  queue.push(currentItem);

  const remainingQueue: any[] = [];
  for (const item of queue) {
    try {
      const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
        body: JSON.stringify({ operation: 'addPlayHistory', SID: item.sid || sid, title: item.title, artist: item.artist, album: item.album }),
      }, 4000);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
    } catch (e) { remainingQueue.push(item); }
  }
  await AsyncStorage.setItem(PENDING_PLAY_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};

export const addWorkHistoryApi = async (sid: string, end: string, time: string): Promise<void> => {
  const currentItem = { end, time, sid };
  let queue: any[] = [];
  try {
    const raw = await AsyncStorage.getItem(PENDING_WORK_HISTORY_KEY);
    if (raw) queue = JSON.parse(raw);
  } catch (e) {}
  queue.push(currentItem);

  const remainingQueue: any[] = [];
  for (const item of queue) {
    try {
      const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
        body: JSON.stringify({ operation: 'addWorkHistory', SID: item.sid || sid, end: item.end, time: item.time }),
      }, 4000);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
    } catch (e) { remainingQueue.push(item); }
  }
  await AsyncStorage.setItem(PENDING_WORK_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};

/**
 * ★ ログイン時 / 再送信ボタン押下時に「作業履歴」「再生履歴」「所有楽曲一覧」「プレイリスト一覧」をサーバーへ一括送信
 * - onProgress コールバックにより、各ステップの進捗テキストをリアルタイムで通知
 */
export const syncInitialLocalHistory = async (
  sid: string, 
  onProgress?: (progressText: string) => void,
  language: LanguageCode = 'ja'
): Promise<void> => {
  console.log('[InitialSync] 🚀 既存ローカルデータのクラウド送信を開始します...');

  // 1. 作業セッション履歴
  try {
    const focusHistoryRaw = await AsyncStorage.getItem('chordia_focus_history');
    if (focusHistoryRaw) {
      const focusList: any[] = JSON.parse(focusHistoryRaw);
      for (let i = 0; i < focusList.length; i++) {
        const item = focusList[i];
        if (onProgress) {
          const msg = t('account_sync_step_work', language)
            .replace('{current}', String(i + 1))
            .replace('{total}', String(focusList.length));
          onProgress(`[1/4] ${msg}`);
        }
        if (item.duration && item.duration > 0) {
          const end = formatWorkSessionEndTime(item.date ? new Date(item.date) : new Date());
          const time = formatWorkDuration(item.duration);
          await addWorkHistoryApi(sid, end, time);
        }
      }
    }
  } catch (e) {}

  // 2. 楽曲再生履歴
  try {
    const playHistoryRaw = await AsyncStorage.getItem('chordia_playback_history');
    if (playHistoryRaw) {
      const playList: any[] = JSON.parse(playHistoryRaw);
      for (let i = 0; i < playList.length; i++) {
        const item = playList[i];
        if (onProgress) {
          const msg = t('account_sync_step_play', language)
            .replace('{current}', String(i + 1))
            .replace('{total}', String(playList.length));
          onProgress(`[2/4] ${msg}`);
        }
        if (item.title || item.artist) {
          await addPlayHistoryApi(sid, item.title || 'Untitled', item.artist || 'Unknown Artist', item.album || 'Unknown Album');
        }
      }
    }
  } catch (e) {}

  // 3. 所有楽曲一覧
  let localLibraryList: any[] = [];
  try {
    const localLibraryRaw = await AsyncStorage.getItem('local_library');
    if (localLibraryRaw) {
      localLibraryList = JSON.parse(localLibraryRaw);
      if (onProgress) {
        const msg = t('account_sync_step_music', language).replace('{count}', String(localLibraryList.length));
        onProgress(`[3/4] ${msg}`);
      }
      const musicList: RegisterMusicItem[] = localLibraryList.map((s: any) => ({
        title: s.title || 'Untitled',
        artist: s.artist || 'Unknown Artist',
        album: s.album || 'Unknown Album',
        lyric: s.lyric || '',
      }));
      await registerMusicListApi(sid, musicList);
    }
  } catch (e) {}

  // 4. プレイリスト一覧
  try {
    const localPlaylistsRaw = await AsyncStorage.getItem('local_playlists');
    if (localPlaylistsRaw) {
      const rawPlaylists: any[] = JSON.parse(localPlaylistsRaw);
      const formattedPlaylists: any[] = [];

      for (const pl of rawPlaylists) {
        if (!pl || pl.isAll || pl.id === 'all_songs') continue;
        if (pl.type === 'smart') {
          formattedPlaylists.push({
            id: pl.id,
            playlistName: pl.playlistName || 'Untitled Playlist',
            sortBy: pl.sortBy || 'title',
            sortDesc: !!pl.sortDesc,
            type: 'smart',
            conditions: pl.conditions || { type: 'group', match: 'all', items: [] },
          });
        } else {
          const matchedSongs = getPlaylistSongs(pl, localLibraryList);
          const musics = matchedSongs.map((s: any) => ({
            title: s.title || 'Untitled',
            artist: s.artist || 'Unknown Artist',
          }));
          formattedPlaylists.push({
            id: pl.id,
            playlistName: pl.playlistName || 'Untitled Playlist',
            sortBy: pl.sortBy || 'title',
            sortDesc: !!pl.sortDesc,
            type: 'normal',
            musics,
          });
        }
      }

      if (onProgress) {
        const msg = t('account_sync_step_playlist', language).replace('{count}', String(formattedPlaylists.length));
        onProgress(`[4/4] ${msg}`);
      }

      if (formattedPlaylists.length > 0) {
        await registerPlaylistApi(sid, formattedPlaylists);
      }
    }
  } catch (e) {}

  console.log('[InitialSync] ✅ 既存ローカルデータのクラウド送信処理が完了しました');
};