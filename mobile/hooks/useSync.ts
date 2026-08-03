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

const buildUrl = (ip: string, port: string) => {
  if (ip.startsWith('http://') || ip.startsWith('https://')) {
    return ip.replace(/\/$/, ''); 
  }
  return `http://${ip}:${port}`;
};

const downloadWithTimeout = async (url: string, fileUri: string, headers: any, timeoutMs: number) => {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Download timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    try {
      const result = await FileSystem.createDownloadResumable(url, fileUri, { headers }).downloadAsync();
      clearTimeout(timer);
      resolve(result);
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
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
          const res = await fetch(`${baseUrl}/api/auth/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: clientInfo.ip }) 
          });
          const data = await res.json();
          
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
          const res = await fetch(`${baseUrl}/api/auth/verify_session`, {
            headers: { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
          });
          if (res.status === 403 || res.status === 401) { if (interval) clearInterval(interval); handleForceDisconnect(); }
        } catch (e) {}
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
      console.log(`[Sync] Requesting auth to PC: ${baseUrl}`);
      const res = await fetch(`${baseUrl}/api/auth/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: clientInfo.ip, device: clientInfo.deviceName, os: clientInfo.osVersion })
      });
      const data = await res.json();
      if (data.status === 'pending') {
        setServerIp(ip);
        setServerPort(port);
        setSyncStage('AWAITING_APPROVAL');
      } else { throw new Error(data.message || 'PCが要求を拒否しました'); }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert('接続エラー', 'PCに接続できません。URLやIP、PC版が同期画面を開いているか確認してください。'); 
    }
    finally { setIsSyncing(false); }
  };

  const verifyAuthCode = async (ip: string, port: string, code: string) => {
    setIsSyncing(true);
    const baseUrl = buildUrl(ip, port);
    try {
      console.log(`[Sync] Verifying auth code with PC: ${baseUrl}`);
      const res = await fetch(`${baseUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ip: clientInfo.ip, device: clientInfo.deviceName, os: clientInfo.osVersion })
      });
      const data = await res.json();
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
      const res = await fetch(`${baseUrl}/api/playlists`, {
        headers: { 'X-API-KEY': key, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
      });
      const data = await res.json();
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
            await fetch(`${baseUrl}/api/auth/logout`, {
                method: 'POST',
                headers: { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
            });
        } catch(e) { }
    }
    setSyncStage('INPUT_IP');
    setApiKey(null);
    setPcPlaylists([]);
  };
  
  // ★ 最適化された同期ダウンロード処理（大量State更新によるフリーズを完全回避）
  const startSyncDownload = async (mode: 'KEEP_DUPLICATES' | 'DELETE_ALL') => {
    if (!serverIp || !apiKey) { Alert.alert('エラー', '接続が確立されていません。'); return; }
    
    didCancelRef.current = false;
    setIsFullScreenSyncing(true);
    setSyncProgress('プレイヤーを停止中...');

    const baseUrl = buildUrl(serverIp, serverPort);
    
    // ★ 修正: React State を直接書き換えずに、確定した最終データだけを後から反映するための変数
    let finalLibraryToSet: any[] | null = null;
    let finalPlaylistsToSet: any[] | null = null;

    try {
        if (closeFullPlayer) closeFullPlayer();
        if (stopAndUnloadPlayer) await stopAndUnloadPlayer();

        const headers = { 
          'X-API-KEY': apiKey, 
          'X-DEVICE-IP': clientInfo.ip, 
          'X-DEVICE-NAME': clientInfo.deviceName, 
          'X-DEVICE-OS': clientInfo.osVersion 
        };

        setSyncProgress('PCからライブラリ情報を取得中...');
        const resLib = await fetch(`${baseUrl}/api/library`, { headers });
        if (!resLib.ok) {
           throw new Error(`PCライブラリの取得に失敗しました (HTTP ${resLib.status})`);
        }
        
        const dataLib = await resLib.json();
        const allSongs = dataLib.library || [];

        let targetPlaylists = selectedPls.size > 0 ? pcPlaylists.filter((_, i) => selectedPls.has(i)) : pcPlaylists;
        const musicSet = new Set(
          targetPlaylists.flatMap(pl => (pl.music || []).map((m: any) => typeof m === 'string' ? m.split(/[\\/]/).pop() : ""))
        );

        let targets = allSongs.filter((s: any) => {
          if (!s || !s.musicFilename) return false;
          const fname = s.musicFilename.split(/[\\/]/).pop();
          return musicSet.has(fname);
        });

        if (targets.length === 0) {
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
        const targetFilenames = new Set();
        const targetTitleArtists = new Set();
        for (const t of targets) {
            if (t.musicFilename) targetFilenames.add(t.musicFilename.split(/[\\/]/).pop());
            if (t.title && t.artist) targetTitleArtists.add(`${t.title}:::${t.artist}`);
        }

        if (mode === 'DELETE_ALL') {
            setSyncProgress('ローカル楽曲をすべて削除中...');
            for (const localSong of currentLocal) {
                if (localSong.localMusicUri) {
                    try { await FileSystem.deleteAsync(localSong.localMusicUri, { idempotent: true }); } catch (e) {}
                }
                if (localSong.localImageUri) {
                    try { await FileSystem.deleteAsync(localSong.localImageUri, { idempotent: true }); } catch (e) {}
                }
            }
            currentLocal = [];
            // Stateの更新は行わず、Storageのみ更新
            await AsyncStorage.setItem('local_library', JSON.stringify([]));
            finalLibraryToSet = [];
            
        } else if (mode === 'KEEP_DUPLICATES') {
            setSyncProgress('同期対象外の楽曲を整理中...');
            const updatedLocalList: any[] = [];
            
            for (let i = 0; i < currentLocal.length; i++) {
                if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
                
                const localSong = currentLocal[i];
                const localFname = localSong.musicFilename ? localSong.musicFilename.split(/[\\/]/).pop() : "";
                const isTarget = targetFilenames.has(localFname) || targetTitleArtists.has(`${localSong.title}:::${localSong.artist}`);

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
            await AsyncStorage.setItem('local_library', JSON.stringify(currentLocal));
            finalLibraryToSet = currentLocal;
        }

        const libraryMap = new Map();
        for (const s of currentLocal) {
            const fname = s.musicFilename ? s.musicFilename.split(/[\\/]/).pop() : "";
            if (fname) libraryMap.set(fname, s);
            else if (s.title && s.artist) libraryMap.set(`${s.title}:::${s.artist}`, s);
        }

        for (let i = 0; i < targets.length; i++) {
            if (didCancelRef.current) break;
            if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1));

            const song = targets[i];
            const musicFname = song.musicFilename ? song.musicFilename.split(/[\\/]/).pop() : `song_${i}.mp3`;
            const musicLocalUri = baseDir + musicFname;

            setSyncProgress(`楽曲を同期中... (${i + 1}/${targets.length})\n${song.title || 'Untitled'}`);

            const existingLocal = libraryMap.get(musicFname) || libraryMap.get(`${song.title}:::${song.artist}`);

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
            
            if (musicFname) libraryMap.set(musicFname, newSongItem);
            else if (song.title && song.artist) libraryMap.set(`${song.title}:::${song.artist}`, newSongItem);
        }

        if (didCancelRef.current) return;

        const finalLibrarySet = new Set(libraryMap.values());
        const updatedLibrary = Array.from(finalLibrarySet);

        await AsyncStorage.setItem('local_library', JSON.stringify(updatedLibrary));
        finalLibraryToSet = updatedLibrary;

        const processedPlaylists: any[] = [];
        for (let j = 0; j < targetPlaylists.length; j++) {
            const pl = { ...targetPlaylists[j] };
            
            let coverUrl = pl.url_cover || pl.cover_url || pl.coverUrl;
            if (!coverUrl && (pl.coverPath || pl.cover_path || pl.coverFilename)) {
                const pathStr = pl.coverPath || pl.cover_path || pl.coverFilename;
                const fname = pathStr.split(/[\\/]/).pop();
                coverUrl = `/mobile_cover_image/${fname}`;
            }

            if (coverUrl) {
                const imgFname = coverUrl.split(/[\\/]/).pop();
                const localCoverUri = baseDir + "cover_pl_" + imgFname;
                try {
                    const imgInfo = await FileSystem.getInfoAsync(localCoverUri);
                    if (!imgInfo.exists || mode === 'DELETE_ALL') {
                        setSyncProgress(`プレイリストカバーを同期中... (${j + 1}/${targetPlaylists.length})`);
                        await downloadWithTimeout(`${baseUrl}${coverUrl}`, localCoverUri, headers, 15000);
                    }
                    pl.localCoverImageUri = localCoverUri;
                } catch (e) {
                    console.warn("[Sync Download] Playlist cover download error:", e);
                }
            }
            processedPlaylists.push(pl);
        }

        await AsyncStorage.setItem('local_playlists', JSON.stringify(processedPlaylists));
        finalPlaylistsToSet = processedPlaylists;

        // ★ 修正: アラートを出す前に必ず全画面ブロックを解除し、重いState更新はアラートを閉じた後に実行する
        setIsFullScreenSyncing(false);
        setSyncProgress('');

        setTimeout(() => {
            Alert.alert("同期完了", `${targets.length}曲の同期処理が完了しました！`, [{ 
                text: "OK", 
                onPress: () => {
                    disconnect();
                    // 画面の遷移やアニメーションが完全に落ち着いてから大量のState更新を実行
                    setTimeout(() => {
                        if (finalLibraryToSet) setLocalLibrary([...finalLibraryToSet]);
                        if (finalPlaylistsToSet) setLocalPlaylists(finalPlaylistsToSet);
                    }, 400);
                } 
            }]);
        }, 100);

    } catch (e: any) {
        console.error("[Sync Download Error]:", e);
        setIsFullScreenSyncing(false);
        setSyncProgress('');
        
        // ★ 修正: 403 (セッション切れ) だった場合の専用プロンプト表示
        const errMsg = e.message || '';
        const is403 = errMsg.includes('403');
        
        if (didCancelRef.current && !is403) {
            if (finalLibraryToSet) setLocalLibrary([...finalLibraryToSet]);
            return;
        }

        setTimeout(() => {
            Alert.alert(
              "同期エラー", 
              is403 ? "セッションが無効になりました（PCから強制切断された可能性があります）。" : `同期が中断されました。(${errMsg})`, 
              [{ 
                  text: "OK", 
                  onPress: () => {
                      disconnect();
                      setTimeout(() => {
                          if (finalLibraryToSet) setLocalLibrary([...finalLibraryToSet]);
                      }, 400);
                  } 
              }]
            );
        }, 100);
    }
  };

  const cancelSync = () => {
    didCancelRef.current = true;
    setIsAutoConnecting(false);
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