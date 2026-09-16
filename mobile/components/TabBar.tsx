import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  View, Text, Animated, StyleSheet, useWindowDimensions, 
  PanResponder, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { styles, TAB_BAR_HEIGHT, LANDSCAPE_TAB_BAR_WIDTH } from '../styles/styles';
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
const DRAG_THRESHOLD = 5;

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

  const containerRef = useRef<View>(null);

  const tabs = useMemo(() => [
    ...(showSyncTab !== false ? [{ key: 'SYNC', label: t('tab_sync', language), icon: 'cloud-download' }] : []),
    { key: 'PLAYER', label: t('tab_player', language), icon: 'play-circle' },
    ...(showFocusTab ? [{ key: 'FOCUS', label: t('tab_focus', language), icon: 'timer' }] : []),
    { key: 'INFO', label: t('tab_info', language), icon: 'information-circle' }
  ], [showSyncTab, showFocusTab, language]);

  const tabCount = tabs.length;

  const barMetricsRef = useRef({ pageX: 0, pageY: 0, width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ 
    width: isLandscape ? LANDSCAPE_TAB_BAR_WIDTH : Math.min(width - 32, 800), 
    height: isLandscape ? 400 : TAB_BAR_HEIGHT 
  });

  const currentPosRef = useRef(0);
  const prevPosRef = useRef(0);
  const targetPosRef = useRef(0);
  const currentScaleRef = useRef(1.0);
  const targetScaleRef = useRef(1.0);
  const isDraggingRef = useRef(false);
  const isPointerDownRef = useRef(false);
  const startCoordRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  const wobbleTimeRef = useRef(0);
  const wobbleIntensityRef = useRef(0);

  const pillPosAnim = useRef(new Animated.Value(0)).current;
  const pillScaleAnim = useRef(new Animated.Value(1.0)).current;
  const pillWobbleXAnim = useRef(new Animated.Value(0)).current;
  const pillWobbleYAnim = useRef(new Animated.Value(0)).current;
  const pillWobbleRotateAnim = useRef(new Animated.Value(0)).current;
  const tabbarScaleAnim = useRef(new Animated.Value(1.0)).current;
  const prismOpacityAnim = useRef(new Animated.Value(0)).current;

  const iconScaleAnims = useRef(tabs.map(() => new Animated.Value(1.0))).current;

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.key === activeTab);
    return idx >= 0 ? idx : 0;
  }, [activeTab, tabs]);

  const tabSlotSize = useMemo(() => {
    const totalSpan = isLandscape ? containerSize.height : containerSize.width;
    const usableSpan = Math.max(0, totalSpan - (PILL_PADDING * 2));
    return tabCount > 0 ? usableSpan / tabCount : 0;
  }, [containerSize, isLandscape, tabCount]);

  const pillWidth = isLandscape 
    ? LANDSCAPE_TAB_BAR_WIDTH - (PILL_PADDING * 2)
    : (tabSlotSize > 0 ? tabSlotSize : 74);

  const pillHeight = isLandscape 
    ? (tabSlotSize > 0 ? tabSlotSize : 52)
    : TAB_BAR_HEIGHT - (PILL_PADDING * 2);

  const measureBar = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          barMetricsRef.current = { pageX: x, pageY: y, width: w, height: h };
          setContainerSize({ width: w, height: h });
        }
      });
    }
  }, []);

  const updateIconHighlights = useCallback((closestIdx: number) => {
    tabs.forEach((_, i) => {
      if (iconScaleAnims[i]) {
        Animated.timing(iconScaleAnims[i], {
          toValue: i === closestIdx ? 1.08 : 1.0,
          duration: 160,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [tabs, iconScaleAnims]);

  // ★ 速度感応型プカプカ物理演算
  const updatePhysics = useCallback(() => {
    const lerpRate = isDraggingRef.current ? DRAG_LERP : SNAP_LERP;
    
    currentPosRef.current += (targetPosRef.current - currentPosRef.current) * lerpRate;
    currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * SCALE_LERP;

    const instantVelocity = Math.abs(currentPosRef.current - prevPosRef.current);
    prevPosRef.current = currentPosRef.current;

    const scaleProgress = Math.max(0, Math.min(1, (currentScaleRef.current - 1.0) / (EXPANDED_SCALE - 1.0)));
    prismOpacityAnim.setValue(Math.pow(scaleProgress, 2.0) * 0.12);

    const targetWobble = instantVelocity > 0.20 
      ? Math.min(Math.pow(instantVelocity / 5.5, 0.85), 1.5)
      : 0.0;
    
    wobbleIntensityRef.current += (targetWobble - wobbleIntensityRef.current) * 0.20;

    let wobbleX = 0;
    let wobbleY = 0;
    let wobbleRotate = 0;

    if (wobbleIntensityRef.current > 0.005) {
      const freqStep = 0.11 + Math.min(instantVelocity * 0.008, 0.12);
      wobbleTimeRef.current += freqStep;

      wobbleY = Math.sin(wobbleTimeRef.current * 2.3) * (2.1 * wobbleIntensityRef.current);
      wobbleX = Math.cos(wobbleTimeRef.current * 1.7) * (1.3 * wobbleIntensityRef.current);
      wobbleRotate = Math.sin(wobbleTimeRef.current * 1.9) * (1.3 * wobbleIntensityRef.current);
    }

    pillPosAnim.setValue(currentPosRef.current);
    pillScaleAnim.setValue(currentScaleRef.current);
    pillWobbleXAnim.setValue(wobbleX);
    pillWobbleYAnim.setValue(wobbleY);
    pillWobbleRotateAnim.setValue(wobbleRotate);

    const tabbarScale = 1.0 + scaleProgress * (TABBAR_MAX_SCALE - 1.0);
    tabbarScaleAnim.setValue(tabbarScale);

    if (tabSlotSize > 0) {
      const closest = Math.max(0, Math.min(tabCount - 1, Math.round(currentPosRef.current / tabSlotSize)));
      updateIconHighlights(closest);
    }

    const dist = Math.abs(targetPosRef.current - currentPosRef.current);
    const scaleDiff = Math.abs(targetScaleRef.current - currentScaleRef.current);

    if (isPointerDownRef.current || dist > 0.1 || scaleDiff > 0.005 || wobbleIntensityRef.current > 0.005) {
      animationFrameIdRef.current = requestAnimationFrame(updatePhysics);
    } else {
      currentPosRef.current = targetPosRef.current;
      prevPosRef.current = targetPosRef.current;
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
  }, [tabSlotSize, tabCount, updateIconHighlights, pillPosAnim, pillScaleAnim, pillWobbleXAnim, pillWobbleYAnim, pillWobbleRotateAnim, tabbarScaleAnim, prismOpacityAnim]);

  const startPhysicsLoop = useCallback(() => {
    if (!animationFrameIdRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(updatePhysics);
    }
  }, [updatePhysics]);

  useEffect(() => {
    if (tabSlotSize > 0) {
      const nextTarget = activeIndex * tabSlotSize;
      targetPosRef.current = nextTarget;
      startPhysicsLoop();
    }
  }, [activeIndex, tabSlotSize, startPhysicsLoop]);

  const getRelativeCoord = useCallback((evt: any) => {
    const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
    if (isLandscape) {
      if (barMetricsRef.current.height > 0 && barMetricsRef.current.pageY > 0) {
        return pageY - barMetricsRef.current.pageY;
      }
      return locationY;
    } else {
      if (barMetricsRef.current.width > 0 && barMetricsRef.current.pageX > 0) {
        return pageX - barMetricsRef.current.pageX;
      }
      return locationX;
    }
  }, [isLandscape]);

  const getClosestIndexFromRelative = useCallback((rel: number): number => {
    if (tabSlotSize <= 0) return 0;
    const innerCoord = rel - PILL_PADDING;
    const idx = Math.floor(innerCoord / tabSlotSize);
    return Math.max(0, Math.min(tabCount - 1, idx));
  }, [tabSlotSize, tabCount]);

  const getPillPosFromRelative = useCallback((rel: number): number => {
    if (tabSlotSize <= 0) return 0;
    const innerCoord = rel - PILL_PADDING;
    const rawPos = innerCoord - (tabSlotSize / 2);
    const maxPos = (tabCount - 1) * tabSlotSize;
    return Math.max(0, Math.min(maxPos, rawPos));
  }, [tabSlotSize, tabCount]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        isPointerDownRef.current = true;
        isDraggingRef.current = false;
        measureBar();

        const rel = getRelativeCoord(evt);
        startCoordRef.current = rel;

        const targetIdx = getClosestIndexFromRelative(rel);
        targetPosRef.current = targetIdx * tabSlotSize;
        targetScaleRef.current = EXPANDED_SCALE;

        if (tabs[targetIdx]) {
          setActiveTab(tabs[targetIdx].key);
        }
        startPhysicsLoop();
      },

      onPanResponderMove: (evt) => {
        const rel = getRelativeCoord(evt);
        const moveDist = Math.abs(rel - startCoordRef.current);

        if (moveDist > DRAG_THRESHOLD) {
          isDraggingRef.current = true;
          targetPosRef.current = getPillPosFromRelative(rel);
          targetScaleRef.current = EXPANDED_SCALE;
          startPhysicsLoop();
        }
      },

      onPanResponderRelease: (evt) => {
        isPointerDownRef.current = false;

        const rel = getRelativeCoord(evt);
        const finalIdx = getClosestIndexFromRelative(rel);

        targetPosRef.current = finalIdx * tabSlotSize;
        targetScaleRef.current = 1.0;
        isDraggingRef.current = false;

        if (tabs[finalIdx]) {
          setActiveTab(tabs[finalIdx].key);
        }
        startPhysicsLoop();
      },

      onPanResponderTerminate: () => {
        isPointerDownRef.current = false;
        isDraggingRef.current = false;
        targetScaleRef.current = 1.0;
        startPhysicsLoop();
      },
    })
  ).current;

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

  const pillRadius = Math.min(pillWidth, pillHeight) / 2;

  return (
    <Animated.View 
      ref={containerRef}
      style={[
        isLandscape ? styles.tabBarContainerLandscape : styles.tabBarContainer,
        {
          transform: [{ scale: tabbarScaleAnim }],
          overflow: 'visible',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: isDark ? 0.45 : 0.16,
          shadowRadius: 26,
          elevation: 12,
        }
      ]}
      onLayout={() => measureBar()}
      {...panResponder.panHandlers}
    >
      {/* 1. タブバー本体のすりガラス背景 */}
      <View 
        pointerEvents="none" 
        style={[
          StyleSheet.absoluteFill, 
          {
            borderRadius: 40, 
            overflow: 'hidden',
            backgroundColor: isDark 
              ? 'rgba(20, 20, 25, 0.55)' 
              : 'rgba(25, 25, 30, 0.085)',
            borderWidth: 1,
            borderColor: isDark 
              ? 'rgba(255, 255, 255, 0.22)' 
              : 'rgba(0, 0, 0, 0.12)',
          }
        ]}
      >
        <BlurView 
          intensity={Platform.OS === 'ios' ? 65 : 95} 
          tint={isDark ? 'dark' : 'light'} 
          style={StyleSheet.absoluteFill} 
        />
        
        {/* ガラス天面のインナーハイライト光沢境界線 */}
        <View style={s.topEdgeHighlight} />
      </View>

      {/* 2. Liquid Active Pill（タブカーソル本体） */}
      {tabSlotSize > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.activePillBase,
            {
              width: pillWidth,
              height: pillHeight,
              borderRadius: pillRadius,
              top: PILL_PADDING,
              left: PILL_PADDING,
              transform: pillTransform,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.40)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.95)',
            }
          ]}
        >
          {/* 白光沢主体の淡いクリスタル光彩レイヤー */}
          <Animated.View 
            style={[
              StyleSheet.absoluteFill, 
              s.prismBorder, 
              { opacity: prismOpacityAnim, borderRadius: pillRadius }
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.4)',
                'rgba(0,240,255,0.08)',
                'rgba(255,255,255,0.6)',
                'rgba(255,120,180,0.08)',
                'rgba(255,255,255,0.4)'
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: pillRadius }]}
            />
          </Animated.View>

          {/* ピル内部のインナーベベル（厚みとクリアな光沢フチ） */}
          <View 
            style={[
              s.pillInnerBevel, 
              { borderRadius: pillRadius }
            ]} 
          />
        </Animated.View>
      )}

      {/* 3. 各タブアイテム（★アクティブ時は themeColor を適用） */}
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.key;
        const iconScale = iconScaleAnims[idx] || 1.0;
        const tabItemColor = isActive 
          ? themeColor 
          : (isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.58)');

        return (
          <View
            key={tab.key}
            pointerEvents="none"
            style={[
              isLandscape ? styles.tabItemLandscape : styles.tabItem,
              { 
                width: isLandscape ? '100%' : tabSlotSize, 
                height: isLandscape ? tabSlotSize : '100%',
                zIndex: 2,
              }
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
                color={tabItemColor} 
              />
            </Animated.View>

            <Text
              style={[
                isLandscape ? styles.tabTextLandscape : styles.tabText,
                {
                  color: tabItemColor,
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
  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 0.5,
  },
  activePillBase: {
    position: 'absolute',
    borderWidth: 0.5,
    overflow: 'hidden',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 15,
  },
  prismBorder: {
    padding: 1.5,
  },
  pillInnerBevel: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
  },
});