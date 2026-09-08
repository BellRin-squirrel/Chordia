import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Modal, 
  TouchableWithoutFeedback, StyleSheet, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from '../../styles/styles';
import { RecentSection } from '../RecentSection';
import { getPlaylistSongs } from '../../utils/playlistEvaluator';
import { t } from '../../utils/i18n';
import { 
  getNowPlayingApi, 
  RelayDeviceItem, 
  ACCOUNT_STORAGE_KEY 
} from '../../utils/chordiaSync';
import { PlayCollectionContext } from '../../hooks/useAudioPlayer';

export const LibraryMenuView = ({
  dynamicStyles, themeColor, insets, isLandscape, safePadding,
  pushView, recentlyPlayedSongs, recentlyPlayedCollections,
  localLibrary, startQueue, saveCollectionToHistory, language = 'ja'
}: any) => {

  const [relayModalVisible, setRelayModalVisible] = useState(false);
  const [relayDevices, setRelayDevices] = useState<RelayDeviceItem[]>([]);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchRelayDevices = async () => {
      try {
        const rawAccount = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (!rawAccount) return;
        const account = JSON.parse(rawAccount);
        if (!account?.sid) return;

        const res = await getNowPlayingApi(account.sid);
        if (res.success && res.response) {
          setRelayDevices(res.response);
        }
      } catch (e) {}
    };

    fetchRelayDevices();
    pollingTimerRef.current = setInterval(fetchRelayDevices, 3500);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, []);

  const getPlaylistTypeLabel = (playlistID?: string) => {
    if (playlistID === 'album') return t('relay_type_album', language);
    if (playlistID === 'artist') return t('relay_type_artist', language);
    return t('relay_type_playlist', language);
  };

  const handleDevicePress = (device: RelayDeviceItem) => {
    console.log('[Chordia Relay] 選択されたデバイス:', device);
    setRelayModalVisible(false);
  };

  const menuItems = [
    { title: t('menu_playlists', language), icon: 'musical-notes-outline' as const, view: 'PLAYLISTS' },
    { title: t('menu_albums', language), icon: 'disc-outline' as const, view: 'ALBUMS' },
    { title: t('menu_artists', language), icon: 'mic-outline' as const, view: 'ARTISTS' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      
      <View style={[
        styles.headerBar, 
        { 
          borderBottomColor: 'transparent', 
          paddingTop: insets?.top || 0, 
          height: 44 + (insets?.top || 0),
          paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
          paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20,
          justifyContent: 'space-between',
        }
      ]}>
        <View style={{ width: 36 }} />
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>{t('tab_player', language)}</Text>
        
        <TouchableOpacity 
          style={s.cloudHeaderBtn}
          onPress={() => setRelayModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-outline" size={24} color={themeColor} />
          {relayDevices.length > 0 && (
            <View style={[s.headerBadge, { backgroundColor: themeColor }]}>
              <Text style={s.headerBadgeText}>{relayDevices.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={menuItems}
        keyExtractor={item => item.view}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={[styles.menuRow, index !== menuItems.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} 
            onPress={() => pushView(item.view)}
          >
            <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
            <Text style={[styles.menuRowTitle, { color: dynamicStyles.text }]}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <RecentSection 
            recentlyPlayedSongs={recentlyPlayedSongs} 
            recentlyPlayedCollections={recentlyPlayedCollections} 
            dynamicStyles={dynamicStyles} 
            themeColor={themeColor}
            // ★ 最近再生した楽曲からの再生: context は渡さない（API送信しない）
            onPlaySong={(sVal: any) => startQueue([sVal], sVal, undefined, null)} 
            // ★ 最近再生したコレクションからの再生: context を構築して渡す（API送信する）
            onPlayCollection={(item: any) => {
              let songs: any[] = [];
              let context: PlayCollectionContext | null = null;

              if (item.type === 'PLAYLIST') {
                songs = getPlaylistSongs(item.data, localLibrary);
                context = {
                  type: 'PLAYLIST',
                  playlistID: item.data?.id || item.id || 'all_songs',
                  playlistName: item.data?.playlistName || item.title || 'Playlist',
                };
              } else if (item.type === 'ALBUM') {
                songs = localLibrary.filter((sVal: any) => sVal.album === item.data?.album && sVal.artist === item.data?.artist);
                context = {
                  type: 'ALBUM',
                  playlistID: 'album',
                  playlistName: item.data?.album || item.title || 'Album',
                };
              } else if (item.type === 'ARTIST') {
                songs = localLibrary.filter((sVal: any) => sVal.artist === item.data?.artistName);
                context = {
                  type: 'ARTIST',
                  playlistID: 'artist',
                  playlistName: item.data?.artistName || item.title || 'Artist',
                };
              }

              if (songs.length > 0) {
                startQueue(songs, undefined, false, context);
                saveCollectionToHistory(item);
              }
            }}
            language={language}
            localLibrary={localLibrary}
          />
        }
        contentContainerStyle={safePadding}
      />

      <Modal visible={relayModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setRelayModalVisible(false)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[s.modalCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
                <View style={s.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="cloud-outline" size={22} color={themeColor} />
                    <Text style={[s.modalTitle, { color: dynamicStyles.text }]}>Chordia Relay</Text>
                  </View>
                  <TouchableOpacity onPress={() => setRelayModalVisible(false)}>
                    <Ionicons name="close-circle" size={24} color={dynamicStyles.subText} />
                  </TouchableOpacity>
                </View>

                <Text style={[s.modalDesc, { color: dynamicStyles.subText }]}>
                  {t('relay_modal_desc', language) || 'Chordia Relay は一つのデバイスで再生していた再生リストを別のデバイスで再生を続ける機能です。\nDesktop 版から Mobile 版への同期とは異なります。'}
                </Text>

                {relayDevices.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="radio-outline" size={44} color={dynamicStyles.subText} />
                    <Text style={{ color: dynamicStyles.subText, fontSize: 13, marginTop: 8 }}>
                      {t('relay_no_devices', language)}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={relayDevices}
                    keyExtractor={(item, index) => `${item.name}-${index}`}
                    style={{ maxHeight: 320 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[s.deviceCard, { backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', borderColor: dynamicStyles.border }]}
                        onPress={() => handleDevicePress(item)}
                        activeOpacity={0.7}
                      >
                        <View style={s.deviceHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="phone-portrait-outline" size={17} color={themeColor} />
                            <Text style={[s.deviceNameText, { color: dynamicStyles.text }]}>
                              {item.name}
                            </Text>
                          </View>

                          <View style={[s.typeBadge, { backgroundColor: themeColor }]}>
                            <Text style={s.typeBadgeText}>
                              {getPlaylistTypeLabel(item.nowPlaying?.playlistID)}
                            </Text>
                          </View>
                        </View>

                        <Text style={[s.playlistNameText, { color: dynamicStyles.text }]} numberOfLines={1}>
                          {item.nowPlaying?.playlistName || 'Untitled'}
                        </Text>

                        {item.nowPlaying?.nowPlayingTitle && (
                          <Text style={[s.nowPlayingSongText, { color: dynamicStyles.subText }]} numberOfLines={1}>
                            ♪ {item.nowPlaying.nowPlayingTitle} - {item.nowPlaying.nowPlayingArtist}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  cloudHeaderBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  headerBadge: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 20, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalDesc: { fontSize: 12, marginBottom: 14, lineHeight: 18 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 35 },
  deviceCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  deviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  deviceNameText: { fontSize: 15, fontWeight: 'bold' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  playlistNameText: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  nowPlayingSongText: { fontSize: 12 },
});
