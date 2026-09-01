import AsyncStorage from '@react-native-async-storage/async-storage';
import { HTTP_X_ACCESS_KEY, CHORDIA_SYNC_API_URL } from '../constants/config';

const PENDING_PLAY_HISTORY_KEY = 'chordia_pending_play_history';
const PENDING_WORK_HISTORY_KEY = 'chordia_pending_work_history';

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
 * 認証コード事前通信 (ユーザーへ接続促進)
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
    console.log('[Chordia Sync] 📡 全楽曲再生履歴を取得中...');
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
      console.warn('[Chordia Sync] ❌ 楽曲再生履歴取得エラー:', data.error);
      return { success: false, error: String(data.error) };
    }

    if (Array.isArray(data.history)) {
      console.log(`[Chordia Sync] ✅ ${data.history.length} 件の楽曲再生履歴を取得しました`);
      return { success: true, history: data.history };
    }

    return { success: true, history: [] };
  } catch (error: any) {
    console.warn('[Chordia Sync] ⚠️ 楽曲再生履歴取得 失敗:', error?.message);
    return { success: false, error: error?.message || 'インターネット接続を確認してください' };
  }
};

/**
 * 楽曲再生履歴追加API (オフラインキュー自動再送対応)
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
      console.log(`[Chordia Sync] ✅ 楽曲再生履歴を送信完了: "${item.title}"`);
    } catch (e) {
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(PENDING_PLAY_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};

/**
 * 作業セッション履歴追加API (オフラインキュー自動再送対応)
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
      console.log(`[Chordia Sync] ✅ 作業履歴を送信完了: end=${item.end}, time=${item.time}`);
    } catch (e) {
      remainingQueue.push(item);
    }
  }

  await AsyncStorage.setItem(PENDING_WORK_HISTORY_KEY, JSON.stringify(remainingQueue.slice(-50)));
};