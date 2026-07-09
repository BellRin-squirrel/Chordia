import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, useWindowDimensions, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { styles } from '../styles/styles';

const PRESET_COLORS =[
  {r: 79, g: 70, b: 229}, {r: 0, g: 122, b: 255}, {r: 52, g: 199, b: 89},
  {r: 255, g: 45, b: 85}, {r: 255, g: 149, b: 0}, {r: 175, g: 82, b: 222},
  {r: 255, g: 167, b: 255}, {r: 255, g: 204, b: 0}, {r: 90, g: 200, b: 250},
];

export const SettingsScreen = ({ dynamicStyles, themeColor, isCustomTheme, themeR, themeG, themeB, recentColors, setThemeR, setThemeG, setThemeB, showRGBModal, setShowRGBModal, saveColor, applyCustomColor, insets, audioEngine, changeAudioEngine, showFocusTab, toggleFocusTab }: any) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const bottomPadding = isLandscape ? 100 : 120;
  const modalContentWidth = isLandscape ? Math.min(width * 0.9, 600) : width * 0.85;

  return (
    <View style={{flex:1, backgroundColor: dynamicStyles.bg}}>
      <View style={[styles.headerBar, {backgroundColor: dynamicStyles.bg, borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0)}]}><Text style={[styles.headerTitle, {color: dynamicStyles.text}]}>設定</Text></View>
      <ScrollView 
        style={{padding: 25}}
        contentContainerStyle={{ paddingBottom: bottomPadding }} 
      >
        <Text style={[styles.recentHeader, {color: dynamicStyles.text, marginLeft: 0}]}>テーマカラーを選択</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 15}}>
          {PRESET_COLORS.map((c, i) => (<TouchableOpacity key={i} onPress={() => saveColor(c.r, c.g, c.b, false)} style={[styles.colorPreset, {backgroundColor: `rgb(${c.r},${c.g},${c.b})`}, !isCustomTheme && themeR===c.r && themeG===c.g && {borderWidth:3, borderColor: dynamicStyles.text}]} />))}
          <TouchableOpacity onPress={() => setShowRGBModal(true)} style={[styles.colorPreset, isCustomTheme && {borderWidth:3, borderColor: dynamicStyles.text}]}>{isCustomTheme ? (<View style={{flex:1, backgroundColor: themeColor, borderRadius: 25}} />) : (<LinearGradient colors={['#FF9A9E', '#A18CD1', '#84FAB0', '#F6D365']} style={{flex:1, borderRadius:25}} />)}</TouchableOpacity>
        </View>

        <Text style={[styles.recentHeader, {color: dynamicStyles.text, marginLeft: 0, marginTop: 40}]}>再生エンジン (再起動推奨)</Text>
        <View style={{flexDirection: 'row', backgroundColor: dynamicStyles.card, borderRadius: 25, overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: dynamicStyles.border}}>
          <TouchableOpacity 
            style={{flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'rntp' ? themeColor : 'transparent'}}
            onPress={() => changeAudioEngine('rntp')}
          >
            <Text style={{color: audioEngine === 'rntp' ? '#fff' : dynamicStyles.text, fontWeight: 'bold'}}>RNTP (標準)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'expo-av' ? themeColor : 'transparent'}}
            onPress={() => changeAudioEngine('expo-av')}
          >
            <Text style={{color: audioEngine === 'expo-av' ? '#fff' : dynamicStyles.text, fontWeight: 'bold'}}>Expo-AV (BGM用)</Text>
          </TouchableOpacity>
        </View>
        <Text style={{color: dynamicStyles.subText, fontSize: 12, marginTop: 10, lineHeight: 18}}>
          【RNTP】ロック画面・AirPods操作対応。他アプリの音声と干渉します。{"\n"}
          【Expo-AV】他アプリと同時に再生(ミックス)可能。ロック画面操作は不可。
        </Text>

        <Text style={[styles.recentHeader, {color: dynamicStyles.text, marginLeft: 0, marginTop: 40}]}>機能設定</Text>
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 15, marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>作業(Focus)モード</Text>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>勉強や仕事に集中するための専用タブを表示します</Text>
            </View>
            <Switch 
                value={showFocusTab} 
                onValueChange={(val) => toggleFocusTab(val)} // ★ 修正: 値を渡す
                trackColor={{ false: "#767577", true: themeColor }}
                thumbColor={"#f4f3f4"}
            />
          </View>
        </View>

      </ScrollView>

      <Modal visible={showRGBModal} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
            <BlurView 
                intensity={100} 
                tint={dynamicStyles.blur} 
                style={[ styles.rgbModalContent, { width: modalContentWidth, padding: 20 } ]}
            >
                <Text style={[styles.modalTitle, {color: dynamicStyles.text, marginBottom: isLandscape ? 10 : 20, fontSize: isLandscape ? 16 : 18}]}>カスタムカラー設定</Text>
                <View style={{ flexDirection: isLandscape ? 'row' : 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ alignItems: 'center', marginRight: isLandscape ? 25 : 0, marginBottom: isLandscape ? 0 : 20 }}>
                        <View style={[styles.colorBoxBig, { backgroundColor: themeColor, width: isLandscape ? 100 : 120, height: isLandscape ? 100 : 120 }]} />
                        <Text style={[styles.rgbText, {color: dynamicStyles.text, marginTop: 8, fontSize: 14}]}>{themeColor}</Text>
                    </View>
                    <View style={{ flex: isLandscape ? 1 : 0, width: '100%' }}>
                        {[{l:'R',v:themeR,s:setThemeR,c:'#ef4444'},{l:'G',v:themeG,s:setThemeG,c:'#10b981'},{l:'B',v:themeB,s:setThemeB,c:'#3b82f6'}].map((item, i)=>(
                            <View key={i} style={[styles.sliderRow, { marginBottom: isLandscape ? 5 : 10 }]}>
                                <Text style={[styles.sliderLabel, {color: item.c, width: 20}]}>{item.l}</Text>
                                <Slider style={{flex:1}} minimumValue={0} maximumValue={255} step={1} value={item.v} onValueChange={item.s} />
                            </View>
                        ))}
                        {recentColors.length > 0 && (
                            <View style={{marginTop: isLandscape ? 10 : 15}}>
                                <Text style={[styles.subLabel, {color: dynamicStyles.subText, fontSize: 12}]}>最近の設定</Text>
                                <View style={styles.recentRow}>
                                    {recentColors.map((rc: any, idx: number) => (
                                        <TouchableOpacity key={idx} onPress={() => {setThemeR(rc.r); setThemeG(rc.g); setThemeB(rc.b);}} style={[styles.recentCircle, {backgroundColor: `rgb(${rc.r},${rc.g},${rc.b})`, width: 24, height: 24}]} />
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </View>
                <View style={[styles.modalBtnRow, { marginTop: isLandscape ? 15 : 25 }]}>
                    <TouchableOpacity onPress={() => setShowRGBModal(false)} style={styles.modalBtnCancel}><Text style={{color: '#8e8e93'}}>キャンセル</Text></TouchableOpacity>
                    <TouchableOpacity onPress={applyCustomColor} style={[styles.modalBtnApply, {backgroundColor: themeColor}]}><Text style={{color: '#fff', fontWeight:'bold'}}>設定</Text></TouchableOpacity>
                </View>
            </BlurView>
        </View>
      </Modal>
    </View>
  );
};