import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';

export const InfoLicenseView = ({
  dynamicStyles, themeColor, isDark, safePadding, renderHeader, language = 'ja'
}: any) => {
  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('license_title', language))}
      
      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 20, alignItems: 'center' }]}>
        <View style={[styles.licenseCard, { backgroundColor: dynamicStyles.card, borderWidth: 1, borderColor: dynamicStyles.border }]}>
          <Ionicons name="musical-notes" size={48} color={themeColor} style={{ marginBottom: 12 }} />
          <Text style={[styles.appNameLabel, { color: dynamicStyles.text }]}>
            {t('app_name', language)}
          </Text>
          <Text style={styles.appVersionLabel}>v5.5.1</Text>
          <View style={[styles.divider, { backgroundColor: dynamicStyles.border, marginVertical: 20 }]} />
          <Text style={{ color: dynamicStyles.subText, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 15 }}>
            {t('app_desc', language)}
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
          <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', marginBottom: 10 }}>
            {t('oss_license_title', language)}
          </Text>
          <Text style={{ color: dynamicStyles.subText, fontSize: 12, lineHeight: 18 }}>
            {t('oss_license_desc', language)}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
