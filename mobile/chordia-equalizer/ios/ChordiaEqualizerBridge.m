#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ChordiaEqualizer, NSObject)

RCT_EXTERN_METHOD(initEqualizer:(NSInteger)audioSessionId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setEnabled:(BOOL)enabled)
RCT_EXTERN_METHOD(setBands:(NSArray *)gains preamp:(double)preamp)
RCT_EXTERN_METHOD(applySettings:(BOOL)enabled preamp:(double)preamp gains:(NSArray *)gains)
RCT_EXTERN_METHOD(loadAndPlay:(NSString *)filePath startSeconds:(double)startSeconds autoPlay:(BOOL)autoPlay resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(pause:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(play:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(seekTo:(double)seconds resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getPosition:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getDuration:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isPlaying:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getDebugInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end