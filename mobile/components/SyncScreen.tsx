import React, { useRef } from 'react'; // ★ useRefを追加
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Alert, TouchableWithoutFeedback, Keyboard, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { styles } from '../styles/styles';

export const SyncScreen = ({ dynamicStyles, themeColor, syncStage, setSyncStage, serverIp, setServerIp, serverPort, setServerPort, authCodeInput, setAuthCodeInput, showCamera, setShowCamera, requestCameraPermission, pcPlaylists, selectedPls, setSelectedPls, isSyncing, isDark, requestAuthToPC, verifyAuthCode, startSyncDownload, cancelSync, disconnect, setScannedQrData, clientInfo, insets, currentSong }: any) => {

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const bottomPadding = currentSong ? 280 : 160;

  // ★ 連続読み込みを防止するためのロック変数
  const isProcessingQr = useRef(false);

  const selectAll = () => {
    const allIndices = new Set(pcPlaylists.map((_, i: number) => i));
    setSelectedPls(allIndices);
  };

  const deselectAll = () => {
    setSelectedPls(new Set());
  };

  return (
    <View style={{flex:1, backgroundColor: dynamicStyles.bg}}>
      <View style={[styles.headerBar, {backgroundColor: dynamicStyles.bg, borderBottomColor: 'transparent', paddingTop: insets?.top || 0, height: 44 + (insets?.top || 0)}]}><Text style={[styles.headerTitle, {color: dynamicStyles.text}]}>同期</Text></View>
      
      {syncStage === 'INPUT_IP' && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomPadding }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
                <View style={[styles.syncCard, {backgroundColor: dynamicStyles.card, margin: 0}]}>
                    <View style={{alignItems: 'center', marginBottom: 15}}>
                      <Text style={{color: dynamicStyles.subText, fontSize: 12}}>
                        このデバイス: {clientInfo?.deviceName || '取得中...'} ({clientInfo?.osVersion || '取得中...'})
                      </Text>
                    </View>

                    <TouchableOpacity style={[styles.smallBtn, {backgroundColor: '#34c759', marginBottom: 20}]} onPress={async () => { 
                        Keyboard.dismiss();
                        const granted = await requestCameraPermission(); 
                        if (granted) {
                          isProcessingQr.current = false; // カメラを開くときにロックを解除
                          setShowCamera(true);
                        }
                      }}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                        <Ionicons name="qr-code-outline" size={20} color="#fff" />
                        <Text style={styles.btnText}>QRコードで自動接続</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{height: 1, backgroundColor: dynamicStyles.border, marginBottom: 20}} />
                    
                    <Text style={{color: dynamicStyles.text, marginBottom: 10, fontWeight: 'bold'}}>手動で接続する</Text>
                    
                    <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                        <View style={{flex: 3}}>
                            <Text style={{color: dynamicStyles.subText, fontSize: 11, marginBottom: 4}}>IPアドレス</Text>
                            <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0}]} placeholder="192.168.0.x" placeholderTextColor="#888" value={serverIp} onChangeText={setServerIp} keyboardType="decimal-pad" />
                        </View>
                        <View style={{flex: 1.2}}>
                            <Text style={{color: dynamicStyles.subText, fontSize: 11, marginBottom: 4}}>ポート</Text>
                            <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, marginBottom: 0}]} placeholder="5000" placeholderTextColor="#888" value={serverPort} onChangeText={setServerPort} keyboardType="number-pad" maxLength={5} />
                        </View>
                    </View>

                    <TouchableOpacity style={[styles.smallBtn, {backgroundColor: themeColor}]} onPress={() => { Keyboard.dismiss(); requestAuthToPC(serverIp, serverPort); }}><Text style={styles.btnText}>PCに接続要求</Text></TouchableOpacity>
                    {isSyncing && <ActivityIndicator color={themeColor} style={{marginTop:15}} />}
                </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {syncStage === 'AWAITING_APPROVAL' && (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40}}>
            <ActivityIndicator size="large" color={themeColor} />
            <Text style={{color: dynamicStyles.text, marginTop: 20, textAlign: 'center', fontSize: 16, fontWeight: 'bold'}}>PC側で接続を許可してください...</Text>
            <TouchableOpacity style={{marginTop: 40}} onPress={cancelSync}><Text style={{color: themeColor, fontSize: 16}}>キャンセル</Text></TouchableOpacity>
        </View>
      )}

      {syncStage === 'AWAITING_CODE' && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomPadding }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <View style={[styles.syncCard, {backgroundColor: dynamicStyles.card, margin: 0}]}>
                    <Text style={{color: dynamicStyles.text, marginBottom: 15, fontSize: 16, fontWeight: 'bold'}}>PCに表示された6桁のコードを入力してください。</Text>
                    <TextInput style={[styles.input, {backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: dynamicStyles.text, fontSize: 32, textAlign: 'center', letterSpacing: 8, fontWeight: '800'}]} placeholder="000000" placeholderTextColor="#888" maxLength={6} value={authCodeInput} onChangeText={setAuthCodeInput} keyboardType="number-pad" />
                    <TouchableOpacity style={[styles.smallBtn, {backgroundColor: themeColor, marginBottom: 10}]} onPress={() => { Keyboard.dismiss(); verifyAuthCode(serverIp, serverPort, authCodeInput); }}><Text style={styles.btnText}>認証する</Text></TouchableOpacity>
                    <TouchableOpacity style={{marginTop: 15, alignItems: 'center'}} onPress={cancelSync}><Text style={{color: themeColor}}>やり直す</Text></TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </ScrollView>
      )}

      {syncStage === 'READY' && (
        <View style={{flex: 1}}>
          <FlatList 
            data={pcPlaylists} 
            keyExtractor={(item, index) => item.playlistName + index} 
            numColumns={isLandscape ? 2 : 1}
            key={isLandscape ? 'grid' : 'list'}
            contentContainerStyle={{paddingBottom: bottomPadding, paddingTop: 10, paddingHorizontal: isLandscape ? 10 : 0}} 
            ListHeaderComponent={
                <View style={{paddingHorizontal: 20, paddingBottom: 10, gap: 10}}>
                   <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#6b7280' }]} onPress={disconnect}><Text style={styles.btnText}>接続を解除</Text></TouchableOpacity>
                   <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} onPress={selectAll}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>すべて選択</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, { backgroundColor: isDark ? '#2c2c2e' : '#e5e7eb', flex: 1, height: 40 }]} onPress={deselectAll}><Text style={{ color: dynamicStyles.text, fontWeight: 'bold' }}>選択解除</Text></TouchableOpacity>
                   </View>
                </View>
            }
            renderItem={({item, index}) => (
              <TouchableOpacity style={[styles.checkRow, {backgroundColor: dynamicStyles.bg}, isLandscape && { flex: 0.5, margin: 5, borderRadius: 10, borderWidth: 0.5, borderColor: dynamicStyles.border }]} onPress={() => { const next = new Set(selectedPls); if (next.has(index)) next.delete(index); else next.add(index); setSelectedPls(next); }}>
                <Ionicons name={selectedPls.has(index) ? "checkbox" : "square-outline"} size={24} color={themeColor} />
                <Text style={[styles.rowTitle, {color: dynamicStyles.text}]} numberOfLines={1}>{item.playlistName}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={pcPlaylists.length > 0 ? (
                    <View style={[styles.syncFooterContainer, isLandscape && { flexDirection: 'row', justifyContent: 'center', gap: 15 }]}>
                        <TouchableOpacity style={[styles.syncActionBtn, {backgroundColor: themeColor, flex: isLandscape ? 1 : 0}]} onPress={() => startSyncDownload(false)}><Text style={styles.syncActionBtnText}>選択した項目を同期</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.syncActionBtn, {backgroundColor: '#6b7280', flex: isLandscape ? 1 : 0}]} onPress={() => startSyncDownload(true)}><Text style={styles.syncActionBtnText}>すべて同期</Text></TouchableOpacity>
                    </View>
                ) : null
            }
          />
        </View>
      )}

      {showCamera && (
          <Modal visible={true} transparent={false} animationType="slide" supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}>
              <SafeAreaView style={{flex: 1, backgroundColor: '#000'}}>
                  <View style={{flex: 1, borderRadius: 20, overflow: 'hidden', margin: 10}}>
                      <CameraView 
                        style={StyleSheet.absoluteFill} 
                        onBarcodeScanned={async ({ data }) => {
                              // ★ すでに処理中なら何もしない
                              if (isProcessingQr.current) return;
                              isProcessingQr.current = true;

                              try {
                                const qrData = JSON.parse(data);
                                if(qrData.ip && qrData.code) { 
                                  setShowCamera(false);
                                  setScannedQrData(qrData); 
                                } else {
                                  // JSONだが中身が不正な場合
                                  throw new Error();
                                }
                              } catch(e) { 
                                Alert.alert(
                                  "エラー", 
                                  "無効なQRコードです",
                                  [{ text: "OK", onPress: () => { isProcessingQr.current = false; } }] // OKを押すまでロックを維持
                                ); 
                              }
                          }} 
                      />
                  </View>
                  <TouchableOpacity style={{padding: 20, alignItems: 'center'}} onPress={() => setShowCamera(false)}><Text style={{color: '#fff', fontSize: 18}}>キャンセル</Text></TouchableOpacity>
              </SafeAreaView>
          </Modal>
      )}
    </View>
  );
};