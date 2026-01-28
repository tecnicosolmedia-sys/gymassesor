import { useState, useEffect, useCallback, useRef } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  tag: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export const useWorkoutNotification = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const notificationRef = useRef<Notification | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supported = 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (err) {
      console.log('Error requesting notification permission:', err);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') return null;

    // Cerrar notificación anterior con el mismo tag
    if (notificationRef.current) {
      notificationRef.current.close();
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        tag: options.tag,
        icon: '/logo.png',
        badge: '/logo.png',
        requireInteraction: options.requireInteraction ?? true,
        silent: options.silent ?? true,
      });

      notificationRef.current = notification;

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (err) {
      console.log('Error showing notification:', err);
      return null;
    }
  }, [isSupported, permission]);

  const closeNotification = useCallback(() => {
    if (notificationRef.current) {
      notificationRef.current.close();
      notificationRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Función para formatear tiempo
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Actualizar notificación con cronómetro de entrenamiento
  const updateWorkoutNotification = useCallback((elapsedTime: number, exerciseName?: string) => {
    const timeStr = formatTime(elapsedTime);
    const body = exerciseName 
      ? `${exerciseName} • ${timeStr}`
      : `Tiempo: ${timeStr}`;
    
    showNotification({
      title: '🏋️ Entrenamiento activo',
      body,
      tag: 'workout-timer',
      requireInteraction: true,
      silent: true,
    });
  }, [showNotification]);

  // Actualizar notificación con temporizador de descanso
  const updateRestNotification = useCallback((timeLeft: number, nextSet?: string) => {
    const timeStr = formatTime(timeLeft);
    const body = nextSet 
      ? `Descanso: ${timeStr}\nSiguiente: ${nextSet}`
      : `Descanso: ${timeStr}`;
    
    showNotification({
      title: timeLeft <= 5 ? '⚠️ ¡Prepárate!' : '⏱️ Tiempo de descanso',
      body,
      tag: 'rest-timer',
      requireInteraction: true,
      silent: timeLeft > 5,
    });
  }, [showNotification]);

  // Iniciar actualizaciones periódicas del cronómetro
  const startWorkoutUpdates = useCallback((
    getElapsedTime: () => number,
    getExerciseName?: () => string | undefined
  ) => {
    // Limpiar intervalo anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Actualizar inmediatamente
    updateWorkoutNotification(getElapsedTime(), getExerciseName?.());

    // Actualizar cada 5 segundos para no saturar
    intervalRef.current = setInterval(() => {
      updateWorkoutNotification(getElapsedTime(), getExerciseName?.());
    }, 5000);
  }, [updateWorkoutNotification]);

  // Detener actualizaciones
  const stopUpdates = useCallback(() => {
    closeNotification();
  }, [closeNotification]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      closeNotification();
    };
  }, [closeNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    closeNotification,
    updateWorkoutNotification,
    updateRestNotification,
    startWorkoutUpdates,
    stopUpdates,
  };
};
