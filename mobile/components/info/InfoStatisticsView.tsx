import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MarqueeText } from '../MarqueeText';
import { t } from '../../utils/i18n';
import { loadAllPlayHistoryApi, parseSyncDate, PlayHistoryItem } from '../../utils/chordiaSync';

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

export const InfoStatisticsView = ({
  dynamicStyles, themeColor, isDark, isLandscape, safePadding,
  focusHistory = [], pushView, renderHeader, language = 'ja', localLibrary = []
}: any) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);
  const [playbackHistory, setPlaybackHistory] = useState<any[]>([]);
  const [isSyncAccount, setIsSyncAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 楽曲ジャケット画像の高速マップ作成
  const libraryArtMap = useMemo(() => {
    const map = new Map<string, string>();
    localLibrary.forEach((s: any) => {
      const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}`;
      if (s.localImageUri && !map.has(key)) {
        map.set(key, s.localImageUri);
      }
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
            const res = await loadAllPlayHistoryApi(account.sid);
            if (res.success && res.history) {
              setPlaybackHistory(res.history);
              setIsLoading(false);
              return;
            } else if (res.error) {
              Alert.alert(t('alert_timer_error_title', language), res.error);
            }
          }
        }

        // ログインしていない場合・失敗時はローカル履歴を使用
        const ph = await AsyncStorage.getItem('chordia_playback_history');
        if (ph) setPlaybackHistory(JSON.parse(ph));
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, [language]);

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
      const totalSec = focusHistory
        .filter((h: any) => {
          const hd = new Date(h.date);
          return hd >= d && hd < nextDay;
        })
        .reduce((sum: number, h: any) => sum + h.duration, 0);
      
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

  // 直近7日間の再生回数ランキングTOP5導出
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
          countsMap.set(key, { 
            song: { ...item, localImageUri: artUri }, 
            count: 0 
          });
        }
        countsMap.get(key)!.count += 1;
      }
    }

    return Array.from(countsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
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
        <Text style={{ color: dynamicStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>
          {t('activity_record', language)}
        </Text>
        
        {/* 過去7日間の集中時間グラフカード */}
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold' }}>
              {t('last_7_days_focus', language)}
            </Text>
            {selectedDayData && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold' }}>
                  {selectedDayData.fullDateLabel}: {formatSecToHMS(selectedDayData.totalSec)}
                </Text>
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
                  <TouchableOpacity 
                    key={i} 
                    style={{ alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}
                    onPress={() => setSelectedDayIndex(i)}
                    activeOpacity={0.7}
                  >
                    <View style={{ 
                      height: barHeight, 
                      width: isLandscape ? 32 : 18, 
                      backgroundColor: isSelected 
                        ? themeColor 
                        : (d.totalSec > 0 ? (isDark ? '#48484a' : '#c7c7cc') : (isDark ? '#2c2c2e' : '#e5e5ea')), 
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      minHeight: d.totalSec > 0 ? 6 : 0,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: '#ffffff',
                    }} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', marginLeft: 75, marginTop: 10 }}>
            {graphData.map((d, i) => {
              const isSelected = selectedDayIndex === i;
              return (
                <TouchableOpacity 
                  key={i} 
                  style={{ alignItems: 'center', flex: 1 }}
                  onPress={() => setSelectedDayIndex(i)}
                >
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal' }}>{d.dayName}</Text>
                  <Text style={{ color: isSelected ? themeColor : dynamicStyles.subText, fontSize: 10, marginTop: 2, fontWeight: isSelected ? '600' : 'normal' }}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 集中セッション全履歴ボタン */}
        <TouchableOpacity 
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            marginBottom: 25,
            borderWidth: 1,
            borderColor: dynamicStyles.border,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8
          }}
          onPress={() => pushView('STATS_ALL')}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={themeColor} />
          <Text style={{ color: themeColor, fontSize: 15, fontWeight: 'bold' }}>
            {t('view_all_focus_history', language)}
          </Text>
        </TouchableOpacity>

        {/* 直近7日間の再生回数ランキング TOP 5 */}
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('ranking_last_7_days', language)}
              </Text>
            </View>
            {isSyncAccount && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `rgba(79, 70, 229, 0.12)`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                <Ionicons name="cloud-done" size={13} color={themeColor} />
                <Text style={{ color: themeColor, fontSize: 11, fontWeight: 'bold' }}>Sync</Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator color={themeColor} style={{ paddingVertical: 20 }} />
          ) : topPlayedSongsLast7Days.length > 0 ? (
            <View style={{ gap: 10 }}>
              {topPlayedSongsLast7Days.map((item, idx) => (
                <View 
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7',
                    borderWidth: 1,
                    borderColor: dynamicStyles.border
                  }}
                >
                  <View style={{ width: 26, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                    <Text style={{ color: getRankBadgeColor(idx), fontSize: 15, fontWeight: '900' }}>
                      {idx + 1}
                    </Text>
                  </View>

                  <Image 
                    source={item.song.localImageUri ? { uri: item.song.localImageUri } : DEFAULT_ICON} 
                    style={{ width: 38, height: 38, borderRadius: 8, marginRight: 10 }} 
                  />

                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <MarqueeText 
                      text={item.song.title || 'Untitled'} 
                      style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }} 
                    />
                    <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {item.song.artist || 'Unknown Artist'}
                    </Text>
                  </View>

                  <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: themeColor, fontSize: 12, fontWeight: 'bold' }}>
                      {item.count} {t('times', language)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="musical-notes-outline" size={36} color={dynamicStyles.subText} style={{ marginBottom: 6 }} />
              <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>
                {t('no_ranking_data', language)}
              </Text>
            </View>
          )}
        </View>

        {/* 楽曲再生一覧ボタン */}
        <TouchableOpacity 
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            marginBottom: 35,
            borderWidth: 1,
            borderColor: dynamicStyles.border,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8
          }}
          onPress={() => pushView('PLAY_HISTORY')}
          activeOpacity={0.7}
        >
          <Ionicons name="list-outline" size={18} color={themeColor} />
          <Text style={{ color: themeColor, fontSize: 15, fontWeight: 'bold' }}>
            {t('view_all_playback_history', language)}
          </Text>
        </TouchableOpacity>

        {/* 週間合計集中時間 */}
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>
            {t('total_focus_week', language)}
          </Text>
          <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {formatSecToHMS(weekTotalSec)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export const InfoAllHistoryView = ({
  dynamicStyles, themeColor, focusHistory = [], safePadding, renderHeader, language = 'ja'
}: any) => {
  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('focus_history_title', language))}
      <FlatList
        data={focusHistory}
        keyExtractor={(item, index) => `${item.id || index}`}
        contentContainerStyle={safePadding}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="time-outline" size={80} color={dynamicStyles.border} />
            <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>
              {t('no_focus_history', language)}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.date);
          const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          return (
            <View style={{ 
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
              backgroundColor: dynamicStyles.card, padding: 16, borderRadius: 16, marginBottom: 12,
              borderWidth: 1, borderColor: dynamicStyles.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                  <Ionicons name="checkmark-done-circle" size={26} color={themeColor} />
                </View>
                <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', flex: 1 }}>{dateStr}</Text>
              </View>
              <Text style={{ color: themeColor, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(item.duration)}</Text>
            </View>
          );
        }}
      />
    </View>
  );
};

export const InfoPlaybackHistoryView = ({
  dynamicStyles, themeColor, safePadding, renderHeader, language = 'ja', localLibrary = []
}: any) => {
  const [playbackList, setPlaybackList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const libraryArtMap = useMemo(() => {
    const map = new Map<string, string>();
    localLibrary.forEach((s: any) => {
      const key = `${(s.title || '').trim().toLowerCase()}:::${(s.artist || '').trim().toLowerCase()}`;
      if (s.localImageUri && !map.has(key)) {
        map.set(key, s.localImageUri);
      }
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
            const res = await loadAllPlayHistoryApi(account.sid);
            if (res.success && res.history) {
              setPlaybackList(res.history);
              setIsLoading(false);
              return;
            } else if (res.error) {
              Alert.alert(t('alert_timer_error_title', language), res.error);
            }
          }
        }

        const ph = await AsyncStorage.getItem('chordia_playback_history');
        if (ph) setPlaybackList(JSON.parse(ph));
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    })();
  }, [language]);

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('playback_history_title', language))}
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
              <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>
                {t('no_playback_history', language)}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const d = item.date ? parseSyncDate(item.date) : (item.playedAt ? new Date(item.playedAt) : new Date());
            const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const key = `${(item.title || '').trim().toLowerCase()}:::${(item.artist || '').trim().toLowerCase()}`;
            const artUri = item.localImageUri || libraryArtMap.get(key);

            return (
              <View style={{ 
                flexDirection: 'row', alignItems: 'center', 
                backgroundColor: dynamicStyles.card, padding: 14, borderRadius: 16, marginBottom: 10,
                borderWidth: 1, borderColor: dynamicStyles.border,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2
              }}>
                <Image 
                  source={artUri ? { uri: artUri } : DEFAULT_ICON} 
                  style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} 
                />
                
                {/* 左側: 曲名 & アーティスト・アルバム名 */}
                <View style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                  <MarqueeText 
                    text={item.title || 'Untitled'} 
                    style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} 
                  />
                  <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {item.artist || 'Unknown'} • {item.album || 'Unknown Album'}
                  </Text>
                </View>

                {/* ★ 右側: 日付 ＆ その下に再生デバイス名を表示 */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: '600' }}>
                    {dateStr}
                  </Text>
                  {item.device && (
                    <Text 
                      style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 3, opacity: 0.8 }} 
                      numberOfLines={1}
                    >
                      {item.device}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};