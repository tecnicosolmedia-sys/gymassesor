import { useCallback, useRef, useEffect } from 'react';
import recordSound from '@/assets/personal-record.mp3';

export const usePersonalRecordSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(recordSound);
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 0.9;
  }, []);

  const playRecord = useCallback(() => {
    try {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      void a.play();
    } catch {
      // ignore
    }
  }, []);

  return playRecord;
};
