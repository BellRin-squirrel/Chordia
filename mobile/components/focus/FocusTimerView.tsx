import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, StyleSheet as RNStyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const QUOTES_LIST = [
  "学ぶことをやめた時、成長も止まる（ベンジャミン・フランクリン）",
  "努力なくして成功は存在しない（レオナルド・ダ・ヴィンチ）",
  "継続は力なりという真理は変わらない（ウィリアム・シェイクスピア）",
  "行動こそがすべての始まりである（アリストテレス）",
  "小さな努力が大きな結果を生む（アイザック・ニュートン）",
  "困難は成長のために存在する（ヘレン・ケラー）",
  "学び続ける者だけが未来を得る（ガリレオ・ガリレイ）",
  "成功は準備した者に訪れる（ルイ・パスツール）",
  "努力は決して無駄にはならない（トーマス・エジソン）",
  "挑戦しなければ何も得られない（ナポレオン・ボナパルト）",
  "今を大切にする者が未来を掴む（マルクス・アウレリウス）",
  "知識は最大の力である（フランシス・ベーコン）",
  "自分を信じることが第一歩である（ルネ・デカルト）",
  "継続こそが成功への最短の道（チャールズ・ダーウィン）",
  "行動しなければ夢は実現しない（ヨハン・ゲーテ）",
  "失敗は成功への過程に過ぎない（アルベルト・アインシュタイン）",
  "努力は必ず自分を裏切らない（マハトマ・ガンディー）",
  "苦難の中にこそ学びがある（ジョン・ロック）",
  "時間を無駄にする者は未来を失う（セネカ）",
  "自分を高める努力を続けよ（孔子）",
  "継続は才能を超える力となる（ラ・ロシュフコー）",
  "目標を持つことで道は開ける（プラトン）",
  "努力する者だけがチャンスを得る（サミュエル・スマイルズ）",
  "忍耐は成功に必要な条件である（レフ・トルストイ）",
  "行動することでのみ現実は変わる（ジャン＝ジャック・ルソー）",
  "努力は未来への投資である（アダム・スミス）",
  "諦めなければ道は残る（エイブラハム・リンカーン）",
  "継続が自分の価値を高める（イマヌエル・カント）",
  "学ぶことに終わりはない（ソクラテス）",
  "挑戦こそが成長の鍵である（フリードリヒ・ニーチェ）",
  "自分を磨き続けることが大切（ブッダ）",
  "行動がすべての結果を生む（デール・カーネギー）",
  "努力は未来の自分を助ける（ヘンリー・フォード）",
  "成功は一日にして成らず（ジョン・レノン）",
  "続けることが最も価値がある（アレクサンダー・グラハム・ベル）",
  "小さな積み重ねが大きな差を生む（ピタゴラス）",
  "自分に勝つことが最大の勝利（プルタルコス）",
  "困難を越えることで人は強くなる（フローレンス・ナイチンゲール）",
  "努力は人生を変える鍵である（ヴィクトル・ユーゴー）",
  "今日の努力が明日を作る（ヨハネス・ケプラー）",
  "行動しないことが最大の失敗（アルフレッド・アドラー）",
  "継続はすべてを可能にする（ミケランジェロ）",
  "知るだけではなく行動せよ（レオナルド・ダ・ヴィンチ）",
  "努力は必ず実を結ぶ（パスカル）",
  "忍耐は力を生む（モンテーニュ）",
  "自分の限界を決めるな（ガリレオ）",
  "今この瞬間を大切にせよ（ホラティウス）",
  "挑戦する心を忘れるな（シーザー）",
  "努力する者が最後に勝つ（ナポレオン）",
  "知識は努力で増える（デカルト）",
  "行動が未来を決める（ロック）",
  "継続することで夢は近づく（ダーウィン）",
  "自分を信じ続けよ（ゲーテ）",
  "努力は裏切らない（エジソン）",
  "失敗から学ぶことが大切（アインシュタイン）",
  "挑戦することで道は開ける（ルソー）",
  "今日を変えれば未来も変わる（カント）",
  "継続が結果を生む（ニュートン）",
  "努力は可能性を広げる（フランクリン）",
  "学び続けることが成功の鍵（ベーコン）",
  "自分を高めることをやめるな（孔子）",
  "行動し続けることで成果が出る（フォード）",
  "困難は乗り越えるためにある（ガンディー）",
  "努力は未来への準備である（パスツール）",
  "挑戦し続ける者が成長する（ニーチェ）",
  "継続は最強の武器である（スマイルズ）",
  "小さな努力を軽視するな（ピタゴラス）",
  "自分を磨くことが成功への道（ブッダ）",
  "行動する勇気を持て（リンカーン）",
  "努力は必ず報われる（ナイチンゲール）",
  "学ぶ姿勢を持ち続けよ（ソクラテス）",
  "継続することで力がつく（ミケランジェロ）",
  "挑戦を恐れるな（シーザー）",
  "今やることが未来を変える（セネカ）",
  "努力は確実に自分を強くする（ユーゴー）",
  "行動しない後悔を避けよ（アドラー）",
  "継続は夢を現実にする（ベル）",
  "小さな成功を積み重ねよ（ケプラー）",
  "自分を信じる力を持て（ゲーテ）",
  "努力は自分への信頼となる（フランクリン）",
  "学びは人生を豊かにする（アリストテレス）",
  "挑戦することが価値を生む（ニーチェ）",
  "継続は未来への鍵である（ダーウィン）",
  "努力は自分を裏切らない（エジソン）",
  "行動することで道ができる（ルソー）",
  "学び続けることで強くなる（ベーコン）",
  "自分を高める努力を続けよ（孔子）",
  "継続する者が最後に勝つ（ナポレオン）",
  "挑戦が人生を変える（リンカーン）",
  "努力は人生の基盤である（スマイルズ）",
  "行動が成功を呼び込む（フォード）",
  "継続が最大の力となる（ニュートン）",
  "学びを止めるな（ソクラテス）",
  "努力することが未来を作る（フランクリン）"
];

const FadeText = ({ text, style }: { text: string, style: any }) => {
  const [displayText, setDisplayText] = useState(text);
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (displayText !== text) {
      Animated.timing(opacityAnim, { toValue: 0.4, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setDisplayText(text);
          Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } else {
          setDisplayText(text);
          opacityAnim.setValue(1);
        }
      });
    }
  }, [text]);

  const fontSize = style?.fontSize || 14;
  return (
    <View style={{ justifyContent: 'center', alignItems: 'center', height: fontSize * 1.3 }}>
      <Animated.Text style={[style, { opacity: opacityAnim }]} numberOfLines={1}>{displayText}</Animated.Text>
    </View>
  );
};

const AnimatedGradient = ({ children, isAppDark }: any) => {
  const colorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(colorAnim, { toValue: 1, duration: 4000, useNativeDriver: false }),
        Animated.timing(colorAnim, { toValue: 2, duration: 4000, useNativeDriver: false }),
        Animated.timing(colorAnim, { toValue: 3, duration: 4000, useNativeDriver: false }),
        Animated.timing(colorAnim, { toValue: 0, duration: 4000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      <View style={RNStyleSheet.absoluteFill}>
          <LinearGradient colors={['#ff9a9e', '#fecfef']} style={RNStyleSheet.absoluteFill} />
          <Animated.View style={[RNStyleSheet.absoluteFill, { opacity: colorAnim.interpolate({ inputRange:[0, 1, 2, 3], outputRange:[0, 1, 0, 0] }) }]}>
              <LinearGradient colors={['#a18cd1', '#fbc2eb']} style={RNStyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[RNStyleSheet.absoluteFill, { opacity: colorAnim.interpolate({ inputRange:[0, 1, 2, 3], outputRange:[0, 0, 1, 0] }) }]}>
              <LinearGradient colors={['#84fab0', '#8fd3f4']} style={RNStyleSheet.absoluteFill} />
          </Animated.View>
      </View>
      <View style={{ backgroundColor: isAppDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)', paddingHorizontal: 15, paddingVertical: 6 }}>
        {children}
      </View>
    </View>
  );
};

export const FocusTimerView = ({ 
    isLandscape, insets, themeColor, isAppDark, 
    dateStr, dayStr, clockStr, dayMode, 
    totalWorkSeconds, pomoEnabled, pomoState, pomoRemaining, 
    currentSong, isPaused, showHelp, pausedSeconds, formatTime,
    handleTouchPress, handleLongPress, panHandlers, introToastAnim,
    showQuote
}: any) => {
  const isLeftAreaHidden = dateStr === "" && dayStr === "" && clockStr === "";

  const [randomQuote, setRandomQuote] = useState("");
  
  const updateQuote = () => {
      const randomIndex = Math.floor(Math.random() * QUOTES_LIST.length);
      setRandomQuote(QUOTES_LIST[randomIndex]);
  };

  useEffect(() => {
      if (showQuote) {
          updateQuote(); 
          const quoteTimer = setInterval(() => {
              updateQuote();
          }, 60000);
          return () => clearInterval(quoteTimer);
      }
  }, [showQuote]);

  // ★ 修正: ダブルクォーテーションを削除し、純粋に改行のみを行う
  const formatQuoteText = (rawQuote: string) => {
      if (!rawQuote) return "";
      const parts = rawQuote.split('（');
      if (parts.length === 2) {
          return `${parts[0]}\n（${parts[1]}`; 
      }
      return rawQuote; 
  };

  const QuoteElement = () => (
      <View style={{ marginTop: isLandscape ? 0 : 40, paddingHorizontal: 20, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 }}>
              {formatQuoteText(randomQuote)}
          </Text>
      </View>
  );

  return (
    <TouchableWithoutFeedback onPress={handleTouchPress} onLongPress={handleLongPress} delayLongPress={600}>
      <View style={{ flex: 1, backgroundColor: '#000' }} {...panHandlers}>
        <View style={{ flex: 1, padding: 40, paddingTop: insets.top + (isLandscape ? 40 : 60), opacity: isPaused ? 0.3 : 1 }}>
          <View style={{ 
            flex: 1, 
            flexDirection: isLandscape ? 'row' : 'column', 
            justifyContent: isLeftAreaHidden ? 'center' : (isLandscape ? 'center' : 'flex-start'), 
            alignItems: 'center', 
            gap: isLandscape && !isLeftAreaHidden ? 100 : 0 
          }}>
            
            {!isLeftAreaHidden && (
              <View style={{ alignItems: isLandscape ? 'flex-start' : 'center', marginBottom: isLandscape ? 0 : 50 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                  {dateStr !== "" && <FadeText text={dateStr} style={{ color: 'rgba(255,255,255,0.6)', fontSize: isLandscape ? 18 : 20, fontWeight: '600', fontVariant: ['tabular-nums'] }} />}
                  {dayStr !== "" && dayMode !== '日曜日' && <FadeText text={dayStr} style={{ color: 'rgba(255,255,255,0.6)', fontSize: isLandscape ? 18 : 20, fontWeight: '600', fontVariant: ['tabular-nums'] }} />}
                </View>
                {dayStr !== "" && dayMode === '日曜日' && (
                  <View style={{ marginTop: 5 }}>
                    <FadeText text={dayStr} style={{ color: 'rgba(255,255,255,0.6)', fontSize: isLandscape ? 22 : 24, fontWeight: 'bold', fontVariant: ['tabular-nums'] }} />
                  </View>
                )}
                {clockStr !== "" && (
                  <View style={{ marginTop: 10 }}>
                    <FadeText text={clockStr} style={{ color: '#fff', fontSize: isLandscape ? 68 : 76, fontWeight: '900', fontVariant: ['tabular-nums'] }} />
                  </View>
                )}
              </View>
            )}

            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 'bold' }}>TOTAL WORK</Text>
              <Text style={{ color: themeColor, fontSize: isLandscape ? 36 : 48, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{formatTime(totalWorkSeconds)}</Text>
              
              {!isLandscape && showQuote && !pomoEnabled && <QuoteElement />}

              {pomoEnabled && (
                <View style={{ marginTop: isLandscape ? 30 : 60, alignItems: 'center' }}>
                  <AnimatedGradient isAppDark={isAppDark}>
                    <FadeText text={pomoState === 'WORK' ? 'FOCUSING' : 'BREAK TIME'} style={{ color: themeColor, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 2 }} />
                  </AnimatedGradient>
                  <Text style={{ color: '#fff', fontSize: isLandscape ? 52 : 72, fontWeight: '200', fontVariant: ['tabular-nums'] }}>{formatTime(pomoRemaining)}</Text>
                  
                  {!isLandscape && showQuote && <QuoteElement />}
                </View>
              )}
            </View>
          </View>

          <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 0, right: 0, alignItems: 'center', padding: 15 }}>
            {isLandscape && showQuote && (
                <View style={{ marginBottom: 15 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 20 }}>
                        {formatQuoteText(randomQuote)}
                    </Text>
                </View>
            )}
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontVariant: ['tabular-nums'] }}>{currentSong ? `♪ ${currentSong.title}` : 'No Music'}</Text>
          </View>
        </View>

        <Animated.View style={{ position: 'absolute', top: insets.top + 20, left: 0, right: 0, alignItems: 'center', opacity: introToastAnim }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>画面を長押しするとヘルプが表示されます</Text>
            </View>
        </Animated.View>

        {isPaused && !showHelp && (
          <View style={[RNStyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }]}>
            <Ionicons name="pause-circle" size={80} color="#fff" style={{ opacity: 0.8 }} />
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 10, letterSpacing: 5 }}>PAUSED</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 15 }}>画面をタップして再開</Text>
            <View style={{ position: 'absolute', bottom: insets.bottom + 80, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>PAUSED TIME</Text>
              <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>{formatTime(pausedSeconds)}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};