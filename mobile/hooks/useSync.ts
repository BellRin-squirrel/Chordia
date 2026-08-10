import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import DeviceInfo from 'react-native-device-info';

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
};

type ClientInfo = {
  ip: string;
  deviceName: string;
  osVersion: string;
};

// ★ 修正: https:// なしのドメイン名が手動入力された場合でも自動で https:// を安全補完
const buildUrl = (ip: string, port: string) => {
  let cleanIp = ip ? ip.trim().replace(/[\r\n]/g, '') : '';
  let cleanPort = port ? port.trim().replace(/[\r\n]/g, '') : '';
  
  if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) {
    return cleanIp.replace(/\/$/, ''); 
  }
  
  // ドメイン名（. を含む文字列）の場合は自動的に https:// を付与
  if (cleanIp.includes('.')) {
    return `https://${cleanIp}`;
  }
  
  return `http://${cleanIp}:${cleanPort}`;
};

const cleanStr = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.normalize('NFC').toLowerCase().trim();
};

const getFileName = (pathStr: string | null | undefined): string => {
  if (!pathStr) return '';
  const fname = pathStr.split(/[\\/]/).pop();
  return fname ? cleanStr(fname) : '';
};

const safeFetchJson = async (url: string, options: any = {}) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  if (text.trim().startsWith('<')) {
    throw new Error(`PCサーバーからHTMLエラー画面が返されました (HTTP ${res.status})`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`応答データの解析失敗 (HTTP ${res.status}): ${text.substring(0, 60)}`);
  }
};

const downloadWithTimeout = async (url: string, fileUri: string, headers: any, timeoutMs: number) => {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`通信がタイムアウトしました (${Math.floor(timeoutMs / 1000)}秒)`));
    }, timeoutMs);

    try {
      const fullHeaders = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        ...headers
      };
      const result = await FileSystem.createDownloadResumable(url, fileUri, { headers: fullHeaders }).downloadAsync();
      clearTimeout(timer);
      resolve(result);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
};

const yieldToUI = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
          console.warn(`[Sync Debug] ⚠️ ${label} timed out after ${ms}ms — 続行します`);
          resolve(undefined as any);
      }, ms);
      promise.then(v => { clearTimeout(timer); resolve(v); })
             .catch(e => { clearTimeout(timer); reject(e); });
  });
};

export const useSync = ({ 
  closeFullPlayer, 
  stopAndUnloadPlayer,
  localLibrary, setLocalLibrary, setLocalPlaylists
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
        
        if (rnModel && !rnModel.includes(',')) {
            finalDeviceName = rnModel;
        } else if (expoModel && !expoModel.includes(',')) {
            finalDeviceName = expoModel;
        } else if (rnModel) {
            finalDeviceName = rnModel.replace(/[0-9,]/g, '').trim() || rnModel;
        }
      } catch (e) {}

      setClientInfo(prev => ({ ...prev, ip, deviceName: finalDeviceName }));
    };
    fetchDeviceInfo();
  },[]);

  const isSyncingRef = useRef(isFullScreenSyncing);
  useEffect(() => { isSyncingRef.current = isFullScreenSyncing; }, [isFullScreenSyncing]);

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
              Alert.alert('拒否されました', 'PC側で接続が拒否されました。');
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
        Alert.alert("応答がありません", "PCからの応答がタイムアウトしました。");
        cancelSync();
      }, 30000);
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeoutHandler) clearTimeout(timeoutHandler);
    };
  }, [syncStage, serverIp, serverPort, clientInfo, isAutoConnecting]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (apiKey && serverIp) {
      interval = setInterval(async () => {
        if (didCancelRef.current) { if(interval) clearInterval(interval); return; }
        try {
          const baseUrl = buildUrl(serverIp, serverPort);
          await safeFetchJson(`${baseUrl}/api/auth/verify_session`, {
            headers: { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
          });
        } catch (e: any) {
          if (e.message?.includes('403') || e.message?.includes('401')) {
            if (interval) clearInterval(interval);
            handleForceDisconnect();
          }
        }
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  },[apiKey, serverIp, serverPort, clientInfo]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('権限が必要です', 'QRコードをスキャンするにはカメラへのアクセスを許可してください。');
      return false;
    }
    return true;
  };

  const requestAuthToPC = async (ip: string, port: string) => {
    setIsSyncing(true);
    setAuthCodeInput('');
    const baseUrl = buildUrl(ip, port);
    
    try {
      console.log(`[Sync] Requesting auth to PC: ${baseUrl}/api/auth/request`);
      const data = await safeFetchJson(`${baseUrl}/api/auth/request`, {
        method: 'POST',
        body: JSON.stringify({ ip: clientInfo.ip, device: clientInfo.deviceName, os: clientInfo.osVersion })
      });
      
      console.log(`[Sync] Response data:`, JSON.stringify(data));

      if (data && data.status === 'pending') {
        setServerIp(ip);
        setServerPort(port);
        setSyncStage('AWAITING_APPROVAL');
      } else { 
        const detail = data?.message || data?.error || (data?.status ? `ステータス: ${data.status}` : JSON.stringify(data));
        throw new Error(detail); 
      }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert('接続エラー', `PCに接続できませんでした。\n理由: ${e.message || '通信失敗'}`); 
    }
    finally { setIsSyncing(false); }
  };

  const verifyAuthCode = async (ip: string, port: string, code: string) => {
    setIsSyncing(true);
    const baseUrl = buildUrl(ip, port);
    try {
      console.log(`[Sync] Verifying auth code with PC: ${baseUrl}`);
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
      } else { throw new Error(data.message || '認証に失敗しました'); }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert('認証エラー', e.message); 
    }
    finally { setIsSyncing(false); }
  };

  const fetchPlaylists = async (ip: string, port: string, key: string) => {
    const baseUrl = buildUrl(ip, port);
    try {
      const data = await safeFetchJson(`${baseUrl}/api/playlists`, {
        headers: { 'X-API-KEY': key, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
      });
      if (data.playlists) setPcPlaylists(data.playlists);
      else throw new Error(data.error || 'プレイリストの取得に失敗しました');
    } catch (e: any) { Alert.alert('エラー', e.message); }
  };

  const clearAllLocalData = async () => {
    try {
      const baseDir = FileSystem.documentDirectory + 'chordia/';
      const dirInfo = await FileSystem.getInfoAsync(baseDir);
      if (dirInfo.exists) await FileSystem.deleteAsync(baseDir, { idempotent: true });
      await AsyncStorage.removeItem('local_library');
      await AsyncStorage.removeItem('local_playlists');
      setLocalLibrary([]);
      setLocalPlaylists([]);
    } catch (e) {}
  };

  const handleForceDisconnect = async () => {
    didCancelRef.current = true;
    setIsAutoConnecting(false);
    if (isSyncingRef.current) {
        setIsFullScreenSyncing(false);
        setSyncProgress('');
        await clearAllLocalData();
        Alert.alert("切断されました", "同期中にPCから切断されました。");
    } else { Alert.alert("切断されました", "PCから接続が解除されました。"); }
    setSyncStage('INPUT_IP');
    setApiKey(null);
    setPcPlaylists([]);
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
        } catch(e) { }
    }
    setSyncStage('INPUT_IP');
    setApiKey(null);
    setPcPlaylists([]);
  };
  
  const startSyncDownload = async (mode: 'KEEP_DUPLICATES' | 'DELETE_ALL') => {
    if (!serverIp || !apiKey) { Alert.alert('エラー', '接続が確立されていません。'); return; }
    
    didCancelRef.current = false;
    setIsFullScreenSyncing(true);
    setSyncProgress('プレイヤーを停止中...');

    await yieldToUI();

    const baseUrl = buildUrl(serverIp, serverPort);

    try {
        if (closeFullPlayer) closeFullPlayer();
        if (stopAndUnloadPlayer) {
            await withTimeout(stopAndUnloadPlayer(), 3000, 'stopAndUnloadPlayer');
        }

        setSyncProgress('PCからライブラリ情報を取得中...');
        await yieldToUI();

        const headers = { 
          'X-API-KEY': apiKey, 
          'X-DEVICE-IP': clientInfo.ip, 
          'X-DEVICE-NAME': clientInfo.deviceName, 
          'X-DEVICE-OS': clientInfo.osVersion 
        };

        const dataLib = await safeFetchJson(`${baseUrl}/api/library`, { headers });
        const allSongs = dataLib.library || [];

        setSyncProgress('PCからプレイリスト情報を取得中...');
        await yieldToUI();

        let currentPcPlaylists = pcPlaylists;
        try {
            const dataPls = await safeFetchJson(`${baseUrl}/api/playlists`, { headers });
            if (dataPls.playlists) {
                currentPcPlaylists = dataPls.playlists;
                setPcPlaylists(currentPcPlaylists);
            }
        } catch(e) {}

        setSyncProgress('同期対象を計算中...');
        await yieldToUI();

        let targetPlaylists = selectedPls.size > 0 ? currentPcPlaylists.filter((_, i) => selectedPls.has(i)) : currentPcPlaylists;
        
        const musicSet = new Set(
          targetPlaylists.flatMap(pl => (pl.music || []).map((m: any) => getFileName(typeof m === 'string' ? m : "")))
        );

        let targets = allSongs.filter((s: any) => {
          if (!s || !s.musicFilename) return false;
          const fname = getFileName(s.musicFilename);
          return fname ? musicSet.has(fname) : false;
        });

        if (targets.length === 0) {
            if (didCancelRef.current) return;
            setIsFullScreenSyncing(false);
            setSyncProgress('');
            setTimeout(() => {
              Alert.alert("通知", "同期対象となる楽曲が見つかりませんでした。");
            }, 100);
            return;
        }

        const baseDir = FileSystem.documentDirectory + 'chordia/';
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

        let currentLocal = [...localLibrary];
        const targetTitleArtists = new Set();
        for (const t of targets) {
            if (t.title && t.artist) {
                targetTitleArtists.add(`${cleanStr(t.title)}:::${cleanStr(t.artist)}`);
            }
        }

        if (mode === 'DELETE_ALL') {
            setSyncProgress('ローカルデータをすべて消去してクリーン化中...');
            await yieldToUI();

            try {
                const dirInfo = await FileSystem.getInfoAsync(baseDir);
                if (dirInfo.exists) {
                    await FileSystem.deleteAsync(baseDir, { idempotent: true });
                }
            } catch (e) {
                console.warn("[Sync] Directory deletion error:", e);
            }

            await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

            currentLocal = [];
            await AsyncStorage.setItem('local_library', JSON.stringify([]));
            await AsyncStorage.setItem('local_playlists', JSON.stringify([]));
            setLocalLibrary([]);
            setLocalPlaylists([]);
            
        } else if (mode === 'KEEP_DUPLICATES') {
            await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
            
            setSyncProgress('同期対象外の楽曲を整理中...');
            await yieldToUI();

            const updatedLocalList: any[] = [];
            
            for (let i = 0; i < currentLocal.length; i++) {
                if (i % 50 === 0) {
                    setSyncProgress(`ローカル楽曲を整理中... (${i + 1}/${currentLocal.length})`);
                    await yieldToUI();
                }
                
                const localSong = currentLocal[i];
                const titleArtistKey = localSong.title && localSong.artist ? `${cleanStr(localSong.title)}:::${cleanStr(localSong.artist)}` : "";
                const isTarget = titleArtistKey ? targetTitleArtists.has(titleArtistKey) : false;

                if (!isTarget) {
                    if (localSong.localMusicUri) {
                        try { await FileSystem.deleteAsync(localSong.localMusicUri, { idempotent: true }); } catch (e) {}
                    }
                    if (localSong.localImageUri) {
                        try { await FileSystem.deleteAsync(localSong.localImageUri, { idempotent: true }); } catch (e) {}
                    }
                } else {
                    updatedLocalList.push(localSong);
                }
            }
            currentLocal = updatedLocalList;
        }

        const libraryMap = new Map();
        for (const s of currentLocal) {
            if (s.title && s.artist) {
                libraryMap.set(`${cleanStr(s.title)}:::${cleanStr(s.artist)}`, s);
            }
        }

        for (let i = 0; i < targets.length; i++) {
            if (didCancelRef.current) break;
            
            await yieldToUI();

            const song = targets[i];
            const musicFname = song.musicFilename ? song.musicFilename.split(/[\\/]/).pop() : `song_${i}.mp3`;
            const musicLocalUri = baseDir + musicFname;

            setSyncProgress(`楽曲を同期中... (${i + 1}/${targets.length})\n${song.title || 'Untitled'}`);
            
            const songKey = song.title && song.artist ? `${cleanStr(song.title)}:::${cleanStr(song.artist)}` : "";
            const existingLocal = songKey ? libraryMap.get(songKey) : undefined;

            let finalMusicUri = musicLocalUri;
            let finalImgUri = "";

            if (mode === 'KEEP_DUPLICATES' && existingLocal && existingLocal.localMusicUri) {
                const fileCheck = await FileSystem.getInfoAsync(existingLocal.localMusicUri);
                if (fileCheck.exists) {
                    finalMusicUri = existingLocal.localMusicUri;
                    finalImgUri = existingLocal.localImageUri || "";
                } else {
                    try {
                        await downloadWithTimeout(`${baseUrl}${song.url_music}`, musicLocalUri, headers, 60000);
                    } catch(e) { console.warn(`Music download timeout: ${song.title}`); }
                }
            } else {
                try {
                    await downloadWithTimeout(`${baseUrl}${song.url_music}`, musicLocalUri, headers, 60000);
                } catch(e) { console.warn(`Music download timeout: ${song.title}`); }
            }

            if (song.url_image && (!finalImgUri || mode === 'DELETE_ALL')) {
                const imgFname = song.imageFilename ? song.imageFilename.split(/[\\/]/).pop() : `img_${i}.jpg`;
                finalImgUri = baseDir + imgFname;
                const imgInfo = await FileSystem.getInfoAsync(finalImgUri);
                if (!imgInfo.exists) {
                    try {
                        await downloadWithTimeout(`${baseUrl}${song.url_image}`, finalImgUri, headers, 15000);
                    } catch(e) { console.warn(`Image download timeout: ${song.title}`); }
                }
            }

            const newSongItem = { ...song, localMusicUri: finalMusicUri, localImageUri: finalImgUri };
            
            if (songKey) {
                libraryMap.set(songKey, newSongItem);
            } else {
                libraryMap.set(`fallback_${i}_${Date.now()}`, newSongItem);
            }
        }

        if (didCancelRef.current) {
            setIsFullScreenSyncing(false);
            setSyncProgress('');
            return;
        }

        const finalLibrarySet = new Set(libraryMap.values());
        const updatedLibrary = Array.from(finalLibrarySet);

        await AsyncStorage.setItem('local_library', JSON.stringify(updatedLibrary));
        setLocalLibrary(updatedLibrary);

        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        const processedPlaylists: any[] = [];
        for (let j = 0; j < targetPlaylists.length; j++) {
            if (didCancelRef.current) break;
            const pl = { ...targetPlaylists[j] };
            
            let coverUrl = pl.url_cover || pl.cover_url || pl.coverUrl;
            if (!coverUrl && (pl.coverPath || pl.cover_path || pl.coverFilename)) {
                const pathStr = pl.coverPath || pl.cover_path || pl.coverFilename;
                const fname = pathStr.split(/[\\/]/).pop();
                
                const normalizedPath = pathStr.replace(/\\/g, '/');
                if (normalizedPath.includes('library/images')) {
                    coverUrl = `/mobile_image/${fname}`;
                } else {
                    coverUrl = `/mobile_cover_image/${fname}`;
                }
            }

            if (coverUrl) {
                const imgFname = coverUrl.split(/[\\/]/).pop();
                const uniqueFname = `cover_pl_${Date.now()}_${imgFname}`;
                const localCoverUri = baseDir + uniqueFname;
                
                try {
                    const msg = `プレイリストカバーを同期中... (${j + 1}/${targetPlaylists.length})\n${pl.playlistName || 'Untitled'}`;
                    setSyncProgress(msg);
                    await yieldToUI();
                    
                    const res = await downloadWithTimeout(`${baseUrl}${coverUrl}`, localCoverUri, headers, 15000);
                    
                    if (res && (res as any).status !== 404) {
                        pl.localCoverImageUri = localCoverUri;
                    }
                } catch (e) {
                    console.warn("[Sync Download] Playlist cover download error:", e);
                }
            }
            processedPlaylists.push(pl);
        }

        if (didCancelRef.current) {
            setIsFullScreenSyncing(false);
            setSyncProgress('');
            return;
        }

        await AsyncStorage.setItem('local_playlists', JSON.stringify(processedPlaylists));
        setLocalPlaylists(processedPlaylists);

        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        setIsFullScreenSyncing(false);
        setSyncProgress('');

        setTimeout(() => {
            Alert.alert("同期完了", `${targets.length}曲の同期処理が完了しました！`, [{ 
                text: "OK", 
                onPress: () => disconnect() 
            }]);
        }, 100);

    } catch (e: any) {
        console.error("[Sync Download Error]:", e);
        setIsFullScreenSyncing(false);
        setSyncProgress('');
        
        const errMsg = e.message || '';
        const is403 = errMsg.includes('403');
        
        if (didCancelRef.current && !is403) {
            return;
        }

        setTimeout(() => {
            Alert.alert(
              "同期エラー", 
              is403 ? "セッションが無効になりました（PCから強制切断された可能性があります）。" : `同期が中断されました。(${errMsg})`, 
              [{ text: "OK", onPress: () => disconnect() }]
            );
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
    setScannedQrData, clientInfo
  };
};