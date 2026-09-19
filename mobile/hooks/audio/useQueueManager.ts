import { useState, useRef, useEffect } from 'react';
import { LoopModeType } from './types';

export const useQueueManager = () => {
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [playQueue, setPlayQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopModeType>('OFF');
  const [isShuffle, setIsShuffle] = useState(false);

  const originalQueueRef = useRef<any[]>([]);
  const activeQueueRef = useRef<any[]>([]);
  const queueRef = useRef<any[]>([]);
  const currentSongRef = useRef<any>(null);
  const indexRef = useRef<number>(0);
  const loopRef = useRef<LoopModeType>('OFF');
  const shuffleRef = useRef<boolean>(false);

  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { queueRef.current = playQueue; }, [playQueue]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { loopRef.current = loopMode; }, [loopMode]);
  useEffect(() => { shuffleRef.current = isShuffle; }, [isShuffle]);

  const rebuildActiveQueue = (forceShuffle: boolean, song: any) => {
    if (!song || originalQueueRef.current.length === 0) return [];
    if (forceShuffle) {
      const remaining = originalQueueRef.current.filter((s) => s.localMusicUri !== song.localMusicUri);
      return [song, ...remaining.sort(() => Math.random() - 0.5)];
    } else {
      return [...originalQueueRef.current];
    }
  };

  const updateQueueIndexes = (targetIndex: number, newActiveQueue: any[]) => {
    const appQueue = newActiveQueue.slice(targetIndex + 1);
    setPlayQueue(appQueue);
    queueRef.current = appQueue;
    setCurrentIndex(targetIndex);
    indexRef.current = targetIndex;
  };

  return {
    currentSong,
    setCurrentSong,
    playQueue,
    setPlayQueue,
    currentIndex,
    setCurrentIndex,
    loopMode,
    setLoopMode,
    isShuffle,
    setIsShuffle,
    originalQueueRef,
    activeQueueRef,
    queueRef,
    currentSongRef,
    indexRef,
    loopRef,
    shuffleRef,
    rebuildActiveQueue,
    updateQueueIndexes,
  };
};