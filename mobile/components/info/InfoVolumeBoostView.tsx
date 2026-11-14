import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { t, LanguageCode } from '../../utils/i18n';
import { GlassActionButton } from '../ui/GlassActionButton';
import { 
  getAppVolumeSetting, 
  saveAppVolumeSetting, 
  VolumeMultiplierSetting, 
  DEFAULT_VOLUME_SETTING 
} from '../../utils/appVolume';

interface InfoVolumeBoostViewProps {
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  safePadding: any;
  renderHeader: (title: string, right?: React.ReactNode) => React.ReactNode;
  language?: LanguageCode;
}

export const InfoVolumeBoostView: React.FC<InfoVolumeBoostViewProps> = ({
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  safePadding,
  renderHeader,
  language = 'ja',
}) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const [setting, setSetting] = useState<VolumeMultiplierSetting>(DEFAULT_VOLUME_SETTING);
  const [activeTab, setActiveTab] = useState<'BOOST' | 'ATTENUATE'>('BOOST');

  useEffect(() => {
    (async () => {
      const s = await getAppVolumeSetting();
      setSetting(s);
      if (s.type === 'ATTENUATE') {
        setActiveTab('ATTENUATE');
      } else {
        setActiveTab('BOOST');
      }
    })();
  }, []);

  const handleApplySetting = async (type: 'NORMAL' | 'BOOST' | 'ATTENUATE', value: number) => {
    let multiplier = 1.0;
    if (type === 'BOOST') {
      multiplier = Math.max(1, value);
    } else if (type === 'ATTENUATE') {
      multiplier = 1 / Math.max(1, value);
    }

    const newSetting: VolumeMultiplierSetting = {
      type,
      value,
      multiplier,
    };
    setSetting(newSetting);
    await saveAppVolumeSetting(newSetting);
  };

  const boostPresets = [2, 3, 4, 5, 6, 8];
  const attenuatePresets = [2, 3, 4, 5, 8, 10];

  const getMultiplierDisplayText = () => {
    if (setting.type === 'NORMAL' || setting.multiplier === 1.0) {
      return '× 1.0 (標準)';
    }
    if (setting.type === 'BOOST') {
      return `× ${setting.value} ${t('volume_boost_times', language)}`;
    }
    return `1 / ${setting.value}`;
  };

  const getDbEstimateText = () => {
    if (setting.multiplier === 1.0) return '0.0 dB';
    const db = 20 * Math.log10(setting.multiplier);
    const sign = db > 0 ? '+' : '';
    return `${sign}${db.toFixed(1)} dB`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('volume_boost_title', language))}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 16 }]}>
        {/* 説明カード */}
        <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 16, overflow: 'hidden' }]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[s.iconBox, { backgroundColor: `rgba(79, 70, 229, 0.12)` }]}>
              <Ionicons name="volume-high-outline" size={24} color={themeColor} />
            </View>
            <Text style={[s.cardTitle, { color: dynamicStyles.text }]}>
              {t('volume_boost_title', language)}
            </Text>
          </View>
          <Text style={[s.descText, { color: dynamicStyles.subText }]}>
            {t('volume_boost_desc', language)}
          </Text>
        </View>

        {/* 現在の音量倍率表示 ＆ リセットボタン */}
        <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 20, alignItems: 'center', overflow: 'hidden' }]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <Text style={{ color: dynamicStyles.subText, fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
            {t('volume_boost_current', language)}
          </Text>
          
          <Text style={[s.bigMultiplierText, { color: setting.multiplier !== 1.0 ? themeColor : dynamicStyles.text }]}>
            {getMultiplierDisplayText()}
          </Text>

          <View style={{ backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'), paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 4, marginBottom: 16, overflow: 'hidden' }}>
            {useLiquidGlass && (
              <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            )}
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {getDbEstimateText()}
            </Text>
          </View>

          {setting.multiplier !== 1.0 && (
            <GlassActionButton
              isDark={isDark}
              onPress={() => handleApplySetting('NORMAL', 1)}
              style={[s.resetBtn, { backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#e5e7eb') }]}
            >
              <Ionicons name="refresh-outline" size={16} color={dynamicStyles.text} style={{ marginRight: 6 }} />
              <Text style={{ color: dynamicStyles.text, fontSize: 13, fontWeight: 'bold' }}>
                {t('volume_boost_normal_btn', language)}
              </Text>
            </GlassActionButton>
          )}
        </View>

        {/* モード選択タブ（整数倍 / 1/整数倍） */}
        <View style={{ flexDirection: 'row', backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderRadius: 16, padding: 4, marginBottom: 16, borderWidth: useLiquidGlass ? 0 : 1, borderColor: dynamicStyles.border, overflow: 'hidden' }}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'BOOST' ? themeColor : 'transparent' }}
            onPress={() => setActiveTab('BOOST')}
          >
            <Text style={{ color: activeTab === 'BOOST' ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }}>
              {t('volume_boost_tab_boost', language)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'ATTENUATE' ? themeColor : 'transparent' }}
            onPress={() => setActiveTab('ATTENUATE')}
          >
            <Text style={{ color: activeTab === 'ATTENUATE' ? textColor : dynamicStyles.text, fontWeight: 'bold', fontSize: 13 }}>
              {t('volume_boost_tab_attenuate', language)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 整数倍 (ブースト) セクション */}
        {activeTab === 'BOOST' && (
          <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, overflow: 'hidden' }]}>
            {useLiquidGlass && (
              <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="trending-up" size={18} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
                {t('volume_boost_tab_boost', language)}
              </Text>
            </View>

            <View style={s.presetGrid}>
              {boostPresets.map((val) => {
                const isSelected = setting.type === 'BOOST' && setting.value === val;
                return (
                  <TouchableOpacity
                    key={`boost-${val}`}
                    style={[
                      s.presetBtn,
                      {
                        backgroundColor: isSelected ? themeColor : (isDark ? '#2c2c2e' : '#f2f2f7'),
                        borderColor: isSelected ? themeColor : dynamicStyles.border,
                      }
                    ]}
                    onPress={() => handleApplySetting('BOOST', val)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.presetBtnText, { color: isSelected ? textColor : dynamicStyles.text }]}>
                      {val}{t('volume_boost_times', language)}
                    </Text>
                    <Text style={{ color: isSelected ? textColor : dynamicStyles.subText, fontSize: 11, marginTop: 2, opacity: 0.8 }}>
                      +{ (20 * Math.log10(val)).toFixed(1) } dB
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ステッパー微調整 */}
            <View style={[s.stepperRow, { borderTopWidth: 1, borderTopColor: dynamicStyles.border, marginTop: 16, paddingTop: 16 }]}>
              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={() => {
                  const current = setting.type === 'BOOST' ? setting.value : 1;
                  if (current > 2) handleApplySetting('BOOST', current - 1);
                  else handleApplySetting('NORMAL', 1);
                }}
              >
                <Ionicons name="remove" size={20} color={dynamicStyles.text} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', minWidth: 90 }}>
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                  {setting.type === 'BOOST' ? `${setting.value} ${t('volume_boost_times', language)}` : '1x'}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={() => {
                  const current = setting.type === 'BOOST' ? setting.value : 1;
                  handleApplySetting('BOOST', Math.min(10, current + 1));
                }}
              >
                <Ionicons name="add" size={20} color={dynamicStyles.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 1/整数倍 (減衰) セクション */}
        {activeTab === 'ATTENUATE' && (
          <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, overflow: 'hidden' }]}>
            {useLiquidGlass && (
              <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="trending-down" size={18} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
                {t('volume_boost_tab_attenuate', language)}
              </Text>
            </View>

            <View style={s.presetGrid}>
              {attenuatePresets.map((val) => {
                const isSelected = setting.type === 'ATTENUATE' && setting.value === val;
                return (
                  <TouchableOpacity
                    key={`attenuate-${val}`}
                    style={[
                      s.presetBtn,
                      {
                        backgroundColor: isSelected ? themeColor : (isDark ? '#2c2c2e' : '#f2f2f7'),
                        borderColor: isSelected ? themeColor : dynamicStyles.border,
                      }
                    ]}
                    onPress={() => handleApplySetting('ATTENUATE', val)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.presetBtnText, { color: isSelected ? textColor : dynamicStyles.text }]}>
                      1 / {val}
                    </Text>
                    <Text style={{ color: isSelected ? textColor : dynamicStyles.subText, fontSize: 11, marginTop: 2, opacity: 0.8 }}>
                      { (20 * Math.log10(1 / val)).toFixed(1) } dB
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ステッパー微調整 */}
            <View style={[s.stepperRow, { borderTopWidth: 1, borderTopColor: dynamicStyles.border, marginTop: 16, paddingTop: 16 }]}>
              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={() => {
                  const current = setting.type === 'ATTENUATE' ? setting.value : 1;
                  if (current > 2) handleApplySetting('ATTENUATE', current - 1);
                  else handleApplySetting('NORMAL', 1);
                }}
              >
                <Ionicons name="remove" size={20} color={dynamicStyles.text} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', minWidth: 90 }}>
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                  {setting.type === 'ATTENUATE' ? `1 / ${setting.value}` : '1x'}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={() => {
                  const current = setting.type === 'ATTENUATE' ? setting.value : 1;
                  handleApplySetting('ATTENUATE', Math.min(16, current + 1));
                }}
              >
                <Ionicons name="add" size={20} color={dynamicStyles.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* デジタル上限・ハードウェア保護に関する注意書き */}
        <View style={[
          s.card, 
          { 
            backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? 'rgba(234, 179, 8, 0.08)' : 'rgba(234, 179, 8, 0.08)'), 
            borderColor: isDark ? 'rgba(234, 179, 8, 0.25)' : 'rgba(202, 138, 4, 0.25)', 
            marginTop: 16,
            marginBottom: 24,
            overflow: 'hidden' 
          }
        ]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="information-circle-outline" size={20} color={isDark ? '#facc15' : '#ca8a04'} />
            <Text style={{ color: isDark ? '#fef08a' : '#854d0e', fontSize: 14, fontWeight: 'bold' }}>
              {t('volume_boost_notice_title', language)}
            </Text>
          </View>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#713f12', fontSize: 12.5, lineHeight: 19 }}>
            {t('volume_boost_notice_desc', language)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: 'bold' },
  descText: { fontSize: 13, lineHeight: 20 },
  bigMultiplierText: { fontSize: 32, fontWeight: '900', letterSpacing: 1, marginVertical: 4 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  presetBtn: { width: '31%', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  presetBtnText: { fontSize: 16, fontWeight: 'bold' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stepperBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});