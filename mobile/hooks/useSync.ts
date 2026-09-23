import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import DeviceInfo from 'react-native-device-info';
import { getPlaylistSongs } from '../utils/playlistEvaluator';
import { LanguageCode, t } from '../utils/i18n';
import { syncMusicAndPlaylistsToCloud } from '../utils/chordiaSync';

export interface ConflictItem {
  id: string;
  type: 'DESKTOP' | 'LOCAL';
  title: string;
  artist: string;
  album: string;
  sourceUrlOrUri: string;
  fileName: string;
  localSongRef?: any;
  desktopSongRef?: any;
}

export interface ConflictSet {
  key: string;
  title: string;
  artist: string;
  album: string;
  items: ConflictItem[];
}

type QrData = {
  ip?: string;
  port?: string;
  code?: string;
  wanUrl?: string;
};

type UseSyncProps = {
  closeFullPlayer: () => void;
  stopAndUnloadPlayer: () => Promise<void>;
  localLibrary: any[];
  setLocalLibrary: (library: any[]) => void;
  setLocalPlaylists: (playlists: any[]) => void;
  language?: LanguageCode;
};

type ClientInfo = {
  ip: string;
  deviceName: string;
  osVersion: string;
};

const buildUrl = (ip: string, port: string) => {
  let cleanIp = ip ? String(ip).trim().replace(/[\r\n]/g, '') : '';
  let cleanPort = port ? String(port).trim().replace(/[\r\n]/g, '') : '';
  if (!cleanIp) return '';
  if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) return cleanIp.replace(/\/$/, '');
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp);
  if (isIpv4) return `http://${cleanIp}:${cleanPort}`;
  if (cleanIp.includes('.')) return `https://${cleanIp}`;
  return `http://${cleanIp}:${cleanPort}`;
};

const cleanStr = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str).normalize('NFC').toLowerCase().trim();
};

const getFileName = (pathStr: any): string => {
  if (pathStr === null || pathStr === undefined) return '';
  const fname = String(pathStr).split(/[\\/]/).pop();
  return fname ? cleanStr(fname) : '';
};

const safeFetchJson = async (url: string, options: any = {}) => {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error(`HTTP ${res.status}`);
  try { return JSON.parse(text); } catch (e) { throw new Error(`HTTP ${res.status}: ${text.substring(0, 60)}`); }
};

const downloadWithTimeout = async (url: string, fileUri: string, headers: any, timeoutMs: number) => {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${Math.floor(timeoutMs / 1000)}s)`)), timeoutMs);
  });
  try {
    const fullHeaders = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ...headers
    };
    const downloadTask = FileSystem.createDownloadResumable(url, fileUri, { headers: fullHeaders });
    const result = await Promise.race([downloadTask.downloadAsync(), timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw e;
  }
};

const yieldToUI = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[Sync Debug] ⚠️ ${label} timed out after ${ms}ms`);
      resolve(undefined as any);
    }, ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }).catch(e => { clearTimeout(timer); reject(e); });
  });
};

export const useSync = ({ 
  closeFullPlayer, 
  stopAndUnloadPlayer,
  localLibrary, setLocalLibrary, setLocalPlaylists,
  language = 'ja'
}: UseSyncProps) => {

  const [syncStage, setSyncStage] = useState<'INPUT_IP' | 'AWAITING_APPROVAL' | 'AWAITING_CODE' | 'READY'>('INPUT_IP');
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('5000');
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [pcPlaylists, setPcPlaylists] = useState<any[]>([]);
  const [selectedPls, setSelectedPls] = useState<Set<number>>(new Set());
  const [syncProgress, setSyncProgress] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullScreenSyncing, setIsFullScreenSyncing] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [scannedQrData, setScannedQrData] = useState<QrData | null>(null);
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);

  const didCancelRef = useRef(false);

  // ★ 重複解決モーダル用の状態
  const [activeConflictSet, setActiveConflictSet] = useState<ConflictSet | null>(null);
  const conflictResolverRef = useRef<((choice: { action: 'ADOPT' | 'IGNORE'; adoptedItem?: ConflictItem } | 'ABORT') => void) | null>(null);

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    ip: 'Unknown IP',
    deviceName: 'iPhone',
    osVersion: Platform.OS === 'ios' ? `iOS ${Platform.Version}` : `${Platform.OS} ${Platform.Version}`
  });

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      let ip = clientInfo.ip;
      let finalDeviceName = clientInfo.deviceName;
      try { ip = await Network.getIpAddressAsync(); } catch (e) {}
      try {
        const expoModel = Device.modelName;
        const rnModel = DeviceInfo.getModel();
        if (rnModel && !rnModel.includes(',')) finalDeviceName = rnModel;
        else if (expoModel && !expoModel.includes(',')) finalDeviceName = expoModel;
        else if (rnModel) finalDeviceName = rnModel.replace(/[0-9,]/g, '').trim() || rnModel;
      } catch (e) {}
      setClientInfo(prev => ({ ...prev, ip, deviceName: finalDeviceName }));
    };
    fetchDeviceInfo();
  }, []);

  useEffect(() => {
    if (scannedQrData) {
      if (scannedQrData.wanUrl) {
        setServerIp(scannedQrData.wanUrl);
        setServerPort('');
        setIsAutoConnecting(false);
        requestAuthToPC(scannedQrData.wanUrl, '');
      } else if (scannedQrData.ip && scannedQrData.code) {
        setServerIp(scannedQrData.ip);
        setServerPort(scannedQrData.port || '5000');
        setIsAutoConnecting(true);
        requestAuthToPC(scannedQrData.ip, scannedQrData.port || '5000'); 
      }
      setScannedQrData(null); 
    }
  }, [scannedQrData]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let timeoutHandler: NodeJS.Timeout | null = null;

    if (syncStage === 'AWAITING_APPROVAL' && serverIp) {
      pollInterval = setInterval(async () => {
        try {
          const baseUrl = buildUrl(serverIp, serverPort);
          const data = await safeFetchJson(`${baseUrl}/api/auth/check`, {
            method: 'POST',
            body: JSON.stringify({ ip: clientInfo.ip }) 
          });
          if (data.status === 'approved' || data.status === 'rejected' || data.status === 'expired') {
            if (pollInterval) clearInterval(pollInterval);
            if (timeoutHandler) clearTimeout(timeoutHandler);
            if (data.status === 'approved') {
              if (isAutoConnecting && data.code) verifyAuthCode(serverIp, serverPort, data.code);
              else setSyncStage('AWAITING_CODE');
            } else if (data.status === 'rejected') {
              setIsAutoConnecting(false);
              Alert.alert(t('sync_rejected_title', language), t('sync_rejected_desc', language));
              cancelSync();
            } else {
              setIsAutoConnecting(false);
              cancelSync();
            }
          }
        } catch (e) {}
      }, 2000);

      timeoutHandler = setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        setIsAutoConnecting(false);
        Alert.alert(t('sync_timeout_title', language), t('sync_timeout_desc', language));
        cancelSync();
      }, 30000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutHandler) clearTimeout(timeoutHandler);
    };
  }, [syncStage, serverIp, serverPort, clientInfo, isAutoConnecting, language]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permission_required', language), t('sync_qr_permission_desc', language));
      return false;
    }
    return true;
  };

  const requestAuthToPC = async (ip: string, port: string) => {
    setIsSyncing(true);
    setAuthCodeInput('');
    const baseUrl = buildUrl(ip, port);
    try {
      const data = await safeFetchJson(`${baseUrl}/api/auth/request`, {
        method: 'POST',
        body: JSON.stringify({ ip: clientInfo.ip, device: clientInfo.deviceName, os: clientInfo.osVersion })
      });
      if (data && data.status === 'pending') {
        setServerIp(ip);
        setServerPort(port);
        setSyncStage('AWAITING_APPROVAL');
      } else { 
        throw new Error(data?.message || data?.error || 'Failed'); 
      }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert(t('sync_connect_error_title', language), `${t('sync_connect_error_prefix', language)}${e.message || 'Network Error'}`); 
    } finally {
      setIsSyncing(false);
    }
  };

  const verifyAuthCode = async (ip: string, port: string, code: string) => {
    setIsSyncing(true);
    const baseUrl = buildUrl(ip, port);
    try {
      const data = await safeFetchJson(`${baseUrl}/api/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ code, ip: clientInfo.ip, device: clientInfo.deviceName, os: clientInfo.osVersion })
      });
      if (data.status === 'success' && data.api_key) {
        setApiKey(data.api_key);
        setAuthCodeInput('');
        setIsAutoConnecting(false);
        await fetchPlaylists(ip, port, data.api_key);
        setSyncStage('READY');
      } else { throw new Error(data.message || 'Auth failed'); }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert(t('sync_auth_error_title', language), e.message); 
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchPlaylists = async (ip: string, port: string, key: string) => {
    const baseUrl = buildUrl(ip, port);
    try {
      const data = await safeFetchJson(`${baseUrl}/api/playlists`, {
        headers: { 'X-API-KEY': key, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
      });
      if (data.playlists) setPcPlaylists(data.playlists);
    } catch (e: any) {
      Alert.alert(t('alert_timer_error_title', language), e.message);
    }
  };

  const disconnect = async () => {
    didCancelRef.current = true;
    setIsAutoConnecting(false);
    if (serverIp && apiKey) {
      const baseUrl = buildUrl(serverIp, serverPort);
      try {
        await safeFetchJson(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
        });
      } catch (e) {}
    }
    setSyncStage('INPUT_IP');
    setApiKey(null);
    setPcPlaylists([]);
  };

  // 重複解決用モーダルコールバック
  const resolveCurrentConflict = (choice: { action: 'ADOPT' | 'IGNORE'; adoptedItem?: ConflictItem } | 'ABORT') => {
    if (conflictResolverRef.current) {
      conflictResolverRef.current(choice);
      conflictResolverRef.current = null;
    }
    setActiveConflictSet(null);
  };

  // ★ 新同期システム：「ローカルから追加した曲」を保護する自己入手非削除方式
  const startSyncDownload = async () => {
    if (!serverIp || !apiKey) {
      Alert.alert(t('alert_timer_error_title', language), t('sync_not_connected', language));
      return;
    }

    didCancelRef.current = false;
    setIsFullScreenSyncing(true);
    setSyncProgress(t('sync_stopping_player', language));

    await yieldToUI();
    const baseUrl = buildUrl(serverIp, serverPort);
    const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
    await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

    // 一時試聴ダウンロード用ファイルパスの追跡
    const tempPreviewFiles: string[] = [];

    const cleanupTempPreviews = async () => {
      for (const p of tempPreviewFiles) {
        try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch (e) {}
      }
    };

    try {
      if (closeFullPlayer) closeFullPlayer();
      if (stopAndUnloadPlayer) {
        await withTimeout(stopAndUnloadPlayer(), 3000, 'stopAndUnloadPlayer');
      }

      setSyncProgress(t('sync_fetching_library', language));
      await yieldToUI();

      const headers = { 
        'X-API-KEY': apiKey, 
        'X-DEVICE-IP': clientInfo.ip, 
        'X-DEVICE-NAME': clientInfo.deviceName, 
        'X-DEVICE-OS': clientInfo.osVersion 
      };

      const dataLib = await safeFetchJson(`${baseUrl}/api/library`, { headers });
      const allSongs = dataLib?.library || [];

      setSyncProgress(t('sync_fetching_playlists', language));
      await yieldToUI();

      let currentPcPlaylists = pcPlaylists;
      try {
        const dataPls = await safeFetchJson(`${baseUrl}/api/playlists`, { headers });
        if (dataPls && dataPls.playlists) {
          currentPcPlaylists = dataPls.playlists;
          setPcPlaylists(currentPcPlaylists);
        }
      } catch (e) {}

      setSyncProgress(t('sync_calculating_targets', language));
      await yieldToUI();

      let desktopTargets: any[] = [];
      if (selectedPls.size > 0) {
        const targetPlaylists = currentPcPlaylists.filter((_, i) => selectedPls.has(i));
        const targetFilenameSet = new Set<string>();
        for (const pl of targetPlaylists) {
          const songs = getPlaylistSongs(pl, allSongs);
          songs.forEach((s: any) => {
            if (s.musicFilename) {
              const fname = getFileName(s.musicFilename);
              if (fname) targetFilenameSet.add(fname);
            }
          });
        }
        desktopTargets = allSongs.filter((s: any) => {
          if (!s || !s.musicFilename) return false;
          const fname = getFileName(s.musicFilename);
          return fname ? targetFilenameSet.has(fname) : false;
        });
      } else {
        desktopTargets = allSongs;
      }

      // ==============================================================
      // ステップ 1: 過去のDesktop同期曲の削除 ＆ プレイリストスナップショット
      // ==============================================================
      setSyncProgress(t('sync_organizing_local', language));
      await yieldToUI();

      const rawPlaylists = await AsyncStorage.getItem('local_playlists');
      let currentLocalPlaylists: any[] = rawPlaylists ? JSON.parse(rawPlaylists) : [];

      const currentLocal = Array.isArray(localLibrary) ? [...localLibrary] : [];

      // 過去のDesktop曲と、保護対象のローカル追加曲を分離
      const protectedLocalSongs: any[] = [];
      const pastDesktopSongs: any[] = [];

      for (const song of currentLocal) {
        const isLocallyAdded = song.origin === 'local' ||
          (song.id && String(song.id).startsWith('local_song_')) ||
          (song.musicFilename && String(song.musicFilename).startsWith('local_'));

        if (isLocallyAdded) {
          protectedLocalSongs.push({ ...song, origin: 'local' });
        } else {
          pastDesktopSongs.push(song);
        }
      }

      // Mobile作成プレイリストから削除されるDesktop曲のスナップショット（メモ）を記録
      const deletedDesktopFnames = new Set(
        pastDesktopSongs.map(s => s.musicFilename?.split(/[\\/]/).pop()).filter(Boolean)
      );

      interface PlaylistTrackSnapshot {
        playlistId: string;
        index: number;
        title: string;
        artist: string;
        album: string;
      }
      const mobilePlaylistSnapshots: PlaylistTrackSnapshot[] = [];

      for (const pl of currentLocalPlaylists) {
        if (pl.origin !== 'desktop' && pl.type !== 'smart' && Array.isArray(pl.music)) {
          pl.music.forEach((m: string, idx: number) => {
            const fname = m.split(/[\\/]/).pop();
            const matchedPastSong = pastDesktopSongs.find(
              s => s.musicFilename?.split(/[\\/]/).pop() === fname
            );
            if (matchedPastSong) {
              mobilePlaylistSnapshots.push({
                playlistId: pl.id,
                index: idx,
                title: matchedPastSong.title || '',
                artist: matchedPastSong.artist || '',
                album: matchedPastSong.album || '',
              });
            }
          });

          // 削除されるDesktop曲をプレイリストから一旦除去
          pl.music = pl.music.filter((m: string) => !deletedDesktopFnames.has(m.split(/[\\/]/).pop()));
        }
      }

      // 過去のDesktop曲の音声ファイル・画像ファイルを物理削除
      for (const dSong of pastDesktopSongs) {
        if (dSong.localMusicUri) {
          try { await FileSystem.deleteAsync(dSong.localMusicUri, { idempotent: true }); } catch (e) {}
        }
        if (dSong.localImageUri) {
          try { await FileSystem.deleteAsync(dSong.localImageUri, { idempotent: true }); } catch (e) {}
        }
      }

      // Desktop由来の古いプレイリストを除去
      currentLocalPlaylists = currentLocalPlaylists.filter(pl => pl.origin !== 'desktop');

      // 一時状態を保存
      await AsyncStorage.setItem('local_library', JSON.stringify(protectedLocalSongs));
      setLocalLibrary(protectedLocalSongs);

      // ==============================================================
      // ステップ 2: 重複検出 ＆ ポップアップ試聴比較
      // ==============================================================
      const conflictMap = new Map<string, ConflictItem[]>();

      // 保護されているローカル追加曲を重複判定マップに登録
      for (const lSong of protectedLocalSongs) {
        const key = `${cleanStr(lSong.title)}:::${cleanStr(lSong.artist)}:::${cleanStr(lSong.album || '')}`;
        if (!conflictMap.has(key)) conflictMap.set(key, []);
        conflictMap.get(key)!.push({
          id: lSong.id || lSong.localMusicUri,
          type: 'LOCAL',
          title: lSong.title || 'Untitled',
          artist: lSong.artist || 'Unknown Artist',
          album: lSong.album || 'Local Files',
          sourceUrlOrUri: lSong.localMusicUri,
          fileName: lSong.musicFilename?.split(/[\\/]/).pop() || '',
          localSongRef: lSong,
        });
      }

      // 今回のDesktop同期対象曲を重複判定マップに登録
      const finalDesktopToDownload: any[] = [];
      const adoptedLocalReplacements = new Map<string, string>(); // desktopFname -> localFname

      for (const dSong of desktopTargets) {
        const key = `${cleanStr(dSong.title)}:::${cleanStr(dSong.artist)}:::${cleanStr(dSong.album || '')}`;
        const existing = conflictMap.get(key);

        if (existing && existing.length > 0) {
          existing.push({
            id: `desktop_${dSong.id || dSong.url_music}`,
            type: 'DESKTOP',
            title: dSong.title || 'Untitled',
            artist: dSong.artist || 'Unknown Artist',
            album: dSong.album || '',
            sourceUrlOrUri: `${baseUrl}${dSong.url_music}`,
            fileName: dSong.musicFilename?.split(/[\\/]/).pop() || '',
            desktopSongRef: dSong,
          });
        } else {
          finalDesktopToDownload.push(dSong);
        }
      }

      // 重複が存在するセットを抽出
      const conflictSets: ConflictSet[] = [];
      for (const [key, items] of conflictMap.entries()) {
        const hasDesktop = items.some(i => i.type === 'DESKTOP');
        const hasLocal = items.some(i => i.type === 'LOCAL');
        if (hasDesktop && hasLocal) {
          conflictSets.push({
            key,
            title: items[0].title,
            artist: items[0].artist,
            album: items[0].album,
            items,
          });
        }
      }

      // 各重複セットを順番にユーザーに試聴比較させ、選択してもらう
      for (let sIdx = 0; sIdx < conflictSets.length; sIdx++) {
        if (didCancelRef.current) break;
        const cSet = conflictSets[sIdx];

        // 試聴用の一時ファイルを準備
        for (const item of cSet.items) {
          if (item.type === 'DESKTOP' && !item.sourceUrlOrUri.startsWith('file://')) {
            const previewPath = `${baseDir}temp_preview_${Date.now()}_${item.fileName}`;
            tempPreviewFiles.push(previewPath);
            try {
              await downloadWithTimeout(item.sourceUrlOrUri, previewPath, headers, 20000);
              item.sourceUrlOrUri = previewPath; // 試聴可能ローカルURIに差し替え
            } catch (e) {
              console.warn('[Conflict Preview Download Error]', e);
            }
          }
        }

        // ポップアップを表示し、ユーザーの選択を待機
        const userDecision = await new Promise<{ action: 'ADOPT' | 'IGNORE'; adoptedItem?: ConflictItem } | 'ABORT'>((resolve) => {
          conflictResolverRef.current = resolve;
          setActiveConflictSet(cSet);
        });

        // 一時試聴ファイルを削除
        await cleanupTempPreviews();

        // 中断が選択された場合
        if (userDecision === 'ABORT') {
          didCancelRef.current = true;
          setIsFullScreenSyncing(false);
          setSyncProgress('');
          // 中断時はローカル追加曲のみのクリーン状態で終了
          await AsyncStorage.setItem('local_library', JSON.stringify(protectedLocalSongs));
          setLocalLibrary(protectedLocalSongs);
          syncMusicAndPlaylistsToCloud();
          return;
        }

        // 採用または両方除外の処理
        if (userDecision.action === 'ADOPT' && userDecision.adoptedItem) {
          const adopted = userDecision.adoptedItem;
          if (adopted.type === 'DESKTOP') {
            finalDesktopToDownload.push(adopted.desktopSongRef);
            // 競合していたローカル曲を削除
            for (const item of cSet.items) {
              if (item.type === 'LOCAL' && item.localSongRef?.localMusicUri) {
                try { await FileSystem.deleteAsync(item.localSongRef.localMusicUri, { idempotent: true }); } catch (e) {}
                const lIdx = protectedLocalSongs.findIndex(s => s.localMusicUri === item.localSongRef.localMusicUri);
                if (lIdx !== -1) protectedLocalSongs.splice(lIdx, 1);
              }
            }
          } else {
            // ローカル曲を採用（Desktop音源はダウンロードしない）
            // Desktop由来プレイリストが自己入手曲を参照できるようマッピングを記録
            const dItem = cSet.items.find(i => i.type === 'DESKTOP');
            if (dItem && adopted.fileName) {
              adoptedLocalReplacements.set(dItem.fileName, adopted.fileName);
            }
          }
        } else if (userDecision.action === 'IGNORE') {
          // 両方除外：ローカル曲も削除
          for (const item of cSet.items) {
            if (item.type === 'LOCAL' && item.localSongRef?.localMusicUri) {
              try { await FileSystem.deleteAsync(item.localSongRef.localMusicUri, { idempotent: true }); } catch (e) {}
              const lIdx = protectedLocalSongs.findIndex(s => s.localMusicUri === item.localSongRef.localMusicUri);
              if (lIdx !== -1) protectedLocalSongs.splice(lIdx, 1);
            }
          }
        }
      }

      if (didCancelRef.current) return;

      // ==============================================================
      // ステップ 3: 確定したDesktop楽曲のダウンロード
      // ==============================================================
      const downloadedDesktopSongs: any[] = [];

      for (let i = 0; i < finalDesktopToDownload.length; i++) {
        if (didCancelRef.current) break;
        await yieldToUI();

        const song = finalDesktopToDownload[i];
        const musicFname = song.musicFilename ? String(song.musicFilename).split(/[\\/]/).pop() : `song_${Date.now()}_${i}.mp3`;
        const musicLocalUri = baseDir + musicFname;

        const progressMsg = t('sync_downloading_progress', language)
          .replace('{current}', String(i + 1))
          .replace('{total}', String(finalDesktopToDownload.length))
          .replace('{title}', song.title || 'Untitled');
        setSyncProgress(progressMsg);

        try {
          await downloadWithTimeout(`${baseUrl}${song.url_music}`, musicLocalUri, headers, 60000);
        } catch (e) {
          console.warn(`[Sync] Music download failed: ${song.title}`);
        }

        let finalImgUri: string | null = null;
        if (song.url_image) {
          const imgFname = song.imageFilename ? String(song.imageFilename).split(/[\\/]/).pop() : `img_${Date.now()}_${i}.jpg`;
          finalImgUri = baseDir + imgFname;
          const imgInfo = await FileSystem.getInfoAsync(finalImgUri);
          if (!imgInfo.exists) {
            try {
              await downloadWithTimeout(`${baseUrl}${song.url_image}`, finalImgUri, headers, 15000);
            } catch (e) {}
          }
        }

        downloadedDesktopSongs.push({
          ...song,
          origin: 'desktop',
          localMusicUri: musicLocalUri,
          localImageUri: finalImgUri,
        });
      }

      if (didCancelRef.current) return;

      // 新しい全ライブラリ（保護されたローカル曲 ＋ 新規Desktop曲）
      const finalLibrary = [...protectedLocalSongs, ...downloadedDesktopSongs];
      await AsyncStorage.setItem('local_library', JSON.stringify(finalLibrary));
      setLocalLibrary(finalLibrary);

      // ==============================================================
      // ステップ 4: プレイリストの復元と自動置換
      // ==============================================================
      // 1. Mobile作成プレイリストへのスナップショット自動復元
      for (const snap of mobilePlaylistSnapshots) {
        const matchedNewSong = finalLibrary.find(s => 
          cleanStr(s.title) === cleanStr(snap.title) &&
          cleanStr(s.artist) === cleanStr(snap.artist) &&
          cleanStr(s.album) === cleanStr(snap.album)
        );
        if (matchedNewSong && matchedNewSong.musicFilename) {
          const pl = currentLocalPlaylists.find(p => p.id === snap.playlistId);
          if (pl && Array.isArray(pl.music)) {
            const fname = matchedNewSong.musicFilename.split(/[\\/]/).pop();
            if (fname) {
              const insertIdx = Math.min(snap.index, pl.music.length);
              pl.music.splice(insertIdx, 0, fname);
            }
          }
        }
      }

      // 2. Desktop由来プレイリストの同期 ＆ 自己入手曲への参照自動置換
      const targetPlaylistsForPl = selectedPls.size > 0 
        ? currentPcPlaylists.filter((_, i) => selectedPls.has(i)) 
        : currentPcPlaylists;

      for (let j = 0; j < targetPlaylistsForPl.length; j++) {
        if (didCancelRef.current) break;
        const pl = { ...targetPlaylistsForPl[j], origin: 'desktop' };

        // Desktop側指定ファイル名をローカル追加曲のファイル名に自動置換
        if (pl.type !== 'smart' && Array.isArray(pl.music)) {
          pl.music = pl.music.map((m: any) => {
            const origFname = (typeof m === 'string' ? m : m?.musicFilename || '').split(/[\\/]/).pop();
            if (origFname && adoptedLocalReplacements.has(origFname)) {
              return adoptedLocalReplacements.get(origFname);
            }
            return origFname || m;
          });
        }

        // カバー画像のダウンロード
        let coverUrl = pl.url_cover || pl.cover_url || pl.coverUrl;
        if (!coverUrl && (pl.coverPath || pl.cover_path || pl.coverFilename)) {
          const pathStr = String(pl.coverPath || pl.cover_path || pl.coverFilename);
          const fname = pathStr.split(/[\\/]/).pop();
          coverUrl = pathStr.replace(/\\/g, '/').includes('library/images') ? `/mobile_image/${fname}` : `/mobile_cover_image/${fname}`;
        }

        if (coverUrl) {
          const imgFname = String(coverUrl).split(/[\\/]/).pop();
          const localCoverUri = `${baseDir}cover_pl_${Date.now()}_${imgFname}`;
          try {
            const res = await downloadWithTimeout(`${baseUrl}${coverUrl}`, localCoverUri, headers, 15000);
            if (res && (res as any).status !== 404) pl.localCoverImageUri = localCoverUri;
          } catch (e) {}
        }

        currentLocalPlaylists.push(pl);
      }

      if (didCancelRef.current) return;

      await AsyncStorage.setItem('local_playlists', JSON.stringify(currentLocalPlaylists));
      setLocalPlaylists(currentLocalPlaylists);

      syncMusicAndPlaylistsToCloud();

      setIsFullScreenSyncing(false);
      setSyncProgress('');

      setTimeout(() => {
        Alert.alert(
          t('sync_complete_title', language), 
          t('sync_complete_desc', language).replace('{count}', String(downloadedDesktopSongs.length)), 
          [{ text: t('confirm', language), onPress: () => disconnect() }]
        );
      }, 100);

    } catch (e: any) {
      await cleanupTempPreviews();
      setIsFullScreenSyncing(false);
      setSyncProgress('');
      const errMsg = e?.message || String(e) || 'Unknown Error';
      setTimeout(() => {
        Alert.alert(t('sync_stopped_title', language), errMsg, [{ text: t('confirm', language), onPress: () => disconnect() }]);
      }, 100);
    }
  };

  const cancelSync = () => {
    didCancelRef.current = true;
    setIsAutoConnecting(false);
    setIsFullScreenSyncing(false);
    setSyncProgress('');
    setSyncStage('INPUT_IP');
    setAuthCodeInput('');
  };

  return {
    syncStage, setSyncStage, serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput,
    showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls,
    syncProgress, isSyncing, isFullScreenSyncing,
    requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect,
    setScannedQrData, clientInfo,
    activeConflictSet, resolveCurrentConflict,
  };
};