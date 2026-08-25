import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const useLibraryData = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [themeR, setThemeR] = useState(79);
  const [themeG, setThemeG] = useState(70);
  const [themeB, setThemeB] = useState(229);
  const [isCustomTheme, setIsCustomTheme] = useState(false);
  const [showRGBModal, setShowRGBModal] = useState(false);
  const [recentColors, setRecentColors] = useState<any[]>([]);
  const [localLibrary, setLocalLibrary] = useState<any[]>([]);
  const [localPlaylists, setLocalPlaylists] = useState<any[]>([]);
  
  const [showFocusTab, setShowFocusTab] = useState(true);
  const [showSyncTab, setShowSyncTab] = useState(true);
  const [showPlaylistTypeIcon, setShowPlaylistTypeIcon] = useState(true);

  const themeColor = `rgb(${themeR}, ${themeG}, ${themeB})`;
  const themeTextColor = (themeR * 299 + themeG * 587 + themeB * 114) / 1000 >= 150 ? '#000000' : '#ffffff';

  const dynamicStyles = {
    bg: isDark ? '#000000' : '#f2f2f7',
    card: isDark ? '#1c1c1e' : '#ffffff',
    text: isDark ? '#ffffff' : '#000000',
    subText: '#8e8e93',
    border: isDark ? '#38383a' : '#d1d1d6',
    blur: isDark ? 'dark' as const : 'light' as const,
  };

  useEffect(() => {
    (async () => {
      try {
        const lib = await AsyncStorage.getItem('local_library');
        const pls = await AsyncStorage.getItem('local_playlists');
        const r = await AsyncStorage.getItem('theme_r');
        const g = await AsyncStorage.getItem('theme_g');
        const b = await AsyncStorage.getItem('theme_b');
        const custom = await AsyncStorage.getItem('is_custom_theme');
        const recent = await AsyncStorage.getItem('recent_colors');
        const focusState = await AsyncStorage.getItem('show_focus_tab');
        const syncState = await AsyncStorage.getItem('show_sync_tab');
        const iconState = await AsyncStorage.getItem('show_playlist_type_icon');
        
        const baseDir = (FileSystem.documentDirectory || '') + 'chordia/';
        const fixUri = (uri: string | null | undefined) => {
            if (!uri) return uri;
            const fname = uri.split(/[\\/]/).pop();
            return fname ? baseDir + fname : uri;
        };

        if (lib) {
            const parsedLib = JSON.parse(lib).map((song: any) => ({
                ...song,
                localMusicUri: fixUri(song.localMusicUri),
                localImageUri: fixUri(song.localImageUri),
            }));
            setLocalLibrary(parsedLib);
        }
        
        if (pls) {
            const parsedPls = JSON.parse(pls).map((pl: any) => ({
                ...pl,
                localCoverImageUri: fixUri(pl.localCoverImageUri),
            }));
            setLocalPlaylists(parsedPls);
        }
        
        if (r) setThemeR(parseInt(r, 10));
        if (g) setThemeG(parseInt(g, 10));
        if (b) setThemeB(parseInt(b, 10));
        if (custom === 'true') setIsCustomTheme(true);
        if (recent) setRecentColors(JSON.parse(recent));
        
        if (focusState !== null) {
          setShowFocusTab(focusState === 'true');
        }
        if (syncState !== null) {
          setShowSyncTab(syncState === 'true');
        }
        if (iconState !== null) {
          setShowPlaylistTypeIcon(iconState === 'true');
        }
      } catch (e) {
        console.error("Storage Load Error:", e);
      }
    })();
  }, []);

  const saveColor = async (r: number, g: number, b: number, isCustom = false) => {
    setThemeR(r); setThemeG(g); setThemeB(b); setIsCustomTheme(isCustom);
    await AsyncStorage.setItem('theme_r', r.toString());
    await AsyncStorage.setItem('theme_g', g.toString());
    await AsyncStorage.setItem('theme_b', b.toString());
    await AsyncStorage.setItem('is_custom_theme', isCustom ? 'true' : 'false');
  };

  const applyCustomColor = async () => {
    const newRecent = [{r: themeR, g: themeG, b: themeB}, ...recentColors.filter(c => !(c.r === themeR && c.g === themeG && c.b === themeB))].slice(0, 5);
    setRecentColors(newRecent);
    await AsyncStorage.setItem('recent_colors', JSON.stringify(newRecent));
    await saveColor(themeR, themeG, themeB, true);
    setShowRGBModal(false);
  };

  const toggleFocusTab = async (newValue: boolean) => {
    setShowFocusTab(newValue);
    await AsyncStorage.setItem('show_focus_tab', newValue ? 'true' : 'false');
  };

  const toggleSyncTab = async (newValue: boolean) => {
    setShowSyncTab(newValue);
    await AsyncStorage.setItem('show_sync_tab', newValue ? 'true' : 'false');
  };

  const toggleShowPlaylistTypeIcon = async (newValue: boolean) => {
    setShowPlaylistTypeIcon(newValue);
    await AsyncStorage.setItem('show_playlist_type_icon', newValue ? 'true' : 'false');
  };

  return { 
    isDark, dynamicStyles, themeColor, themeTextColor, themeR, themeG, themeB, isCustomTheme, 
    recentColors, showRGBModal, setShowRGBModal, setThemeR, setThemeG, setThemeB, 
    setIsCustomTheme, localLibrary, setLocalLibrary, localPlaylists, setLocalPlaylists, 
    saveColor, applyCustomColor, showFocusTab, toggleFocusTab, showSyncTab, toggleSyncTab,
    showPlaylistTypeIcon, toggleShowPlaylistTypeIcon
  };
};
