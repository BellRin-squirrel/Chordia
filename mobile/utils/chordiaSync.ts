import { HTTP_X_ACCESS_KEY, CHORDIA_SYNC_API_URL } from '../constants/config';

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

/**
 * 8桁の認証コードを生成
 * ★ 誤認防止のため、アルファベットの「O」と数字の「0」を除外した34文字から生成
 */
export const generateAuthCode = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
};

/**
 * 認証コード事前通信 (registerAuthenticationCode)
 */
export const registerAuthCodeApi = async (username: string, device: string, code: string): Promise<RegisterAuthResponse> => {
  try {
    const response = await fetch(CHORDIA_SYNC_API_URL, {
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
    });

    const text = await response.text();
    let data: any = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        error: `サーバーからの応答が無効な形式です (HTTP ${response.status})`,
      };
    }

    if (data.error) {
      return {
        success: false,
        error: String(data.error),
      };
    }

    if (data.sid) {
      return {
        success: true,
        sid: String(data.sid),
      };
    }

    return {
      success: false,
      error: '有効なセッションID(sid)が取得できませんでした',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'サーバーとの通信に失敗しました',
    };
  }
};

/**
 * 認証完了確認API (ポーリング通信)
 * - operation: 'checkAlreadyLogin'
 * - SID: 事前通信APIレスポンスのSID
 * - name: ユーザー名
 * - device: ログインデバイス名
 */
export const checkAuthStatusApi = async (sid: string, name: string, device: string): Promise<CheckAuthStatusResponse> => {
  try {
    const response = await fetch(CHORDIA_SYNC_API_URL, {
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
    });

    const text = await response.text();
    let data: any = {};
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        error: `サーバーからの応答が無効な形式です (HTTP ${response.status})`,
      };
    }

    if (data.error) {
      return {
        success: false,
        error: String(data.error),
      };
    }

    if (data.status) {
      return {
        success: true,
        status: data.status,
      };
    }

    return {
      success: false,
      error: '認証ステータスを取得できませんでした',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || '通信エラーが発生しました',
    };
  }
};

/**
 * ログアウトAPI
 * - operation: 'logout'
 * - SID: セッションID
 * - name: ユーザー名
 * - device: ログインデバイス名
 */
export const logoutApi = async (sid: string, name: string, device: string): Promise<LogoutResponse> => {
  try {
    const response = await fetch(CHORDIA_SYNC_API_URL, {
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
    });

    const text = await response.text();
    let data: any = {};

    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        success: false,
        error: `サーバーからの応答が無効な形式です (HTTP ${response.status})`,
      };
    }

    if (data.error) {
      return {
        success: false,
        error: String(data.error),
      };
    }

    if (data.status === 'success') {
      return {
        success: true,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'ログアウト通信に失敗しました',
    };
  }
};