import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Dimensions, FlatList, Image, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

const DEFAULT_ICON = require('../../assets/images/icon.png');
const { width } = Dimensions.get('window');

export const FocusSetupView = ({ 
    dynamicStyles, themeColor, 
    dateMode, setDateMode, dayMode, setDayMode, clockMode, setClockMode,
    showQuote, setShowQuote,
    pomoEnabled, setPomoEnabled, workTime, setWorkTime, breakTime, setBreakTime,
    mainPlaylist, workPlaylist, breakPlaylist,
    musicCollections, expanded, toggleSection, onSelectCollection,
    pickerVisible, setPickerVisible, setPickingTarget,
    isReady, mainShuffle, setMainShuffle, workShuffle, setWorkShuffle, breakShuffle, setBreakShuffle,
    openCustomTimerModal
}: any) => {

  const renderTileOption = (label: string, options: string[], current: any, setter: (v: any) => void, icon: string, type: 'WORK' | 'BREAK', isLast: boolean = false) => {
    const isCustomValue = !options.some(opt => {
        const valOnly = opt.replace('(推奨)', '');
        const internalVal = parseInt(valOnly);
        return String(current) === String(internalVal);
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
            const isTime = valOnly.includes('分') || valOnly.includes('秒');
            const internalVal = isTime ? parseInt(valOnly) : valOnly;
            const isSelected = String(current) === String(internalVal) && !isCustomValue;
            
            return (
              <TouchableOpacity 
                key={opt} 
                onPress={() => setter(internalVal)} 
                style={[
                  s.tileBtn, 
                  { backgroundColor: isSelected ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }, 
                  { width: '31%', paddingHorizontal: 4 }, 
                  isSelected && s.tileBtnSelected
                ]}
              >
                <Text style={[s.tileText, { color: isSelected ? '#fff' : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{valOnly}</Text>
                {opt.includes('推奨') && <View style={[s.recommendBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)' }]}><Text style={{ color: isSelected ? '#fff' : themeColor, fontSize: 8, fontWeight: 'bold' }}>推奨</Text></View>}
                {isSelected && <Ionicons name="checkmark-circle" size={14} color="#fff" style={s.checkIcon} />}
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
            <Text style={[s.tileText, { color: isCustomValue ? '#fff' : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {isCustomValue ? `ｶｽﾀﾑ(${Math.floor(current)}分${Math.round((current % 1) * 60)}秒)` : 'カスタム'}
            </Text>
            {isCustomValue && <Ionicons name="checkmark-circle" size={14} color="#fff" style={s.checkIcon} />}
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
              <Text style={[s.tileText, { color: isSelected ? '#fff' : dynamicStyles.text }]} numberOfLines={1} adjustsFontSizeToFit>{opt}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={14} color="#fff" style={s.checkIcon} />}
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
        <TouchableOpacity style={[s.pickerBox, { backgroundColor: dynamicStyles.bg, borderColor: dynamicStyles.border }]} onPress={() => { setPickingTarget(target); setPickerVisible(true); }}>
            <Text style={{ color: selected ? dynamicStyles.text : dynamicStyles.subText, fontWeight: selected ? 'bold' : 'normal' }} numberOfLines={1}>{selected ? selected.title : '選択してください'}</Text>
            <Ionicons name="chevron-down" size={16} color={dynamicStyles.subText} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => setShuffle(!shuffle)} style={[s.shuffleToggle, { backgroundColor: shuffle ? themeColor : dynamicStyles.bg, borderColor: dynamicStyles.border }]}>
        <Ionicons name="shuffle" size={22} color={shuffle ? "#fff" : dynamicStyles.subText} />
        <Text style={{ color: shuffle ? "#fff" : dynamicStyles.subText, fontSize: 9, fontWeight: 'bold' }}>{shuffle ? "ON" : "OFF"}</Text>
      </TouchableOpacity>
    </View>
  );

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
                    {/* ★ 修正1: 「30秒(テスト用)」を削除しました */}
                    {renderTileOption('作業時間', ['15分', '20分', '25分(推奨)', '30分', '40分', '50分', '60分', '120分'], workTime, setWorkTime, 'briefcase', 'WORK', false)}
                    {/* ★ 修正2: 「30秒(テスト用)」を削除しました */}
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
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}><BlurView intensity={95} tint={dynamicStyles.blur} style={s.modalContent}>
            <View style={s.modalHeader}><Text style={[s.modalTitle, { color: dynamicStyles.text }]}>リストを選択</Text><TouchableOpacity onPress={() => setPickerVisible(false)}><Ionicons name="close-circle" size={32} color={dynamicStyles.subText} /></TouchableOpacity></View>
            <FlatList data={musicCollections} keyExtractor={(item, i) => i.toString()} contentContainerStyle={{ paddingBottom: 50 }} renderItem={({ item }) => {
                if (item.isHeader) return <TouchableOpacity style={s.listHeaderRow} onPress={() => toggleSection(item.section)}><Text style={[s.listHeader, { color: themeColor }]}>{item.title}</Text><Ionicons name={expanded[item.section as keyof typeof expanded] ? "chevron-down" : "chevron-forward"} size={18} color={themeColor} /></TouchableOpacity>;
                return <TouchableOpacity style={[s.listItem, { backgroundColor: dynamicStyles.bg + '50', borderColor: dynamicStyles.border }]} onPress={() => onSelectCollection(item)}><Image source={item.art ? { uri: item.art } : DEFAULT_ICON} style={[s.listArt, item.type === 'ARTIST' && { borderRadius: 25 }]} /><View style={{ flex: 1 }}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{item.title}</Text><Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>{item.sub}</Text></View></TouchableOpacity>;
            }} />
        </BlurView></View>
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { height: '85%', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 5 },
  listHeader: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 8, gap: 15 },
  listArt: { width: 50, height: 50, borderRadius: 12 },
});