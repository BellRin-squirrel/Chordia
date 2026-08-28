import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, 
  TouchableWithoutFeedback, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../utils/i18n';

const createDefaultFilter = (tag: string = 'artist'): any => {
  const isNum = ['year', 'track', 'disc', 'bpm'].includes(tag);
  return {
    type: 'filter',
    tag,
    op: isNum ? 'equals' : 'contains',
    val: isNum ? '' : '',
  };
};

const createDefaultGroup = (): any => ({
  type: 'group',
  match: 'all',
  items: [createDefaultFilter('artist')],
});

export const SmartPlaylistEditorModal = ({
  visible, mode = 'CREATE', initialPlaylist = null,
  onClose, onSave, dynamicStyles, themeColor, isDark, insets, language = 'ja'
}: any) => {
  const { width } = useWindowDimensions();
  const isLandscape = width > 500;

  const [playlistName, setPlaylistName] = useState('');
  const [rootGroup, setRootGroup] = useState<any>(createDefaultGroup());

  const tagOptions = useMemo(() => [
    { key: 'title', label: t('smart_title_rule', language), type: 'string' },
    { key: 'artist', label: t('smart_artist_rule', language), type: 'string' },
    { key: 'album', label: t('smart_album_rule', language), type: 'string' },
    { key: 'genre', label: t('smart_genre_rule', language), type: 'string' },
    { key: 'album_artist', label: t('smart_album_artist_rule', language), type: 'string' },
    { key: 'composer', label: t('smart_composer_rule', language), type: 'string' },
    { key: 'year', label: t('smart_year_rule', language), type: 'number' },
    { key: 'track', label: t('smart_track_rule', language), type: 'number' },
    { key: 'disc', label: t('smart_disc_rule', language), type: 'number' },
    { key: 'bpm', label: t('smart_bpm_rule', language), type: 'number' },
    { key: 'lyric', label: t('smart_lyric_rule', language), type: 'string' },
    { key: 'comment', label: t('smart_comment_rule', language), type: 'string' },
  ], [language]);

  const stringOperators = useMemo(() => [
    { key: 'contains', label: t('op_contains', language) },
    { key: 'not_contains', label: t('op_not_contains', language) },
    { key: 'equals', label: t('op_equals', language) },
    { key: 'not_equals', label: t('op_not_equals', language) },
    { key: 'startswith', label: t('op_startswith', language) },
    { key: 'endswith', label: t('op_endswith', language) },
  ], [language]);

  const numberOperators = useMemo(() => [
    { key: 'equals', label: t('op_equals', language) },
    { key: 'not_equals', label: t('op_not_equals', language) },
    { key: 'greater', label: t('op_greater', language) },
    { key: 'less', label: t('op_less', language) },
    { key: 'range', label: t('op_range', language) },
  ], [language]);

  const [pickerConfig, setPickerConfig] = useState<{
    visible: boolean;
    title: string;
    options: { key: string; label: string }[];
    onSelect: (key: string) => void;
  }>({ visible: false, title: '', options: [], onSelect: () => {} });

  useEffect(() => {
    if (visible) {
      if (mode === 'EDIT' && initialPlaylist) {
        setPlaylistName(initialPlaylist.playlistName || '');
        if (initialPlaylist.conditions) {
          setRootGroup(JSON.parse(JSON.stringify(initialPlaylist.conditions)));
        } else {
          setRootGroup(createDefaultGroup());
        }
      } else {
        setPlaylistName('');
        setRootGroup(createDefaultGroup());
      }
    }
  }, [visible, mode, initialPlaylist]);

  const openPicker = (title: string, options: { key: string; label: string }[], onSelect: (key: string) => void) => {
    setPickerConfig({ visible: true, title, options, onSelect });
  };

  const handleSave = () => {
    if (mode === 'CREATE' && !playlistName.trim()) {
      alert(t('new_playlist_modal_desc', language));
      return;
    }
    onSave(playlistName.trim(), rootGroup);
  };

  const updateItemInGroup = (group: any, path: number[], updater: (item: any) => any): any => {
    if (path.length === 0) return group;
    const [index, ...rest] = path;
    const newItems = [...group.items];
    if (rest.length === 0) {
      const updated = updater(newItems[index]);
      if (updated === null) {
        newItems.splice(index, 1);
      } else {
        newItems[index] = updated;
      }
    } else {
      newItems[index] = updateItemInGroup(newItems[index], rest, updater);
    }
    return { ...group, items: newItems };
  };

  const handleAddFilter = (path: number[]) => {
    const parentPath = path.slice(0, -1);
    const targetIdx = path[path.length - 1];

    if (path.length === 0) {
      setRootGroup((prev: any) => ({ ...prev, items: [...prev.items, createDefaultFilter()] }));
      return;
    }

    setRootGroup((prev: any) => {
      if (parentPath.length === 0) {
        const items = [...prev.items];
        items.splice(targetIdx + 1, 0, createDefaultFilter());
        return { ...prev, items };
      }
      return updateItemInGroup(prev, parentPath, (group) => {
        const items = [...group.items];
        items.splice(targetIdx + 1, 0, createDefaultFilter());
        return { ...group, items };
      });
    });
  };

  const handleAddSubGroup = (path: number[]) => {
    const parentPath = path.slice(0, -1);
    const targetIdx = path[path.length - 1];

    setRootGroup((prev: any) => {
      if (parentPath.length === 0) {
        const items = [...prev.items];
        items.splice(targetIdx + 1, 0, createDefaultGroup());
        return { ...prev, items };
      }
      return updateItemInGroup(prev, parentPath, (group) => {
        const items = [...group.items];
        items.splice(targetIdx + 1, 0, createDefaultGroup());
        return { ...group, items };
      });
    });
  };

  const handleRemoveItem = (path: number[]) => {
    const parentPath = path.slice(0, -1);
    const targetIdx = path[path.length - 1];

    setRootGroup((prev: any) => {
      if (parentPath.length === 0) {
        if (prev.items.length <= 1) return prev;
        const items = [...prev.items];
        items.splice(targetIdx, 1);
        return { ...prev, items };
      }
      return updateItemInGroup(prev, parentPath, (group) => {
        const items = [...group.items];
        items.splice(targetIdx, 1);
        return { ...group, items };
      });
    });
  };

  const handleFilterChange = (path: number[], key: string, value: any) => {
    setRootGroup((prev: any) => updateItemInGroup(prev, path, (filter) => {
      const updated = { ...filter, [key]: value };
      if (key === 'tag') {
        const isNum = ['year', 'track', 'disc', 'bpm'].includes(value);
        updated.op = isNum ? 'equals' : 'contains';
        updated.val = isNum ? '' : '';
      }
      if (key === 'op' && value === 'range' && !Array.isArray(updated.val)) {
        updated.val = ['', ''];
      } else if (key === 'op' && value !== 'range' && Array.isArray(updated.val)) {
        updated.val = updated.val[0] || '';
      }
      return updated;
    }));
  };

  const handleGroupMatchChange = (path: number[], match: 'all' | 'any') => {
    if (path.length === 0) {
      setRootGroup((prev: any) => ({ ...prev, match }));
      return;
    }
    setRootGroup((prev: any) => updateItemInGroup(prev, path, (group) => ({ ...group, match })));
  };

  const renderFilterRow = (filter: any, path: number[], canDelete: boolean) => {
    const tagObj = tagOptions.find(tObj => tObj.key === filter.tag) || tagOptions[0];
    const isNum = tagObj.type === 'number';
    const ops = isNum ? numberOperators : stringOperators;
    const currentOp = ops.find(o => o.key === filter.op) || ops[0];
    const isRange = filter.op === 'range';

    return (
      <View key={path.join('-')} style={[s.filterRow, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.card }]}>
        <TouchableOpacity 
          style={[s.selectBtn, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
          onPress={() => openPicker(t('smart_select_field', language), tagOptions, (k) => handleFilterChange(path, 'tag', k))}
        >
          <Text style={[s.selectBtnText, { color: dynamicStyles.text }]} numberOfLines={1}>{tagObj.label}</Text>
          <Ionicons name="chevron-down" size={12} color={dynamicStyles.subText} />
        </TouchableOpacity>

        {t('smart_particle_ga', language).trim() !== '' && (
          <Text style={[s.particleText, { color: dynamicStyles.subText }]}>{t('smart_particle_ga', language)}</Text>
        )}

        {isRange ? (
          <View style={s.rangeInputGroup}>
            <TextInput 
              style={[s.textInputSmall, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
              value={Array.isArray(filter.val) ? String(filter.val[0] ?? '') : ''}
              onChangeText={(textVal) => {
                const current = Array.isArray(filter.val) ? [...filter.val] : ['', ''];
                current[0] = textVal;
                handleFilterChange(path, 'val', current);
              }}
              placeholder={t('smart_placeholder_min', language)}
              placeholderTextColor={dynamicStyles.subText}
              keyboardType={isNum ? 'number-pad' : 'default'}
            />
            <Text style={{ color: dynamicStyles.subText, fontSize: 11 }}>{t('smart_particle_to', language)}</Text>
            <TextInput 
              style={[s.textInputSmall, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
              value={Array.isArray(filter.val) ? String(filter.val[1] ?? '') : ''}
              onChangeText={(textVal) => {
                const current = Array.isArray(filter.val) ? [...filter.val] : ['', ''];
                current[1] = textVal;
                handleFilterChange(path, 'val', current);
              }}
              placeholder={t('smart_placeholder_max', language)}
              placeholderTextColor={dynamicStyles.subText}
              keyboardType={isNum ? 'number-pad' : 'default'}
            />
          </View>
        ) : (
          <TextInput 
            style={[s.textInput, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
            value={filter.val !== undefined && filter.val !== null ? String(filter.val) : ''}
            onChangeText={(textVal) => handleFilterChange(path, 'val', textVal)}
            placeholder={t('smart_placeholder_val', language)}
            placeholderTextColor={dynamicStyles.subText}
            keyboardType={isNum ? 'number-pad' : 'default'}
          />
        )}

        <TouchableOpacity 
          style={[s.selectBtn, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg, minWidth: 85 }]}
          onPress={() => openPicker(t('smart_select_condition', language), ops, (k) => handleFilterChange(path, 'op', k))}
        >
          <Text style={[s.selectBtnText, { color: dynamicStyles.text }]} numberOfLines={1}>{currentOp.label}</Text>
          <Ionicons name="chevron-down" size={12} color={dynamicStyles.subText} />
        </TouchableOpacity>

        <View style={s.actionBtnGroup}>
          <TouchableOpacity 
            style={[s.iconBtn, !canDelete && { opacity: 0.3 }]}
            onPress={() => canDelete && handleRemoveItem(path)}
            disabled={!canDelete}
          >
            <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
          </TouchableOpacity>

          <TouchableOpacity style={s.iconBtn} onPress={() => handleAddFilter(path)}>
            <Ionicons name="add-circle-outline" size={20} color={themeColor} />
          </TouchableOpacity>

          <TouchableOpacity style={s.iconBtn} onPress={() => handleAddSubGroup(path)}>
            <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={themeColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderGroup = (group: any, path: number[] = [], isRoot: boolean = true) => {
    const isAll = group.match === 'all';

    return (
      <View key={path.join('-') || 'root'} style={[s.groupBox, { borderColor: isRoot ? themeColor : dynamicStyles.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
        <View style={s.groupHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity 
              style={[s.matchToggleBtn, { backgroundColor: themeColor }]}
              onPress={() => handleGroupMatchChange(path, isAll ? 'any' : 'all')}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                {isAll ? t('smart_all_rules', language) : t('smart_any_rules', language)}
              </Text>
            </TouchableOpacity>
            <Text style={[s.groupLabel, { color: dynamicStyles.text }]}>{t('smart_match_suffix', language)}</Text>
          </View>

          {!isRoot && (
            <TouchableOpacity onPress={() => handleRemoveItem(path)}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ gap: 8, marginTop: 10 }}>
          {group.items.map((item: any, idx: number) => {
            const currentPath = [...path, idx];
            if (item.type === 'group') {
              return renderGroup(item, currentPath, false);
            }
            return renderFilterRow(item, currentPath, isRoot ? group.items.length > 1 : true);
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, paddingTop: Math.max(insets?.top || 0, 20), paddingBottom: Math.max(insets?.bottom || 0, 20) }}>
        <KeyboardAvoidingView 
          style={{ width: isLandscape ? Math.min(width * 0.95, 760) : '100%', maxHeight: '90%', flexShrink: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[s.modalCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flash" size={20} color={themeColor} />
                <Text style={[s.modalTitle, { color: dynamicStyles.text }]}>
                  {mode === 'CREATE' ? t('smart_create_title', language) : t('smart_edit_title', language)}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            {mode === 'CREATE' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
                  {t('smart_name_label', language)}
                </Text>
                <TextInput 
                  style={[s.nameInput, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7' }]}
                  value={playlistName}
                  onChangeText={setPlaylistName}
                  placeholder={t('smart_name_placeholder', language)}
                  placeholderTextColor={dynamicStyles.subText}
                  autoFocus={mode === 'CREATE'}
                />
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1, marginVertical: 4 }}>
              {renderGroup(rootGroup, [], true)}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity 
                style={[s.footerBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={onClose}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }}>{t('cancel', language)}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[s.footerBtn, { backgroundColor: themeColor }]}
                onPress={handleSave}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  {mode === 'CREATE' ? t('create_btn', language) : t('save', language)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={pickerConfig.visible} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => setPickerConfig(prev => ({ ...prev, visible: false }))}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 25 }}>
            <View style={[s.pickerCard, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
                {pickerConfig.title}
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {pickerConfig.options.map(opt => (
                  <TouchableOpacity 
                    key={opt.key}
                    style={[s.pickerItem, { borderBottomColor: dynamicStyles.border }]}
                    onPress={() => {
                      pickerConfig.onSelect(opt.key);
                      setPickerConfig(prev => ({ ...prev, visible: false }));
                    }}
                  >
                    <Text style={{ color: dynamicStyles.text, fontSize: 14 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Modal>
  );
};

const s = StyleSheet.create({
  modalCard: { borderRadius: 24, padding: 20, borderWidth: 1.5, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  nameInput: { height: 42, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, borderWidth: 1 },
  groupBox: { borderRadius: 16, padding: 12, borderWidth: 1.5, marginBottom: 8 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchToggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  groupLabel: { fontSize: 13, fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 12, borderWidth: 1 },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, minWidth: 80, justifyContent: 'space-between' },
  selectBtnText: { fontSize: 12, fontWeight: 'bold' },
  particleText: { fontSize: 12, fontWeight: 'bold' },
  textInput: { flex: 1, minWidth: 90, height: 34, borderRadius: 8, paddingHorizontal: 8, fontSize: 12, borderWidth: 1 },
  rangeInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 120 },
  textInputSmall: { flex: 1, height: 34, borderRadius: 8, paddingHorizontal: 6, fontSize: 12, borderWidth: 1, textAlign: 'center' },
  actionBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 2 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  footerBtn: { paddingHorizontal: 18, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  pickerCard: { width: '85%', maxWidth: 320, borderRadius: 20, padding: 16, borderWidth: 1.5 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 0.5 },
});
