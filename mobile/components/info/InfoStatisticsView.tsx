import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, FlatList, Image, 
  Alert, ActivityIndicator, Modal, TouchableWithoutFeedback, Animated, Easing, StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarqueeText } from '../MarqueeText';
import { t } from '../../utils/i18n';
import { 
  loadAllPlayHistoryApi, 
  loadAllWorkHistoryApi, 
  deletePlayHistoryBatchApi,
  deleteWorkHistoryBatchApi,
  getCutoffDate,
  parseSyncDate, 
  parseDurationToSeconds,
  formatWorkSessionEndTime,
  formatWorkDuration,
  DeletePeriod,
  PlayHistoryItem,
  WorkHistoryItem
} from '../../utils/chordiaSync';

const DEFAULT_ICON = require('../../assets/images/icon.png');
const GRAPH_HEIGHT = 180;
const ACCOUNT_STORAGE_KEY = 'chordia_sync_account';

export const formatSecToHMS = (sec: number) => {
  const total = Math.round(sec);
  if (total <= 0) return '0s';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const AnimatedMenuButton = ({ onPress, isDark, textStyle }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.82, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Animated.View style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', transform: [{ scale }] }}>
        <Ionicons name="ellipsis-horizontal" size={18} color={textStyle} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const AnimatedCancelButton = ({ onPress, dynamicStyles, label }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={{ backgroundColor: dynamicStyles.card, borderRadius: 16, height: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dynamicStyles.border, transform: [{ scale }] }}>
        <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{label || 'キャンセル'}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// 削除メニューモーダル
const HistoryDeleteMenuModal = ({ visible, onClose, onSelectPeriod, dynamicStyles, language }: any) => {
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 24, mass: 0.8, stiffness: 300 }).start();
    }
  }, [visible]);

  const closeWithAnim = (cb?: () => void) => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      onClose();
      if (cb) cb();
    });
  };

  const options: { period: DeletePeriod; labelKey: string }[] = [
    { period: '1day', labelKey: 'delete_keep_1day' },
    { period: '1week', labelKey: 'delete_keep_1week' },
    { period: '1month', labelKey: 'delete_keep_1month' },
    { period: '1year', labelKey: 'delete_keep_1year' },
    { period: 'all', labelKey: 'delete_all_history' },
  ];

  return (
    <Modal visible={visible} transparent animationType="none">
      <TouchableWithoutFeedback onPress={() => closeWithAnim()}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: sheetAnim, justifyContent: 'flex-end', paddingHorizontal: 15, paddingBottom: 25 }}>
          <TouchableWithoutFeedback>
            <Animated.View style={{ gap: 10, transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
              <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border, alignItems: 'center' }}>
                  <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>{t('delete_history_menu_title', language)}</Text>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>{t('delete_history_menu_subtitle', language)}</Text>
                </View>

                {options.map((opt, i) => (
                  <TouchableOpacity
                    key={opt.period}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: i !== options.length - 1 ? 1 : 0, borderBottomColor: dynamicStyles.border }}
                    onPress={() => closeWithAnim(() => onSelectPeriod(opt.period))}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '600' }}>{t(opt.labelKey, language)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <AnimatedCancelButton onPress={() => closeWithAnim()} dynamicStyles={dynamicStyles} label={t('cancel', language)} />
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ★ モーダル競合を防ぐ絶対配置のローディングオーバーレイ
const DeletingBlockOverlay = ({ visible, dynamicStyles, themeColor, language }: any) => {
  if (!visible) return null;
  return (
    <View 
      style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: 'rgba(0,0,0,0.65)', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 9999,
          elevation: 20
        }
      ]}
      pointerEvents="auto"
    >
      <View style={{ 
        backgroundColor: dynamicStyles.card, 
        paddingVertical: 24, 
        paddingHorizontal: 28, 
        borderRadius: 22, 
        alignItems: 'center', 
        gap: 14, 
        borderWidth: 1.5, 
        borderColor: dynamicStyles.border,
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 8 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 16, 
        elevation: 10 
      }}>
        <ActivityIndicator size="large" color={themeColor} />
        <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
          {t('deleting_history_progress', language)}
        </Text>
      </View>
    </View>
  );
};

export const InfoStatisticsView = ({
  dynamicStyles, themeColor, isDark, isLandscape, safePadding,
  focusHistory = [], pushView, renderHeader, language = 'ja', localLibrary = []
}: any) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);
  const [playbackHistory, setPlaybackHistory] = useState<any[]>([]);
  const [activeFocusHistory, setActiveFocusHistory] = useState<any[]>(focusHistory);
  const [isSyncAccount, setIsSyncAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const libraryArtMap = useMemo(() => {
    const map = new Map<string, string>();
    localLibrary.forEach((s: any) => {
      const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}`;
      if (s.localImageUri && !map.has(key)) map.set(key, s.localImageUri);
    });
    return map;
  }, [localLibrary]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const accountJson = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (accountJson) {
          const account = JSON.parse(accountJson);
          if (account.sid) {
            setIsSyncAccount(true);
            const [playRes, workRes] = await Promise.all([
              loadAllPlayHistoryApi(account.sid),
              loadAllWorkHistoryApi(account.sid)
            ]);

            if (playRes.success && playRes.history) setPlaybackHistory(playRes.history);
            if (workRes.success && workRes.history) {
              const formattedWork = workRes.history.map((item, idx) => ({
                id: `sync_${item.end}_${idx}`,
                date: parseSyncDate(item.end).toISOString(),
                duration: parseDurationToSeconds(item.time),
                device: item.device,
                rawEnd: item.end,
                rawTime: item.time,
              }));
              formattedWork.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              setActiveFocusHistory(formattedWork);
            }
            setIsLoading(false);
            return;
          }
        }

        setIsSyncAccount(false);
        const ph = await AsyncStorage.getItem('chordia_playback_history');
        if (ph) setPlaybackHistory(JSON.parse(ph));
        setActiveFocusHistory([...focusHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, [language, focusHistory]);

  const getLast7DaysData = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days.map(d => {
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      const totalSec = activeFocusHistory
        .filter((h: any) => {
          const hd = new Date(h.date);
          return hd >= d && hd < nextDay;
        })
        .reduce((sum: number, h: any) => sum + (h.duration || 0), 0);
      
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      return { 
        date: d, 
        totalSec, 
        label: `${d.getMonth() + 1}/${d.getDate()}`, 
        dayName: dayNames[d.getDay()],
        fullDateLabel: `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`
      };
    });
  };

  const topPlayedSongsLast7Days = useMemo(() => {
    if (!playbackHistory || playbackHistory.length === 0) return [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const countsMap = new Map<string, { song: any; count: number }>();

    for (const item of playbackHistory) {
      const playedDate = item.date ? parseSyncDate(item.date) : (item.playedAt ? new Date(item.playedAt) : new Date(0));
      if (playedDate >= sevenDaysAgo) {
        const title = item.title || 'Untitled';
        const artist = item.artist || 'Unknown Artist';
        const key = `${title.trim().toLowerCase()}:::${artist.trim().toLowerCase()}`;
        if (!countsMap.has(key)) {
          const artUri = item.localImageUri || libraryArtMap.get(key);
          countsMap.set(key, { song: { ...item, localImageUri: artUri }, count: 0 });
        }
        countsMap.get(key)!.count += 1;
      }
    }

    return Array.from(countsMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [playbackHistory, libraryArtMap]);

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const selectedDayData = selectedDayIndex !== null ? graphData[selectedDayIndex] : null;

  const getRankBadgeColor = (index: number) => {
    switch (index) {
      case 0: return '#f59e0b';
      case 1: return '#94a3b8';
      case 2: return '#b45309';
      default: return dynamicStyles.subText;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('stats_title', language))}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: dynamicStyles.text, fontSize: 22, fontWeight: 'bold' }}>{t('activity_record', language)}</Text>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
              {isSyncAccount ? t('stats_source_sync', language) : t('stats_source_local', language)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isSyncAccount ? `rgba(79, 70, 229, 0.12)` : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: isSyncAccount ? themeColor : dynamicStyles.border }}>
            <Ionicons name={isSyncAccount ? "cloud-done" : "phone-portrait-outline"} size={13} color={isSyncAccount ? themeColor : dynamicStyles.subText} />
            <Text style={{ color: isSyncAccount ? themeColor : dynamicStyles.subText, fontSize: 11, fontWeight: 'bold' }}>{isSyncAccount ? "Sync" : "Local"}</Text>
          </View>
        </View>
        
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold' }}>{t('last_7_days_focus', language)}</Text>
            {selectedDayData && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold' }}>{selectedDayData.fullDateLabel}: {formatSecToHMS(selectedDayData.totalSec)}</Text>
              </View>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', height: GRAPH_HEIGHT }}>
            <View style={{ justifyContent: 'space-between', paddingRight: 15, alignItems: 'flex-end', width: 75 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>{formatSecToHMS(maxSec)}</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>{formatSecToHMS(Math.round(maxSec / 2))}</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>0s</Text>
            </View>
            
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: dynamicStyles.border, paddingBottom: 5 }}>
              {graphData.map((d, i) => {
                const barHeight = maxSec > 0 ? (d.totalSec / maxSec) * (GRAPH_HEIGHT - 25) : 0;
                const isSelected = selectedDayIndex === i;
                return (
                  <TouchableOpacity key={i} style={{ alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }} onPress={() => setSelectedDayIndex(i)} activeOpacity={0.7}>
                    <View style={{ height: barHeight, width: isLandscape ? 32 : 18, backgroundColor: isSelected ? themeColor : (d.totalSec > 0 ? (isDark ? '#48484a' : '#c7c7cc') : (isDark ? '#2c2c2e' : '#e5e5ea')), borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: d.totalSec > 0 ? 6 : 0, borderWidth: isSelected ? 1.5 : 0, borderColor: '#ffffff' }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', marginLeft: 75, marginTop: 10 }}>
            {graphData.map((d, i) => {
              const isSelected = selectedDayIndex === i;
              return (
                <TouchableOpacity key={i} style={{ alignItems: 'center', flex: 1 }} onPress={() => setSelectedDayIndex(i)}>
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal' }}>{d.dayName}</Text>
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 10, marginTop: 2, fontWeight: isSelected ? '600' : 'normal' }}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={{ backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 25, borderWidth: 1, borderColor: dynamicStyles.border, flexDirection: 'row', justifyContent: 'center', gap: 8 }} onPress={() => pushView('STATS_ALL')} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={18} color={themeColor} />
          <Text style={{ color: themeColor, fontSize: 15, fontWeight: 'bold' }}>{t('view_all_focus_history', language)}</Text>
        </TouchableOpacity>

        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('ranking_last_7_days', language)}</Text>
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator color={themeColor} style={{ paddingVertical: 20 }} />
          ) : topPlayedSongsLast7Days.length > 0 ? (
            <View style={{ gap: 10 }}>
              {topPlayedSongsLast7Days.map((item, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <View style={{ width: 26, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                    <Text style={{ color: getRankBadgeColor(idx), fontSize: 15, fontWeight: '900' }}>{idx + 1}</Text>
                  </View>
                  <Image source={item.song.localImageUri ? { uri: item.song.localImageUri } : DEFAULT_ICON} style={{ width: 38, height: 38, borderRadius: 8, marginRight: 10 }} />
                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <MarqueeText text={item.song.title || 'Untitled'} style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }} />
                    <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{item.song.artist || 'Unknown Artist'}</Text>
                  </View>
                  <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold' }}>{item.count} {t('times', language)}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="musical-notes-outline" size={36} color={dynamicStyles.subText} style={{ marginBottom: 6 }} />
              <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>{t('no_ranking_data', language)}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={{ backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 35, borderWidth: 1, borderColor: dynamicStyles.border, flexDirection: 'row', justifyContent: 'center', gap: 8 }} onPress={() => pushView('PLAY_HISTORY')} activeOpacity={0.7}>
          <Ionicons name="list-outline" size={18} color={themeColor} />
          <Text style={{ color: themeColor, fontSize: 15, fontWeight: 'bold' }}>{t('view_all_playback_history', language)}</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>{t('total_focus_week', language)}</Text>
          <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(weekTotalSec)}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export const InfoAllHistoryView = ({
  dynamicStyles, themeColor, isDark, safePadding, renderHeader, language = 'ja'
}: any) => {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountSid, setAccountSid] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const accountJson = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (accountJson) {
        const account = JSON.parse(accountJson);
        if (account.sid) {
          setAccountSid(account.sid);
          const res = await loadAllWorkHistoryApi(account.sid);
          if (res.success && res.history) {
            const formatted = res.history.map((item, idx) => ({
              id: `sync_all_${item.end}_${idx}`,
              date: parseSyncDate(item.end).toISOString(),
              duration: parseDurationToSeconds(item.time),
              device: item.device,
              rawEnd: item.end,
              rawTime: item.time,
            }));
            formatted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHistoryList(formatted);
            setIsLoading(false);
            return;
          }
        }
      }
      const local = await AsyncStorage.getItem('chordia_focus_history');
      if (local) {
        const parsed = JSON.parse(local);
        parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistoryList(parsed);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [language]);

  const handleSelectDeletePeriod = (period: DeletePeriod) => {
    const isSync = !!accountSid;
    const title = isSync ? t('delete_history_confirm_sync_title', language) : t('delete_history_confirm_local_title', language);
    const desc = isSync ? t('delete_history_confirm_sync_desc', language) : t('delete_history_confirm_local_desc', language);

    Alert.alert(title, desc, [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete_confirm_btn', language),
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const cutoff = getCutoffDate(period);

          try {
            if (accountSid) {
              const toDeleteFromCloud: WorkHistoryItem[] = historyList.filter(item => {
                if (period === 'all') return true;
                return new Date(item.date) < cutoff;
              }).map(item => ({
                end: item.rawEnd || formatWorkSessionEndTime(new Date(item.date)),
                time: item.rawTime || formatWorkDuration(item.duration),
                device: item.device || '',
              }));

              if (toDeleteFromCloud.length > 0) {
                await deleteWorkHistoryBatchApi(accountSid, toDeleteFromCloud);
              }
            }

            if (period === 'all') {
              await AsyncStorage.setItem('chordia_focus_history', JSON.stringify([]));
              setHistoryList([]);
            } else {
              const localRaw = await AsyncStorage.getItem('chordia_focus_history');
              let localList: any[] = localRaw ? JSON.parse(localRaw) : [];
              localList = localList.filter((item: any) => new Date(item.date) >= cutoff);
              await AsyncStorage.setItem('chordia_focus_history', JSON.stringify(localList));
              setHistoryList(prev => prev.filter(item => new Date(item.date) >= cutoff));
            }

            setIsDeleting(false);
            setTimeout(() => {
              Alert.alert(t('confirm', language), t('delete_history_success', language));
            }, 100);
          } catch (e: any) {
            setIsDeleting(false);
            setTimeout(() => {
              Alert.alert(t('alert_timer_error_title', language), e?.message || '削除中にエラーが発生しました');
            }, 100);
          }
        }
      }
    ]);
  };

  const headerRight = (
    <AnimatedMenuButton onPress={() => setMenuVisible(true)} isDark={isDark} textStyle={dynamicStyles.text} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('focus_history_title', language), headerRight)}
      {isLoading ? (
        <ActivityIndicator color={themeColor} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={historyList}
          keyExtractor={(item, index) => `${item.id || index}`}
          contentContainerStyle={safePadding}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Ionicons name="time-outline" size={80} color={dynamicStyles.border} />
              <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>{t('no_focus_history', language)}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const d = new Date(item.date);
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            return (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: dynamicStyles.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: dynamicStyles.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                    <Ionicons name="checkmark-done-circle" size={26} color={themeColor} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} numberOfLines={1}>{dateStr}</Text>
                    {item.device && <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2, opacity: 0.8 }} numberOfLines={1}>{item.device}</Text>}
                  </View>
                </View>
                <Text style={{ color: themeColor, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(item.duration)}</Text>
              </View>
            );
          }}
        />
      )}

      <HistoryDeleteMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelectPeriod={handleSelectDeletePeriod}
        dynamicStyles={dynamicStyles}
        language={language}
      />

      <DeletingBlockOverlay 
        visible={isDeleting} 
        dynamicStyles={dynamicStyles} 
        themeColor={themeColor} 
        language={language} 
      />
    </View>
  );
};

export const InfoPlaybackHistoryView = ({
  dynamicStyles, themeColor, isDark, safePadding, renderHeader, language = 'ja', localLibrary = []
}: any) => {
  const [playbackList, setPlaybackList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountSid, setAccountSid] = useState<string | null>(null);

  const libraryArtMap = useMemo(() => {
    const map = new Map<string, string>();
    localLibrary.forEach((s: any) => {
      const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}`;
      if (s.localImageUri && !map.has(key)) map.set(key, s.localImageUri);
    });
    return map;
  }, [localLibrary]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const accountJson = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (accountJson) {
        const account = JSON.parse(accountJson);
        if (account.sid) {
          setAccountSid(account.sid);
          const res = await loadAllPlayHistoryApi(account.sid);
          if (res.success && res.history) {
            const sorted = [...res.history].sort((a, b) => {
              const dateA = a.date ? parseSyncDate(a.date).getTime() : 0;
              const dateB = b.date ? parseSyncDate(b.date).getTime() : 0;
              return dateB - dateA;
            });
            setPlaybackList(sorted);
            setIsLoading(false);
            return;
          }
        }
      }
      const ph = await AsyncStorage.getItem('chordia_playback_history');
      if (ph) {
        const parsed = JSON.parse(ph);
        parsed.sort((a: any, b: any) => new Date(b.playedAt || 0).getTime() - new Date(a.playedAt || 0).getTime());
        setPlaybackList(parsed);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [language]);

  const handleSelectDeletePeriod = (period: DeletePeriod) => {
    const isSync = !!accountSid;
    const title = isSync ? t('delete_history_confirm_sync_title', language) : t('delete_history_confirm_local_title', language);
    const desc = isSync ? t('delete_history_confirm_sync_desc', language) : t('delete_history_confirm_local_desc', language);

    Alert.alert(title, desc, [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete_confirm_btn', language),
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const cutoff = getCutoffDate(period);

          try {
            if (accountSid) {
              const toDeleteFromCloud = playbackList.filter((item: PlayHistoryItem) => {
                if (period === 'all') return true;
                const itemDate = item.date ? parseSyncDate(item.date) : new Date(0);
                return itemDate < cutoff;
              });

              if (toDeleteFromCloud.length > 0) {
                await deletePlayHistoryBatchApi(accountSid, toDeleteFromCloud);
              }
            }

            if (period === 'all') {
              await AsyncStorage.setItem('chordia_playback_history', JSON.stringify([]));
              setPlaybackList([]);
            } else {
              const localRaw = await AsyncStorage.getItem('chordia_playback_history');
              let localList: any[] = localRaw ? JSON.parse(localRaw) : [];
              localList = localList.filter((item: any) => new Date(item.playedAt || 0) >= cutoff);
              await AsyncStorage.setItem('chordia_playback_history', JSON.stringify(localList));

              setPlaybackList(prev => prev.filter(item => {
                const itemDate = item.date ? parseSyncDate(item.date) : new Date(item.playedAt || 0);
                return itemDate >= cutoff;
              }));
            }

            setIsDeleting(false);
            setTimeout(() => {
              Alert.alert(t('confirm', language), t('delete_history_success', language));
            }, 100);
          } catch (e: any) {
            setIsDeleting(false);
            setTimeout(() => {
              Alert.alert(t('alert_timer_error_title', language), e?.message || '削除中にエラーが発生しました');
            }, 100);
          }
        }
      }
    ]);
  };

  const headerRight = (
    <AnimatedMenuButton onPress={() => setMenuVisible(true)} isDark={isDark} textStyle={dynamicStyles.text} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('playback_history_title', language), headerRight)}
      {isLoading ? (
        <ActivityIndicator color={themeColor} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={playbackList}
          keyExtractor={(item, index) => `${item.id || index}-${item.date || item.playedAt}`}
          contentContainerStyle={safePadding}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Ionicons name="musical-notes-outline" size={80} color={dynamicStyles.border} />
              <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>{t('no_playback_history', language)}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const d = item.date ? parseSyncDate(item.date) : (item.playedAt ? new Date(item.playedAt) : new Date());
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const key = `${(item.title || '').trim().toLowerCase()}:::${(item.artist || '').trim().toLowerCase()}`;
            const artUri = item.localImageUri || libraryArtMap.get(key);

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: dynamicStyles.card, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: dynamicStyles.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 }}>
                <Image source={artUri ? { uri: artUri } : DEFAULT_ICON} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                  <MarqueeText text={item.title || 'Untitled'} style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} />
                  <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{item.artist || 'Unknown'} • {item.album || 'Unknown Album'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: '600' }}>{dateStr}</Text>
                  {item.device && <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 3, opacity: 0.8 }} numberOfLines={1}>{item.device}</Text>}
                </View>
              </View>
            );
          }}
        />
      )}

      <HistoryDeleteMenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelectPeriod={handleSelectDeletePeriod}
        dynamicStyles={dynamicStyles}
        language={language}
      />

      <DeletingBlockOverlay 
        visible={isDeleting} 
        dynamicStyles={dynamicStyles} 
        themeColor={themeColor} 
        language={language} 
      />
    </View>
  );
};