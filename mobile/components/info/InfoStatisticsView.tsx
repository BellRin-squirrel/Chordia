import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';

const GRAPH_HEIGHT = 180;

export const formatSecToHMS = (sec: number) => {
  const total = Math.round(sec);
  if (total <= 0) return '0秒';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}時間${m}分${s}秒`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
};

export const InfoStatisticsView = ({
  dynamicStyles, themeColor, isDark, isLandscape, safePadding,
  focusHistory = [], pushView, renderHeader
}: any) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);

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
        fullDateLabel: `${d.getMonth() + 1}月${d.getDate()}日(${dayNames[d.getDay()]})`
      };
    });
  };

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const selectedDayData = selectedDayIndex !== null ? graphData[selectedDayIndex] : null;

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('統計')}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <Text style={{ color: dynamicStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>活動記録</Text>
        
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border, marginBottom: 25 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold' }}>過去7日間の集中時間</Text>
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
              <Text style={{ color: dynamicStyles.subText, fontSize: 10, fontWeight: '600' }}>0秒</Text>
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

        <TouchableOpacity 
          style={{
            backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
            paddingVertical: 18,
            borderRadius: 16,
            alignItems: 'center',
            marginBottom: 35,
            borderWidth: 1,
            borderColor: dynamicStyles.border
          }}
          onPress={() => pushView('STATS_ALL')}
          activeOpacity={0.7}
        >
          <Text style={{ color: themeColor, fontSize: 16, fontWeight: 'bold' }}>すべての集中セッション履歴を確認する</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>この1週間の合計集中時間</Text>
          <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(weekTotalSec)}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export const InfoAllHistoryView = ({
  dynamicStyles, themeColor, focusHistory = [], safePadding, renderHeader
}: any) => {
  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('すべての履歴')}
      <FlatList
        data={focusHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={safePadding}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="time-outline" size={80} color={dynamicStyles.border} />
            <Text style={{ color: dynamicStyles.subText, marginTop: 15, fontSize: 16, fontWeight: 'bold' }}>履歴がありません</Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = new Date(item.date);
          const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
