import { useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import DeviceInfo from 'react-native-device-info';
import { getPlaylistSongs } from '../utils/playlistEvaluator';
import { LanguageCode, t } from '../utils/i18n';

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

  if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) {
    return cleanIp.replace(/\/$/, ''); 
  }
  
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp);
  if (isIpv4) {
    return `http://${cleanIp}:${cleanPort}`;
  }

  if (cleanIp.includes('.')) {
    return `https://${cleanIp}`;
  }
  
  return `http://${cleanIp}:${cleanPort}`;
};

const cleanStr = (str: any): string => {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s.normalize('NFC').toLowerCase().trim();
};

const getFileName = (pathStr: any): string => {
  if (pathStr === null || pathStr === undefined) return '';
  const s = String(pathStr);
  const fname = s.split(/[\\/]/).pop();
  return fname ? cleanStr(fname) : '';
};

const safeFetchJson = async (url: string, options: any = {}) => {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  if (text.trim().startsWith('<')) {
    throw new Error(`HTTP ${res.status}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 60)}`);
  }
};

const downloadWithTimeout = async (url: string, fileUri: string, headers: any, timeoutMs: number) => {
  let timer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout (${Math.floor(timeoutMs / 1000)}s)`));
    }, timeoutMs);
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

const yieldToUI = () =>
  new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
          console.warn(`[Sync Debug] ⚠️ ${label} timed out after ${ms}ms`);
          resolve(undefined as any);
      }, ms);
      promise.then(v => { clearTimeout(timer); resolve(v); })
             .catch(e => { clearTimeout(timer); reject(e); });
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
        const detail = data?.message || data?.error || (data?.status ? `status: ${data.status}` : JSON.stringify(data));
        throw new Error(detail); 
      }
    } catch (e: any) { 
      setIsAutoConnecting(false);
      Alert.alert(t('sync_connect_error_title', language), `${t('sync_connect_error_prefix', language)}${e.message || 'Network Error'}`); 
    }
    finally { setIsSyncing(false); }
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
      else throw new Error(data.error || 'Failed to fetch playlists');
    } catch (e: any) { Alert.alert(t('alert_timer_error_title', language), e.message); }
  };

  const clearAllLocalData = async () => {
    try {
      const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
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
        Alert.alert(t('sync_disconnected_title', language), t('sync_disconnected_during_sync', language));
    } else { 
        Alert.alert(t('sync_disconnected_title', language), t('sync_disconnected_idle', language)); 
    }
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
    if (!serverIp || !apiKey) { Alert.alert(t('alert_timer_error_title', language), t('sync_not_connected', language)); return; }
    
    didCancelRef.current = false;
    setIsFullScreenSyncing(true);
    setSyncProgress(t('sync_stopping_player', language));

    await yieldToUI();

    const baseUrl = buildUrl(serverIp, serverPort);

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
        } catch(e) {}

        setSyncProgress(t('sync_calculating_targets', language));
        await yieldToUI();

        let targets: any[] = [];
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

            targets = allSongs.filter((s: any) => {
              if (!s || !s.musicFilename) return false;
              const fname = getFileName(s.musicFilename);
              return fname ? targetFilenameSet.has(fname) : false;
            });
        } else {
            targets = allSongs;
        }

        if (targets.length === 0) {
            if (didCancelRef.current) return;
            setIsFullScreenSyncing(false);
            setSyncProgress('');
            setTimeout(() => {
              Alert.alert(t('sync_complete_title', language), t('sync_no_targets', language));
            }, 100);
            return;
        }

        const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
        await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

        let currentLocal = Array.isArray(localLibrary) ? [...localLibrary] : [];
        const targetTitleArtists = new Set();
        for (const tg of targets) {
            if (tg && tg.title && tg.artist) {
                targetTitleArtists.add(`${cleanStr(tg.title)}:::${cleanStr(tg.artist)}`);
            }
        }

        if (mode === 'DELETE_ALL') {
            setSyncProgress(t('sync_cleaning_local', language));
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
            
            setSyncProgress(t('sync_organizing_local', language));
            await yieldToUI();

            const updatedLocalList: any[] = [];
            
            for (let i = 0; i < currentLocal.length; i++) {
                if (i % 50 === 0) {
                    const msg = t('sync_organizing_progress', language).replace('{current}', String(i + 1)).replace('{total}', String(currentLocal.length));
                    setSyncProgress(msg);
                    await yieldToUI();
                }
                
                const localSong = currentLocal[i];
                const titleArtistKey = localSong && localSong.title && localSong.artist ? `${cleanStr(localSong.title)}:::${cleanStr(localSong.artist)}` : "";
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
            if (s && s.title && s.artist) {
                libraryMap.set(`${cleanStr(s.title)}:::${cleanStr(s.artist)}`, s);
            }
        }

        for (let i = 0; i < targets.length; i++) {
            if (didCancelRef.current) break;
            
            await yieldToUI();

            const song = targets[i];
            const musicFname = song.musicFilename ? String(song.musicFilename).split(/[\\/]/).pop() : `song_${i}.mp3`;
            const musicLocalUri = baseDir + musicFname;

            const progressMsg = t('sync_downloading_progress', language)
              .replace('{current}', String(i + 1))
              .replace('{total}', String(targets.length))
              .replace('{title}', song.title || 'Untitled');
            setSyncProgress(progressMsg);
            
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
                const imgFname = song.imageFilename ? String(song.imageFilename).split(/[\\/]/).pop() : `img_${i}.jpg`;
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

        const targetPlaylistsForPl = selectedPls.size > 0 ? currentPcPlaylists.filter((_, i) => selectedPls.has(i)) : currentPcPlaylists;
        const processedPlaylists: any[] = [];

        for (let j = 0; j < targetPlaylistsForPl.length; j++) {
            if (didCancelRef.current) break;
            const pl = { ...targetPlaylistsForPl[j] };
            
            let coverUrl = pl.url_cover || pl.cover_url || pl.coverUrl;
            if (!coverUrl && (pl.coverPath || pl.cover_path || pl.coverFilename)) {
                const pathStr = String(pl.coverPath || pl.cover_path || pl.coverFilename);
                const fname = pathStr.split(/[\\/]/).pop();
                
                const normalizedPath = pathStr.replace(/\\/g, '/');
                if (normalizedPath.includes('library/images')) {
                    coverUrl = `/mobile_image/${fname}`;
                } else {
                    coverUrl = `/mobile_cover_image/${fname}`;
                }
            }

            if (coverUrl) {
                const imgFname = String(coverUrl).split(/[\\/]/).pop();
                const uniqueFname = `cover_pl_${Date.now()}_${imgFname}`;
                const localCoverUri = baseDir + uniqueFname;
                
                try {
                    const msg = t('sync_cover_progress', language)
                      .replace('{current}', String(j + 1))
                      .replace('{total}', String(targetPlaylistsForPl.length))
                      .replace('{title}', pl.playlistName || 'Untitled');
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
            Alert.alert(
              t('sync_complete_title', language), 
              t('sync_complete_desc', language).replace('{count}', String(targets.length)), 
              [{ text: t('confirm', language), onPress: () => disconnect() }]
            );
        }, 100);

    } catch (e: any) {
        console.error("[Sync Download Error]:", e);
        setIsFullScreenSyncing(false);
        setSyncProgress('');
        
        const errMsg = e?.message || String(e) || 'Unknown Error';
        const is403 = errMsg.includes('403');
        const isTimeout = errMsg.includes('Timeout') || errMsg.includes('タイムアウト');
        
        if (didCancelRef.current && !is403 && !isTimeout) {
            return;
        }

        setTimeout(() => {
            Alert.alert(
              t('sync_stopped_title', language), 
              isTimeout 
                ? t('sync_timeout_error', language)
                : (is403 ? t('sync_session_invalid', language) : `${t('sync_stopped_title', language)}\n(${errMsg})`), 
              [{ text: t('confirm', language), onPress: () => disconnect() }]
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
