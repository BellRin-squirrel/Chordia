import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Animated, StyleSheet, 
  TouchableWithoutFeedback, useWindowDimensions, ScrollView, Switch, 
  Modal, Linking, Easing 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { styles, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';

const HISTORY_KEY = 'chordia_focus_history';
const GRAPH_HEIGHT = 180;

const PRESET_COLORS = [
  { r: 79, g: 70, b: 229 }, { r: 0, g: 122, b: 255 }, { r: 52, g: 199, b: 89 },
  { r: 255, g: 45, b: 85 }, { r: 255, g: 149, b: 0 }, { r: 175, g: 82, b: 222 },
  { r: 255, g: 167, b: 255 }, { r: 255, g: 204, b: 0 }, { r: 90, g: 200, b: 250 },
];

const INFO_MENU_ITEMS = [
  { title: '設定', icon: 'options-outline' as const, view: 'SETTINGS', sub: 'テーマカラー・再生エンジン・動作設定' },
  { title: '統計', icon: 'stats-chart-outline' as const, view: 'STATISTICS', sub: '集中セッションと活動履歴の分析' },
  { title: 'ライセンス・バージョン', icon: 'document-text-outline' as const, view: 'LICENSE', sub: 'Chordia について・開発情報' },
];

export const InfoScreen = ({ 
  dynamicStyles, themeColor, themeTextColor, isCustomTheme, 
  themeR, themeG, themeB, recentColors, setThemeR, setThemeG, setThemeB, 
  showRGBModal, setShowRGBModal, saveColor, applyCustomColor, 
  insets, audioEngine, changeAudioEngine, showFocusTab, toggleFocusTab, 
  showSyncTab, toggleSyncTab,
  isDark, isLandscape 
}: any) => {
  const { width } = useWindowDimensions();
  const textColor = themeTextColor || '#ffffff';

  // ナビゲーション管理
  const [navStack, setNavStack] = useState<string[]>(['MENU']);
  const navAnim = useRef(new Animated.Value(0)).current;
  const isNavAnimating = useRef(false);
  const backButtonScale = useRef(new Animated.Value(1)).current;
  const panX = useRef(new Animated.Value(0)).current;

  // 統計用 State
  const [focusHistory, setFocusHistory] = useState<any[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(6);

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

  const graphData = getLast7DaysData();
  const maxSec = Math.max(...graphData.map(d => d.totalSec));
  const weekTotalSec = graphData.reduce((sum, d) => sum + d.totalSec, 0);
  const selectedDayData = selectedDayIndex !== null ? graphData[selectedDayIndex] : null;

  // ナビゲーションアニメーション補間
  const currentProgress = Animated.subtract(navAnim, Animated.divide(panX, width));

  const layerBorderStyle = {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
  };

  const layer1Translate = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -width * 0.25, -width * 0.25],
    extrapolate: 'clamp'
  });
  
  const layer1Darken = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 0.4, 0.4], 
    extrapolate: 'clamp'
  });

  const layer2Translate = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [width, 0, -width * 0.25],
    extrapolate: 'clamp'
  });

  const layer2Darken = currentProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 0, 0.4],
    extrapolate: 'clamp'
  });

  const layer3Translate = currentProgress.interpolate({
    inputRange: [1, 2],
    outputRange: [width, 0],
    extrapolate: 'clamp'
  });

  const pushView = (view: string) => {
    if (isNavAnimating.current) return;
    isNavAnimating.current = true;
    const next = navStack.length;
    setNavStack([...navStack, view]);
    Animated.spring(navAnim, { 
      toValue: next, 
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

    const prev = navStack.length - 2;
    Animated.spring(navAnim, { 
      toValue: prev, 
      useNativeDriver: true, 
      stiffness: 300, 
      damping: 30,
      mass: 0.8,
      overshootClamping: true 
    }).start(() => {
      setNavStack(navStack.slice(0, -1));
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
          const nextStack = navStack.slice(0, -1);
          setNavStack(nextStack);
          panX.setValue(0);
          navAnim.setValue(nextStack.length - 1);
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

  const handlePressIn = () => { Animated.spring(backButtonScale, { toValue: 1.85, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };
  const handlePressOut = () => { Animated.spring(backButtonScale, { toValue: 1, useNativeDriver: true, bounciness: 15, speed: 20 }).start(); };

  const renderHeader = (title: string) => (
    <View style={[
      styles.navHeader, 
      { 
        paddingTop: insets?.top || 0, 
        height: 44 + (insets?.top || 0),
        paddingLeft: isLandscape ? Math.max(insets?.left || 0, 15) : 15,
        paddingRight: isLandscape ? Math.max(insets?.right || 0, 15) : 15,
      }
    ]}>
      <View style={styles.navHeaderLeft}>
        {navStack.length > 1 && (
          <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={popView}>
            <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
              <View style={[styles.liquidGlassBackButton, { 
                backgroundColor: isDark ? 'rgba(30,30,30,0.4)' : 'rgba(255,255,255,0.4)',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
              }]}>
                <BlurView intensity={isDark ? 50 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <Ionicons name="chevron-back" size={24} color={themeColor} style={{ marginLeft: -2 }} />
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}
      </View>
      <Text style={[styles.navHeaderTitle, { color: dynamicStyles.text }]} numberOfLines={1}>{title}</Text>
      <View style={styles.navHeaderRight} />
    </View>
  );

  const safePadding = {
    paddingBottom: (isLandscape ? 50 : 180) + (insets?.bottom || 0),
    paddingLeft: isLandscape ? Math.max(insets?.left || 0, 20) : 20,
    paddingRight: isLandscape ? (Math.max(insets?.right || 0, 20) + LANDSCAPE_TAB_BAR_WIDTH + 16) : 20,
  };

  // 1. メインメニュー
  const renderMenu = () => (
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
        }
      ]}>
        <Text style={[styles.headerTitle, { color: dynamicStyles.text }]}>情報</Text>
      </View>
      <FlatList
        data={INFO_MENU_ITEMS}
        keyExtractor={item => item.view}
        renderItem={({ item, index }) => (
          <TouchableOpacity 
            style={[styles.menuRow, index !== INFO_MENU_ITEMS.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: dynamicStyles.border }]} 
            onPress={() => pushView(item.view)}
          >
            <Ionicons name={item.icon} size={26} color={themeColor} style={styles.menuIcon} />
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.menuRowTitle, { color: dynamicStyles.text }]}>{item.title}</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={dynamicStyles.subText} />
          </TouchableOpacity>
        )}
        contentContainerStyle={safePadding}
      />
    </View>
  );

  // 2. 設定画面
  const renderSettings = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('設定')}
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0 }]}>テーマカラーを選択</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 15 }}>
          {PRESET_COLORS.map((c, i) => (
            <TouchableOpacity 
              key={i} 
              onPress={() => saveColor(c.r, c.g, c.b, false)} 
              style={[styles.colorPreset, { backgroundColor: `rgb(${c.r},${c.g},${c.b})` }, !isCustomTheme && themeR === c.r && themeG === c.g && { borderWidth: 3, borderColor: dynamicStyles.text }]} 
            />
          ))}
          <TouchableOpacity 
            onPress={() => setShowRGBModal(true)} 
            style={[styles.colorPreset, isCustomTheme && { borderWidth: 3, borderColor: dynamicStyles.text }]}
          >
            {isCustomTheme ? (
              <View style={{ flex: 1, backgroundColor: themeColor, borderRadius: 25 }} />
            ) : (
              <LinearGradient colors={['#FF9A9E', '#A18CD1', '#84FAB0', '#F6D365']} style={{ flex: 1, borderRadius: 25 }} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>再生エンジン (再起動推奨)</Text>
        <View style={{ flexDirection: 'row', backgroundColor: dynamicStyles.card, borderRadius: 25, overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: dynamicStyles.border }}>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'rntp' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('rntp')}
          >
            <Text style={{ color: audioEngine === 'rntp' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>RNTP (標準)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'expo-av' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('expo-av')}
          >
            <Text style={{ color: audioEngine === 'expo-av' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>Expo-Audio (BGM用)</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
          【RNTP】ロック画面・AirPods操作対応。他アプリの音声と干渉します。{"\n"}
          【Expo-Audio】他アプリと同時に再生(ミックス)可能。ロック画面操作は不可。
        </Text>

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>機能設定</Text>
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 15, marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
          {/* 同期タブ切り替え */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>同期タブ</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>PC版Chordiaとのデータ同期専用タブを表示します</Text>
            </View>
            <Switch 
              value={showSyncTab} 
              onValueChange={(val) => toggleSyncTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          {/* 作業(Focus)モード切り替え */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>作業(Focus)モード</Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>勉強や仕事に集中するための専用タブを表示します</Text>
            </View>
            <Switch 
              value={showFocusTab} 
              onValueChange={(val) => toggleFocusTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // 3. 統計画面
  const renderStatistics = () => (
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
          onPress={async () => {
            await loadHistory();
            pushView('STATS_ALL');
          }}
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

  // 4. ライセンス・バージョン画面
  const renderLicense = () => (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('ライセンス・バージョン')}
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 20, alignItems: 'center' }]}>
        <View style={[styles.licenseCard, { backgroundColor: dynamicStyles.card, borderWidth: 1, borderColor: dynamicStyles.border }]}>
          <Ionicons name="musical-notes" size={48} color={themeColor} style={{ marginBottom: 12 }} />
          <Text style={[styles.appNameLabel, { color: dynamicStyles.text }]}>Chordia Mobile版</Text>
          <Text style={styles.appVersionLabel}>v5.1.0</Text>
          
          <View style={[styles.divider, { backgroundColor: dynamicStyles.border, marginVertical: 20 }]} />
          
          <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 15 }}>
            Chordia は PC 版ライブラリとのシームレスな同期と没入感のある音楽再生・作業集中環境を提供する音楽プレイヤーアプリです。
          </Text>

          <Text style={[styles.copyrightLabel, { color: dynamicStyles.text }]}>© 2026 BellRin</Text>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
            onPress={() => Linking.openURL('https://github.com/BellRin-squirrel/Chordia')}
          >
            <Ionicons name="logo-github" size={18} color="#8957e5" />
            <Text style={{ color: '#8957e5', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }}>
              GitHub Repository
            </Text>
            <Ionicons name="open-outline" size={12} color="#8957e5" />
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', maxWidth: 400, marginTop: 25, backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border }}>
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>オープンソースライセンス</Text>
          <Text style={{ color: dynamicStyles.subText, fontSize: 12, lineHeight: 18 }}>
            本アプリケーションは、React Native, Expo, React Native Track Player, Expo Audio をはじめとするオープンソースソフトウェアを利用して開発されています。
          </Text>
        </View>
      </ScrollView>
    </View>
  );

  // 5. 集中履歴全件画面 (Layer 3)
  const renderAllHistory = () => (
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

  const modalContentWidth = isLandscape ? Math.min(width * 0.9, 600) : width * 0.85;

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
          
          {/* Layer 1: メニュー層 */}
          <Animated.View style={[StyleSheet.absoluteFill, { 
            zIndex: 1,
            backgroundColor: dynamicStyles.bg,
            transform: [{ translateX: layer1Translate }] 
          }]}>
            {renderMenu()}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer1Darken }]} />
          </Animated.View>
          
          {/* Layer 2: 設定 / 統計 / ライセンス */}
          {navStack.length > 1 && (
            <Animated.View 
              style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                zIndex: 2,
                backgroundColor: dynamicStyles.bg,
                transform: [{ translateX: layer2Translate }] 
              }]}
            >
              {navStack[1] === 'SETTINGS' && renderSettings()}
              {navStack[1] === 'STATISTICS' && renderStatistics()}
              {navStack[1] === 'LICENSE' && renderLicense()}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: layer2Darken }]} />
            </Animated.View>
          )}

          {/* Layer 3: 統計の全履歴 */}
          {navStack.length > 2 && (
            <Animated.View 
              style={[StyleSheet.absoluteFill, layerBorderStyle, { 
                zIndex: 3,
                backgroundColor: dynamicStyles.bg,
                transform: [{ translateX: layer3Translate }] 
              }]}
            >
              {renderAllHistory()}
            </Animated.View>
          )}

        </View>
      </PanGestureHandler>

      {/* カスタムRGBモーダル */}
      <Modal visible={showRGBModal} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
          <BlurView 
            intensity={100} 
            tint={dynamicStyles.blur} 
            style={[styles.rgbModalContent, { width: modalContentWidth, padding: 20 }]}
          >
            <Text style={[styles.modalTitle, { color: dynamicStyles.text, marginBottom: isLandscape ? 10 : 20, fontSize: isLandscape ? 16 : 18 }]}>カスタムカラー設定</Text>
            <View style={{ flexDirection: isLandscape ? 'row' : 'column', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center', marginRight: isLandscape ? 25 : 0, marginBottom: isLandscape ? 0 : 20 }}>
                <View style={[styles.colorBoxBig, { backgroundColor: themeColor, width: isLandscape ? 100 : 120, height: isLandscape ? 100 : 120 }]} />
                <Text style={[styles.rgbText, { color: dynamicStyles.text, marginTop: 8, fontSize: 14 }]}>{themeColor}</Text>
              </View>
              <View style={{ flex: isLandscape ? 1 : 0, width: '100%' }}>
                {[{ l: 'R', v: themeR, s: setThemeR, c: '#ef4444' }, { l: 'G', v: themeG, s: setThemeG, c: '#10b981' }, { l: 'B', v: themeB, s: setThemeB, c: '#3b82f6' }].map((item, i) => (
                  <View key={i} style={[styles.sliderRow, { marginBottom: isLandscape ? 5 : 10 }]}>
                    <Text style={[styles.sliderLabel, { color: item.c, width: 20 }]}>{item.l}</Text>
                    <Slider style={{ flex: 1 }} minimumValue={0} maximumValue={255} step={1} value={item.v} onValueChange={item.s} />
                  </View>
                ))}
                {recentColors.length > 0 && (
                  <View style={{ marginTop: isLandscape ? 10 : 15 }}>
                    <Text style={[styles.subLabel, { color: dynamicStyles.subText, fontSize: 12 }]}>最近の設定</Text>
                    <View style={styles.recentRow}>
                      {recentColors.map((rc: any, idx: number) => (
                        <TouchableOpacity key={idx} onPress={() => { setThemeR(rc.r); setThemeG(rc.g); setThemeB(rc.b); }} style={[styles.recentCircle, { backgroundColor: `rgb(${rc.r},${rc.g},${rc.b})`, width: 24, height: 24 }]} />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.modalBtnRow, { marginTop: isLandscape ? 15 : 25 }]}>
              <TouchableOpacity onPress={() => setShowRGBModal(false)} style={styles.modalBtnCancel}><Text style={{ color: '#8e8e93' }}>キャンセル</Text></TouchableOpacity>
              <TouchableOpacity onPress={applyCustomColor} style={[styles.modalBtnApply, { backgroundColor: themeColor }]}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>設定</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};