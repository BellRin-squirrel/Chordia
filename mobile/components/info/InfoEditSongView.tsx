import React from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import { t } from '../../utils/i18n';

const DEFAULT_ICON = require('../../assets/images/icon.png');

export const InfoEditSongView = ({
  dynamicStyles, themeColor, textColor, safePadding,
  editingTargetSongs = [],
  editTitle, setEditTitle, editArtist, setEditArtist, editAlbum, setEditAlbum,
  editTrack, setEditTrack, editDisc, setEditDisc, editYear, setEditYear,
  editLyric, setEditLyric, saveEditedSongs, renderHeader, language = 'ja'
}: any) => {
  const isMulti = editingTargetSongs.length > 1;
  const firstSong = editingTargetSongs[0];
  const previewArt = isMulti ? DEFAULT_ICON : (firstSong?.localImageUri ? { uri: firstSong.localImageUri } : DEFAULT_ICON);
  const keepStr = t('keep_label', language);

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
        {t('save', language)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: dynamicStyles.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(isMulti ? t('edit_song_multi_title', language) : t('edit_song_title', language), saveHeaderBtn)}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 15 }]}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image 
            source={previewArt} 
            style={{ width: 110, height: 110, borderRadius: 16, shadowOpacity: 0.15, shadowRadius: 8, marginBottom: 10 }} 
          />
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }}>
            {isMulti ? `${t('multiple_selection', language)} (${editingTargetSongs.length} ${t('songs_count', language)})` : (firstSong?.title || 'Untitled')}
          </Text>
          {isMulti && (
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 4 }}>
              {t('keep_tag_note', language)}
            </Text>
          )}
        </View>

        <View style={{ gap: 15 }}>
          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
              {t('song_title', language)}
            </Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editTitle === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editTitle} 
              onChangeText={setEditTitle} 
              placeholder={t('song_title_placeholder', language)} 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
              {t('artist', language)}
            </Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editArtist === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editArtist} 
              onChangeText={setEditArtist} 
              placeholder={t('artist_placeholder', language)} 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
              {t('album', language)}
            </Text>
            <TextInput 
              style={{ 
                height: 48, borderRadius: 14, paddingHorizontal: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editAlbum === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
              }} 
              value={editAlbum} 
              onChangeText={setEditAlbum} 
              placeholder={t('album_placeholder', language)} 
              placeholderTextColor={dynamicStyles.subText} 
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
                {t('track_number', language)}
              </Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editTrack === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editTrack} 
                onChangeText={setEditTrack} 
                placeholder="1" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editTrack === keepStr ? 'default' : 'number-pad'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
                {t('disc_number', language)}
              </Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editDisc === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editDisc} 
                onChangeText={setEditDisc} 
                placeholder="1" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editDisc === keepStr ? 'default' : 'number-pad'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
                {t('release_year', language)}
              </Text>
              <TextInput 
                style={{ 
                  height: 48, borderRadius: 14, paddingHorizontal: 14, 
                  backgroundColor: dynamicStyles.card, 
                  color: editYear === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                  fontSize: 15, borderWidth: 1, borderColor: dynamicStyles.border 
                }} 
                value={editYear} 
                onChangeText={setEditYear} 
                placeholder="2026" 
                placeholderTextColor={dynamicStyles.subText} 
                keyboardType={editYear === keepStr ? 'default' : 'number-pad'} 
              />
            </View>
          </View>

          <View style={{ marginTop: 5 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginLeft: 4 }}>
              {t('lyrics', language)}
            </Text>
            <TextInput 
              style={{ 
                minHeight: 120, maxHeight: 200, borderRadius: 14, padding: 14, 
                backgroundColor: dynamicStyles.card, 
                color: editLyric === keepStr ? dynamicStyles.subText : dynamicStyles.text, 
                fontSize: 14, lineHeight: 20, borderWidth: 1, borderColor: dynamicStyles.border, textAlignVertical: 'top' 
              }} 
              value={editLyric} 
              onChangeText={setEditLyric} 
              placeholder={t('lyrics_placeholder', language)} 
              placeholderTextColor={dynamicStyles.subText} 
              multiline 
            />
          </View>

          <TouchableOpacity style={{ height: 52, borderRadius: 26, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center', marginTop: 15, shadowColor: themeColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }} onPress={saveEditedSongs}>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: 'bold' }}>
              {t('save_changes_btn', language)}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
