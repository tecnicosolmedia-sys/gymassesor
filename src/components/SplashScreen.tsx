import { useState, useEffect, useRef } from 'react';
import splashVideo from '@/assets/splash-animation.mp4';
import epicIntroSound from '@/assets/epic-intro.mp3';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number; // Duración mínima en ms
}

export const SplashScreen = ({ onComplete, minDuration = 2500 }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasCompleted = useRef(false);

  const handleComplete = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    
    // Fade out audio
    if (audioRef.current) {
      const audio = audioRef.current;
      const fadeOut = setInterval(() => {
        if (audio.volume > 0.1) {
          audio.volume = Math.max(0, audio.volume - 0.1);
        } else {
          audio.volume = 0;
          audio.pause();
          clearInterval(fadeOut);
        }
      }, 50);
    }
    
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 500);
  };

  useEffect(() => {
    // Play epic intro sound
    if (audioRef.current) {
      audioRef.current.volume = 0.7;
      audioRef.current.play().catch(() => {
        // Autoplay blocked by browser - silently ignore
      });
    }

    // Tiempo mínimo de visualización
    const minTimer = setTimeout(() => {
      if (videoRef.current?.ended || videoRef.current?.paused) {
        handleComplete();
      }
    }, minDuration);

    const maxTimer = setTimeout(() => {
      handleComplete();
    }, 5000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [minDuration]);

  const handleVideoEnd = () => {
    // Solo completar si ya pasó el tiempo mínimo
    setTimeout(() => {
      handleComplete();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] bg-background flex items-center justify-center transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="w-full h-full flex items-center justify-center p-4">
        <audio ref={audioRef} src={epicIntroSound} preload="auto" />
        <video
          ref={videoRef}
          src={splashVideo}
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnd}
          className="max-w-full max-h-full object-contain"
          style={{ maxWidth: '400px', maxHeight: '400px' }}
        />
      </div>
    </div>
  );
};
