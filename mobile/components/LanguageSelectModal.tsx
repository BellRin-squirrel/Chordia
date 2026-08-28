import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, Animated, StyleSheet, 
  useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  LANGUAGES, LANGUAGE_SELECTION_TITLES, LanguageCode 
} from '../utils/i18n';

export const LanguageSelectModal = ({
  visible, currentLanguage = 'ja', onSelectLanguage, onClose,
  dynamicStyles, themeColor, textColor, isDark, canClose = false
}: any) => {
  const { width } = useWindowDimensions();
  const isLandscape = width > 500;

  // ガイダンステキストの多言語ローテーション用 State & Anim
  const [titleIndex, setTitleIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      // フェードアウト ➡ テキスト切り替え ➡ フェードイン
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setTitleIndex((prev) => (prev + 1) % LANGUAGE_SELECTION_TITLES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [visible]);

  const currentTitleObj = LANGUAGE_SELECTION_TITLES[titleIndex];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={[
          s.card, 
          { 
            backgroundColor: dynamicStyles.card, 
            borderColor: dynamicStyles.border,
            width: isLandscape ? Math.min(width * 0.9, 520) : '90%',
          }
        ]}>
          {/* ヘッダー */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="globe-outline" size={22} color={themeColor} />
              <Text style={[s.headerTitle, { color: dynamicStyles.text }]}>Language</Text>
            </View>
            {canClose && (
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={26} color={dynamicStyles.subText} />
              </TouchableOpacity>
            )}
          </View>

          {/* ★ 多言語にアニメーション変化する案内テキスト */}
          <View style={s.titleContainer}>
            <Animated.Text style={[s.animatedText, { color: dynamicStyles.text, opacity: fadeAnim }]}>
              {currentTitleObj.text}
            </Animated.Text>
          </View>

          {/* 言語リスト（2列グリッド） */}
          <View style={s.gridContainer}>
            {LANGUAGES.map((lang) => {
              const isSelected = currentLanguage === lang.code;

              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    s.langBtn,
                    { 
                      backgroundColor: isSelected ? themeColor : (isDark ? '#2c2c2e' : '#f2f2f7'),
                      borderColor: isSelected ? themeColor : dynamicStyles.border,
                    }
                  ]}
                  onPress={() => onSelectLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.langLabel, { color: isSelected ? textColor : dynamicStyles.text }]}>
                    {lang.label}
                  </Text>
                  <Text style={[s.langEnglish, { color: isSelected ? textColor : dynamicStyles.subText }]}>
                    {lang.englishLabel}
                  </Text>

                  {isSelected && (
                    <Ionicons 
                      name="checkmark-circle" 
                      size={18} 
                      color={textColor} 
                      style={s.checkIcon} 
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { borderRadius: 24, padding: 22, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  titleContainer: { height: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  animatedText: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  langBtn: { width: '48%', height: 60, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  langLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  langEnglish: { fontSize: 11, opacity: 0.8 },
  checkIcon: { position: 'absolute', top: 6, right: 6 },
});