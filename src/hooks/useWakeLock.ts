import { useState, useEffect, useCallback, useRef } from 'react';

export const useWakeLock = (enabled: boolean = true) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !enabled) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });

      console.log('Wake Lock activado - pantalla no se suspenderá');
    } catch (err) {
      console.log('Wake Lock no disponible:', err);
      setIsActive(false);
    }
  }, [isSupported, enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('Wake Lock liberado');
      } catch (err) {
        console.log('Error al liberar Wake Lock:', err);
      }
    }
  }, []);

  // Solicitar wake lock al montar y cuando la página vuelve a ser visible
  useEffect(() => {
    if (!enabled) {
      releaseWakeLock();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    // Solicitar al montar
    requestWakeLock();

    // Re-solicitar cuando la página vuelve a ser visible
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  };
};
