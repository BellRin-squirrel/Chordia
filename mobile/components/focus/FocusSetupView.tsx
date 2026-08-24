import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState, useMemo } from 'react';
import { 
  Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, 
  Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions 
} from 'react-native';

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
    openCustomTimerModal
}: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const textColor = buttonTextColor || '#ffffff';

  const [modalTab, setModalTab] = useState<CategoryTab>('PLAYLIST');
  const [searchQuery, setSearchQuery] = useState('');

  const parseOptToSeconds = (opt: string) => {
    const valOnly = opt.replace('(推奨)', '').trim();
    let secs = 0;
    if (valOnly.includes('分')) {
      const m = parseInt(valOnly, 10) || 0;
      secs += m * 60;
    } else if (valOnly.includes('秒')) {
      const s = parseInt(valOnly, 10) || 0;
      secs += s;
    } else {
      secs = (parseInt(valOnly, 10) || 0) * 60;
    }
    return secs;
  };

  const formatCustomSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `ｶｽﾀﾑ(${h}h${m}m${s > 0 ? s + 's' : ''})`;
    if (s > 0 && m > 0) return `ｶｽﾀﾑ(${m}分${s}秒)`;
    if (s > 0) return `ｶｽﾀﾑ(${s}秒)`;
    return `ｶｽﾀﾑ(${m}分)`;
  };

  // タブ別コレクションデータの生成
  const { playlistsData, albumsData, artistsData } = useMemo(() => {
    const albumsMap = new Map<string, any>();
    const artistsMap = new Map<string, any>();

    localLibrary.forEach((s: any) => {
      const ak = `${s.album}:::${s.artist}`;
      if (!albumsMap.has(ak)) {
        albumsMap.set(ak, {
          id: ak,
          type: 'ALBUM',
          title: s.album || '不明なアルバム',
          sub: s.artist || '不明なアーティスト',
          art: s.localImageUri,
          songs: []
        });
      }
      albumsMap.get(ak).songs.push(s);

      if (!artistsMap.has(s.artist)) {
        artistsMap.set(s.artist, {
          id: s.artist,
          type: 'ARTIST',
          title: s.artist || '不明なアーティスト',
          sub: 'アーティスト',
          art: s.localImageUri,
          songs: []
        });
      }
      artistsMap.get(s.artist).songs.push(s);
    });

    const getPlaylistArt = (pl: any) => {
      if (pl.localCoverImageUri) return pl.localCoverImageUri.split('?')[0];
      const songs = pl.isAll ? localLibrary : localLibrary.filter((s: any) => pl.music?.includes(s.musicFilename?.split(/[\\/]/).pop()));
      return songs.length > 0 && songs[0].localImageUri ? songs[0].localImageUri : null;
    };

    const pls = [
      {
        id: 'all_songs',
        type: 'PLAYLIST',
        title: 'すべての楽曲',
        sub: `${localLibrary.length}曲`,
        art: localLibrary.length > 0 ? localLibrary[0].localImageUri : null,
        data: { playlistName: 'すべての楽曲', isAll: true, id: 'all_songs' }
      },
      ...localPlaylists.map((p: any) => {
        const count = p.isAll ? localLibrary.length : (p.music?.length || 0);
        return {
          id: p.id,
          type: 'PLAYLIST',
          title: p.playlistName,
          sub: `${count}曲`,
          art: getPlaylistArt(p),
          data: p
        };
      })
    ];

    const albs = Array.from(albumsMap.values()).map(a => ({
      ...a,
      sub: `${a.sub} (${a.songs.length}曲)`
    }));

    const arts = Array.from(artistsMap.values()).map(a => ({
      ...a,
      sub: `${a.songs.length}曲`
    }));

    return {
      playlistsData: pls,
      albumsData: albs,
      artistsData: arts
    };
  }, [localLibrary, localPlaylists]);

  // 表示中タブと検索クエリに応じた現在リスト
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

  // 現在選択されているコレクション
  const currentSelected = pickingTarget === 'MAIN' ? mainPlaylist : (pickingTarget === 'WORK' ? workPlaylist : breakPlaylist);

  const renderTileOption = (label: string, options: string[], current: any, setter: (v: any) => void, icon: string, type: 'WORK' | 'BREAK', isLast: boolean = false) => {
    const isCustomValue = !options.some(opt => {
      const sec = parseOptToSeconds(opt);
      return Number(current) === sec;
    });

    return (
      <View style={[s.settingSection, isLast && { marginBottom: 0 }]}>
        <View style={s.sectionHeaderRow}>
            <Ionicons name={icon as any} size={18} color={themeColor} />
            <Text style={[s.sectionTitleSmall, { color: dynamicStyles.text }]}>{label}</Text>
        </View>
        <View style={s.tileContainer}>
          {options.map(opt => {
            const valOnly = opt.replace('(推奨)', '');
            const internalSec = parseOptToSeconds(opt);
            const isSelected = Number(current) === internalSec && !isCustomValue;
            
            return (
              <TouchableOpacity 
                key={opt} 
                onPress={() => setter(internalSec)} 
                style={[
                  s.tileBtn, 
                  { backgroundColor: isSelected ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
                  { width: '31%', paddingHorizontal: 4 }, 
                  isSelected && s.tileBtnSelected
                ]}
              >
                <Text style={[s.tileText, { color: isSelected ? textColor : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{valOnly}</Text>
                {opt.includes('推奨') && <View style={[s.recommendBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}><Text style={{ color: isSelected ? textColor : themeColor, fontSize: 8, fontWeight: 'bold' }}>推奨</Text></View>}
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
                {isCustomValue ? formatCustomSec(Number(current)) : 'カスタム'}
            </Text>
            {isCustomValue && <Ionicons name="checkmark-circle" size={14} color={textColor} style={s.checkIcon} />}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDisplayOption = (label: string, options: string[], current: any, setter: (v: any) => void, icon: string) => (
    <View style={s.settingSection}>
      <View style={s.sectionHeaderRow}><Ionicons name={icon as any} size={18} color={themeColor} /><Text style={[s.sectionTitleSmall, { color: dynamicStyles.text }]}>{label}</Text></View>
      <View style={s.displayTileContainer}>
        {options.map(opt => {
          const isSelected = String(current) === String(opt);
          return (
            <TouchableOpacity 
              key={opt} 
              onPress={() => setter(opt)} 
              style={[
                s.tileBtn, 
                { backgroundColor: isSelected ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
                { flex: 1, paddingHorizontal: 2 }, 
                isSelected && s.tileBtnSelected
              ]}
            >
              <Text style={[s.tileText, { color: isSelected ? textColor : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{opt}</Text>
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
              {selected ? `${selected.title} (${selected.type === 'PLAYLIST' ? 'プレイリスト' : selected.type === 'ALBUM' ? 'アルバム' : 'アーティスト'})` : '選択してください'}
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
    if (pickingTarget === 'WORK') return '作業用リストを選択';
    if (pickingTarget === 'BREAK') return '休憩用リストを選択';
    return '再生リストを選択';
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 250 }}>
        
        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
            {renderDisplayOption('日付表示', ['表示しない', '年月日', '月日', '日'], dateMode, setDateMode, 'calendar')}
            {renderDisplayOption('曜日表示', ['表示しない', '(日)', '日曜', '日曜日'], dayMode, setDayMode, 'today')}
            {renderDisplayOption('時計表示', ['表示しない', '8:19', '22:19'], clockMode, setClockMode, 'time')}
            
            <View style={[s.switchRow, { marginTop: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="chatbubble-ellipses" size={22} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>名言表示</Text>
              </View>
              <Switch value={showQuote} onValueChange={setShowQuote} trackColor={{ false: "#767577", true: themeColor }} />
            </View>
        </View>

        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 20 }]}>
            <View style={s.switchRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name="timer" size={22} color={themeColor} /><Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>ポモドーロモード</Text></View><Switch value={pomoEnabled} onValueChange={setPomoEnabled} trackColor={{ false: "#767577", true: themeColor }} /></View>
            {pomoEnabled && (
                <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: dynamicStyles.border, paddingTop: 15 }}>
                    {renderTileOption('作業時間', ['15分', '20分', '25分(推奨)', '30分', '40分', '50分', '60分', '120分'], workTime, setWorkTime, 'briefcase', 'WORK', false)}
                    {renderTileOption('休憩時間', ['1分', '3分', '5分(推奨)', '10分', '15分', '20分', '25分', '30分'], breakTime, setBreakTime, 'cafe', 'BREAK', true)}
                </View>
            )}
        </View>

        <View style={[s.mainCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 20 }]}>
            <View style={s.sectionHeaderRow}><Ionicons name="musical-notes" size={20} color={themeColor} /><Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>再生設定</Text></View>
            {!pomoEnabled ? renderPlaylistSelector('使用するリスト', mainPlaylist, mainShuffle, setMainShuffle, 'MAIN') : (
                <View style={{ gap: 15 }}>
                   {renderPlaylistSelector('作業用', workPlaylist, workShuffle, setWorkShuffle, 'WORK')}
                   {renderPlaylistSelector('休憩用', breakPlaylist, breakShuffle, setBreakShuffle, 'BREAK')}
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
          <Text style={[s.primaryBtnText, { color: textColor }]}>設定完了</Text>
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
            {/* モーダルヘッダー */}
            <View style={s.popupHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="musical-notes" size={22} color={themeColor} />
                <Text style={[s.popupTitle, { color: dynamicStyles.text }]}>{getTargetTitle()}</Text>
              </View>
              <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={28} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            {/* ★ 再生タブと同じアイコン（musical-notes-outline, disc-outline, mic-outline）の切り替えタブ */}
            <View style={[s.tabSwitchContainer, { backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#e5e7eb', borderColor: dynamicStyles.border }]}>
              {(['PLAYLIST', 'ALBUM', 'ARTIST'] as CategoryTab[]).map((t) => {
                const isSelected = modalTab === t;
                const label = t === 'PLAYLIST' ? 'プレイリスト' : t === 'ALBUM' ? 'アルバム' : 'アーティスト';
                const icon = t === 'PLAYLIST' ? 'musical-notes-outline' : t === 'ALBUM' ? 'disc-outline' : 'mic-outline';
                return (
                  <TouchableOpacity
                    key={t}
                    style={[s.tabSwitchBtn, isSelected && { backgroundColor: themeColor }]}
                    onPress={() => setModalTab(t)}
                  >
                    <Ionicons name={icon as any} size={16} color={isSelected ? textColor : dynamicStyles.subText} style={{ marginRight: 6 }} />
                    <Text style={{ color: isSelected ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 検索バー */}
            <View style={[s.searchBarBox, { backgroundColor: dynamicStyles.bg === '#000000' ? '#1c1c1e' : '#f2f2f7', borderColor: dynamicStyles.border }]}>
              <Ionicons name="search" size={16} color={dynamicStyles.subText} style={{ marginRight: 8 }} />
              <TextInput
                style={[s.searchInput, { color: dynamicStyles.text }]}
                placeholder="タイトルやアーティスト名で検索..."
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

            {/* コレクション一覧 */}
            <FlatList 
              data={currentList} 
              keyExtractor={(item, i) => `${item.type}-${item.id || i}`} 
              contentContainerStyle={{ paddingVertical: 10, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <Ionicons name="alert-circle-outline" size={48} color={dynamicStyles.subText} />
                  <Text style={{ color: dynamicStyles.subText, marginTop: 10, fontSize: 14, fontWeight: 'bold' }}>
                    該当する項目が見つかりません
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

  // モーダル用スタイル
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