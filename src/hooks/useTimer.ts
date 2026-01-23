import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerProps {
  initialTime: number;
  onComplete?: () => void;
  autoStart?: boolean;
}

export const useTimer = ({ initialTime, onComplete, autoStart = false }: UseTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isComplete, setIsComplete] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasPlayedRef = useRef<Set<number>>(new Set());

  const playBeep = useCallback((frequency: number = 800, duration: number = 200) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  const playFinalBeep = useCallback(() => {
    playBeep(1000, 500);
  }, [playBeep]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          
          // Countdown beeps for 3, 2, 1
          if (newTime <= 3 && newTime > 0 && !hasPlayedRef.current.has(newTime)) {
            hasPlayedRef.current.add(newTime);
            playBeep(600 + (3 - newTime) * 100, 150);
          }
          
          // Final beep at 0
          if (newTime === 0 && !hasPlayedRef.current.has(0)) {
            hasPlayedRef.current.add(0);
            playFinalBeep();
            setIsComplete(true);
            setIsRunning(false);
            onComplete?.();
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, onComplete, playBeep, playFinalBeep]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
    setIsRunning(false);
    setIsComplete(false);
    hasPlayedRef.current.clear();
  }, [initialTime]);

  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  return {
    timeLeft,
    isRunning,
    isComplete,
    start,
    pause,
    reset,
    toggle,
    setTimeLeft,
  };
};
