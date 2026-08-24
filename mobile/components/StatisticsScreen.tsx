import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TouchableWithoutFeedback, Animated, FlatList, StyleSheet, useWindowDimensions, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { styles } from '../styles/styles';

const HISTORY_KEY = 'chordia_focus_history';
const GRAPH_HEIGHT = 180;

export const StatisticsScreen = ({ dynamicStyles, themeColor, insets, isDark, isLandscape }: any) => {
  const { width } = useWindowDimensions();
  const [focusHistory, setFocusHistory] = useState<any[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);
  
  // アニメーション用 State & Refs
  const [navStack, setNavStack] = useState<string[]>(['MAIN']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const panX = useRef(new Animated.Value(0)).current;
  const historyBackButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await AsyncStorage.getItem(HISTORY_KEY);
      if (res) setFocusHistory(JSON.parse(res));
    } catch (e) {}
  };

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

  const formatSecToHM = (sec: number) => {
    if (sec === 0) return '0分';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}時間${m}分`;
    return `${m}分`;
  };

  const formatSecToHMS = (sec: number) => {
    const total = Math.round(sec);
    if (total <= 0) return '0秒';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}時間${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  };

  const handleHistoryPressIn = () => { Animated.spring(historyBackButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handleHistoryPressOut = () => { Animated.spring(historyBackButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const selectedDayData = selectedDayIndex !== null ? graphData[selectedDayIndex] : null;

  const safePadding = {
    paddingBottom: 150 + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
    paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20,
  };
  
  const allHistoryPadding = {
    paddingBottom: 50 + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
    paddingRight: isLandscape ? Math.max(insets?.right || 0, 20) : 20,
  };

  const currentProgress = Animated.subtract(
    navAnim,
    Animated.divide(panX, width)
  );

  const layerBorderStyle = {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
  };

  const layer1Translate = currentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width * 0.25],
    extrapolate: 'clamp'
  });
  
  const layer1Darken = currentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4], 
    extrapolate: 'clamp'
  });

  const layer2Translate = currentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
    extrapolate: 'clamp'
  });

  const pushView = () => {
    if (isNavAnimating.current) return;
    isNavAnimating.current = true;
    setNavStack(['MAIN', 'ALL']);
    Animated.spring(navAnim, { 
      toValue: 1, 
      useNativeDriver: true, 
      stiffness: 300, 
      damping: 30,
      mass: 0.8,
      overshootClamping: true
    }).start(() => { isNavAnimating.current = false; });
  };

  const popView = () => {
    if (isNavAnimating.current || navStack.length <= 1) return;
    isNavAnimating.current = true;
    panX.setValue(0); 

    Animated.spring(navAnim, { 
      toValue: 0, 
      useNativeDriver: true, 
      stiffness: 300, 
      damping: 30,
      mass: 0.8,
      overshootClamping: true 
    }).start(() => {
      setNavStack(['MAIN']);
      isNavAnimating.current = false;
    });
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { state, translationX, velocityX } = event.nativeEvent;
    if (state === State.END || state === State.CANCELLED) {
      if (translationX > width / 4 || velocityX > 300) {
        if (isNavAnimating.current) return;
        isNavAnimating.current = true;
        Animated.timing(panX, {
          toValue: width,
          duration: 250,
          easing: Easing.out(Easing.poly(4)),
          useNativeDriver: true
        }).start(() => {
          setNavStack(['MAIN']);
          panX.setValue(0);
          navAnim.setValue(0);
          isNavAnimating.current = false;
        });
      } else {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          stiffness: 300,
          damping: 30,
          mass: 0.8,
          overshootClamping: true
        }).start();
      }
    }
  };

  const renderMain = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[styles.headerBar, { backgroundColor: dynamicStyles.bg, borderBottomColor: 'transparent', height: 44 }]}>
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>統計</Text>
      </View>

      <ScrollView contentContainerStyle={[{ padding: 20 }, safePadding]}>
        <Text style={{ color: dynamicStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: 20 }}>活動記録</Text>
        
        {/* 今週の棒グラフカード */}
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
              )
            })}
          </View>
        </View>

        {/* すべての履歴を確認するボタン */}
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
          onPress={async () => {
            await loadHistory();
            pushView();
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: themeColor, fontSize: 16, fontWeight: 'bold' }}>すべての集中セッション履歴を確認する</Text>
        </TouchableOpacity>

        {/* 週間合計時間 */}
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>この1週間の合計集中時間</Text>
          <Text style={{ color: themeColor, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatSecToHMS(weekTotalSec)}</Text>
        </View>
      </ScrollView>
    </View>
  );

  const renderAllHistory = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={[styles.navHeader, { height: 44, paddingLeft: isLandscape ? Math.max(insets?.left || 0, 15) : 15, paddingRight: isLandscape ? Math.max(insets?.right || 0, 15) : 15, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }]}>
        <View style={styles.navHeaderLeft}>
          <TouchableWithoutFeedback onPressIn={handleHistoryPressIn} onPressOut={handleHistoryPressOut} onPress={popView}>
              <Animated.View style={{ transform:[{ scale: historyBackButtonScale }] }}>
                  <View style={[styles.liquidGlassBackButton, { 
                      backgroundColor: isDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                  }]}>
                      <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                      <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
                  </View>
              </Animated.View>
          </TouchableWithoutFeedback>
        </View>
        <Text style={[styles.navHeaderTitle, { color: dynamicStyles.text }]} numberOfLines={1}>すべての履歴</Text>
        <View style={styles.navHeaderRight} />
      </View>

      <FlatList
        data={focusHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[{ padding: 20 }, allHistoryPadding]}
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
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: themeColor, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
                  {formatSecToHMS(item.duration)}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />

      <PanGestureHandler
        activeOffsetX={[-500, 10]}
        failOffsetY={[-15, 15]}
        enabled={navStack.length > 1}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <View style={{ flex: 1 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1, backgroundColor: dynamicStyles.bg, transform:[{ translateX: layer1Translate }] }]}>
            {renderMain()}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer1Darken }]} />
          </Animated.View>
          
          {navStack.length > 1 && (
            <Animated.View style={[StyleSheet.absoluteFill, layerBorderStyle, { zIndex: 2, backgroundColor: dynamicStyles.bg, transform:[{ translateX: layer2Translate }] }]}>
              {renderAllHistory()}
            </Animated.View>
          )}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};