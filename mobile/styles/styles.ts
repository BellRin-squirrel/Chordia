import { StyleSheet } from 'react-native';

const SIDE_MARGIN = 16;
export const TAB_BAR_HEIGHT = 58;
const MINI_PLAYER_HEIGHT = 58;
export const LANDSCAPE_TAB_BAR_WIDTH = 70;

export const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  navHeader: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 15, zIndex: 10 },
  navHeaderLeft: { width: 60, justifyContent: 'center', alignItems: 'flex-start' },
  navHeaderRight: { width: 60 },
  navHeaderTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },

  liquidGlassBackButton: { 
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', 
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3
  },

  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  menuIcon: { marginRight: 20 },
  menuRowTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  
  albumGridItem: { flex: 1, margin: 5, marginBottom: 15, maxWidth: '48%' },
  albumGridImage: { width: '100%', aspectRatio: 1, borderRadius: 10, marginBottom: 8 },
  albumGridTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  albumGridArtist: { fontSize: 12 },
  
  recentContainer: { marginTop: 30 },
  recentHeader: { fontSize: 22, fontWeight: 'bold', marginLeft: 20, marginBottom: 15 },
  recentSongItem: { width: 120, marginRight: 10 },
  recentSongImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8 },
  recentSongTitle: { fontSize: 14, fontWeight: '600' },
  recentSongArtist: { fontSize: 12 },
  
  plHero: { alignItems: 'center', paddingBottom: 30, paddingTop: 10 },
  plHeroArt: { width: 220, height: 220, borderRadius: 12, shadowOpacity: 0.3, shadowRadius: 10 },
  plHeroTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 15, textAlign: 'center', paddingHorizontal: 20 },
  plHeroSub: { fontSize: 16, marginTop: 5, textAlign: 'center', paddingHorizontal: 20 },
  plHeroButtons: { flexDirection: 'row', marginTop: 20, gap: 15, width: '100%', paddingHorizontal: 20, maxWidth: 600, alignSelf: 'center' },
  
  plMainBtn: { 
    flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  
  plMainBtnText: { fontSize: 16, fontWeight: 'bold' },
  syncCard: { padding: 20, borderRadius: 16 },
  input: { padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 16 },
  
  smallBtn: { 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  checkRow: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  rowTitle: { marginLeft: 15, fontWeight: '600', flex: 1 },
  playlistIconArt: { width: 70, height: 70, borderRadius: 10 },
  songRow: { flexDirection: 'row', padding: 12, paddingHorizontal: 20, alignItems: 'center' },
  smallArt: { width: 48, height: 48, borderRadius: 8, marginRight: 15 },
  songTitle: { fontSize: 16, fontWeight: '600' },
  songSub: { fontSize: 13, marginTop: 2 },
  
  commonWrapperPortrait: {
    position: 'absolute',
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },

  tabBarWrapper: { 
    position: 'absolute', left: SIDE_MARGIN, right: SIDE_MARGIN, alignItems: 'center' 
  },
  tabBarContainer: { 
    width: '100%', maxWidth: 800, height: TAB_BAR_HEIGHT, 
    borderRadius: 29, 
    flexDirection: 'row', overflow: 'hidden', 
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10
  },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tabText: { fontSize: 10, fontWeight: 'bold', marginTop: 2 },

  tabBarWrapperLandscape: { 
    position: 'absolute', right: SIDE_MARGIN, top: SIDE_MARGIN, bottom: SIDE_MARGIN, 
    width: LANDSCAPE_TAB_BAR_WIDTH, justifyContent: 'center' 
  },
  tabBarContainerLandscape: { 
    width: '100%', height: '100%', maxHeight: 400,
    borderRadius: 35, 
    flexDirection: 'column', overflow: 'hidden', 
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10
  },
  tabItemLandscape: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1, paddingVertical: 10 },
  tabTextLandscape: { fontSize: 9, fontWeight: 'bold', marginTop: 4 },

  miniPlayerPosLandscape: {
    position: 'absolute',
    left: SIDE_MARGIN,
    height: MINI_PLAYER_HEIGHT,
  },

  miniPlayerCard: { 
    width: '100%',
    maxWidth: 800,
    height: MINI_PLAYER_HEIGHT,
    borderRadius: 29, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  
  miniPlayerBlur: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  miniArt: { width: 38, height: 38, borderRadius: 5 },
  miniInfo: { flex: 1, marginLeft: 12 },
  miniTitle: { fontSize: 14, fontWeight: 'bold' },
  miniArtist: { fontSize: 12 },
  miniControls: { flexDirection: 'row', alignItems: 'center' },
  miniBtn: { padding: 8 },
  fullScreenModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  fullScreenModalContent: { paddingHorizontal: 40, paddingVertical: 30, borderRadius: 20, alignItems: 'center', minWidth: 200 },
  fullScreenModalText: { marginTop: 20, fontSize: 16, fontWeight: '600' },
  fullPlayerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  fullPlayerContainer: { position: 'absolute', top: 50, left: 0, right: 0, bottom: 0, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },
  fullPlayerContent: { flex: 1, padding: 25, paddingBottom: 40 },
  swipeArea: { width: '100%', height: 60, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fullPlayerHandle: { width: 40, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
  fullHeaderContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', minHeight: 60, marginBottom: 10 },
  fullArtBase: { backgroundColor: '#333' },
  sideTitleArea: { marginLeft: 15, flex: 1 },
  queueTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  queueArtist: { color: '#aaa', fontSize: 14, marginTop: 2 },
  fullMainContentArea: { flex: 1, width: '100%' },
  mainPlaybackLayout: { flex: 1, justifyContent: 'space-around', alignItems: 'center' },
  mainTitlesCenter: { alignItems: 'center' },
  fullTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#fff', paddingHorizontal: 10 },
  fullArtist: { fontSize: 18, marginTop: 5, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  sliderWithTime: { width: '100%', alignItems: 'center' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: -5 },
  timeLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  fullControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', width: '100%' },
  queueViewArea: { flex: 1, width: '100%', marginTop: 10 },
  queueTogglesWrapper: { flexDirection: 'row', width: '100%', height: 44, borderRadius: 22, overflow: 'hidden', marginBottom: 20 },
  toggleBtnSplit: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  toggleLeft: { borderTopLeftRadius: 22, borderBottomLeftRadius: 22 },
  toggleRight: { borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  toggleDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  oneBadgeInline: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 4, marginTop: -4 },
  songRowQueue: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  smallArtQueue: { width: 45, height: 45, borderRadius: 4, marginRight: 15 },
  queueFooter: { padding: 30, alignItems: 'center' },
  bottomButtonsRow: { flexDirection: 'row', width: '100%', marginTop: 10 },
  bottomButtonContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lyricsScrollView: { flex: 1 },
  lyricsText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 18, fontWeight: 'bold', lineHeight: 30, textAlign: 'left' },
  toastContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, alignItems: 'center', zIndex: 9999 },
  toastBlur: { borderRadius: 20, overflow: 'hidden' },
  toastText: { color: '#fff', paddingHorizontal: 20, paddingVertical: 10, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  licenseCard: { width: '100%', padding: 30, borderRadius: 24, alignItems: 'center', maxWidth: 400 },
  appNameLabel: { fontSize: 20, fontWeight: 'bold' },
  appVersionLabel: { fontSize: 16, color: '#8e8e93' },
  divider: { width: 40, height: 2, marginVertical: 20 },
  copyrightLabel: { fontSize: 15, fontWeight: '600' },
  syncFooterContainer: { padding: 20, gap: 12, paddingBottom: 100, maxWidth: 600, alignSelf: 'center', width: '100%' },
  
  syncActionBtn: { 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowOpacity: 0.1, 
    shadowRadius: 5, 
    elevation: 2 
  },
  syncActionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  colorPreset: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  rgbModalContent: { width: '85%', maxWidth: 400, padding: 25, borderRadius: 25, overflow: 'hidden' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  rgbPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  colorBoxBig: { width: 60, height: 60, borderRadius: 30 },
  rgbText: { fontSize: 16, fontWeight: 'bold' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sliderLabel: { width: 30, fontWeight: 'bold' },
  subLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  recentRow: { flexDirection: 'row', gap: 10 },
  recentCircle: { width: 35, height: 35, borderRadius: 18 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 30, gap: 15 },
  modalBtnCancel: { padding: 10 },
  modalBtnApply: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },

  // ★ 修正: より高級感と視認性を高めたLiquid Glassアラート用スタイル
  liquidAlertBox: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 28,
    paddingTop: 28,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 15,
  },
  liquidAlertTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    letterSpacing: 0.5,
  },
  liquidAlertMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
    lineHeight: 20,
    fontWeight: '500',
  },
  liquidAlertButtonGroup: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liquidAlertButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liquidAlertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});