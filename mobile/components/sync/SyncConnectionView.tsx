import React from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../../styles/styles';
import { t } from '../../utils/i18n';

interface SyncConnectionViewProps {
  dynamicStyles: any;
  themeColor: string;
  textColor: string;
  isDark: boolean;
  syncMode: 'LAN' | 'WAN' | 'LOCAL';
  clientInfo: any;
  serverIp: string;
  setServerIp: (ip: string) => void;
  serverPort: string;
  setServerPort: (port: string) => void;
  wanUrlInput: string;
  setWanUrlInput: (url: string) => void;
  requestCameraPermission: () => Promise<boolean>;
  setShowCamera: (show: boolean) => void;
  isProcessingQr: React.MutableRefObject<boolean>;
  requestAuthToPC: (ip: string, port: string) => void;
  isSyncing: boolean;
  language: string;
}

export const SyncConnectionView: React.FC<SyncConnectionViewProps> = ({
  dynamicStyles,
  themeColor,
  textColor,
  isDark,
  syncMode,
  clientInfo,
  serverIp,
  setServerIp,
  serverPort,
  setServerPort,
  wanUrlInput,
  setWanUrlInput,
  requestCameraPermission,
  setShowCamera,
  isProcessingQr,
  requestAuthToPC,
  isSyncing,
  language,
}) => {
  return (
    <View style={[styles.syncCard, { backgroundColor: dynamicStyles.card, margin: 0 }]}>
      <View style={{ alignItems: 'center', marginBottom: 15 }}>
        <Text style={{ color: dynamicStyles.subText, fontSize: 12 }}>
          {t('this_device', language)}: {clientInfo?.deviceName || t('getting_info', language)} ({clientInfo?.osVersion || t('getting_info', language)})
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.smallBtn, { backgroundColor: '#34c759', marginBottom: 20 }]} 
        onPress={async () => { 
          const granted = await requestCameraPermission(); 
          if (granted) {
            isProcessingQr.current = false;
            setShowCamera(true);
          }
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>{t('qr_auto_connect', language)}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={{ height: 1, backgroundColor: dynamicStyles.border, marginBottom: 20 }} />
      
      {syncMode === 'LAN' ? (
        <>
          <Text style={{ color: dynamicStyles.text, marginBottom: 10, fontWeight: 'bold' }}>
            {t('manual_connect_lan', language)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ flex: 3 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginBottom: 4 }}>
                {t('ip_address', language)}
              </Text>
              <TextInput 
                style={[styles.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0 }]} 
                placeholder="192.168.0.x" 
                placeholderTextColor="#888" 
                value={serverIp} 
                onChangeText={setServerIp} 
                keyboardType="decimal-pad" 
              />
            </View>
            <View style={{ flex: 1.2 }}>
              <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginBottom: 4 }}>
                {t('port', language)}
              </Text>
              <TextInput 
                style={[styles.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0 }]} 
                placeholder="5000" 
                placeholderTextColor="#888" 
                value={serverPort} 
                onChangeText={setServerPort} 
                keyboardType="number-pad" 
                maxLength={5} 
              />
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.smallBtn, { backgroundColor: themeColor }]} 
            onPress={() => requestAuthToPC(serverIp, serverPort)}
          >
            <Text style={[styles.btnText, { color: textColor }]}>{t('request_connect_pc', language)}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ color: dynamicStyles.text, marginBottom: 10, fontWeight: 'bold' }}>
            {t('manual_connect_wan', language)}
          </Text>
          <View style={{ marginBottom: 10 }}>
            <Text style={{ color: dynamicStyles.subText, fontSize: 11, marginBottom: 4 }}>
              {t('wan_public_url_label', language)}
            </Text>
            <TextInput 
              style={[styles.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0 }]} 
              placeholder="https://xxxx.lhr.life" 
              placeholderTextColor="#888" 
              value={wanUrlInput} 
              onChangeText={setWanUrlInput} 
              autoCapitalize="none" 
              keyboardType="url" 
            />
          </View>
          <TouchableOpacity 
            style={[styles.smallBtn, { backgroundColor: themeColor }]} 
            onPress={() => { 
              if (!wanUrlInput.trim() || (!wanUrlInput.startsWith('http://') && !wanUrlInput.startsWith('https://'))) {
                Alert.alert(t('alert_timer_error_title', language), t('invalid_wan_url', language));
                return;
              }
              setServerIp(wanUrlInput.trim());
              setServerPort('');
              requestAuthToPC(wanUrlInput.trim(), ''); 
            }}
          >
            <Text style={[styles.btnText, { color: textColor }]}>{t('wan_connect_btn', language)}</Text>
          </TouchableOpacity>
        </>
      )}

      {isSyncing && <ActivityIndicator color={themeColor} style={{ marginTop: 15 }} />}
    </View>
  );
};