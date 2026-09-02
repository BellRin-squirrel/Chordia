import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, 
  ActivityIndicator, Alert, StyleSheet, Keyboard, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import DeviceInfo from 'react-native-device-info';
import { t } from '../../utils/i18n';
import { 
  generateAuthCode, 
  registerAuthCodeApi, 
  checkAuthStatusApi, 
  logoutApi,
  syncInitialLocalHistory 
} from '../../utils/chordiaSync';

const ACCOUNT_STORAGE_KEY = 'chordia_sync_account';

type AuthStage = 'IDLE' | 'INPUT' | 'WAITING_CODE' | 'AUTHENTICATED' | 'EXPIRED';

export const InfoAccountView = ({
  dynamicStyles, themeColor, textColor, isDark, safePadding, renderHeader, language = 'ja'
}: any) => {
  const [authStage, setAuthStage] = useState<AuthStage>('IDLE');
  const [username, setUsername] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [sid, setSid] = useState<string | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ACCOUNT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.username && parsed.sid) {
            setUsername(parsed.username);
            setDeviceName(parsed.deviceName || '');
            setSid(parsed.sid);
            setAuthStage('AUTHENTICATED');
          }
        }
      } catch (e) {}
    })();

    return () => stopPolling();
  }, []);

  useEffect(() => {
    if (authStage === 'WAITING_CODE' && sid && username && deviceName) {
      stopPolling();

      pollingTimerRef.current = setInterval(async () => {
        const res = await checkAuthStatusApi(sid, username, deviceName);

        if (res.success) {
          if (res.status === 'authenticated') {
            stopPolling();
            setAuthStage('AUTHENTICATED');
            await AsyncStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify({
              username,
              deviceName,
              sid,
              authenticatedAt: new Date().toISOString(),
            }));

            // ログイン成功時に既存の作業履歴＆再生履歴をサーバーへ一括送信
            syncInitialLocalHistory(sid).catch((err) => {
              console.warn('[InitialSync Error]', err);
            });
          } else if (res.status === 'expired') {
            stopPolling();
            setAuthStage('EXPIRED');
          }
        } else {
          stopPolling();
          Alert.alert(t('sync_connect_error_title', language), res.error || t('account_auth_failed', language));
        }
      }, 2500);
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [authStage, sid, username, deviceName]);

  const handleStartAuth = () => {
    let defaultDevName = Platform.OS === 'ios' ? 'iPhone' : 'Android Device';
    try {
      const rnModel = DeviceInfo.getModel();
      const expoModel = Device.modelName;
      if (rnModel && !rnModel.includes(',')) defaultDevName = rnModel;
      else if (expoModel && !expoModel.includes(',')) defaultDevName = expoModel;
    } catch (e) {}

    if (!deviceName) {
      setDeviceName(defaultDevName);
    }
    setAuthStage('INPUT');
    setGeneratedCode(null);
    setSid(null);
  };

  const isFormValid = username.trim().length > 0 && deviceName.trim().length > 0;

  const handleRegisterCode = async () => {
    if (!username.trim()) {
      Alert.alert(t('alert_timer_error_title', language), t('account_enter_username_alert', language));
      return;
    }
    if (!deviceName.trim()) {
      Alert.alert(t('alert_timer_error_title', language), t('account_enter_device_alert', language));
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    const code = generateAuthCode(8);
    const result = await registerAuthCodeApi(username, deviceName, code);

    setIsLoading(false);

    if (result.success && result.sid) {
      setSid(result.sid);
      setGeneratedCode(code);
      setAuthStage('WAITING_CODE');
    } else {
      Alert.alert(
        t('sync_connect_error_title', language),
        result.error || t('account_auth_failed', language)
      );
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      t('account_logout_confirm_title', language),
      t('account_logout_confirm_desc', language),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('account_logout_btn', language),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            stopPolling();

            if (sid && username && deviceName) {
              const res = await logoutApi(sid, username, deviceName);
              if (!res.success && res.error) {
                console.warn('[Logout Warning]', res.error);
              }
            }

            // ★ 1. アカウントセッション情報の削除
            await AsyncStorage.removeItem(ACCOUNT_STORAGE_KEY);

            // ★ 2. ローカルの作業セッション履歴・一時作業時間の削除
            await AsyncStorage.removeItem('chordia_focus_history');
            await AsyncStorage.removeItem('chordia_temp_work_seconds');

            // ★ 3. ローカルの楽曲再生履歴・未送信キューの削除
            await AsyncStorage.removeItem('chordia_playback_history');
            await AsyncStorage.removeItem('chordia_pending_play_history');
            await AsyncStorage.removeItem('chordia_pending_work_history');

            console.log('[Account Logout] 🧹 ローカルの作業セッション履歴および楽曲再生履歴を消去しました');

            setSid(null);
            setGeneratedCode(null);
            setUsername('');
            setDeviceName('');
            setIsLoggingOut(false);
            setAuthStage('IDLE');
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: dynamicStyles.bg }}>
      <View style={{ position: 'absolute', top: -100, bottom: -100, left: -100, right: -100, backgroundColor: dynamicStyles.bg, zIndex: -1 }} />
      {renderHeader(t('menu_account', language))}

      <ScrollView contentContainerStyle={[safePadding, { paddingTop: 20 }]}>
        {/* 説明カード */}
        <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={[s.iconBox, { backgroundColor: `rgba(79, 70, 229, 0.12)` }]}>
              <Ionicons name="cloud-outline" size={24} color={themeColor} />
            </View>
            <Text style={[s.cardTitle, { color: dynamicStyles.text }]}>Chordia Sync</Text>
          </View>

          <Text style={[s.descText, { color: dynamicStyles.subText }]}>
            {t('account_sync_desc', language)}
          </Text>
        </View>

        {/* 1. ログイン完了状態の表示 */}
        {authStage === 'AUTHENTICATED' && (
          <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: themeColor, marginTop: 15 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={22} color={themeColor} />
              <Text style={{ color: dynamicStyles.text, fontSize: 16, fontWeight: 'bold' }}>
                {t('account_logged_in_status', language)}
              </Text>
            </View>

            <View style={{ backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', padding: 14, borderRadius: 14, gap: 6, marginBottom: 15 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>{t('account_username_label', language)}</Text>
                <Text style={{ color: dynamicStyles.text, fontSize: 13, fontWeight: 'bold' }}>{username}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: dynamicStyles.subText, fontSize: 13 }}>{t('account_devicename_label', language)}</Text>
                <Text style={{ color: dynamicStyles.text, fontSize: 13, fontWeight: 'bold' }}>{deviceName}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={{ height: 46, borderRadius: 23, backgroundColor: 'rgba(239, 68, 68, 0.12)', justifyContent: 'center', alignItems: 'center' }}
              onPress={handleLogoutPress}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 14 }}>{t('account_logout_btn', language)}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 2. 未ログイン / 認証開始ボタン */}
        {authStage === 'IDLE' && (
          <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 15 }]}>
            <TouchableOpacity 
              style={[s.primaryBtn, { backgroundColor: themeColor }]}
              onPress={handleStartAuth}
              activeOpacity={0.8}
            >
              <Ionicons name="key-outline" size={20} color={textColor} style={{ marginRight: 8 }} />
              <Text style={[s.primaryBtnText, { color: textColor }]}>
                {t('account_start_auth_btn', language)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. ユーザー名・デバイス名入力フォーム */}
        {authStage === 'INPUT' && (
          <View style={[s.card, { backgroundColor: dynamicStyles.card, borderColor: dynamicStyles.border, marginTop: 15 }]}>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>
                  {t('account_username_label', language)}
                </Text>
                <TextInput 
                  style={[s.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, borderColor: dynamicStyles.border }]}
                  placeholder={t('account_username_placeholder', language)}
                  placeholderTextColor={dynamicStyles.subText}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <Text style={[s.fieldDesc, { color: dynamicStyles.subText }]}>
                  {t('account_username_desc', language)}
                </Text>
              </View>

              <View>
                <Text style={{ color: dynamicStyles.text, fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>
                  {t('account_devicename_label', language)}
                </Text>
                <TextInput 
                  style={[s.input, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, borderColor: dynamicStyles.border }]}
                  placeholder={t('account_devicename_placeholder', language)}
                  placeholderTextColor={dynamicStyles.subText}
                  value={deviceName}
                  onChangeText={setDeviceName}
                  editable={!isLoading}
                />
                <Text style={[s.fieldDesc, { color: dynamicStyles.subText }]}>
                  {t('account_devicename_desc', language)}
                </Text>
              </View>

              <TouchableOpacity 
                style={[
                  s.primaryBtn, 
                  { 
                    backgroundColor: isFormValid ? themeColor : (isDark ? '#3a3a3c' : '#c7c7cc'),
                    opacity: isFormValid && !isLoading ? 1 : 0.6,
                    marginTop: 4
                  }
                ]}
                disabled={!isFormValid || isLoading}
                onPress={handleRegisterCode}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={textColor} />
                ) : (
                  <>
                    <Ionicons name="globe-outline" size={19} color={isFormValid ? textColor : dynamicStyles.subText} style={{ marginRight: 8 }} />
                    <Text style={[s.primaryBtnText, { color: isFormValid ? textColor : dynamicStyles.subText }]}>
                      {t('account_web_auth_btn', language)}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. 認証コード表示 & ポーリング待機中 */}
        {authStage === 'WAITING_CODE' && generatedCode && (
          <View style={[s.codeCard, { backgroundColor: dynamicStyles.card, borderColor: themeColor }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="key" size={20} color={themeColor} />
              <Text style={[s.codeCardTitle, { color: dynamicStyles.text }]}>
                {t('account_code_issued_title', language)}
              </Text>
            </View>

            <Text style={[s.codeCardDesc, { color: dynamicStyles.subText }]}>
              {t('account_code_issued_desc', language)}
            </Text>

            <View style={[s.codeBox, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', borderColor: dynamicStyles.border }]}>
              <Text style={[s.codeText, { color: themeColor }]}>{generatedCode}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <ActivityIndicator size="small" color={themeColor} />
              <Text style={{ color: dynamicStyles.subText, fontSize: 13, fontWeight: '600' }}>
                {t('account_polling_waiting', language)}
              </Text>
            </View>
          </View>
        )}

        {/* 5. 認証コードの有効期限切れ */}
        {authStage === 'EXPIRED' && (
          <View style={[s.codeCard, { backgroundColor: dynamicStyles.card, borderColor: '#ef4444' }]}>
            <Ionicons name="alert-circle" size={32} color="#ef4444" style={{ marginBottom: 6 }} />
            <Text style={[s.codeCardTitle, { color: '#ef4444' }]}>
              {t('account_auth_expired_title', language)}
            </Text>
            <Text style={[s.codeCardDesc, { color: dynamicStyles.subText, marginVertical: 10 }]}>
              {t('account_auth_expired_desc', language)}
            </Text>
            <TouchableOpacity 
              style={[s.primaryBtn, { backgroundColor: themeColor, width: '100%', marginTop: 8 }]}
              onPress={handleRegisterCode}
            >
              <Text style={[s.primaryBtnText, { color: textColor }]}>
                {t('account_reissue_btn', language)}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  descText: { fontSize: 13, lineHeight: 21 },
  fieldDesc: { fontSize: 12, lineHeight: 18, marginTop: 5, paddingHorizontal: 2 },
  input: { height: 48, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, borderWidth: 1 },
  primaryBtn: { height: 50, borderRadius: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: 'bold' },
  codeCard: { marginTop: 20, borderRadius: 20, padding: 20, borderWidth: 1.5, alignItems: 'center' },
  codeCardTitle: { fontSize: 16, fontWeight: 'bold' },
  codeCardDesc: { fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 15, lineHeight: 18 },
  codeBox: { width: '100%', paddingVertical: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 30, fontWeight: '900', letterSpacing: 6, fontVariant: ['tabular-nums'] },
});