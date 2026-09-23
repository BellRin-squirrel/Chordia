import React from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Modal, 
  KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, 
  TouchableWithoutFeedback, ScrollView, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { t } from '../../utils/i18n';
import { StagedSong } from './types';

const DEFAULT_ICON = require('../../assets/images/icon.png');

interface SyncModalsProps {
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  actionSheetTargets: StagedSong[] | null;
  setActionSheetTargets: (targets: StagedSong[] | null) => void;
  openEditModal: (targets: StagedSong[]) => void;
  removeStagedSongs: (targets: StagedSong[]) => void;
  editingModalVisible: boolean;
  setEditingModalVisible: (visible: boolean) => void;
  editingTargets: StagedSong[];
  editTitle: string;
  setEditTitle: (text: string) => void;
  editArtist: string;
  setEditArtist: (text: string) => void;
  editAlbum: string;
  setEditAlbum: (text: string) => void;
  editCoverUri: string | null;
  pickCoverForEditing: () => void;
  saveEditedStagedSongs: () => void;
  showCamera: boolean;
  setShowCamera: (show: boolean) => void;
  onBarcodeScanned: (evt: { data: string }) => void;
  language: string;
}

export const SyncModals: React.FC<SyncModalsProps> = ({
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  actionSheetTargets,
  setActionSheetTargets,
  openEditModal,
  removeStagedSongs,
  editingModalVisible,
  setEditingModalVisible,
  editingTargets,
  editTitle,
  setEditTitle,
  editArtist,
  setEditArtist,
  editAlbum,
  setEditAlbum,
  editCoverUri,
  pickCoverForEditing,
  saveEditedStagedSongs,
  showCamera,
  setShowCamera,
  onBarcodeScanned,
  language,
}) => {
  return (
    <>
      {/* 1. 3点メニューアクションシート */}
      <Modal visible={!!actionSheetTargets} transparent animationType="none">
        <TouchableWithoutFeedback onPress={() => setActionSheetTargets(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', paddingHorizontal: 15, paddingBottom: 25 }}>
            <TouchableWithoutFeedback>
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: dynamicStyles.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: dynamicStyles.border }}>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: dynamicStyles.border }}
                    onPress={() => {
                      const targets = actionSheetTargets;
                      setActionSheetTargets(null);
                      if (targets) openEditModal(targets);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="create-outline" size={22} color={themeColor} />
                    <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: '600' }}>
                      {t('edit_song_info', language)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}
                    onPress={() => {
                      const targets = actionSheetTargets;
                      setActionSheetTargets(null);
                      if (targets) removeStagedSongs(targets);
                    }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600' }}>
                      {t('local_import_remove_staged', language)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={() => setActionSheetTargets(null)}
                  style={{ backgroundColor: dynamicStyles.card, borderRadius: 16, height: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: dynamicStyles.border }}
                >
                  <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 2. 楽曲情報編集モーダル */}
      <Modal visible={editingModalVisible} transparent animationType="none">
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ width: '100%', maxWidth: 440, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ color: dynamicStyles.text, fontSize: 17, fontWeight: 'bold' }}>
                {editingTargets.length > 1 ? t('edit_song_multi_title', language) : t('edit_song_title', language)}
              </Text>
              <TouchableOpacity onPress={() => setEditingModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <View style={{ alignItems: 'center', marginBottom: 15 }}>
                <TouchableOpacity onPress={pickCoverForEditing} activeOpacity={0.8}>
                  <Image 
                    source={editCoverUri ? { uri: editCoverUri } : DEFAULT_ICON} 
                    style={{ width: 88, height: 88, borderRadius: 14, marginBottom: 8 }} 
                  />
                  <View style={{ position: 'absolute', bottom: 12, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={{ color: dynamicStyles.subText, fontSize: 11 }}>
                  {t('change_cover_image', language)}
                </Text>
              </View>

              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('song_title', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder={t('song_title_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>

                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('artist', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editArtist}
                    onChangeText={setEditArtist}
                    placeholder={t('artist_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>

                <View>
                  <Text style={{ color: dynamicStyles.subText, fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>{t('album', language)}</Text>
                  <TextInput 
                    style={{ height: 42, borderRadius: 12, paddingHorizontal: 12, backgroundColor: dynamicStyles.bg === '#000000' ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 14, borderWidth: 1, borderColor: dynamicStyles.border }}
                    value={editAlbum}
                    onChangeText={setEditAlbum}
                    placeholder={t('album_placeholder', language)}
                    placeholderTextColor={dynamicStyles.subText}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
              <TouchableOpacity 
                style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setEditingModalVisible(false)}
              >
                <Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>{t('cancel', language)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1.2, height: 46, borderRadius: 23, backgroundColor: themeColor, justifyContent: 'center', alignItems: 'center' }}
                onPress={saveEditedStagedSongs}
              >
                <Text style={{ color: textColor, fontWeight: 'bold' }}>{t('save', language)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. QRカメラモーダル */}
      {showCamera && (
        <Modal visible={true} transparent={false} animationType="slide" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', margin: 10 }}>
              <CameraView 
                style={StyleSheet.absoluteFill} 
                onBarcodeScanned={onBarcodeScanned} 
              />
            </View>
            <TouchableOpacity style={{ padding: 20, alignItems: 'center' }} onPress={() => setShowCamera(false)}>
              <Text style={{ color: '#fff', fontSize: 18 }}>{t('cancel', language)}</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
};