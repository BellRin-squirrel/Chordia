import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import * as Network from 'expo-network';

type QrData = {
  ip: string;
  port: string; // ポート番号を追加
  code: string;
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

const DEVICE_MODEL_MAP: Record<string, string> = {
  "iPhone18,1": "iPhone 17 Pro", "iPhone18,2": "iPhone 17 Pro Max", "iPhone18,3": "iPhone 17",
  "iPhone18,4": "iPhone Air", "iPhone18,5": "iPhone 17e", "iPhone17,1": "iPhone 16 Pro",
  "iPhone17,2": "iPhone 16 Pro Max", "iPhone17,3": "iPhone 16", "iPhone17,4": "iPhone 16 Plus",
  "iPhone17,5": "iPhone 16e", "iPhone16,1": "iPhone 15 Pro", "iPhone16,2": "iPhone 15 Pro Max",
  "iPhone15,4": "iPhone 15", "iPhone15,5": "iPhone 15 Plus", "iPhone15,2": "iPhone 14 Pro",
  "iPhone15,3": "iPhone 14 Pro Max", "iPhone14,7": "iPhone 14", "iPhone14,8": "iPhone 14 Plus",
  "iPhone14,5": "iPhone 13", "iPhone14,4": "iPhone 13 mini", "iPhone14,2": "iPhone 13 Pro",
  "iPhone14,3": "iPhone 13 Pro Max", "iPhone13,2": "iPhone 12", "iPhone13,1": "iPhone 12 mini",
  "iPhone13,3": "iPhone 12 Pro", "iPhone13,4": "iPhone 12 Pro Max", "iPhone12,1": "iPhone 11",
  "iPhone12,3": "iPhone 11 Pro", "iPhone12,5": "iPhone 11 Pro Max", "iPhone11,8": "iPhone XR",
  "iPhone11,2": "iPhone XS", "iPhone11,6": "iPhone XS Max", "iPhone10,3": "iPhone X",
  "iPhone10,6": "iPhone X", "iPhone14,6": "iPhone SE (3rd Gen)", "iPhone12,8": "iPhone SE (2nd Gen)",
  "iPhone8,4":  "iPhone SE (1st Gen)",
};

const getFriendlyDeviceName = (modelId: string | null): string => {
  if (!modelId) return "iPhone";
  return DEVICE_MODEL_MAP[modelId] || modelId;
};

export const useSync = ({ 
  closeFullPlayer, 
  stopAndUnloadPlayer,
  localLibrary, setLocalLibrary, setLocalPlaylists
}: UseSyncProps) => {

  const [syncStage, setSyncStage] = useState<'INPUT_IP' | 'AWAITING_APPROVAL' | 'AWAITING_CODE' | 'READY'>('INPUT_IP');
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('5000'); // ポート番号の状態を追加
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
      let deviceName = clientInfo.deviceName;
      try { ip = await Network.getIpAddressAsync(); } catch (e) {}
      try { 
        if (Device.modelId) deviceName = getFriendlyDeviceName(Device.modelId);
        else if (Device.modelName) deviceName = getFriendlyDeviceName(Device.modelName);
      } catch (e) {}
      setClientInfo(prev => ({ ...prev, ip, deviceName }));
    };
    fetchDeviceInfo();
  },[]);

  const isSyncingRef = useRef(isFullScreenSyncing);
  useEffect(() => { isSyncingRef.current = isFullScreenSyncing; }, [isFullScreenSyncing]);

  useEffect(() => {
    if (scannedQrData) {
      setServerIp(scannedQrData.ip);
      setServerPort(scannedQrData.port || '5000'); // QRからポートを取得
      setIsAutoConnecting(true);
      requestAuthToPC(scannedQrData.ip, scannedQrData.port || '5000'); 
      setScannedQrData(null); 
    }
  }, [scannedQrData]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;
    let timeoutHandler: NodeJS.Timeout | null = null;

    if (syncStage === 'AWAITING_APPROVAL' && serverIp) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`http://${serverIp}:${serverPort}/api/auth/check`, {
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
          const res = await fetch(`http://${serverIp}:${serverPort}/api/auth/verify_session`, {
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
    try {
      const res = await fetch(`http://${ip}:${port}/api/auth/request`, {
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
      Alert.alert('接続エラー', 'PCに接続できません。IPとポート番号、およびPC版が同期画面を開いているか確認してください。'); 
    }
    finally { setIsSyncing(false); }
  };

  const verifyAuthCode = async (ip: string, port: string, code: string) => {
    setIsSyncing(true);
    try {
      const res = await fetch(`http://${ip}:${port}/api/auth/verify`, {
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
    try {
      const res = await fetch(`http://${ip}:${port}/api/playlists`, {
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
        try {
            await fetch(`http://${serverIp}:${serverPort}/api/auth/logout`, {
                method: 'POST',
                headers: { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion }
            });
        } catch(e) { }
    }
    setSyncStage('INPUT_IP');
    setApiKey(null);
    setPcPlaylists([]);
  };
  
  const startSyncDownload = async (isAll: boolean) => {
    if (!serverIp || !apiKey) { Alert.alert('エラー', '接続が確立されていません。'); return; }
    didCancelRef.current = false;
    closeFullPlayer();
    await stopAndUnloadPlayer();
    setIsFullScreenSyncing(true);
    
    try {
        const headers = { 'X-API-KEY': apiKey, 'X-DEVICE-IP': clientInfo.ip, 'X-DEVICE-NAME': clientInfo.deviceName, 'X-DEVICE-OS': clientInfo.osVersion };
        setSyncProgress('ライブラリ情報を取得中...');
        const resLib = await fetch(`http://${serverIp}:${serverPort}/api/library`, { headers });
        const dataLib = await resLib.json();
        const allSongs = dataLib.library ||[];

        let targetPlaylists = isAll ? pcPlaylists : pcPlaylists.filter((_, i) => selectedPls.has(i));
        let targets = isAll ? allSongs : allSongs.filter((s: any) => new Set(targetPlaylists.flatMap(pl => pl.music)).has(s.musicFilename.split(/[\\/]/).pop()));

        let downloadedData: any[] =[];
        const baseDir = FileSystem.documentDirectory + 'chordia/';
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

        for (let i = 0; i < targets.length; i++) {
            if (didCancelRef.current) break;
            const song = targets[i];
            setSyncProgress(`同期中... (${i + 1}/${targets.length})`);
            const musicFname = song.musicFilename.split(/[\\/]/).pop();
            const musicLocalUri = baseDir + musicFname;
            await FileSystem.downloadAsync(`http://${serverIp}:${serverPort}${song.url_music}`, musicLocalUri, { headers });
            
            let imgLocalUri = "";
            if (song.url_image) {
                const imgFname = song.imageFilename ? song.imageFilename.split(/[\\/]/).pop() : `img_${i}.jpg`;
                imgLocalUri = baseDir + imgFname;
                await FileSystem.downloadAsync(`http://${serverIp}:${serverPort}${song.url_image}`, imgLocalUri, { headers });
            }
            downloadedData.push({ ...song, localMusicUri: musicLocalUri, localImageUri: imgLocalUri });
        }

        if (didCancelRef.current) { await clearAllLocalData(); return; }

        await AsyncStorage.setItem('local_library', JSON.stringify(downloadedData));
        await AsyncStorage.setItem('local_playlists', JSON.stringify(targetPlaylists));
        setLocalLibrary(downloadedData);
        setLocalPlaylists(targetPlaylists);

        Alert.alert("同期完了", `${targets.length}曲の同期が完了しました！`,[{ text: "OK", onPress: () => disconnect() }]);
    } catch (e: any) {
        if (didCancelRef.current) return;
        await clearAllLocalData();
        Alert.alert("同期エラー", `同期が中断されました。(${e.message})`,[{ text: "OK", onPress: () => disconnect() }]);
    } finally {
        setIsFullScreenSyncing(false);
        setSyncProgress('');
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