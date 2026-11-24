import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import DeviceInfo from 'react-native-device-info';
import { HTTP_X_ACCESS_KEY, CHORDIA_SYNC_API_URL, APP_VERSION } from '../constants/config';
import { LanguageCode, t } from './i18n';
import { getPlaylistSongs } from './playlistEvaluator';

export const ACCOUNT_STORAGE_KEY = 'chordia_sync_account';
export const OFFLINE_API_QUEUE_KEY = 'chordia_offline_api_queue';
export const LOCAL_FOCUS_HISTORY_KEY = 'chordia_focus_history';
export const LOCAL_PLAYBACK_HISTORY_KEY = 'chordia_playback_history';

export type DeletePeriod = '1day' | '1week' | '1month' | '1year' | 'all';

export interface QueuedApiRequest {
  id: string;
  timestamp: number;
  operation: string;
  payload: any;
}

export interface RegisterAuthResponse { success: boolean; sid?: string; error?: string; }
export interface CheckAuthStatusResponse { 
  success: boolean; 
  status?: 'authenticated' | 'unauthenticated' | 'expired'; 
  error?: string; 
  networkError?: boolean; 
}
export interface LogoutResponse { success: boolean; error?: string; }
export interface RegisterMusicItem { title: string; artist: string; album: string; lyric: string; }
export interface RegisterMusicListResponse { success: boolean; error?: string; }
export interface RegisterPlaylistResponse { success: boolean; error?: string; }
export interface PlayHistoryItem { title: string; artist: string; album: string; device?: string; date?: string; }
export interface LoadPlayHistoryResponse { success: boolean; history?: PlayHistoryItem[]; error?: string; }
export interface WorkHistoryItem { end: string; time: string; device?: string; }
export interface LoadWorkHistoryResponse { success: boolean; history?: WorkHistoryItem[]; error?: string; }
export interface DeleteHistoryResponse { success: boolean; error?: string; }

export interface RelayNowPlaying {
  playlistID?: string;
  playlistName?: string;
  shuffle?: boolean;
  loop?: boolean;
  musiclist?: any[];
  nowPlayingTitle?: string;
  nowPlayingArtist?: string;
  nowPlayingAlbum?: string;
  nowPlayingTime?: number;
}

export interface RelayDeviceItem {
  name: string;
  nowPlaying: RelayNowPlaying;
}

export interface GetNowPlayingResponse {
  success: boolean;
  response?: RelayDeviceItem[];
  error?: string;
}

type ToastListener = (message: string) => void;
let globalToastListener: ToastListener | null = null;
let lastToastTime = 0;
let currentLanguage: LanguageCode = 'ja';

export const registerToastListener = (listener: ToastListener, language: LanguageCode = 'ja') => {
  globalToastListener = listener;
  currentLanguage = language;
};

export const triggerNoInternetToast = (language: LanguageCode = 'ja') => {
  const now = Date.now();
  if (now - lastToastTime > 3000) {
    lastToastTime = now;
    if (globalToastListener) {
      globalToastListener(t('toast_no_internet', language));
    }
  }
};

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

const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs: number = 7000, showToastOnError: boolean = true): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (showToastOnError) {
      triggerNoInternetToast(currentLanguage);
    }
    if (e.name === 'AbortError') throw new Error('通信がタイムアウトしました。');
    throw new Error('ネットワーク接続を確認してください。');
  }
};

// =========================================================================
// ★ ストレージ・通信の排他ミューテックス（並行実行・二重送信の防止）
// =========================================================================
let storageMutexChain: Promise<any> = Promise.resolve();
const runWithStorageLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = storageMutexChain.then(fn, fn);
  storageMutexChain = run.catch(() => {});
  return run;
};

let syncMutexChain: Promise<any> = Promise.resolve();
let activeAutoFlushPromise: Promise<void> | null = null;
let autoFlushRerunRequested = false;
let isManualResyncRunning = false;
const inFlightRecordIds = new Set<string>();
const completedRecordIds = new Set<string>();

const runWithSyncLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = syncMutexChain.then(fn, fn);
  syncMutexChain = run.catch(() => {});
  return run;
};

const isInternetAvailable = async (): Promise<boolean> => {
  try {
    const netState = await Network.getNetworkStateAsync();
    return !!(netState.isConnected && netState.isInternetReachable !== false);
  } catch (e) {
    return false;
  }
};

const getLoggedInAccount = async (): Promise<{ sid: string; username?: string; deviceName?: string } | null> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.sid) return parsed;
    return null;
  } catch (e) {
    return null;
  }
};

const ensureItemIdsInStorage = async (key: string, idPrefix: string): Promise<any[]> => {
  return runWithStorageLock(async () => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    let modified = false;
    const normalized = parsed.map((item: any, idx: number) => {
      if (item && typeof item === 'object' && item.id) return item;
      modified = true;
      return { ...(item || {}), id: `${idPrefix}_${Date.now()}_${idx}_${Math.random()}` };
    });

    if (modified) {
      await AsyncStorage.setItem(key, JSON.stringify(normalized));
    }
    return normalized;
  });
};

const removeSingleSentItemFromStorage = async (key: string, targetId: string): Promise<void> => {
  if (!targetId) return;
  await runWithStorageLock(async () => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      await AsyncStorage.removeItem(key);
      return;
    }
    const remaining = parsed.filter((item: any) => String(item?.id) !== targetId);
    if (remaining.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(remaining));
    }
  });
};

const sendRawSyncOperation = async (operation: string, payload: any, timeoutMs: number = 7000): Promise<{ ok: boolean; serverRejected?: boolean; error?: string }> => {
  const response = await fetchWithTimeout(
    CHORDIA_SYNC_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({ operation, ...payload }),
    },
    timeoutMs,
    false
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    throw new Error('Empty response body');
  }

  const data = JSON.parse(rawText);
  if (data?.error) {
    return { ok: false, serverRejected: true, error: String(data.error) };
  }
  return { ok: true };
};

export const enqueueOfflineRequest = async (operation: string, payload: any): Promise<void> => {
  await runWithStorageLock(async () => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_API_QUEUE_KEY);
      const queue: QueuedApiRequest[] = raw ? JSON.parse(raw) : [];

      let filtered = Array.isArray(queue) ? queue : [];
      if (operation === 'registerMusicList' || operation === 'registerPlaylist') {
        filtered = filtered.filter((q) => q.operation !== operation);
      }

      filtered.push({
        id: `queue_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        operation,
        payload,
      });

      await AsyncStorage.setItem(OFFLINE_API_QUEUE_KEY, JSON.stringify(filtered.slice(-200)));
    } catch (e) {}
  });
};

const flushAllPendingSyncDataInternal = async (
  sid: string,
  options?: {
    onProgress?: (msg: string) => void;
    language?: LanguageCode;
    throwOnNetworkError?: boolean;
  }
): Promise<{ workSent: number; playSent: number; queueSent: number }> => {
  const language = options?.language || currentLanguage;
  const onProgress = options?.onProgress;
  let workSent = 0;
  let playSent = 0;
  let queueSent = 0;

  // 1. 一時保存された作業履歴 (chordia_focus_history)
  const focusItems = await ensureItemIdsInStorage(LOCAL_FOCUS_HISTORY_KEY, 'work');
  if (focusItems.length > 0) {
    for (let i = 0; i < focusItems.length; i++) {
      const item = focusItems[i];
      const itemId = String(item.id);
      if (inFlightRecordIds.has(itemId) || completedRecordIds.has(itemId)) {
        await removeSingleSentItemFromStorage(LOCAL_FOCUS_HISTORY_KEY, itemId);
        continue;
      }

      if (onProgress) {
        onProgress(`[1/4] ${t('account_sync_step_work', language).replace('{current}', String(i + 1)).replace('{total}', String(focusItems.length))}`);
      }

      if (item.duration && item.duration > 0) {
        inFlightRecordIds.add(itemId);
        const endStr = formatWorkSessionEndTime(item.date ? new Date(item.date) : new Date());
        const timeStr = formatWorkDuration(item.duration);
        try {
          const res = await sendRawSyncOperation('addWorkHistory', { SID: sid, end: endStr, time: timeStr }, 7000);
          if (!res.ok && res.serverRejected) {
            console.warn('[OfflineSync] Server rejected addWorkHistory:', res.error);
          }
          completedRecordIds.add(itemId);
          await removeSingleSentItemFromStorage(LOCAL_FOCUS_HISTORY_KEY, itemId);
          workSent++;
        } catch (err) {
          if (options?.throwOnNetworkError) throw err;
          return { workSent, playSent, queueSent };
        } finally {
          inFlightRecordIds.delete(itemId);
        }
      } else {
        await removeSingleSentItemFromStorage(LOCAL_FOCUS_HISTORY_KEY, itemId);
      }
    }
  }

  // 2. 一時保存された再生履歴 (chordia_playback_history)
  const playItems = await ensureItemIdsInStorage(LOCAL_PLAYBACK_HISTORY_KEY, 'play');
  if (playItems.length > 0) {
    for (let i = 0; i < playItems.length; i++) {
      const item = playItems[i];
      const itemId = String(item.id);
      if (inFlightRecordIds.has(itemId) || completedRecordIds.has(itemId)) {
        await removeSingleSentItemFromStorage(LOCAL_PLAYBACK_HISTORY_KEY, itemId);
        continue;
      }

      if (onProgress) {
        onProgress(`[2/4] ${t('account_sync_step_play', language).replace('{current}', String(i + 1)).replace('{total}', String(playItems.length))}`);
      }

      if (item.title || item.artist) {
        inFlightRecordIds.add(itemId);
        try {
          const res = await sendRawSyncOperation(
            'addPlayHistory',
            {
              SID: sid,
              title: item.title || 'Untitled',
              artist: item.artist || 'Unknown Artist',
              album: item.album || 'Unknown Album',
            },
            7000
          );
          if (!res.ok && res.serverRejected) {
            console.warn('[OfflineSync] Server rejected addPlayHistory:', res.error);
          }
          completedRecordIds.add(itemId);
          await removeSingleSentItemFromStorage(LOCAL_PLAYBACK_HISTORY_KEY, itemId);
          playSent++;
        } catch (err) {
          if (options?.throwOnNetworkError) throw err;
          return { workSent, playSent, queueSent };
        } finally {
          inFlightRecordIds.delete(itemId);
        }
      } else {
        await removeSingleSentItemFromStorage(LOCAL_PLAYBACK_HISTORY_KEY, itemId);
      }
    }
  }

  // 3. 汎用オフライン API キュー (chordia_offline_api_queue)
  const queueItems = await ensureItemIdsInStorage(OFFLINE_API_QUEUE_KEY, 'queue');
  if (queueItems.length > 0) {
    for (let i = 0; i < queueItems.length; i++) {
      const item: QueuedApiRequest = queueItems[i];
      const itemId = String(item.id);
      if (inFlightRecordIds.has(itemId) || completedRecordIds.has(itemId)) {
        await removeSingleSentItemFromStorage(OFFLINE_API_QUEUE_KEY, itemId);
        continue;
      }

      inFlightRecordIds.add(itemId);
      try {
        const payloadWithSid = { ...(item.payload || {}), SID: sid };
        const res = await sendRawSyncOperation(item.operation, payloadWithSid, 10000);
        if (!res.ok && res.serverRejected) {
          console.warn('[OfflineQueue] Server rejected request:', item.operation, res.error);
        }
        completedRecordIds.add(itemId);
        await removeSingleSentItemFromStorage(OFFLINE_API_QUEUE_KEY, itemId);
        queueSent++;
      } catch (err) {
        if (options?.throwOnNetworkError) throw err;
        return { workSent, playSent, queueSent };
      } finally {
        inFlightRecordIds.delete(itemId);
      }
    }
  }

  if (completedRecordIds.size > 1000) {
    completedRecordIds.clear();
  }

  return { workSent, playSent, queueSent };
};

export const processOfflineQueue = async (): Promise<void> => {
  if (isManualResyncRunning) {
    return;
  }
  if (activeAutoFlushPromise) {
    autoFlushRerunRequested = true;
    return activeAutoFlushPromise;
  }

  const runPromise = runWithSyncLock(async () => {
    if (isManualResyncRunning) return;

    do {
      autoFlushRerunRequested = false;

      const online = await isInternetAvailable();
      if (!online) return;

      const account = await getLoggedInAccount();
      if (!account?.sid) return;

      try {
        await flushAllPendingSyncDataInternal(account.sid, {
          language: currentLanguage,
          throwOnNetworkError: false,
        });
      } catch (e) {}

      if (autoFlushRerunRequested && !isManualResyncRunning) {
        const stillOnline = await isInternetAvailable();
        if (!stillOnline) break;
      }
    } while (autoFlushRerunRequested && !isManualResyncRunning);
  }).finally(() => {
    activeAutoFlushPromise = null;
  });

  activeAutoFlushPromise = runPromise;
  return runPromise;
};

export const recordPlayHistoryWithSync = async (song: {
  title?: string;
  artist?: string;
  album?: string;
  localMusicUri?: string;
  localImageUri?: string;
}): Promise<void> => {
  if (!song) return;

  const entryId = `play_${Date.now()}_${Math.random()}`;
  const newItem = {
    id: entryId,
    title: song.title || 'Untitled',
    artist: song.artist || 'Unknown Artist',
    album: song.album || 'Unknown Album',
    localMusicUri: song.localMusicUri,
    localImageUri: song.localImageUri,
    playedAt: new Date().toISOString(),
  };

  await runWithStorageLock(async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_PLAYBACK_HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = [newItem, ...(Array.isArray(list) ? list : [])].slice(0, 500);
      await AsyncStorage.setItem(LOCAL_PLAYBACK_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {}
  });

  const account = await getLoggedInAccount();
  if (!account?.sid) return;

  if (await isInternetAvailable()) {
    void processOfflineQueue();
  }
};

export const recordWorkHistoryEntriesWithSync = async (
  entries: { id?: string; date: string; duration: number }[]
): Promise<void> => {
  if (!entries || entries.length === 0) return;

  const normalizedEntries = entries.map((e, idx) => ({
    ...e,
    id: e.id || `work_${Date.now()}_${idx}_${Math.random()}`,
  }));

  await runWithStorageLock(async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_FOCUS_HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      const updated = [...normalizedEntries.slice().reverse(), ...(Array.isArray(history) ? history : [])].slice(0, 100);
      await AsyncStorage.setItem(LOCAL_FOCUS_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {}
  });

  const account = await getLoggedInAccount();
  if (!account?.sid) return;

  if (await isInternetAvailable()) {
    void processOfflineQueue();
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
  } catch (e: any) { 
    return { success: false, error: e?.message || 'インターネット接続を確認してください' }; 
  }
};

export const checkAuthStatusApi = async (sid: string, name: string, device: string): Promise<CheckAuthStatusResponse> => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
        body: JSON.stringify({ operation: 'checkAlreadyLogin', SID: sid, name: name.trim(), device: device.trim() }),
      }, 7000);
      const data = JSON.parse(await response.text());
      if (data.error) return { success: false, error: String(data.error), networkError: false };
      if (data.status) return { success: true, status: data.status };
      return { success: false, error: '認証ステータスを取得できませんでした', networkError: false };
    } catch (e: any) {
      if (attempts >= maxAttempts) {
        return { success: false, error: e?.message || '通信エラーが発生しました', networkError: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  return { success: false, error: '通信エラーが発生しました', networkError: true };
};

export const verifyChordiaSyncSession = async (showWarning = true, language: LanguageCode = 'ja'): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return false;
    const account = JSON.parse(raw);
    if (!account?.sid || !account?.username) return false;

    const res = await checkAuthStatusApi(account.sid, account.username, account.deviceName || '');

    if (res.success && res.status === 'authenticated') {
      void processOfflineQueue();
      return true;
    }

    if (res.networkError) {
      console.warn('[Chordia Sync] ⚠️ ネットワーク接続不可・遅延のためログインセッションを維持します。');
      return false;
    }

    console.warn('[Chordia Sync] ❌ サーバーにより認証が無効と判定されました。ログアウトします:', res);
    await AsyncStorage.removeItem(ACCOUNT_STORAGE_KEY);
    return false;
  } catch (e) {
    return false;
  }
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
  } catch (e: any) { 
    return { success: false, error: e?.message || 'ログアウト通信に失敗しました' }; 
  }
};

export const registerMusicListApi = async (sid: string, musicList: RegisterMusicItem[]): Promise<RegisterMusicListResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'registerMusicList', SID: sid, musicList }),
    }, 15000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) { 
    await enqueueOfflineRequest('registerMusicList', { SID: sid, musicList });
    return { success: false, error: e?.message || '楽曲一覧の送信に失敗しました' }; 
  }
};

export const registerPlaylistApi = async (sid: string, playlist: any[]): Promise<RegisterPlaylistResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'registerPlaylist', SID: sid, playlist }),
    }, 15000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) { 
    await enqueueOfflineRequest('registerPlaylist', { SID: sid, playlist });
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
        title: s.title || 'Untitled', artist: s.artist || 'Unknown Artist', album: s.album || 'Unknown Album', lyric: s.lyric || '',
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
            id: pl.id, playlistName: pl.playlistName || 'Untitled Playlist', sortBy: pl.sortBy || 'title', sortDesc: !!pl.sortDesc, type: 'smart', conditions: pl.conditions || { type: 'group', match: 'all', items: [] },
          });
        } else {
          const matchedSongs = getPlaylistSongs(pl, localLibraryList);
          const musics = matchedSongs.map((s: any) => ({ title: s.title || 'Untitled', artist: s.artist || 'Unknown Artist' }));
          formattedPlaylists.push({
            id: pl.id, playlistName: pl.playlistName || 'Untitled Playlist', sortBy: pl.sortBy || 'title', sortDesc: !!pl.sortDesc, type: 'normal', musics,
          });
        }
      }
      await registerPlaylistApi(sid, formattedPlaylists);
    }
  } catch (e) {}
};

export const registerNowPlayingApi = async (
  sid: string,
  payload: {
    playlistID: string;
    playlistName: string;
    shuffle: boolean;
    loop: boolean;
    musiclist: { title: string; artist: string; album: string }[];
    nowPlayingTitle: string;
    nowPlayingArtist: string;
    nowPlayingAlbum: string;
    nowPlayingTime: number;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({
        operation: 'registerNowPlaying',
        SID: sid,
        ...payload,
      }),
    }, 4000);

    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || '再生位置の送信に失敗しました' };
  }
};

export const getNowPlayingApi = async (sid: string): Promise<GetNowPlayingResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'getNowPlaying', SID: sid }),
    }, 6000);
    const data = JSON.parse(await response.text());
    if (data.error) return { success: false, error: String(data.error) };
    if (Array.isArray(data.response)) return { success: true, response: data.response };
    return { success: true, response: [] };
  } catch (e: any) { return { success: false, error: e?.message || 'リレー情報の取得に失敗しました' }; }
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
  } catch (e: any) { 
    await enqueueOfflineRequest('deletePlayHistory', { SID: sid, title: item.title, artist: item.artist, album: item.album, device: item.device, date: item.date });
    return { success: false, error: e?.message || '削除通信に失敗しました' }; 
  }
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
  } catch (e: any) { 
    await enqueueOfflineRequest('deleteWorkHistory', { SID: sid, time: item.time, end: item.end, device: item.device });
    return { success: false, error: e?.message || '削除通信に失敗しました' }; 
  }
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
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'addPlayHistory', SID: sid, title, artist, album }),
    }, 4000);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    void processOfflineQueue();
  } catch (e) {
    await enqueueOfflineRequest('addPlayHistory', { SID: sid, title, artist, album });
  }
};

export const addWorkHistoryApi = async (sid: string, end: string, time: string): Promise<void> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY, 'X-ACCESS-KEY': HTTP_X_ACCESS_KEY },
      body: JSON.stringify({ operation: 'addWorkHistory', SID: sid, end, time }),
    }, 4000);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    void processOfflineQueue();
  } catch (e) {
    await enqueueOfflineRequest('addWorkHistory', { SID: sid, end, time });
  }
};

export const syncInitialLocalHistory = async (
  sid: string,
  onProgress?: (msg: string) => void,
  language: LanguageCode = 'ja'
): Promise<void> => {
  isManualResyncRunning = true;
  try {
    await runWithSyncLock(async () => {
      const online = await isInternetAvailable();
      if (!online) {
        triggerNoInternetToast(language);
        throw new Error(t('toast_no_internet', language));
      }

      await flushAllPendingSyncDataInternal(sid, {
        onProgress,
        language,
        throwOnNetworkError: true,
      });

      let localLibraryList: any[] = [];
      const localLibraryRaw = await AsyncStorage.getItem('local_library');
      if (localLibraryRaw) {
        localLibraryList = JSON.parse(localLibraryRaw);
        if (onProgress) {
          onProgress(`[3/4] ${t('account_sync_step_music', language).replace('{count}', String(localLibraryList.length))}`);
        }
        const musicRes = await sendRawSyncOperation(
          'registerMusicList',
          {
            SID: sid,
            musicList: localLibraryList.map((s: any) => ({
              title: s.title || 'Untitled',
              artist: s.artist || 'Unknown Artist',
              album: s.album || 'Unknown Album',
              lyric: s.lyric || '',
            })),
          },
          15000
        );
        if (!musicRes.ok) {
          throw new Error(musicRes.error || t('account_resync_failed', language));
        }
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
            formattedPlaylists.push({
              id: pl.id,
              playlistName: pl.playlistName || 'Untitled Playlist',
              sortBy: pl.sortBy || 'title',
              sortDesc: !!pl.sortDesc,
              type: 'normal',
              musics: matchedSongs.map((s: any) => ({
                title: s.title || 'Untitled',
                artist: s.artist || 'Unknown Artist',
              })),
            });
          }
        }
        if (onProgress) {
          onProgress(`[4/4] ${t('account_sync_step_playlist', language).replace('{count}', String(formattedPlaylists.length))}`);
        }
        if (formattedPlaylists.length > 0) {
          const plRes = await sendRawSyncOperation(
            'registerPlaylist',
            { SID: sid, playlist: formattedPlaylists },
            15000
          );
          if (!plRes.ok) {
            throw new Error(plRes.error || t('account_resync_failed', language));
          }
        }
      }
    });
  } finally {
    isManualResyncRunning = false;
  }
};
