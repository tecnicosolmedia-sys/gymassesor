import { useState, useEffect, useRef } from 'react';
import splashVideo from '@/assets/splash-animation.mp4';

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number; // Duración mínima en ms
}

export const SplashScreen = ({ onComplete, minDuration = 2500 }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasCompleted = useRef(false);

  const handleComplete = () => {
    if (hasCompleted.current) return;
    hasCompleted.current = true;
    
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 500); // Duración del fade out
  };

  useEffect(() => {
    // Tiempo mínimo de visualización
    const minTimer = setTimeout(() => {
      // Si el video ya terminó o no está reproduciéndose, completar
      if (videoRef.current?.ended || videoRef.current?.paused) {
        handleComplete();
      }
    }, minDuration);

    // Timeout máximo de seguridad (5 segundos)
    const maxTimer = setTimeout(() => {
      handleComplete();
    }, 5000);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
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
