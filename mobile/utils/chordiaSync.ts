import AsyncStorage from '@react-native-async-storage/async-storage';
import { HTTP_X_ACCESS_KEY, CHORDIA_SYNC_API_URL } from '../constants/config';

const PENDING_PLAY_HISTORY_KEY = 'chordia_pending_play_history';
const PENDING_WORK_HISTORY_KEY = 'chordia_pending_work_history';

export type DeletePeriod = '1day' | '1week' | '1month' | '1year' | 'all';

export interface RegisterAuthResponse {
  success: boolean;
  sid?: string;
  error?: string;
}

export interface CheckAuthStatusResponse {
  success: boolean;
  status?: 'authenticated' | 'unauthenticated' | 'expired';
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  error?: string;
}

export interface PlayHistoryItem {
  title: string;
  artist: string;
  album: string;
  device?: string;
  date?: string; // "YYYY.MM.DD.HH.mm"
}

export interface LoadPlayHistoryResponse {
  success: boolean;
  history?: PlayHistoryItem[];
  error?: string;
}

export interface WorkHistoryItem {
  end: string;   // "YYYY.MM.DD.HH.mm"
  time: string;  // "HH:mm:ss"
  device?: string;
}

export interface LoadWorkHistoryResponse {
  success: boolean;
  history?: WorkHistoryItem[];
  error?: string;
}

export interface DeleteHistoryResponse {
  success: boolean;
  error?: string;
}

/**
 * タイムアウト付き fetch
 */
const fetchWithTimeout = async (url: string, options: any = {}, timeoutMs: number = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('通信がタイムアウトしました。インターネット接続を確認してください。');
    }
    throw new Error('インターネットに接続できません。ネットワーク設定を確認してください。');
  }
};

/**
 * 8桁の認証コードを生成（Oと0を除外）
 */
export const generateAuthCode = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

/**
 * "YYYY.MM.DD.HH.mm" 形式の日付文字列を Date オブジェクトに変換
 */
export const parseSyncDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date(0);
  if (dateStr.includes('T') || dateStr.includes('-')) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  const parts = dateStr.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 5) {
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
  }
  return new Date(0);
};

/**
 * 期間に応じたカットオフ日時を算出
 */
export const getCutoffDate = (period: DeletePeriod): Date => {
  if (period === 'all') {
    return new Date(8640000000000000); // 最大未来日付
  }
  const now = new Date();
  switch (period) {
    case '1day':
      now.setDate(now.getDate() - 1);
      break;
    case '1week':
      now.setDate(now.getDate() - 7);
      break;
    case '1month':
      now.setMonth(now.getMonth() - 1);
      break;
    case '1year':
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now;
};

export const parseDurationToSeconds = (timeStr?: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
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

/**
 * 認証コード事前通信 (registerAuthenticationCode)
 */
export const registerAuthCodeApi = async (username: string, device: string, code: string): Promise<RegisterAuthResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'registerAuthenticationCode',
        code: code,
        username: username.trim(),
        device: device.trim(),
      }),
    }, 10000);

    const text = await response.text();
    let data: any = JSON.parse(text);

    if (data.error) return { success: false, error: String(data.error) };
    if (data.sid) return { success: true, sid: String(data.sid) };

    return { success: false, error: '有効なセッションID(sid)が取得できませんでした' };
  } catch (error: any) {
    return { success: false, error: error?.message || 'インターネット接続を確認してください' };
  }
};

/**
 * 認証完了確認API (ポーリング通信)
 */
export const checkAuthStatusApi = async (sid: string, name: string, device: string): Promise<CheckAuthStatusResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'checkAlreadyLogin',
        SID: sid,
        name: name.trim(),
        device: device.trim(),
      }),
    }, 5000);

    const text = await response.text();
    let data: any = JSON.parse(text);

    if (data.error) return { success: false, error: String(data.error) };
    if (data.status) return { success: true, status: data.status };

    return { success: false, error: '認証ステータスを取得できませんでした' };
  } catch (error: any) {
    return { success: false, error: error?.message || '通信エラーが発生しました' };
  }
};

/**
 * ログアウトAPI
 */
export const logoutApi = async (sid: string, name: string, device: string): Promise<LogoutResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'logout',
        SID: sid,
        name: name.trim(),
        device: device.trim(),
      }),
    }, 8000);

    const text = await response.text();
    let data: any = JSON.parse(text);
    if (data.error) return { success: false, error: String(data.error) };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'ログアウト通信に失敗しました' };
  }
};

/**
 * 全楽曲再生履歴取得API (loadAllPlayHistory)
 */
export const loadAllPlayHistoryApi = async (sid: string): Promise<LoadPlayHistoryResponse> => {
  try {
    console.log('[PlayHistory API] 📡 全楽曲再生履歴を取得中...');
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'loadAllPlayHistory',
        SID: sid,
      }),
    }, 10000);

    const text = await response.text();
    let data: any = JSON.parse(text);

    if (data.error) {
      console.warn('[PlayHistory API] ❌ 楽曲再生履歴取得エラー:', data.error);
      return { success: false, error: String(data.error) };
    }

    if (Array.isArray(data.history)) {
      console.log(`[PlayHistory API] ✅ 全楽曲再生履歴を取得しました (${data.history.length}件)`);
      return { success: true, history: data.history };
    }

    return { success: true, history: [] };
  } catch (error: any) {
    console.warn('[PlayHistory API] ⚠️ 楽曲再生履歴取得 失敗:', error?.message);
    return { success: false, error: error?.message || 'インターネット接続を確認してください' };
  }
};

/**
 * 全作業セッション履歴取得API (loadAllWorkHistory)
 */
export const loadAllWorkHistoryApi = async (sid: string): Promise<LoadWorkHistoryResponse> => {
  try {
    console.log(`[WorkHistory API] 📡 全作業セッション履歴を取得中... (SID: ${sid.substring(0, 8)}...)`);
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'loadAllWorkHistory',
        SID: sid,
      }),
    }, 10000);

    const text = await response.text();
    let data: any = JSON.parse(text);

    if (data.error) {
      console.warn('[WorkHistory API] ❌ 作業セッション履歴取得エラー:', data.error);
      return { success: false, error: String(data.error) };
    }

    if (Array.isArray(data.history)) {
      console.log(`[WorkHistory API] ✅ 全作業セッション履歴を取得しました (${data.history.length}件)`);
      return { success: true, history: data.history };
    }

    return { success: true, history: [] };
  } catch (error: any) {
    console.warn('[WorkHistory API] ⚠️ 作業セッション履歴取得 失敗:', error?.message);
    return { success: false, error: error?.message || 'インターネット接続を確認してください' };
  }
};

/**
 * ★ 単一の楽曲再生履歴削除API (1曲ずつ削除)
 * - operation: 'deletePlayHistory'
 * - SID: セッションID
 * - title, artist, album: 楽曲情報
 * - device: 再生されたデバイス名
 * - date: 再生された日付 (YYYY.MM.DD.HH.mm)
 */
export const deletePlayHistorySingleApi = async (
  sid: string,
  item: PlayHistoryItem
): Promise<DeleteHistoryResponse> => {
  try {
    const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
        'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
      },
      body: JSON.stringify({
        operation: 'deletePlayHistory',
        SID: sid,
        title: item.title || '',
        artist: item.artist || '',
        album: item.album || '',
        device: item.device || '',
        date: item.date || '',
      }),
    }, 6000);

    const text = await response.text();
    let data: any = JSON.parse(text);

    if (data.error) {
      return { success: false, error: String(data.error) };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || '削除通信に失敗しました' };
  }
};

/**
 * ★ 複数件の楽曲再生履歴を1曲ずつ順次削除するバッチ処理
 */
export const deletePlayHistoryBatchApi = async (
  sid: string,
  itemsToDelete: PlayHistoryItem[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  console.log(`[DeletePlayHistory] 🗑️ 楽曲再生履歴を ${itemsToDelete.length} 件、1曲ずつ削除します...`);

  let deletedCount = 0;
  for (let i = 0; i < itemsToDelete.length; i++) {
    const item = itemsToDelete[i];
    const res = await deletePlayHistorySingleApi(sid, item);
    if (res.success) {
      deletedCount++;
      console.log(`[DeletePlayHistory] ✅ [${i + 1}/${itemsToDelete.length}] 削除完了: "${item.title}" (${item.date})`);
    } else {
      console.warn(`[DeletePlayHistory] ⚠️ [${i + 1}/${itemsToDelete.length}] 削除失敗: "${item.title}" (${res.error})`);
    }
  }

  return {
    success: deletedCount === itemsToDelete.length,
    deletedCount,
  };
};

/**
 * 楽曲再生履歴追加API
 */
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
      console.log(`[PlayHistory API] 📡 楽曲再生履歴を送信中... "${item.title}" by ${item.artist}`);
      const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
          'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
        },
        body: JSON.stringify({
          operation: 'addPlayHistory',
          SID: item.sid || sid,
          title: item.title,
          artist: item.artist,
          album: item.album,
        }),
      }, 4000);

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log(`[PlayHistory API] ✅ 楽曲再生履歴の送信に成功しました: "${item.title}"`);
    } catch (e: any) {
      console.warn(`[PlayHistory API] ⚠️ 送信失敗のためオフラインキューに保持: "${item.title}"`);
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(PENDING_PLAY_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};

/**
 * 作業セッション履歴追加API
 */
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
      console.log(`[WorkHistory API] 📡 作業セッション履歴を送信中... (end: ${item.end}, time: ${item.time})`);
      const response = await fetchWithTimeout(CHORDIA_SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'HTTP_X_ACCESS_KEY': HTTP_X_ACCESS_KEY,
          'X-ACCESS-KEY': HTTP_X_ACCESS_KEY,
        },
        body: JSON.stringify({
          operation: 'addWorkHistory',
          SID: item.sid || sid,
          end: item.end,
          time: item.time,
        }),
      }, 4000);

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      console.log(`[WorkHistory API] ✅ 作業セッション履歴の送信に成功しました: end=${item.end}, time=${item.time}`);
    } catch (e: any) {
      console.warn(`[WorkHistory API] ⚠️ 送信失敗のためオフラインキューに保持: end=${item.end}, time=${item.time}`);
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(PENDING_WORK_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};

/**
 * ログイン時に既存のローカル作業セッション履歴と楽曲再生履歴をサーバーへ一括送信
 */
export const syncInitialLocalHistory = async (sid: string): Promise<void> => {
  console.log('[InitialSync] 🚀 ログイン成功に伴い、既存ローカル履歴のサーバー送信を開始します...');

  try {
    const focusHistoryRaw = await AsyncStorage.getItem('chordia_focus_history');
    if (focusHistoryRaw) {
      const focusList: any[] = JSON.parse(focusHistoryRaw);
      console.log(`[InitialSync] ⏳ 既存の作業セッション履歴 ${focusList.length} 件を同期中...`);
      for (const item of focusList) {
        if (item.duration && item.duration > 0) {
          const dateObj = item.date ? new Date(item.date) : new Date();
          const end = formatWorkSessionEndTime(dateObj);
          const time = formatWorkDuration(item.duration);
          await addWorkHistoryApi(sid, end, time);
        }
      }
    }
  } catch (e: any) {
    console.warn('[InitialSync] ⚠️ 作業履歴の初期同期例外:', e?.message || e);
  }

  try {
    const playHistoryRaw = await AsyncStorage.getItem('chordia_playback_history');
    if (playHistoryRaw) {
      const playList: any[] = JSON.parse(playHistoryRaw);
      console.log(`[InitialSync] ⏳ 既存の楽曲再生履歴 ${playList.length} 件を同期中...`);
      for (const item of playList) {
        if (item.title || item.artist) {
          await addPlayHistoryApi(
            sid,
            item.title || 'Untitled',
            item.artist || 'Unknown Artist',
            item.album || 'Unknown Album'
          );
        }
      }
    }
  } catch (e: any) {
    console.warn('[InitialSync] ⚠️ 再生履歴の初期同期例外:', e?.message || e);
  }

  console.log('[InitialSync] ✅ 既存ローカル履歴のサーバー送信処理が完了しました');
};