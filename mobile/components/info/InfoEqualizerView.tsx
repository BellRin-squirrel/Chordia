import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Switch,
  Modal, Alert, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Button as SwiftUIButton, Host as SwiftUIHost, Menu as SwiftUIMenu, RNHostView } from '@expo/ui/swift-ui';
import { t } from '../../utils/i18n';
import { GlassActionButton } from '../ui/GlassActionButton';
import { GlassTextInput } from '../ui/GlassTextInput';
import { 
  applyEqualizerSettings, 
  initEqualizer, 
  setEqualizerEnabled, 
  setEqualizerBands,
  getEqualizerDebugInfo
} from '../../utils/equalizer';

const STORAGE_EQ_KEY = 'chordia_equalizer_settings';
const STORAGE_CUSTOM_PRESETS_KEY = 'chordia_custom_equalizer_presets';

const BAND_NAME_KEYS: Record<string, string> = {
  '32Hz': 'eq_band_32Hz',
  '64Hz': 'eq_band_64Hz',
  '125Hz': 'eq_band_125Hz',
  '250Hz': 'eq_band_250Hz',
  '500Hz': 'eq_band_500Hz',
  '1kHz': 'eq_band_1kHz',
  '2kHz': 'eq_band_2kHz',
  '4kHz': 'eq_band_4kHz',
  '8kHz': 'eq_band_8kHz',
  '16kHz': 'eq_band_16kHz',
};

export interface EqualizerBand {
  freq: string;
  gain: number;
}

export interface CustomPreset {
  id: string;
  name: string;
  bands: EqualizerBand[];
  preamp?: number;
}

export interface BuiltInPreset {
  id: string;
  name: string;
  gains: number[];
  preamp: number;
}

export const BUILTIN_PRESETS: BuiltInPreset[] = [
  { id: "flat", name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0 },
  { id: "rock", name: "Rock", gains: [4.5, 3.0, 1.5, 0, -1.5, -1.0, 1.0, 2.5, 4.0, 4.5], preamp: -1.5 },
  { id: "pop", name: "Pop", gains: [-1.0, 1.0, 2.5, 3.5, 3.0, 1.0, -1.0, -1.5, 1.5, 2.5], preamp: -1.0 },
  { id: "bass_boost", name: "Bass Boost", gains: [6.0, 5.0, 4.0, 2.5, 1.0, 0, 0, 0, 0, 0], preamp: -3.0 },
  { id: "vocal", name: "Vocal / Podcast", gains: [-3.0, -2.0, -1.0, 1.5, 3.5, 4.0, 3.0, 1.5, 0, -1.5], preamp: -1.0 },
  { id: "acoustic_jazz", name: "Acoustic & Jazz", gains: [3.0, 2.5, 1.5, 1.0, 1.5, 1.5, 2.0, 2.5, 3.0, 3.0], preamp: -1.0 },
  { id: "electronic", name: "Electronic", gains: [5.0, 4.0, 2.0, 0, -2.0, 1.5, 2.0, 3.0, 4.5, 5.0], preamp: -2.5 },
  { id: "treble_boost", name: "Treble Boost", gains: [0, 0, 0, 0, 0, 1.0, 2.5, 4.0, 5.5, 6.0], preamp: -2.0 },
  { id: "night_mode", name: "Night Mode", gains: [-4.0, -3.0, -2.0, 0, 1.0, 1.0, 1.0, 0, -2.0, -3.5], preamp: 0 },
  { id: "classical", name: "Classical", gains: [4.0, 3.0, 2.0, 1.5, -1.0, -1.0, 0, 1.5, 2.5, 3.5], preamp: -1.0 }
];

const DEFAULT_BANDS: EqualizerBand[] = [
  { freq: '32Hz', gain: 0 },
  { freq: '64Hz', gain: 0 },
  { freq: '125Hz', gain: 0 },
  { freq: '250Hz', gain: 0 },
  { freq: '500Hz', gain: 0 },
  { freq: '1kHz', gain: 0 },
  { freq: '2kHz', gain: 0 },
  { freq: '4kHz', gain: 0 },
  { freq: '8kHz', gain: 0 },
  { freq: '16kHz', gain: 0 },
];

export const InfoEqualizerView = ({
  dynamicStyles, themeColor, textColor, isDark, safePadding, renderHeader, language = 'ja'
}: any) => {
  const useLiquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const [isEnabled, setIsEnabled] = useState(false);
  const [bands, setBands] = useState<EqualizerBand[]>(DEFAULT_BANDS);
  const [preamp, setPreamp] = useState<number>(0);
  const [activePresetId, setActivePresetId] = useState<string | null>('flat');
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [sliderVersion, setSliderVersion] = useState(0);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  const isProgrammaticChangeRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        isProgrammaticChangeRef.current = true;
        // 既に ExoPlayer 等の有効セッションに接続済みの場合は再初期化して破壊しない
        const info = getEqualizerDebugInfo();
        if (!info.isNativeConnected) {
          await initEqualizer(0);
        }

        const savedSettings = await AsyncStorage.getItem(STORAGE_EQ_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          const loadedEnabled = parsed.isEnabled !== undefined ? parsed.isEnabled : false;
          const loadedBands = Array.isArray(parsed.bands) ? parsed.bands : DEFAULT_BANDS;
          const loadedPreamp = parsed.preamp !== undefined ? parsed.preamp : 0;

          setIsEnabled(loadedEnabled);
          setBands(loadedBands);
          setPreamp(loadedPreamp);
          if (parsed.activePresetId !== undefined) setActivePresetId(parsed.activePresetId);
          setSliderVersion(prev => prev + 1);

          applyEqualizerSettings({
            enabled: loadedEnabled,
            preamp: loadedPreamp,
            gains: loadedBands.map((b: EqualizerBand) => b.gain),
          });
        }

        const savedPresets = await AsyncStorage.getItem(STORAGE_CUSTOM_PRESETS_KEY);
        if (savedPresets) {
          setCustomPresets(JSON.parse(savedPresets));
        }

        setTimeout(() => {
          isProgrammaticChangeRef.current = false;
        }, 500);
      } catch (e) {
        isProgrammaticChangeRef.current = false;
      }
    })();

  }, []);

  const saveAndSyncHardware = async (newEnabled: boolean, newBands: EqualizerBand[], newPreamp: number, newActivePresetId: string | null) => {
    try {
      await AsyncStorage.setItem(STORAGE_EQ_KEY, JSON.stringify({ 
        isEnabled: newEnabled, 
        bands: newBands, 
        preamp: newPreamp,
        activePresetId: newActivePresetId 
      }));

      applyEqualizerSettings({
        enabled: newEnabled,
        preamp: newPreamp,
        gains: newBands.map(b => b.gain),
      });

    } catch (e) {}
  };

  const handleToggleEnable = (val: boolean) => {
    setIsEnabled(val);
    saveAndSyncHardware(val, bands, preamp, activePresetId);
  };

  const handleGainChange = (index: number, val: number) => {
    if (isProgrammaticChangeRef.current) return;

    const rounded = Math.round(val * 2) / 2;
    if (bands[index]?.gain === rounded) return;

    const updated = [...bands];
    updated[index] = { ...updated[index], gain: rounded };
    setBands(updated);
    setActivePresetId(null);
    saveAndSyncHardware(isEnabled, updated, preamp, null);
  };

  const handlePreampChange = (val: number) => {
    if (isProgrammaticChangeRef.current) return;

    const rounded = Math.round(val * 2) / 2;
    if (preamp === rounded) return;

    setPreamp(rounded);
    setActivePresetId(null);
    saveAndSyncHardware(isEnabled, bands, rounded, null);
  };

  const handleSelectBuiltInPreset = (preset: BuiltInPreset) => {
    isProgrammaticChangeRef.current = true;

    const newBands = DEFAULT_BANDS.map((b, i) => ({
      ...b,
      gain: preset.gains[i] !== undefined ? preset.gains[i] : 0,
    }));
    const newPreamp = preset.preamp !== undefined ? preset.preamp : 0;

    setBands(newBands);
    setPreamp(newPreamp);
    setActivePresetId(preset.id);
    setIsEnabled(true);
    setSliderVersion(prev => prev + 1);
    saveAndSyncHardware(true, newBands, newPreamp, preset.id);

    setTimeout(() => {
      isProgrammaticChangeRef.current = false;
    }, 500);
  };

  const handleResetFlat = () => {
    isProgrammaticChangeRef.current = true;

    const flat = DEFAULT_BANDS.map(b => ({ ...b, gain: 0 }));
    setBands(flat);
    setPreamp(0);
    setActivePresetId('flat');
    setSliderVersion(prev => prev + 1);
    saveAndSyncHardware(isEnabled, flat, 0, 'flat');

    setTimeout(() => {
      isProgrammaticChangeRef.current = false;
    }, 500);
  };

  const handleSaveCustomPreset = async () => {
    if (!presetNameInput.trim()) return;
    const name = presetNameInput.trim();

    const clonedBands: EqualizerBand[] = bands.map(b => ({
      freq: b.freq,
      gain: Number(b.gain) || 0,
    }));

    const newPreset: CustomPreset = {
      id: 'custom_' + Date.now(),
      name,
      bands: clonedBands,
      preamp: Number(preamp) || 0,
    };

    const updatedList = [newPreset, ...customPresets];
    setCustomPresets(updatedList);
    setActivePresetId(newPreset.id);
    await AsyncStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updatedList));

    setPresetNameInput('');
    setSaveModalVisible(false);
    setSliderVersion(prev => prev + 1);

    Alert.alert(t('confirm', language), t('equalizer_saved_alert', language).replace('{name}', name));
  };

  const handleApplyCustomPreset = (preset: CustomPreset) => {
    isProgrammaticChangeRef.current = true;

    let newBands: EqualizerBand[] = [];

    if (Array.isArray(preset.bands) && preset.bands.length > 0) {
      if (typeof preset.bands[0] === 'number') {
        newBands = DEFAULT_BANDS.map((b, i) => ({
          ...b,
          gain: Number((preset.bands as any)[i]) || 0,
        }));
      } else {
        newBands = DEFAULT_BANDS.map((b, i) => {
          const matched = preset.bands.find(pb => pb.freq === b.freq) || preset.bands[i];
          return {
            ...b,
            gain: Number(matched?.gain) || 0,
          };
        });
      }
    } else if ((preset as any).gains && Array.isArray((preset as any).gains)) {
      newBands = DEFAULT_BANDS.map((b, i) => ({
        ...b,
        gain: Number((preset as any).gains[i]) || 0,
      }));
    } else {
      newBands = DEFAULT_BANDS.map(b => ({ ...b, gain: 0 }));
    }

    const newPreamp = preset.preamp !== undefined ? Number(preset.preamp) || 0 : 0;

    setBands(newBands);
    setPreamp(newPreamp);
    setActivePresetId(preset.id);
    setIsEnabled(true);
    setSliderVersion(prev => prev + 1);

    saveAndSyncHardware(true, newBands, newPreamp, preset.id);

    setTimeout(() => {
      isProgrammaticChangeRef.current = false;
    }, 500);
  };

  const handleDeleteCustomPreset = (preset: CustomPreset) => {
    Alert.alert(
      t('delete', language),
      t('equalizer_delete_confirm', language).replace('{name}', preset.name),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('delete', language),
          style: 'destructive',
          onPress: async () => {
            const updated = customPresets.filter(p => p.id !== preset.id);
            setCustomPresets(updated);
            await AsyncStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updated));
            if (activePresetId === preset.id) {
              setActivePresetId(null);
            }
          }
        }
      ]
    );
  };

  const formatDbText = (val: number) => {
    const str = Number.isInteger(val) ? String(val) : val.toFixed(1);
    return val > 0 ? `+${str}dB` : `${str}dB`;
  };

  const activeBuiltInPreset = BUILTIN_PRESETS.find(preset => preset.id === activePresetId);
  const getBuiltInPresetLabel = (preset: BuiltInPreset) => {
    const translatedLabel = t('eq_preset_' + preset.id, language);
    return translatedLabel !== ('eq_preset_' + preset.id) ? translatedLabel : preset.name;
  };

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('equalizer_title', language))}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 15 }]}>
        {/* 1. 有効/無効 スイッチ */}
        <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 15, overflow: 'hidden' }]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={s.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="options-outline" size={22} color={themeColor} />
              <View>
                <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                  {t('equalizer_enable', language)}
                </Text>
              </View>
            </View>
            <Switch 
              value={isEnabled} 
              onValueChange={handleToggleEnable} 
              trackColor={{ false: "#767577", true: themeColor }}
            />
          </View>
        </View>

        {isEnabled && (
          <>
        {/* 2. イコライザアセット一覧 */}
        <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 20, overflow: 'hidden' }]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="layers-outline" size={22} color={themeColor} />
            <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }}>
              {t('equalizer_assets_title', language)}
            </Text>
          </View>

          {/* (A) カスタムアセット */}
          <View style={{ marginBottom: 18 }}>
            <View style={[s.rowBetween, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="bookmark-outline" size={16} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }}>
                  {t('equalizer_custom_assets_subtitle', language)}
                </Text>
              </View>

              <TouchableOpacity 
                style={[s.saveSmallBtn, { backgroundColor: useLiquidGlass ? 'transparent' : themeColor, overflow: 'hidden' }]}
                onPress={() => setSaveModalVisible(true)}
                activeOpacity={0.8}
              >
                {useLiquidGlass && (
                  <GlassView
                    pointerEvents="none"
                    glassEffectStyle="regular"
                    colorScheme={isDark ? 'dark' : 'light'}
                    tintColor={themeColor}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Ionicons name="add" size={15} color={textColor} style={{ marginRight: 3 }} />
                <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                  {t('equalizer_save_btn', language)}
                </Text>
              </TouchableOpacity>
            </View>

            {customPresets.length === 0 ? (
              <View style={[s.emptyCustomBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: dynamicStyles.border }]}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center' }}>
                  {t('equalizer_no_custom_assets', language)}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {customPresets.map((preset) => {
                  const isCustomActive = isEnabled && activePresetId === preset.id;
                  return (
                    <TouchableOpacity 
                      key={preset.id} 
                      style={[
                        s.presetItem, 
                        { 
                          backgroundColor: useLiquidGlass ? 'transparent' : (isCustomActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : (isDark ? '#2c2c2e' : '#f2f2f7')),
                          borderColor: isCustomActive ? themeColor : dynamicStyles.border 
                          },
                          { overflow: 'hidden' }
                      ]}
                      onPress={() => handleApplyCustomPreset(preset)}
                      activeOpacity={0.7}
                    >
                      {useLiquidGlass && (
                        <GlassView
                          pointerEvents="none"
                          glassEffectStyle="regular"
                          isInteractive
                          colorScheme={isDark ? 'dark' : 'light'}
                          tintColor={isCustomActive ? themeColor : undefined}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                        <Text style={{ color: isCustomActive ? themeColor : dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }} numberOfLines={1}>
                          {preset.name}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDeleteCustomPreset(preset);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 16 }} />

          {/* (B) プリセット一覧 */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="musical-notes-outline" size={16} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }}>
                {t('equalizer_builtin_presets_subtitle', language)}
              </Text>
            </View>

            {Platform.OS === 'ios' ? (
              <SwiftUIHost matchContents>
                <SwiftUIMenu
                  label={
                    <RNHostView matchContents>
                      <TouchableOpacity
                        style={[s.presetDropdown, { backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#f2f2f7'), borderColor: dynamicStyles.border, overflow: 'hidden' }]}
                        activeOpacity={0.7}
                      >
                        {useLiquidGlass && (
                          <GlassView pointerEvents="none" glassEffectStyle="regular" isInteractive colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                        )}
                        <Text style={{ color: activeBuiltInPreset ? dynamicStyles.text : dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
                          {activeBuiltInPreset ? getBuiltInPresetLabel(activeBuiltInPreset) : t('equalizer_builtin_presets_subtitle', language)}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color={dynamicStyles.subText} />
                      </TouchableOpacity>
                    </RNHostView>
                  }
                >
                  {BUILTIN_PRESETS.map(preset => (
                    <SwiftUIButton
                      key={preset.id}
                      label={getBuiltInPresetLabel(preset)}
                      systemImage={activePresetId === preset.id ? 'checkmark' : undefined}
                      onPress={() => handleSelectBuiltInPreset(preset)}
                    />
                  ))}
                </SwiftUIMenu>
              </SwiftUIHost>
            ) : (
              <>
                <TouchableOpacity
                  style={[s.presetDropdown, { backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#f2f2f7'), borderColor: dynamicStyles.border, overflow: 'hidden' }]}
                  onPress={() => setIsPresetDropdownOpen(open => !open)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isPresetDropdownOpen }}
                >
                  {useLiquidGlass && (
                    <GlassView pointerEvents="none" glassEffectStyle="regular" isInteractive colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                  )}
                  <Text style={{ color: activeBuiltInPreset ? dynamicStyles.text : dynamicStyles.subText, fontSize: 14, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
                    {activeBuiltInPreset ? getBuiltInPresetLabel(activeBuiltInPreset) : t('equalizer_builtin_presets_subtitle', language)}
                  </Text>
                  <Ionicons name={isPresetDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color={dynamicStyles.subText} />
                </TouchableOpacity>
                {isPresetDropdownOpen && (
                  <ScrollView
                    style={[s.presetDropdownMenu, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border }]}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {useLiquidGlass && (
                      <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    )}
                    {BUILTIN_PRESETS.map(preset => {
                      const isSelected = activePresetId === preset.id;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[s.presetDropdownItem, { backgroundColor: useLiquidGlass ? 'transparent' : (isSelected ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent'), overflow: 'hidden' }]}
                          onPress={() => {
                            handleSelectBuiltInPreset(preset);
                            setIsPresetDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          {useLiquidGlass && (
                            <GlassView
                              pointerEvents="none"
                              glassEffectStyle="regular"
                              isInteractive
                              colorScheme={isDark ? 'dark' : 'light'}
                              tintColor={isSelected ? themeColor : undefined}
                              style={StyleSheet.absoluteFill}
                            />
                          )}
                          <Text style={{ color: isSelected ? themeColor : dynamicStyles.text, fontSize: 14, fontWeight: isSelected ? 'bold' : 'normal', flex: 1 }} numberOfLines={1}>
                            {getBuiltInPresetLabel(preset)}
                          </Text>
                          {isSelected && <Ionicons name="checkmark" size={18} color={themeColor} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>

        {/* 3. イコライザ調節 */}
        <View style={[s.card, { backgroundColor: useLiquidGlass ? 'transparent' : dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 20, overflow: 'hidden' }]}>
          {useLiquidGlass && (
            <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          )}
          <View style={[s.rowBetween, { marginBottom: 15 }]}>
            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
              {t('equalizer_title', language)}
            </Text>
            <TouchableOpacity 
              style={[
                s.flatBtn, 
                { backgroundColor: useLiquidGlass ? 'transparent' : themeColor, overflow: 'hidden' }
              ]}
              onPress={handleResetFlat}
              disabled={!isEnabled}
            >
              {useLiquidGlass && (
                <GlassView
                  pointerEvents="none"
                  glassEffectStyle="regular"
                  colorScheme={isDark ? 'dark' : 'light'}
                  isInteractive
                  tintColor={themeColor}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                {t('equalizer_flat_btn', language)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* プリアンプ */}
          <View style={[s.bandRow, { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border, marginBottom: 12 }]}>
            <View style={s.bandLabelContainer}>
              <Text style={[s.bandLabel, { color: themeColor }]}>{t('equalizer_preamp', language)}</Text>
            </View>
            <Slider
              key={`preamp-${sliderVersion}`}
              style={{ flex: 1 }}
              minimumValue={-12}
              maximumValue={12}
              step={0.5}
              value={preamp}
              onValueChange={handlePreampChange}
              disabled={!isEnabled}
              minimumTrackTintColor={themeColor}
              maximumTrackTintColor={isDark ? '#3a3a3c' : '#e5e5ea'}
              thumbTintColor={themeColor}
            />
            <Text style={[s.gainLabel, { color: preamp !== 0 ? themeColor : dynamicStyles.subText }]}>
              {formatDbText(preamp)}
            </Text>
          </View>

          {/* 10バンド周波数スライダー */}
          <View style={{ gap: 10 }}>
            {bands.map((band, idx) => {
              const bandNameKey = BAND_NAME_KEYS[band.freq];
              const bandName = bandNameKey ? t(bandNameKey, language) : '';
              return (
                <View key={band.freq} style={s.bandRow}>
                  <View style={s.bandLabelContainer}>
                    <Text style={[s.bandLabel, { color: dynamicStyles.text }]}>{band.freq}</Text>
                    {bandName ? (
                      <Text style={[s.bandSubLabel, { color: dynamicStyles.subText }]} numberOfLines={1}>
                        {bandName}
                      </Text>
                    ) : null}
                  </View>
                  <Slider
                    key={`${band.freq}-${sliderVersion}`}
                    style={{ flex: 1 }}
                    minimumValue={-12}
                    maximumValue={12}
                    step={0.5}
                    value={band.gain}
                    onValueChange={(val) => handleGainChange(idx, val)}
                    disabled={!isEnabled}
                    minimumTrackTintColor={themeColor}
                    maximumTrackTintColor={isDark ? '#3a3a3c' : '#e5e5ea'}
                    thumbTintColor={themeColor}
                  />
                  <Text style={[s.gainLabel, { color: band.gain !== 0 ? themeColor : dynamicStyles.subText }]}>
                    {formatDbText(band.gain)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 設定保存ボタン */}
          <TouchableOpacity 
            style={[s.saveFullBtn, { backgroundColor: useLiquidGlass ? 'transparent' : themeColor, marginTop: 18, overflow: 'hidden' }]}
            onPress={() => setSaveModalVisible(true)}
            activeOpacity={0.8}
          >
            {useLiquidGlass && (
              <GlassView
                pointerEvents="none"
                glassEffectStyle="regular"
                colorScheme={isDark ? 'dark' : 'light'}
                tintColor={themeColor}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Ionicons name="bookmark-outline" size={17} color={textColor} style={{ marginRight: 6 }} />
            <Text style={{ color: textColor, fontSize: 14, fontWeight: 'bold' }}>
              {t('equalizer_save_btn', language)}
            </Text>
          </TouchableOpacity>
        </View>
          </>
        )}
      </ScrollView>

      {/* カスタム設定 保存モーダル */}
      <Modal visible={saveModalVisible} transparent animationType="none">
        <KeyboardAvoidingView 
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
            <Text style={[s.modalTitle, { color: dynamicStyles.text }]}>
              {t('equalizer_save_modal_title', language)}
            </Text>
            <Text style={[s.modalDesc, { color: dynamicStyles.subText }]}>
              {t('equalizer_save_modal_desc', language)}
            </Text>

            <GlassTextInput
              isDark={isDark}
              backgroundColor={isDark ? '#2c2c2e' : '#f2f2f7'}
              containerStyle={[s.input, { paddingHorizontal: 0, borderColor: dynamicStyles.border }]}
              inputStyle={{ color: dynamicStyles.text, fontSize: 15, paddingHorizontal: 14 }}
              placeholder={t('equalizer_save_modal_placeholder', language)}
              placeholderTextColor={dynamicStyles.subText}
              value={presetNameInput}
              onChangeText={setPresetNameInput}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassActionButton
                isDark={isDark}
                style={[s.modalBtn, { backgroundColor: useLiquidGlass ? 'transparent' : (isDark ? '#2c2c2e' : '#e5e7eb') }]}
                onPress={() => { setPresetNameInput(''); setSaveModalVisible(false); }}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
              </GlassActionButton>
              <GlassActionButton
                isDark={isDark}
                glassTintColor={themeColor}
                style={[s.modalBtn, { backgroundColor: useLiquidGlass ? 'transparent' : themeColor }]}
                onPress={handleSaveCustomPreset}
              >
                <Text style={{ color: textColor, fontWeight: 'bold' }}>{t('save', language)}</Text>
              </GlassActionButton>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetDropdown: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  presetDropdownMenu: { maxHeight: 260, marginTop: 6, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  presetDropdownItem: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  emptyCustomBox: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  flatBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandLabelContainer: { width: 75, justifyContent: 'center' },
  bandLabel: { fontSize: 13, fontWeight: 'bold' },
  bandSubLabel: { fontSize: 10, marginTop: 1 },
  gainLabel: { width: 56, fontSize: 12, fontWeight: 'bold', textAlign: 'right', fontVariant: ['tabular-nums'] },
  saveSmallBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  saveFullBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 44, borderRadius: 22 },
  presetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 22, borderWidth: 1.5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  modalDesc: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  input: { height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, marginBottom: 18 },
  modalBtn: { flex: 1, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
});
