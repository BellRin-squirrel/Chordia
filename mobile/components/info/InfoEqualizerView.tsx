import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Switch, TextInput, 
  Modal, Alert, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../../utils/i18n';

const STORAGE_EQ_KEY = 'chordia_equalizer_settings';
const STORAGE_CUSTOM_PRESETS_KEY = 'chordia_custom_equalizer_presets';

export interface EqualizerBand {
  freq: string;
  gain: number; // -12 ~ +12 dB
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

// ★ プリセット一覧（Flatを含めた計10個）
export const BUILTIN_PRESETS: BuiltInPreset[] = [
  {
    id: "flat",
    name: "Flat",
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0
  },
  {
    id: "rock",
    name: "Rock",
    gains: [4.5, 3.0, 1.5, 0, -1.5, -1.0, 1.0, 2.5, 4.0, 4.5],
    preamp: -1.5
  },
  {
    id: "pop",
    name: "Pop",
    gains: [-1.0, 1.0, 2.5, 3.5, 3.0, 1.0, -1.0, -1.5, 1.5, 2.5],
    preamp: -1.0
  },
  {
    id: "bass_boost",
    name: "Bass Boost",
    gains: [6.0, 5.0, 4.0, 2.5, 1.0, 0, 0, 0, 0, 0],
    preamp: -3.0
  },
  {
    id: "vocal",
    name: "Vocal / Podcast",
    gains: [-3.0, -2.0, -1.0, 1.5, 3.5, 4.0, 3.0, 1.5, 0, -1.5],
    preamp: -1.0
  },
  {
    id: "acoustic_jazz",
    name: "Acoustic & Jazz",
    gains: [3.0, 2.5, 1.5, 1.0, 1.5, 1.5, 2.0, 2.5, 3.0, 3.0],
    preamp: -1.0
  },
  {
    id: "electronic",
    name: "Electronic",
    gains: [5.0, 4.0, 2.0, 0, -2.0, 1.5, 2.0, 3.0, 4.5, 5.0],
    preamp: -2.5
  },
  {
    id: "treble_boost",
    name: "Treble Boost",
    gains: [0, 0, 0, 0, 0, 1.0, 2.5, 4.0, 5.5, 6.0],
    preamp: -2.0
  },
  {
    id: "night_mode",
    name: "Night Mode",
    gains: [-4.0, -3.0, -2.0, 0, 1.0, 1.0, 1.0, 0, -2.0, -3.5],
    preamp: 0
  },
  {
    id: "classical",
    name: "Classical",
    gains: [4.0, 3.0, 2.0, 1.5, -1.0, -1.0, 0, 1.5, 2.5, 3.5],
    preamp: -1.0
  }
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
  const { width } = useWindowDimensions();
  const [isEnabled, setIsEnabled] = useState(false);
  const [bands, setBands] = useState<EqualizerBand[]>(DEFAULT_BANDS);
  const [preamp, setPreamp] = useState<number>(0);
  const [activePresetId, setActivePresetId] = useState<string | null>('flat');
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);

  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const savedSettings = await AsyncStorage.getItem(STORAGE_EQ_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed.isEnabled !== undefined) setIsEnabled(parsed.isEnabled);
          if (Array.isArray(parsed.bands)) setBands(parsed.bands);
          if (parsed.preamp !== undefined) setPreamp(parsed.preamp);
          if (parsed.activePresetId !== undefined) setActivePresetId(parsed.activePresetId);
        }

        const savedPresets = await AsyncStorage.getItem(STORAGE_CUSTOM_PRESETS_KEY);
        if (savedPresets) {
          setCustomPresets(JSON.parse(savedPresets));
        }
      } catch (e) {}
    })();
  }, []);

  const saveSettings = async (newEnabled: boolean, newBands: EqualizerBand[], newPreamp: number, newActivePresetId: string | null) => {
    try {
      await AsyncStorage.setItem(STORAGE_EQ_KEY, JSON.stringify({ 
        isEnabled: newEnabled, 
        bands: newBands, 
        preamp: newPreamp,
        activePresetId: newActivePresetId 
      }));
    } catch (e) {}
  };

  const handleToggleEnable = (val: boolean) => {
    setIsEnabled(val);
    saveSettings(val, bands, preamp, activePresetId);
  };

  const handleGainChange = (index: number, val: number) => {
    const updated = [...bands];
    const rounded = Math.round(val * 2) / 2;
    updated[index] = { ...updated[index], gain: rounded };
    setBands(updated);
    setActivePresetId(null);
    saveSettings(isEnabled, updated, preamp, null);
  };

  const handlePreampChange = (val: number) => {
    const rounded = Math.round(val * 2) / 2;
    setPreamp(rounded);
    setActivePresetId(null);
    saveSettings(isEnabled, bands, rounded, null);
  };

  // ビルトインプリセットを選択・適用
  const handleSelectBuiltInPreset = (preset: BuiltInPreset) => {
    const newBands = DEFAULT_BANDS.map((b, i) => ({
      ...b,
      gain: preset.gains[i] !== undefined ? preset.gains[i] : 0,
    }));
    const newPreamp = preset.preamp !== undefined ? preset.preamp : 0;

    setBands(newBands);
    setPreamp(newPreamp);
    setActivePresetId(preset.id);
    setIsEnabled(true);
    saveSettings(true, newBands, newPreamp, preset.id);
  };

  // フラット (リセット)
  const handleResetFlat = () => {
    const flat = DEFAULT_BANDS.map(b => ({ ...b, gain: 0 }));
    setBands(flat);
    setPreamp(0);
    setActivePresetId('flat');
    saveSettings(isEnabled, flat, 0, 'flat');
  };

  // カスタム設定保存
  const handleSaveCustomPreset = async () => {
    if (!presetNameInput.trim()) return;
    const name = presetNameInput.trim();
    const newPreset: CustomPreset = {
      id: 'custom_' + Date.now(),
      name,
      bands: JSON.parse(JSON.stringify(bands)),
      preamp,
    };

    const updatedList = [newPreset, ...customPresets];
    setCustomPresets(updatedList);
    setActivePresetId(newPreset.id);
    await AsyncStorage.setItem(STORAGE_CUSTOM_PRESETS_KEY, JSON.stringify(updatedList));

    setPresetNameInput('');
    setSaveModalVisible(false);

    Alert.alert(t('confirm', language), t('equalizer_saved_alert', language).replace('{name}', name));
  };

  // カスタム設定適用
  const handleApplyCustomPreset = (preset: CustomPreset) => {
    const newBands = JSON.parse(JSON.stringify(preset.bands));
    const newPreamp = preset.preamp !== undefined ? preset.preamp : 0;
    setBands(newBands);
    setPreamp(newPreamp);
    setActivePresetId(preset.id);
    setIsEnabled(true);
    saveSettings(true, newBands, newPreamp, preset.id);
  };

  // カスタム設定削除
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

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('equalizer_title', language))}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 15 }]}>
        {/* 1. 有効/無効 スイッチ */}
        <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 15 }]}>
          <View style={s.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="options-outline" size={22} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('equalizer_enable', language)}
              </Text>
            </View>
            <Switch 
              value={isEnabled} 
              onValueChange={handleToggleEnable} 
              trackColor={{ false: "#767577", true: themeColor }}
            />
          </View>
        </View>

        {/* 2. ★ イコライザアセット一覧（カスタムアセット ＋ プリセット一覧 10個） */}
        <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="layers-outline" size={22} color={themeColor} />
            <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }}>
              {t('equalizer_assets_title', language)}
            </Text>
          </View>

          {/* (A) カスタムアセット サブセクション */}
          <View style={{ marginBottom: 18 }}>
            <View style={[s.rowBetween, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="bookmark-outline" size={16} color={themeColor} />
                <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }}>
                  {t('equalizer_custom_assets_subtitle', language)}
                </Text>
              </View>

              <TouchableOpacity 
                style={[s.saveSmallBtn, { backgroundColor: themeColor }]}
                onPress={() => setSaveModalVisible(true)}
                activeOpacity={0.8}
              >
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
                    <View 
                      key={preset.id} 
                      style={[
                        s.presetItem, 
                        { 
                          backgroundColor: isCustomActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : (isDark ? '#2c2c2e' : '#f2f2f7'), 
                          borderColor: isCustomActive ? themeColor : dynamicStyles.border 
                        }
                      ]}
                    >
                      <TouchableOpacity 
                        style={{ flex: 1, paddingVertical: 4 }}
                        onPress={() => handleApplyCustomPreset(preset)}
                      >
                        <Text style={{ color: isCustomActive ? themeColor : dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }}>
                          {preset.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteCustomPreset(preset)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* セパレータ */}
          <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 16 }} />

          {/* (B) プリセット一覧 サブセクション（10個のグリッド表示） */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="musical-notes-outline" size={16} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 14, fontWeight: 'bold' }}>
                {t('equalizer_builtin_presets_subtitle', language)}
              </Text>
            </View>

            <View style={s.presetGrid}>
              {BUILTIN_PRESETS.map((preset) => {
                const isSelected = isEnabled && activePresetId === preset.id;
                const presetLabel = t('eq_preset_' + preset.id, language) !== ('eq_preset_' + preset.id)
                  ? t('eq_preset_' + preset.id, language)
                  : preset.name;

                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      s.presetTile,
                      {
                        backgroundColor: isSelected ? themeColor : (isDark ? '#2c2c2e' : '#f2f2f7'),
                        borderColor: isSelected ? themeColor : dynamicStyles.border,
                      }
                    ]}
                    onPress={() => handleSelectBuiltInPreset(preset)}
                    activeOpacity={0.7}
                  >
                    <Text 
                      style={[
                        s.presetTileText, 
                        { color: isSelected ? textColor : dynamicStyles.text }
                      ]} 
                      numberOfLines={1}
                    >
                      {presetLabel}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color={textColor} style={{ position: 'absolute', right: 8, top: 11 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 3. イコライザ調節 (Preamp + 10バンド周波数スライダー) */}
        <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, opacity: isEnabled ? 1 : 0.5, marginBottom: 20 }]}>
          <View style={[s.rowBetween, { marginBottom: 15 }]}>
            <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
              {t('equalizer_title', language)}
            </Text>
            <TouchableOpacity 
              style={[
                s.flatBtn, 
                { backgroundColor: activePresetId === 'flat' ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb') }
              ]}
              onPress={handleResetFlat}
              disabled={!isEnabled}
            >
              <Text style={{ color: activePresetId === 'flat' ? textColor : dynamicStyles.text, fontSize: 12, fontWeight: 'bold' }}>
                {t('equalizer_flat_btn', language)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* プリアンプ (Preamp) */}
          <View style={[s.bandRow, { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border, marginBottom: 12 }]}>
            <Text style={[s.bandLabel, { color: themeColor }]}>{t('equalizer_preamp', language)}</Text>
            <Slider
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
            {bands.map((band, idx) => (
              <View key={band.freq} style={s.bandRow}>
                <Text style={[s.bandLabel, { color: dynamicStyles.text }]}>{band.freq}</Text>
                <Slider
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
            ))}
          </View>

          {/* 設定保存ボタン */}
          <TouchableOpacity 
            style={[s.saveFullBtn, { backgroundColor: themeColor, marginTop: 18 }]}
            onPress={() => setSaveModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark-outline" size={17} color={textColor} style={{ marginRight: 6 }} />
            <Text style={{ color: textColor, fontSize: 14, fontWeight: 'bold' }}>
              {t('equalizer_save_btn', language)}
            </Text>
          </TouchableOpacity>
        </View>
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

            <TextInput 
              style={[s.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, borderColor: dynamicStyles.border }]}
              placeholder={t('equalizer_save_modal_placeholder', language)}
              placeholderTextColor={dynamicStyles.subText}
              value={presetNameInput}
              onChangeText={setPresetNameInput}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity 
                style={[s.modalBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={() => { setPresetNameInput(''); setSaveModalVisible(false); }}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[s.modalBtn, { backgroundColor: themeColor }]}
                onPress={handleSaveCustomPreset}
              >
                <Text style={{ color: textColor, fontWeight: 'bold' }}>{t('save', language)}</Text>
              </TouchableOpacity>
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
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  presetTile: { width: '48%', height: 42, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, position: 'relative' },
  presetTileText: { fontSize: 13, fontWeight: 'bold' },
  emptyCustomBox: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  flatBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bandLabel: { width: 65, fontSize: 13, fontWeight: 'bold' },
  gainLabel: { width: 56, fontSize: 12, fontWeight: 'bold', textAlign: 'right', fontVariant: ['tabular-nums'] },
  saveSmallBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  saveFullBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 44, borderRadius: 22 },
  presetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 22, borderWidth: 1.5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  modalDesc: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  input: { height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, marginBottom: 18 },
  modalBtn: { flex: 1, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
});