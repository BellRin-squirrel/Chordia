import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, 
  TouchableWithoutFeedback, StyleSheet, useWindowDimensions, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TAG_OPTIONS = [
  { key: 'title', label: 'タイトル', type: 'string' },
  { key: 'artist', label: 'アーティスト', type: 'string' },
  { key: 'album', label: 'アルバム', type: 'string' },
  { key: 'genre', label: 'ジャンル', type: 'string' },
  { key: 'album_artist', label: 'アルバムアーティスト', type: 'string' },
  { key: 'composer', label: '作曲者', type: 'string' },
  { key: 'year', label: '年/日付', type: 'number' },
  { key: 'track', label: 'トラック番号', type: 'number' },
  { key: 'disc', label: 'ディスク番号', type: 'number' },
  { key: 'bpm', label: 'BPM', type: 'number' },
  { key: 'lyric', label: '歌詞', type: 'string' },
  { key: 'comment', label: 'コメント', type: 'string' },
];

const STRING_OPERATORS = [
  { key: 'contains', label: 'を含む' },
  { key: 'not_contains', label: 'を含まない' },
  { key: 'equals', label: 'である' },
  { key: 'not_equals', label: 'ではない' },
  { key: 'startswith', label: 'で始まる' },
  { key: 'endswith', label: 'で終わる' },
];

const NUMBER_OPERATORS = [
  { key: 'equals', label: 'である' },
  { key: 'not_equals', label: 'ではない' },
  { key: 'greater', label: 'より大きい' },
  { key: 'less', label: 'より小さい' },
  { key: 'range', label: 'の範囲内' },
];

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
  onClose, onSave, dynamicStyles, themeColor, isDark, insets
}: any) => {
  const { width } = useWindowDimensions();
  const isLandscape = width > 500;

  const [playlistName, setPlaylistName] = useState('');
  const [rootGroup, setRootGroup] = useState<any>(createDefaultGroup());

  // ドロップダウン選択用ポップアップ
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
      alert('プレイリスト名を入力してください。');
      return;
    }
    onSave(playlistName.trim(), rootGroup);
  };

  // --- 再帰的なグループ・フィルター操作 ---

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
      // タグが変わったら適切な演算子と初期値にリセット
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

  // --- レンダリング部 ---

  const renderFilterRow = (filter: any, path: number[], canDelete: boolean) => {
    const tagObj = TAG_OPTIONS.find(t => t.key === filter.tag) || TAG_OPTIONS[0];
    const isNum = tagObj.type === 'number';
    const ops = isNum ? NUMBER_OPERATORS : STRING_OPERATORS;
    const currentOp = ops.find(o => o.key === filter.op) || ops[0];
    const isRange = filter.op === 'range';

    return (
      <View key={path.join('-')} style={[s.filterRow, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.card }]}>
        {/* ① 対象タグ */}
        <TouchableOpacity 
          style={[s.selectBtn, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
          onPress={() => openPicker('項目を選択', TAG_OPTIONS, (k) => handleFilterChange(path, 'tag', k))}
        >
          <Text style={[s.selectBtnText, { color: dynamicStyles.text }]} numberOfLines={1}>{tagObj.label}</Text>
          <Ionicons name="chevron-down" size={12} color={dynamicStyles.subText} />
        </TouchableOpacity>

        <Text style={[s.particleText, { color: dynamicStyles.subText }]}>が</Text>

        {/* ② 入力枠（通常または範囲） */}
        {isRange ? (
          <View style={s.rangeInputGroup}>
            <TextInput 
              style={[s.textInputSmall, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
              value={Array.isArray(filter.val) ? String(filter.val[0] ?? '') : ''}
              onChangeText={(t) => {
                const current = Array.isArray(filter.val) ? [...filter.val] : ['', ''];
                current[0] = t;
                handleFilterChange(path, 'val', current);
              }}
              placeholder="最小"
              placeholderTextColor={dynamicStyles.subText}
              keyboardType={isNum ? 'number-pad' : 'default'}
            />
            <Text style={{ color: dynamicStyles.subText, fontSize: 11 }}>と</Text>
            <TextInput 
              style={[s.textInputSmall, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
              value={Array.isArray(filter.val) ? String(filter.val[1] ?? '') : ''}
              onChangeText={(t) => {
                const current = Array.isArray(filter.val) ? [...filter.val] : ['', ''];
                current[1] = t;
                handleFilterChange(path, 'val', current);
              }}
              placeholder="最大"
              placeholderTextColor={dynamicStyles.subText}
              keyboardType={isNum ? 'number-pad' : 'default'}
            />
          </View>
        ) : (
          <TextInput 
            style={[s.textInput, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg }]}
            value={filter.val !== undefined && filter.val !== null ? String(filter.val) : ''}
            onChangeText={(t) => handleFilterChange(path, 'val', t)}
            placeholder="値・文字を入力"
            placeholderTextColor={dynamicStyles.subText}
            keyboardType={isNum ? 'number-pad' : 'default'}
          />
        )}

        {/* ③ 条件（演算子） */}
        <TouchableOpacity 
          style={[s.selectBtn, { borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg, minWidth: 85 }]}
          onPress={() => openPicker('条件を選択', ops, (k) => handleFilterChange(path, 'op', k))}
        >
          <Text style={[s.selectBtnText, { color: dynamicStyles.text }]} numberOfLines={1}>{currentOp.label}</Text>
          <Ionicons name="chevron-down" size={12} color={dynamicStyles.subText} />
        </TouchableOpacity>

        {/* ④ 操作ボタン（− / ＋ / ●●●） */}
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
    const canDeleteSelf = !isRoot;

    return (
      <View key={path.join('-') || 'root'} style={[s.groupBox, { borderColor: isRoot ? themeColor : dynamicStyles.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
        {/* グループヘッダー: すべて / いずれか */}
        <View style={s.groupHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity 
              style={[s.matchToggleBtn, { backgroundColor: themeColor }]}
              onPress={() => handleGroupMatchChange(path, isAll ? 'any' : 'all')}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                {isAll ? 'すべての' : 'いずれかの'}
              </Text>
            </TouchableOpacity>
            <Text style={[s.groupLabel, { color: dynamicStyles.text }]}>ルールに一致</Text>
          </View>

          {!isRoot && (
            <TouchableOpacity onPress={() => handleRemoveItem(path)}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {/* グループ内のルール・小グループ一覧 */}
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
            {/* ヘッダー */}
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flash" size={20} color={themeColor} />
                <Text style={[s.modalTitle, { color: dynamicStyles.text }]}>
                  {mode === 'CREATE' ? 'スマートプレイリストを新規作成' : 'スマートプレイリストを編集'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            {/* 新規作成時のみプレイリスト名入力欄 */}
            {mode === 'CREATE' && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>
                  プレイリスト名
                </Text>
                <TextInput 
                  style={[s.nameInput, { color: dynamicStyles.text, borderColor: dynamicStyles.border, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7' }]}
                  value={playlistName}
                  onChangeText={setPlaylistName}
                  placeholder="例: 2024年のJ-POP"
                  placeholderTextColor={dynamicStyles.subText}
                  autoFocus={mode === 'CREATE'}
                />
              </View>
            )}

            {/* ルール組み立てスクロールエリア */}
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1, marginVertical: 4 }}>
              {renderGroup(rootGroup, [], true)}
            </ScrollView>

            {/* フッターアクション */}
            <View style={s.modalFooter}>
              <TouchableOpacity 
                style={[s.footerBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb' }]}
                onPress={onClose}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold', fontSize: 14 }}>キャンセル</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[s.footerBtn, { backgroundColor: themeColor }]}
                onPress={handleSave}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  {mode === 'CREATE' ? '作成' : '保存'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* 選択肢ピッカーモーダル */}
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