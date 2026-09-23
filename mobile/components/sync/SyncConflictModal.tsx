import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer } from 'expo-audio';
import { ConflictItem, ConflictSet } from '../../hooks/useSync';
import { t } from '../../utils/i18n';

interface SyncConflictModalProps {
  activeConflictSet: ConflictSet | null;
  resolveCurrentConflict: (choice: { action: 'ADOPT' | 'IGNORE'; adoptedItem?: ConflictItem } | 'ABORT') => void;
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  language: string;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  activeConflictSet,
  resolveCurrentConflict,
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  language,
}) => {
  const previewPlayerRef = useRef<any>(null);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);

  const stopPreviewAudio = () => {
    if (previewPlayerRef.current) {
      try { 
        previewPlayerRef.current.pause?.(); 
        previewPlayerRef.current.remove?.(); 
      } catch (e) {}
      previewPlayerRef.current = null;
    }
    setPlayingItemId(null);
  };

  useEffect(() => {
    return () => stopPreviewAudio();
  }, []);

  const togglePlayPreview = (item: ConflictItem) => {
    if (playingItemId === item.id) {
      stopPreviewAudio();
      return;
    }
    stopPreviewAudio();
    try {
      const cleanPath = Platform.OS === 'android' 
        ? item.sourceUrlOrUri.replace(/^file:\/+/i, '/') 
        : item.sourceUrlOrUri;
      const player = createAudioPlayer(cleanPath);
      previewPlayerRef.current = player;
      player.play();
      setPlayingItemId(item.id);
    } catch (e) {
      Alert.alert(t('alert_timer_error_title', language), 'Failed to play preview');
    }
  };

  if (!activeConflictSet) return null;

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: dynamicStyles.card, borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: dynamicStyles.border }}>
          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(245, 158, 11, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="copy-outline" size={24} color="#f59e0b" />
            </View>
            <Text style={{ color: dynamicStyles.text, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
              {t('sync_conflict_title', language)}
            </Text>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
              {t('sync_conflict_desc', language)}
            </Text>
          </View>

          <View style={{ backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', padding: 12, borderRadius: 14, marginBottom: 16 }}>
            <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold' }} numberOfLines={1}>{activeConflictSet.title}</Text>
            <Text style={{ color: dynamicStyles.subText, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{activeConflictSet.artist} • {activeConflictSet.album}</Text>
          </View>

          {/* 音源一覧（試聴＆採用ボタン） */}
          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 10, paddingBottom: 5 }}>
            {activeConflictSet.items.map(item => {
              const isItemPlaying = playingItemId === item.id;
              const isDesktop = item.type === 'DESKTOP';

              return (
                <View 
                  key={item.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14,
                    backgroundColor: dynamicStyles.bg === '#000000' ? '#1c1c1e' : '#ffffff',
                    borderWidth: 1, borderColor: dynamicStyles.border
                  }}
                >
                  <TouchableOpacity 
                    onPress={() => togglePlayPreview(item)}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isItemPlaying ? themeColor : (isDark ? '#2c2c2e' : '#e5e7eb'), justifyContent: 'center', alignItems: 'center', marginRight: 10 }}
                  >
                    <Ionicons name={isItemPlaying ? 'pause' : 'play'} size={18} color={isItemPlaying ? textColor : dynamicStyles.text} />
                  </TouchableOpacity>

                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <Text style={{ color: themeColor, fontSize: 11, fontWeight: 'bold' }}>
                      {isDesktop ? t('sync_conflict_source_desktop', language) : t('sync_conflict_source_local', language)}
                    </Text>
                    <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: themeColor }}
                    onPress={() => {
                      stopPreviewAudio();
                      resolveCurrentConflict({ action: 'ADOPT', adoptedItem: item });
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: 'bold' }}>
                      {t('sync_conflict_adopt_this', language)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ gap: 8, marginTop: 16 }}>
            {/* どちらも同期しない（除外） */}
            <TouchableOpacity 
              style={{ height: 44, borderRadius: 22, backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => {
                stopPreviewAudio();
                resolveCurrentConflict({ action: 'IGNORE' });
              }}
            >
              <Text style={{ color: dynamicStyles.text, fontWeight: '600', fontSize: 13 }}>
                {t('sync_conflict_ignore_both', language)}
              </Text>
            </TouchableOpacity>

            {/* 同期中断ボタン ＆ 注意警告 */}
            <View style={{ marginTop: 6, alignItems: 'center' }}>
              <TouchableOpacity 
                style={{ height: 44, width: '100%', borderRadius: 22, backgroundColor: 'rgba(239, 68, 68, 0.12)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  Alert.alert(
                    t('sync_conflict_abort_confirm_title', language),
                    t('sync_conflict_abort_confirm_desc', language),
                    [
                      { text: t('cancel', language), style: 'cancel' },
                      {
                        text: t('sync_conflict_abort_btn', language),
                        style: 'destructive',
                        onPress: () => {
                          stopPreviewAudio();
                          resolveCurrentConflict('ABORT');
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 13 }}>
                  {t('sync_conflict_abort_btn', language)}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: '#ef4444', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16, paddingHorizontal: 10 }}>
                {t('sync_conflict_abort_warning', language)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};