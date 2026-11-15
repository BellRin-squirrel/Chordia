import TrackPlayer, { Event } from 'react-native-track-player';

const safeAddListener = (eventName: any, listener: (event: any) => void) => {
  if (!eventName || typeof eventName !== 'string') return;
  try {
    TrackPlayer.addEventListener(eventName, listener);
  } catch (e) {}
};

// ロック画面やイヤホンからの操作をハンドリングするサービス
module.exports = async function() {
  safeAddListener(Event.RemotePlay, () => TrackPlayer.play());
  safeAddListener(Event.RemotePause, () => TrackPlayer.pause());
  safeAddListener(Event.RemoteStop, () => TrackPlayer.stop());
  safeAddListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  safeAddListener(Event.RemotePrevious, async () => {
    try {
      const position = await TrackPlayer.getPosition();
      if (typeof position === 'number' && position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (e) {
      await TrackPlayer.skipToPrevious();
    }
  });
  safeAddListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
};