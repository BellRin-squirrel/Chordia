import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Switch, Modal, useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { styles } from '../../styles/styles';
import { LANGUAGES, LanguageCode, t } from '../../utils/i18n';
import { LanguageSelectModal } from '../LanguageSelectModal';

const PRESET_COLORS = [
  { r: 79, g: 70, b: 229 }, { r: 0, g: 122, b: 255 }, { r: 52, g: 199, b: 89 },
  { r: 255, g: 45, b: 85 }, { r: 255, g: 149, b: 0 }, { r: 175, g: 82, b: 222 },
  { r: 255, g: 167, b: 255 }, { r: 255, g: 204, b: 0 }, { r: 90, g: 200, b: 250 },
];

export const InfoSettingsView = ({
  dynamicStyles, themeColor, textColor, isCustomTheme, isDark,
  themeR, themeG, themeB, recentColors, setThemeR, setThemeG, setThemeB,
  showRGBModal, setShowRGBModal, saveColor, applyCustomColor,
  audioEngine, changeAudioEngine, showFocusTab, toggleFocusTab,
  showSyncTab, toggleSyncTab, showPlaylistTypeIcon, toggleShowPlaylistTypeIcon,
  language = 'ja', changeLanguage,
  renderHeader, safePadding, isLandscape
}: any) => {
  const { width } = useWindowDimensions();
  const modalContentWidth = isLandscape ? Math.min(width * 0.9, 600) : width * 0.85;

  const [langModalVisible, setLangModalVisible] = useState(false);
  const currentLangObj = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('settings_title', language))}
      
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 10 }]}>
        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0 }]}>
          {t('select_theme', language)}
        </Text>
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

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>
          {t('audio_engine', language)}
        </Text>
        <View style={{ flexDirection: 'row', backgroundColor: dynamicStyles.card, borderRadius: 25, overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: dynamicStyles.border }}>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'rntp' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('rntp')}
          >
            <Text style={{ color: audioEngine === 'rntp' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>
              {t('rntp_label', language)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ flex: 1, padding: 15, alignItems: 'center', backgroundColor: audioEngine === 'expo-av' ? themeColor : 'transparent' }}
            onPress={() => changeAudioEngine('expo-av')}
          >
            <Text style={{ color: audioEngine === 'expo-av' ? textColor : dynamicStyles.text, fontWeight: 'bold' }}>
              {t('expo_label', language)}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 10, lineHeight: 18 }}>
          {t('audio_engine_desc', language)}
        </Text>

        <Text style={[styles.recentHeader, { color: dynamicStyles.text, marginLeft: 0, marginTop: 40 }]}>
          {t('features_settings', language)}
        </Text>
        <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 15, marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
          {/* 言語設定 */}
          <TouchableOpacity 
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}
            onPress={() => setLangModalVisible(true)}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('language_setting', language)}
              </Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
                {t('language_setting_desc', language)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
              <Text style={{ color: themeColor, fontWeight: 'bold', fontSize: 14 }}>{currentLangObj.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={dynamicStyles.subText} />
            </View>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          {/* 同期タブ */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('sync_tab', language)}
              </Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
                {t('sync_tab_desc', language)}
              </Text>
            </View>
            <Switch 
              value={showSyncTab} 
              onValueChange={(val) => toggleSyncTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          {/* 作業(Focus)モード */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('focus_tab', language)}
              </Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
                {t('focus_tab_desc', language)}
              </Text>
            </View>
            <Switch 
              value={showFocusTab} 
              onValueChange={(val) => toggleFocusTab(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginHorizontal: 20 }} />

          {/* プレイリストの種類を明記 */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('playlist_type', language)}
              </Text>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
                {t('playlist_type_desc', language)}
              </Text>
            </View>
            <Switch 
              value={showPlaylistTypeIcon} 
              onValueChange={(val) => toggleShowPlaylistTypeIcon(val)} 
              trackColor={{ false: "#767577", true: themeColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>
        </View>
      </ScrollView>

      {/* カスタムRGBモーダル */}
      <Modal visible={showRGBModal} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={100} tint={dynamicStyles.blur} style={[styles.rgbModalContent, { width: modalContentWidth, padding: 20 }]}>
            <Text style={[styles.modalTitle, { color: dynamicStyles.text, marginBottom: isLandscape ? 10 : 20, fontSize: isLandscape ? 16 : 18 }]}>
              {t('custom_color_title', language)}
            </Text>
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
                    <Text style={[styles.subLabel, { color: dynamicStyles.subText, fontSize: 12 }]}>
                      {t('recent_settings', language)}
                    </Text>
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
              <TouchableOpacity onPress={() => setShowRGBModal(false)} style={styles.modalBtnCancel}>
                <Text style={{ color: '#8e8e93' }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyCustomColor} style={[styles.modalBtnApply, { backgroundColor: themeColor }]}>
                <Text style={{ color: textColor, fontWeight: 'bold' }}>{t('apply_color', language)}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* 言語選択モーダル */}
      <LanguageSelectModal 
        visible={langModalVisible}
        currentLanguage={language}
        onSelectLanguage={(newLang: LanguageCode) => {
          changeLanguage(newLang);
          setLangModalVisible(false);
        }}
        onClose={() => setLangModalVisible(false)}
        dynamicStyles={dynamicStyles}
        themeColor={themeColor}
        textColor={textColor}
        isDark={isDark}
        canClose={true}
      />
    </View>
  );
};
