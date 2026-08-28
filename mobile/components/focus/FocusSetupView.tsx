import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import { 
  FlatList, Image, Modal, ScrollView, StyleSheet, 
  Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions 
} from 'react-native';
import { getPlaylistFirstArt, getPlaylistSongs } from '../../utils/playlistEvaluator';
import { t } from '../../utils/i18n';

const DEFAULT_ICON = require('../../assets/images/icon.png');

type CategoryTab = 'PLAYLIST' | 'ALBUM' | 'ARTIST';

export const FocusSetupView = ({ 
    dynamicStyles, themeColor, buttonTextColor,
    dateMode, setDateMode, dayMode, setDayMode, clockMode, setClockMode,
    showQuote, setShowQuote,
    pomoEnabled, setPomoEnabled, workTime, setWorkTime, breakTime, setBreakTime,
    mainPlaylist, workPlaylist, breakPlaylist,
    localLibrary = [], localPlaylists = [], insets,
    onSelectCollection,
    pickerVisible, setPickerVisible, pickingTarget, setPickingTarget,
    isReady, handleFinishSetup, mainShuffle, setMainShuffle, workShuffle, setWorkShuffle, breakShuffle, setBreakShuffle,
    openCustomTimerModal, language = 'ja'
}: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const textColor = buttonTextColor || '#ffffff';

  const [modalTab, setModalTab] = useState<CategoryTab>('PLAYLIST');
  const [searchQuery, setSearchQuery] = useState('');

  const formatCustomSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const customPrefix = `${t('custom_timer_btn', language)}:`;
    if (h > 0) return `${customPrefix}${h}h${m}m${s > 0 ? s + 's' : ''}`;
    if (s > 0 && m > 0) return `${customPrefix}${m}m${s}s`;
    if (s > 0) return `${customPrefix}${s}s`;
    return `${customPrefix}${m}m`;
  };

  const { playlistsData, albumsData, artistsData } = useMemo(() => {
    const albumsMap = new Map<string, any>();
    const artistsMap = new Map<string, any>();

    localLibrary.forEach((sVal: any) => {
      const ak = `${sVal.album}:::${sVal.artist}`;
      if (!albumsMap.has(ak)) {
        albumsMap.set(ak, {
          id: ak,
          type: 'ALBUM',
          title: sVal.album || 'Unknown Album',
          sub: sVal.artist || 'Unknown Artist',
          art: sVal.localImageUri,
          songs: []
        });
      }
      albumsMap.get(ak).songs.push(sVal);

      if (!artistsMap.has(sVal.artist)) {
        artistsMap.set(sVal.artist, {
          id: sVal.artist,
          type: 'ARTIST',
          title: sVal.artist || 'Unknown Artist',
          sub: t('artist_label', language),
          art: sVal.localImageUri,
          songs: []
        });
      }
      artistsMap.get(sVal.artist).songs.push(sVal);
    });

    const pls = [
      {
        id: 'all_songs',
        type: 'PLAYLIST',
        title: t('all_songs_item', language),
        sub: `${localLibrary.length} ${t('songs_count', language)}`,
        art: localLibrary.length > 0 ? localLibrary[0].localImageUri : null,
        data: { playlistName: t('all_songs_item', language), isAll: true, id: 'all_songs' }
      },
      ...localPlaylists.map((p: any) => {
        const count = getPlaylistSongs(p, localLibrary).length;
        const artSource = getPlaylistFirstArt(p, localLibrary);
        return {
          id: p.id,
          type: 'PLAYLIST',
          title: p.playlistName,
          sub: `${count} ${t('songs_count', language)}`,
          art: artSource?.uri || null,
          data: p
        };
      })
    ];

    const albs = Array.from(albumsMap.values()).map(a => ({
      ...a,
      sub: `${a.sub} (${a.songs.length} ${t('songs_count', language)})`
    }));

    const arts = Array.from(artistsMap.values()).map(a => ({
      ...a,
      sub: `${a.songs.length} ${t('songs_count', language)}`
    }));

    return {
      playlistsData: pls,
      albumsData: albs,
      artistsData: arts
    };
  }, [localLibrary, localPlaylists, language]);

  const currentList = useMemo(() => {
    let list: any[] = [];
    if (modalTab === 'PLAYLIST') list = playlistsData;
    else if (modalTab === 'ALBUM') list = albumsData;
    else if (modalTab === 'ARTIST') list = artistsData;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(item => 
      item.title?.toLowerCase().includes(q) || item.sub?.toLowerCase().includes(q)
    );
  }, [modalTab, searchQuery, playlistsData, albumsData, artistsData]);

  const currentSelected = pickingTarget === 'MAIN' ? mainPlaylist : (pickingTarget === 'WORK' ? workPlaylist : breakPlaylist);

  const workPresetOptions = [
    { sec: 15 * 60, label: `15${t('minutes_unit', language)}`, isRec: false },
    { sec: 20 * 60, label: `20${t('minutes_unit', language)}`, isRec: false },
    { sec: 25 * 60, label: `25${t('minutes_unit', language)}`, isRec: true },
    { sec: 30 * 60, label: `30${t('minutes_unit', language)}`, isRec: false },
    { sec: 40 * 60, label: `40${t('minutes_unit', language)}`, isRec: false },
    { sec: 50 * 60, label: `50${t('minutes_unit', language)}`, isRec: false },
    { sec: 60 * 60, label: `60${t('minutes_unit', language)}`, isRec: false },
    { sec: 120 * 60, label: `120${t('minutes_unit', language)}`, isRec: false },
  ];

  const breakPresetOptions = [
    { sec: 1 * 60, label: `1${t('minutes_unit', language)}`, isRec: false },
    { sec: 3 * 60, label: `3${t('minutes_unit', language)}`, isRec: false },
    { sec: 5 * 60, label: `5${t('minutes_unit', language)}`, isRec: true },
    { sec: 10 * 60, label: `10${t('minutes_unit', language)}`, isRec: false },
    { sec: 15 * 60, label: `15${t('minutes_unit', language)}`, isRec: false },
    { sec: 20 * 60, label: `20${t('minutes_unit', language)}`, isRec: false },
    { sec: 25 * 60, label: `25${t('minutes_unit', language)}`, isRec: false },
    { sec: 30 * 60, label: `30${t('minutes_unit', language)}`, isRec: false },
  ];

  const renderPresetTiles = (label: string, presetList: typeof workPresetOptions, current: number, setter: (v: number) => void, icon: string, type: 'WORK' | 'BREAK', isLast: boolean = false) => {
    const isCustomValue = !presetList.some(opt => opt.sec === current);

    return (
      <View style={[s.settingSection, isLast && { marginBottom: 0 }]}>
        <View style={s.sectionHeaderRow}>
            <Ionicons name={icon as any} size={18} color={themeColor} />
            <Text style={[s.sectionTitleSmall, { color: dynamicStyles.text }]}>{label}</Text>
        </View>
        <View style={s.tileContainer}>
          {presetList.map(opt => {
            const isSelected = current === opt.sec && !isCustomValue;
            
            return (
              <TouchableOpacity 
                key={opt.sec} 
                onPress={() => setter(opt.sec)} 
                style={[
                  s.tileBtn, 
                  { backgroundColor: isSelected ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
                  { width: '31%', paddingHorizontal: 4 }, 
                  isSelected && s.tileBtnSelected
                ]}
              >
                <Text style={[s.tileText, { color: isSelected ? textColor : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{opt.label}</Text>
                {opt.isRec && (
                  <View style={[s.recommendBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={{ color: isSelected ? textColor : themeColor, fontSize: 8, fontWeight: 'bold' }}>{t('recommended_badge', language)}</Text>
                  </View>
                )}
                {isSelected && <Ionicons name="checkmark-circle" size={14} color={textColor} style={s.checkIcon} />}
              </TouchableOpacity>
            );
          })}
          
          <TouchableOpacity 
            onPress={() => openCustomTimerModal(type)} 
            style={[
              s.tileBtn, 
              { backgroundColor: isCustomValue ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
              { width: '31%', paddingHorizontal: 4 }, 
              isCustomValue && s.tileBtnSelected
            ]}
          >
            <Text style={[s.tileText, { color: isCustomValue ? textColor : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {isCustomValue ? formatCustomSec(Number(current)) : t('custom_timer_btn', language)}
            </Text>
            {isCustomValue && <Ionicons name="checkmark-circle" size={14} color={textColor} style={s.checkIcon} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDisplayOption = (label: string, options: { key: string; label: string }[], current: string, setter: (v: string) => void, icon: string) => (
    <View style={s.settingSection}>
      <View style={s.sectionHeaderRow}><Ionicons name={icon as any} size={18} color={themeColor} /><Text style={[s.sectionTitleSmall, { color: dynamicStyles.text }]}>{label}</Text></View>
      <View style={s.displayTileContainer}>
        {options.map(opt => {
          const isSelected = String(current) === opt.key;
          return (
            <TouchableOpacity 
              key={opt.key} 
              onPress={() => setter(opt.key)} 
              style={[
                s.tileBtn, 
                { backgroundColor: isSelected ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
                { flex: 1, paddingHorizontal: 2 }, 
                isSelected && s.tileBtnSelected
              ]}
            >
              <Text style={[s.tileText, { color: isSelected ? textColor : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{opt.label}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={14} color={textColor} style={s.checkIcon} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPlaylistSelector = (label: string, selected: any, shuffle: boolean, setShuffle: (v: boolean) => void, target: string) => (
    <View style={s.playlistRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.playlistLabel, { color: dynamicStyles.subText }]}>{label}</Text>
        <TouchableOpacity style={[s.pickerBox, { backgroundColor: dynamicStyles.bg, borderColor: dynamicStyles.border }]} onPress={() => { setPickingTarget(target); setSearchQuery(''); setPickerVisible(true); }}>
            <Text style={{ color: selected ? dynamicStyles.text : dynamicStyles.subText, fontWeight: selected ? 'bold' : 'normal' }} numberOfLines={1}>
              {selected ? `${selected.title} (${selected.type === 'PLAYLIST' ? t('playlist_label', language) : selected.type === 'ALBUM' ? t('album_label', language) : t('artist_label', language)})` : t('select_playlist_placeholder', language)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={dynamicStyles.subText} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => setShuffle(!shuffle)} style={[s.shuffleToggle, { backgroundColor: shuffle ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }]}>
        <Ionicons name="shuffle" size={22} color={shuffle ? textColor : dynamicStyles.subText} />
        <Text style={{ color: shuffle ? textColor : dynamicStyles.subText, fontSize: 9, fontWeight: 'bold' }}>{shuffle ? "ON" : "OFF"}</Text>
      </TouchableOpacity>
    </View>
  );

  const getTargetTitle = () => {
    if (pickingTarget === 'WORK') return t('select_work_list_title', language);
    if (pickingTarget === 'BREAK') return t('select_break_list_title', language);
    return t('select_list_title', language);
  };

  const dateOptions = [
    { key: '表示しない', label: t('opt_hide', language) },
    { key: '年月日', label: t('opt_date_ymd', language) },
    { key: '月日', label: t('opt_date_md', language) },
    { key: '日', label: t('opt_date_d', language) },
  ];

  const dayOptions = [
    { key: '表示しない', label: t('opt_hide', language) },
    { key: '(日)', label: t('opt_day_short_paren', language) },
    { key: '日曜', label: t('opt_day_short', language) },
    { key: '日曜日', label: t('opt_day_full', language) },
  ];

  const clockOptions = [
    { key: '表示しない', label: t('opt_hide', language) },
    { key: '8:19', label: t('opt_clock_12', language) },
    { key: '22:19', label: t('opt_clock_24', language) },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 250 }}>
        
        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
            {renderDisplayOption(t('date_display', language), dateOptions, dateMode, setDateMode, 'calendar')}
            {renderDisplayOption(t('day_display', language), dayOptions, dayMode, setDayMode, 'today')}
            {renderDisplayOption(t('clock_display', language), clockOptions, clockMode, setClockMode, 'time')}
            
            <View style={[s.switchRow, { marginTop: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="chatbubble-ellipses" size={22} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('quote_display', language)}</Text>
              </View>
              <Switch value={showQuote} onValueChange={setShowQuote} trackColor={{ false: "#767577", true: themeColor }} />
            </View>
        </View>

        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 20 }]}>
            <View style={s.switchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="timer" size={22} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('pomodoro_mode', language)}</Text>
              </View>
              <Switch value={pomoEnabled} onValueChange={setPomoEnabled} trackColor={{ false: "#767577", true: themeColor }} />
            </View>
            {pomoEnabled && (
                <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: dynamicStyles.border, paddingTop: 15 }}>
                    {renderPresetTiles(t('work_time', language), workPresetOptions, workTime, setWorkTime, 'briefcase', 'WORK', false)}
                    {renderPresetTiles(t('break_time', language), breakPresetOptions, breakTime, setBreakTime, 'cafe', 'BREAK', true)}
                </View>
            )}
        </View>

        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 20 }]}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="musical-notes" size={20} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('playback_settings', language)}</Text>
            </View>
            {!pomoEnabled ? renderPlaylistSelector(t('main_playlist_label', language), mainPlaylist, mainShuffle, setMainShuffle, 'MAIN') : (
                <View style={{ gap: 15 }}>
                   {renderPlaylistSelector(t('work_playlist_label', language), workPlaylist, workShuffle, setWorkShuffle, 'WORK')}
                   {renderPlaylistSelector(t('break_playlist_label', language), breakPlaylist, breakShuffle, setBreakShuffle, 'BREAK')}
                </View>
            )}
        </View>

        <TouchableOpacity 
          style={[
            s.primaryBtn, 
            { 
              backgroundColor: themeColor, 
              marginTop: 30, 
              opacity: isReady ? 1 : 0.8,
              shadowColor: themeColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }
          ]} 
          onPress={handleFinishSetup}
        >
          <Text style={[s.primaryBtnText, { color: textColor }]}>{t('finish_setup_btn', language)}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 全画面ポップアップ型 再生リスト選択モーダル */}
      <Modal visible={pickerVisible} animationType="fade" transparent={true} supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={s.modalOverlay}>
          <View style={[
            s.fullPopupCard, 
            { 
              backgroundColor: dynamicStyles.card, 
              borderColor: dynamicStyles.border,
              width: isLandscape ? Math.min(width * 0.9, 680) : '92%',
              height: isLandscape ? Math.min(height * 0.9, 560) : '85%',
            }
          ]}>
            <View style={s.popupHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="musical-notes" size={22} color={themeColor} />
                <Text style={[s.popupTitle, { color: dynamicStyles.text }]}>{getTargetTitle()}</Text>
              </View>
              <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            <View style={[s.tabSwitchContainer, { backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#e5e7eb', borderColor: dynamicStyles.border }]}>
              {(['PLAYLIST', 'ALBUM', 'ARTIST'] as CategoryTab[]).map((tabKey) => {
                const isSelected = modalTab === tabKey;
                const label = tabKey === 'PLAYLIST' ? t('playlist_label', language) : tabKey === 'ALBUM' ? t('album_label', language) : t('artist_label', language);
                const icon = tabKey === 'PLAYLIST' ? 'musical-notes-outline' : tabKey === 'ALBUM' ? 'disc-outline' : 'mic-outline';
                return (
                  <TouchableOpacity
                    key={tabKey}
                    style={[s.tabSwitchBtn, isSelected && { backgroundColor: themeColor }]}
                    onPress={() => setModalTab(tabKey)}
                  >
                    <Ionicons name={icon as any} size={16} color={isSelected ? textColor : dynamicStyles.subText} style={{ marginRight: 6 }} />
                    <Text style={{ color: isSelected ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[s.searchBarBox, { backgroundColor: dynamicStyles.bg === '#000000' ? '#1c1c1e' : '#f2f2f7', borderColor: dynamicStyles.border }]}>
              <Ionicons name="search" size={16} color={dynamicStyles.subText} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.searchInput, { color: dynamicStyles.text }]}
                placeholder={t('search_collection_placeholder', language)}
                placeholderTextColor={dynamicStyles.subText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle-sharp" size={16} color={dynamicStyles.subText} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList 
              data={currentList} 
              keyExtractor={(item, i) => `${item.type}-${item.id || i}`} 
              contentContainerStyle={{ paddingVertical: 10, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <Ionicons name="alert-circle-outline" size={48} color={dynamicStyles.subText} />
                  <Text style={{ color: dynamicStyles.subText, marginTop: 10, fontSize: 14, fontWeight: 'bold' }}>
                    {t('no_items_found', language)}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = currentSelected && currentSelected.id === item.id && currentSelected.type === item.type;
                const isArtist = item.type === 'ARTIST';

                return (
                  <TouchableOpacity 
                    style={[
                      s.listItemCard, 
                      { 
                        backgroundColor: isSelected ? (dynamicStyles.bg === '#000000' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent', 
                        borderColor: isSelected ? themeColor : dynamicStyles.border 
                      }
                    ]} 
                    onPress={() => onSelectCollection(item)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={item.art ? { uri: item.art } : DEFAULT_ICON} 
                      style={[s.listArtImage, isArtist && { borderRadius: 25 }]} 
                    />
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[s.listTitleText, { color: isSelected ? themeColor : dynamicStyles.text, fontWeight: isSelected ? 'bold' : '600' }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={[s.listSubText, { color: dynamicStyles.subText }]} numberOfLines={1}>
                        {item.sub}
                      </Text>
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={themeColor} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={dynamicStyles.subText} />
                    )}
                  </TouchableOpacity>
                );
              }} 
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  mainCard: { borderRadius: 24, padding: 18, borderWidth: 1 },
  settingSection: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitleSmall: { fontSize: 14, fontWeight: 'bold' },
  tileContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '3%' }, 
  displayTileContainer: { flexDirection: 'row', gap: 8 }, 
  tileBtn: { paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 8 },
  tileBtnSelected: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tileText: { fontSize: 12, fontWeight: '600' },
  recommendBadge: { position: 'absolute', top: -6, right: -4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  checkIcon: { position: 'absolute', top: 2, right: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playlistRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  playlistLabel: { fontSize: 11, marginBottom: 5, fontWeight: '600' },
  pickerBox: { height: 48, borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  shuffleToggle: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  primaryBtn: { height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontSize: 18, fontWeight: '900' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
  fullPopupCard: { borderRadius: 28, padding: 20, borderWidth: 1.5, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  popupTitle: { fontSize: 18, fontWeight: 'bold' },
  tabSwitchContainer: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1 },
  tabSwitchBtn: { flex: 1, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  searchBarBox: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  listItemCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  listArtImage: { width: 46, height: 46, borderRadius: 10 },
  listTitleText: { fontSize: 15, marginBottom: 3 },
  listSubText: { fontSize: 12 },
});
