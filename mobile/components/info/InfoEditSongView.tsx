import React from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Image, KeyboardAvoidingView, Platform 
} from 'react-native';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const InfoEditSongView = ({
  dynamicStyles, themeColor, textColor, safePadding,
  editingTargetSongs = [],
  editTitle, setEditTitle, editArtist, setEditArtist, editAlbum, setEditAlbum,
  editTrack, setEditTrack, editDisc, setEditDisc, editYear, setEditYear,
  editLyric, setEditLyric, saveEditedSongs, renderHeader
}: any) => {
  const isMulti = editingTargetSongs.length > 1;
  const firstSong = editingTargetSongs[0];
  const previewArt = isMulti ? DEFAULT_ICON : (firstSong?.localImageUri ? { uri: firstSong.localImageUri } : DEFAULT_ICON);

  const saveHeaderBtn = (
    <TouchableOpacity 
      onPress={saveEditedSongs}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: themeColor,
      }}
    >
      <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 13 }}>
        保存
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: dynamicStyles.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(isMulti ? '楽曲情報を一括編集' : '楽曲情報を編集', saveHeaderBtn)}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 15 }]}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image 
            source={previewArt} 
            style={{ width: 110, height: 110, borderRadius: 16, shadowOpacity: 0.15, shadowRadius: 8, marginBottom: 10 }} 
          />
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
            {isMulti ? `複数選択 (${editingTargetSongs.length}曲)` : (firstSong?.title || 'Untitled')}
          </Text>
          {isMulti && (
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
              ※「&lt;維持&gt;」の項目は変更されず元の値が保たれます
            </Text>
          )}
        </View>

        <View style={{ gap: 15 }}>
          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>曲名</Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editTitle === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editTitle} 
              onChangeText={setEditTitle} 
              placeholder="曲名を入力" 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>アーティスト</Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editArtist === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editArtist} 
              onChangeText={setEditArtist} 
              placeholder="アーティスト名を入力" 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>アルバム</Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editAlbum === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editAlbum} 
              onChangeText={setEditAlbum} 
              placeholder="アルバム名を入力" 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>トラック番号</Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editTrack === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editTrack} 
                onChangeText={setEditTrack} 
                placeholder="1" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editTrack === '<維持>' ? 'default' : 'number-pad'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>ディスク番号</Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editDisc === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editDisc} 
                onChangeText={setEditDisc} 
                placeholder="1" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editDisc === '<維持>' ? 'default' : 'number-pad'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>リリース年</Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editYear === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editYear} 
                onChangeText={setEditYear} 
                placeholder="2026" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editYear === '<維持>' ? 'default' : 'number-pad'} 
              />
            </View>
          </View>

          <View style={{ marginTop: 5 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>歌詞 (Lyrics)</Text>
            <TextInput 
              style={{ 
                minHeight: 120, maxHeight: 200, borderRadius: 14, padding: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editLyric === '<維持>' ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 14, lineHeight: 20, borderWidth: 1, borderColor: dynamicStyles.border, textAlignVertical: 'top' 
              }} 
              value={editLyric} 
              onChangeText={setEditLyric} 
              placeholder="歌詞を入力..." 
              placeholderTextColor={dynamicStyles.subText} 
              multiline 
            />
          </View>

          <TouchableOpacity style={{ height: 52, borderRadius: 26, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 15, shadowColor: themeColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }} onPress={saveEditedSongs}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>変更を保存</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};