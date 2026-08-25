import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';

export const InfoLicenseView = ({
  dynamicStyles, themeColor, isDark, safePadding, renderHeader
}: any) => {
  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader('ライセンス・バージョン')}
      
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 20, alignItems: 'center' }]}>
        <View style={[styles.licenseCard, { backgroundColor: dynamicStyles.card, borderWidth: 1, borderColor: dynamicStyles.border }]}>
          <Ionicons name="musical-notes" size={48} color={themeColor} style={{ marginBottom: 12 }} />
          <Text style={[styles.appNameLabel, { color: dynamicStyles.text }]}>Chordia Mobile版</Text>
          <Text style={styles.appVersionLabel}>v5.3.0</Text>
          <View style={[styles.divider, { backgroundColor: dynamicStyles.border, marginVertical: 20 }]} />
          <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 15 }}>
            Chordia は PC 版ライブラリとのシームレスな同期と没入感のある音楽再生・作業集中環境を提供する音楽プレイヤーアプリです。
          </Text>
          <Text style={[styles.copyrightLabel, { color: dynamicStyles.text }]}>© 2026 BellRin</Text>
          <TouchableOpacity 
            activeOpacity={0.7} 
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }} 
            onPress={() => Linking.openURL('https://github.com/BellRin-squirrel/Chordia')}
          >
            <Ionicons name="logo-github" size={18} color="#8957e5" />
            <Text style={{ color: '#8957e5', fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' }}>GitHub Repository</Text>
            <Ionicons name="open-outline" size={12} color="#8957e5" />
          </TouchableOpacity>
        </View>

        <View style={{ width: '100%', maxWidth: 400, marginTop: 25, backgroundColor: dynamicStyles.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: dynamicStyles.border }}>
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>オープンソースライセンス</Text>
          <Text style={{ color: dynamicStyles.subText, fontSize: 12, lineHeight: 18 }}>
            本アプリケーションは、React Native, Expo, React Native Track Player, Expo Audio をはじめとするオープンソースソフトウェアを利用して開発されています。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
