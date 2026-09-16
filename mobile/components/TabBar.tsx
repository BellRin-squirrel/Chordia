import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  View, Text, Animated, StyleSheet, useWindowDimensions, 
  PanResponder, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { TAB_BAR_HEIGHT, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
import { t } from '../utils/i18n';

interface TabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  themeColor: string;
  themeTextColor?: string;
  isDark: boolean;
  isBlurBackground?: boolean;
  showFocusTab?: boolean;
  showSyncTab?: boolean;
  language?: string;
}

const PILL_PADDING = 6;
const EXPANDED_SCALE = 1.40;
const TABBAR_MAX_SCALE = 1.020;

// 物理補間係数（HTML準拠）
const DRAG_LERP = 0.40;
const SNAP_LERP = 0.18;
const SCALE_LERP = 0.48;

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  setActiveTab,
  themeColor,
  themeTextColor,
  isDark,
  showFocusTab,
  showSyncTab,
  language = 'ja',
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const textColor = themeTextColor || '#ffffff';

  const tabs = useMemo(() => [
    ...(showSyncTab !== false ? [{ key: 'SYNC', label: t('tab_sync', language), icon: 'cloud-download' }] : []),
    { key: 'PLAYER', label: t('tab_player', language), icon: 'play-circle' },
    ...(showFocusTab ? [{ key: 'FOCUS', label: t('tab_focus', language), icon: 'timer' }] : []),
    { key: 'INFO', label: t('tab_info', language), icon: 'information-circle' }
  ], [showSyncTab, showFocusTab, language]);

  const tabCount = tabs.length;

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // 物理演算用 Refs
  const currentPosRef = useRef(0);
  const targetPosRef = useRef(0);
  const currentScaleRef = useRef(1.0);
  const targetScaleRef = useRef(1.0);
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);

  // プカプカ揺動（Wobble）用 Refs
  const wobbleTimeRef = useRef(0);
  const wobbleIntensityRef = useRef(0);

  // 指の接触位置（Specular Glow）
  const [touchCoords, setTouchCoords] = useState<{ x: number; y: number } | null>(null);

  // Animated Values
  const pillPosAnim = useRef(new Animated.Value(0)).current;
  const pillScaleAnim = useRef(new Animated.Value(1.0)).current;
  const pillWobbleXAnim = useRef(new Animated.Value(0)).current;
  const pillWobbleYAnim = useRef(new Animated.Value(0)).current;
  const pillWobbleRotateAnim = useRef(new Animated.Value(0)).current;
  const tabbarScaleAnim = useRef(new Animated.Value(1.0)).current;
  const dynamicAlphaAnim = useRef(new Animated.Value(0.44)).current;
  const prismOpacityAnim = useRef(new Animated.Value(0)).current;

  // アイコン個別スケール
  const iconScaleAnims = useRef(tabs.map(() => new Animated.Value(1.0))).current;

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.key === activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab, tabs]);

  const tabSlotSize = useMemo(() => {
    if (isLandscape) {
      return containerSize.height > 0 ? (containerSize.height - (PILL_PADDING * 2)) / tabCount : 0;
    } else {
      return containerSize.width > 0 ? (containerSize.width - (PILL_PADDING * 2)) / tabCount : 0;
    }
  }, [containerSize, isLandscape, tabCount]);

  const pillWidth = isLandscape 
    ? LANDSCAPE_TAB_BAR_WIDTH - (PILL_PADDING * 2)
    : (tabSlotSize > 0 ? tabSlotSize : 74);

  const pillHeight = isLandscape 
    ? (tabSlotSize > 0 ? tabSlotSize : 52)
    : TAB_BAR_HEIGHT - (PILL_PADDING * 2);

  // アクティブタブ変更時のターゲット更新
  useEffect(() => {
    if (tabSlotSize > 0) {
      const nextTarget = activeIndex * tabSlotSize;
      targetPosRef.current = nextTarget;
      startPhysicsLoop();
    }
  }, [activeIndex, tabSlotSize]);

  // アイコンのアニメーション更新
  const updateIconHighlights = (closestIdx: number) => {
    tabs.forEach((_, i) => {
      if (iconScaleAnims[i]) {
        Animated.timing(iconScaleAnims[i], {
          toValue: i === closestIdx ? 1.08 : 1.0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    });
  };

  // 単一物理演算エンジン（HTML updatePhysics の完全移植）
  const updatePhysics = () => {
    const lerpRate = isDraggingRef.current ? DRAG_LERP : SNAP_LERP;
    
    currentPosRef.current += (targetPosRef.current - currentPosRef.current) * lerpRate;
    currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * SCALE_LERP;

    const scaleProgress = Math.max(0, Math.min(1, (currentScaleRef.current - 1.0) / (EXPANDED_SCALE - 1.0)));

    // 透明度＆プリズム光彩の補間
    const pillAlpha = 0.44 - (scaleProgress * 0.36);
    dynamicAlphaAnim.setValue(pillAlpha);
    prismOpacityAnim.setValue(Math.pow(scaleProgress, 2.0) * 0.45);

    // 移動中のみプカプカ揺動（Wobble）
    const dist = Math.abs(targetPosRef.current - currentPosRef.current);
    const scaleDiff = Math.abs(targetScaleRef.current - currentScaleRef.current);
    const isActuallyMoving = dist > 1.2;
    const targetWobble = isActuallyMoving ? 1.0 : 0.0;
    
    wobbleIntensityRef.current += (targetWobble - wobbleIntensityRef.current) * 0.18;

    let wobbleX = 0;
    let wobbleY = 0;
    let wobbleRotate = 0;

    if (wobbleIntensityRef.current > 0.005) {
      wobbleTimeRef.current += 0.14;
      wobbleY = Math.sin(wobbleTimeRef.current * 2.4) * (2.4 * wobbleIntensityRef.current);
      wobbleX = Math.cos(wobbleTimeRef.current * 1.8) * (1.6 * wobbleIntensityRef.current);
      wobbleRotate = Math.sin(wobbleTimeRef.current * 2.0) * (1.9 * wobbleIntensityRef.current);
    }

    pillPosAnim.setValue(currentPosRef.current);
    pillScaleAnim.setValue(currentScaleRef.current);
    pillWobbleXAnim.setValue(wobbleX);
    pillWobbleYAnim.setValue(wobbleY);
    pillWobbleRotateAnim.setValue(wobbleRotate);

    // タブバー全体の同期スケール連動
    const tabbarScale = 1.0 + scaleProgress * (TABBAR_MAX_SCALE - 1.0);
    tabbarScaleAnim.setValue(tabbarScale);

    if (tabSlotSize > 0) {
      const closest = Math.max(0, Math.min(tabCount - 1, Math.round(currentPosRef.current / tabSlotSize)));
      updateIconHighlights(closest);
    }

    if (isPointerDownRef.current || dist > 0.1 || scaleDiff > 0.005 || wobbleIntensityRef.current > 0.005) {
      animationFrameIdRef.current = requestAnimationFrame(updatePhysics);
    } else {
      currentPosRef.current = targetPosRef.current;
      currentScaleRef.current = targetScaleRef.current;
      wobbleIntensityRef.current = 0;
      pillPosAnim.setValue(currentPosRef.current);
      pillScaleAnim.setValue(currentScaleRef.current);
      pillWobbleXAnim.setValue(0);
      pillWobbleYAnim.setValue(0);
      pillWobbleRotateAnim.setValue(0);
      tabbarScaleAnim.setValue(targetScaleRef.current === 1.0 ? 1.0 : TABBAR_MAX_SCALE);
      animationFrameIdRef.current = null;
    }
  };

  const startPhysicsLoop = () => {
    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(updatePhysics);
    }
  };

  const getClosestIndexFromCoord = (coord: number): number => {
    if (tabSlotSize <= 0) return 0;
    const rel = coord - PILL_PADDING;
    const idx = Math.round((rel - (tabSlotSize / 2)) / tabSlotSize);
    return Math.max(0, Math.min(tabCount - 1, idx));
  };

  const getPillPosFromCoord = (coord: number): number => {
    if (tabSlotSize <= 0) return 0;
    const rel = coord - PILL_PADDING;
    const rawPos = rel - (tabSlotSize / 2);
    const maxPos = (tabCount - 1) * tabSlotSize;
    return Math.max(0, Math.min(maxPos, rawPos));
  };

  // PanResponder によるドラッグ＆タップの完全捕捉
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
      onPanResponderGrant: (evt) => {
        isPointerDownRef.current = true;
        isDraggingRef.current = false;
        
        const { locationX, locationY } = evt.nativeEvent;
        setTouchCoords({ x: locationX, y: locationY });

        const coord = isLandscape ? locationY : locationX;
        const targetIdx = getClosestIndexFromCoord(coord);

        targetPosRef.current = targetIdx * tabSlotSize;
        targetScaleRef.current = EXPANDED_SCALE;
        setActiveTab(tabs[targetIdx].key);
        startPhysicsLoop();
      },
      onPanResponderMove: (evt, gesture) => {
        const { locationX, locationY } = evt.nativeEvent;
        setTouchCoords({ x: locationX, y: locationY });

        const moveDist = isLandscape ? Math.abs(gesture.dy) : Math.abs(gesture.dx);
        if (moveDist > 4) {
          isDraggingRef.current = true;
          const coord = isLandscape ? locationY : locationX;
          targetPosRef.current = getPillPosFromCoord(coord);
          targetScaleRef.current = EXPANDED_SCALE;
          startPhysicsLoop();
        }
      },
      onPanResponderRelease: (evt) => {
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        setTouchCoords(null);

        const { locationX, locationY } = evt.nativeEvent;
        const coord = isLandscape ? locationY : locationX;
        const finalIdx = getClosestIndexFromCoord(coord);

        targetPosRef.current = finalIdx * tabSlotSize;
        targetScaleRef.current = 1.0;
        setActiveTab(tabs[finalIdx].key);
        startPhysicsLoop();
      },
      onPanResponderTerminate: () => {
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        setTouchCoords(null);
        targetScaleRef.current = 1.0;
        startPhysicsLoop();
      },
    })
  ).current;

  // ピル変形スタイル
  const pillTransform = isLandscape ? [
    { translateY: Animated.add(pillPosAnim, pillWobbleYAnim) },
    { translateX: pillWobbleXAnim },
    { scale: pillScaleAnim },
    { rotate: pillWobbleRotateAnim.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] }) }
  ] : [
    { translateX: Animated.add(pillPosAnim, pillWobbleXAnim) },
    { translateY: pillWobbleYAnim },
    { scale: pillScaleAnim },
    { rotate: pillWobbleRotateAnim.interpolate({ inputRange: [-5, 5], outputRange: ['-5deg', '5deg'] }) }
  ];

  return (
    <Animated.View 
      style={[
        isLandscape ? styles.tabBarContainerLandscape : styles.tabBarContainer,
        {
          transform: [{ scale: tabbarScaleAnim }],
          backgroundColor: isDark ? 'rgba(20, 20, 25, 0.45)' : 'rgba(255, 255, 255, 0.24)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.65)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: isDark ? 0.45 : 0.18,
          shadowRadius: 28,
          elevation: 12,
        }
      ]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setContainerSize({ width: w, height: h });
      }}
      {...panResponder.panHandlers}
    >
      <BlurView 
        intensity={Platform.OS === 'ios' ? 70 : 100} 
        tint={isDark ? 'dark' : 'light'} 
        style={StyleSheet.absoluteFill} 
      />

      {/* 1. ガラス内部の環境光（指位置追従 Specular Glow） */}
      {touchCoords && (
        <View 
          pointerEvents="none" 
          style={[
            s.specularGlow, 
            { 
              left: touchCoords.x - 50, 
              top: touchCoords.y - 50 
            }
          ]} 
        />
      )}

      {/* 2. ガラス天面のインナーハイライト光沢境界線 */}
      <View pointerEvents="none" style={s.topEdgeHighlight} />

      {/* 3. Liquid Active Pill（タブカーソル本体） */}
      {tabSlotSize > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.activePillBase,
            {
              width: pillWidth,
              height: pillHeight,
              borderRadius: Math.min(pillWidth, pillHeight) / 2,
              top: PILL_PADDING,
              left: PILL_PADDING,
              transform: pillTransform,
              backgroundColor: isDark 
                ? dynamicAlphaAnim.interpolate({ inputRange: [0.08, 0.44], outputRange: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.22)'] })
                : dynamicAlphaAnim.interpolate({ inputRange: [0.08, 0.44], outputRange: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.52)'] }),
              borderColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.85)',
            }
          ]}
        >
          {/* 微細なプリズム光彩レイヤー */}
          <Animated.View 
            style={[
              StyleSheet.absoluteFill, 
              s.prismBorder, 
              { opacity: prismOpacityAnim, borderRadius: Math.min(pillWidth, pillHeight) / 2 }
            ]}
          >
            <LinearGradient
              colors={['rgba(255,80,120,0.5)', 'rgba(255,180,50,0.4)', 'rgba(0,240,255,0.5)', 'rgba(80,255,140,0.4)', 'rgba(255,90,240,0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: Math.min(pillWidth, pillHeight) / 2 }]}
            />
          </Animated.View>

          {/* ピル内部のインナーベベル（厚みと光沢フチ） */}
          <View 
            style={[
              s.pillInnerBevel, 
              { borderRadius: Math.min(pillWidth, pillHeight) / 2 }
            ]} 
          />
        </Animated.View>
      )}

      {/* 4. 各タブアイテム */}
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.key;
        const iconScale = iconScaleAnims[idx] || 1.0;

        return (
          <View
            key={tab.key}
            pointerEvents="none"
            style={[
              isLandscape ? styles.tabItemLandscape : styles.tabItem,
              { width: isLandscape ? '100%' : tabSlotSize, height: isLandscape ? tabSlotSize : '100%' }
            ]}
          >
            <Animated.View
              style={{
                transform: [
                  { scale: iconScale },
                  { translateY: isActive ? -1.5 : 0 }
                ],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={22} 
                color={isActive ? textColor : (isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.45)')} 
              />
            </Animated.View>

            <Text
              style={[
                isLandscape ? styles.tabTextLandscape : styles.tabText,
                {
                  color: isActive ? textColor : (isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.45)'),
                  fontWeight: isActive ? '700' : '500',
                  marginTop: 3,
                }
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
};

const s = StyleSheet.create({
  specularGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    transform: [{ scale: 1.2 }],
    opacity: 0.8,
  },
  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.80)',
    borderRadius: 0.5,
  },
  activePillBase: {
    position: 'absolute',
    borderWidth: 0.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 14,
    elevation: 8,
  },
  prismBorder: {
    padding: 1.5,
  },
  pillInnerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.70)',
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
});