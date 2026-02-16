import { useEffect, useState, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, X, ArrowRight, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useWorkoutNotification } from '@/hooks/useWorkoutNotification';

interface FullscreenTimerProps {
  initialTime: number;
  label: string;
  nextSetLabel?: string;
  onComplete: () => void;
  onContinue: () => void;
  onClose: () => void;
  // Cronómetro global del entrenamiento
  globalElapsedTime?: number;
  globalIsRunning?: boolean;
  onGlobalToggle?: () => void;
}

export const FullscreenTimer = ({
  initialTime,
  label,
  nextSetLabel,
  onComplete,
  onContinue,
  onClose,
  globalElapsedTime,
  globalIsRunning,
  onGlobalToggle,
}: FullscreenTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasPlayedRef = useRef<Set<number>>(new Set());

  // Mantener pantalla activa durante el temporizador
  useWakeLock(true);
  
  // Notificaciones para pantalla de bloqueo
  const { 
    permission: notificationPermission,
    updateRestNotification,
    closeNotification,
  } = useWorkoutNotification();
  useWakeLock(true);

  // Detectar orientación
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Estado para controlar si ya se reprodujo el sonido de inicio
  const hasPlayedStartRef = useRef(false);

  // Función para vibrar el dispositivo
  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      console.log('Vibration not available');
    }
  }, []);

  // Función para reproducir beep de inicio
  const playStartBeep = useCallback(() => {
    // Vibración corta de inicio
    vibrate(150);
    
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Tono ascendente para indicar inicio
      oscillator.frequency.setValueAtTime(400, ctx.currentTime);
      oscillator.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.log('Audio not available');
    }
  }, [vibrate]);

  // Función para reproducir beep fuerte de cuenta atrás
  const playCountdownBeep = useCallback((secondsLeft: number) => {
    // Vibración rítmica
    vibrate([120, 60, 120, 60, 120]);
    
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      const baseFreq = 600 + (10 - secondsLeft) * 80;
      
      for (let i = 0; i < 3; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = baseFreq;
        oscillator.type = 'square';
        
        const startTime = ctx.currentTime + (i * 0.12);
        gainNode.gain.setValueAtTime(0.9, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.08);
      }
    } catch (e) {
      console.log('Audio not available');
    }
  }, [vibrate]);

  // Función para campana de ring de boxeo
  const playBoxingBell = useCallback(() => {
    vibrate(800);
    
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      
      const ctx = audioContextRef.current;
      
      for (let hit = 0; hit < 3; hit++) {
        const hitTime = ctx.currentTime + hit * 0.35;
        const frequencies = [800, 1200, 1600, 2400, 3200];
        
        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = i < 2 ? 'sine' : 'triangle';
          const volume = i === 0 ? 0.7 : i === 1 ? 0.5 : 0.25;
          gain.gain.setValueAtTime(volume, hitTime);
          gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.8);
          osc.start(hitTime);
          osc.stop(hitTime + 0.8);
        });
        
        const bufferSize = ctx.sampleRate * 0.3;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let s = 0; s < bufferSize; s++) {
          output[s] = (Math.random() * 2 - 1) * Math.exp(-s / (ctx.sampleRate * 0.05));
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 3000;
        noiseFilter.Q.value = 5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, hitTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.4);
        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseSource.start(hitTime);
        noiseSource.stop(hitTime + 0.4);
      }
    } catch (e) {
      console.log('Audio not available');
    }
  }, [vibrate]);

  // Reproducir sonido de inicio e iniciar timer inmediatamente al montar
  useEffect(() => {
    // Reproducir sonido de inicio una sola vez
    if (!hasPlayedStartRef.current) {
      hasPlayedStartRef.current = true;
      // Pequeño delay para asegurar que el AudioContext se active correctamente
      setTimeout(() => {
        playStartBeep();
      }, 100);
    }
    
    // Iniciar el timer inmediatamente
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer completado
          if (!hasPlayedRef.current.has(0)) {
            hasPlayedRef.current.add(0);
            playBoxingBell();
          }
          setIsComplete(true);
          setIsRunning(false);
          onComplete();
          return 0;
        }
        
        const newTime = prev - 1;
        
        // Beep fuerte para los últimos 10 segundos
        if (newTime <= 10 && newTime > 0 && !hasPlayedRef.current.has(newTime)) {
          hasPlayedRef.current.add(newTime);
          playCountdownBeep(newTime);
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  // Actualizar notificación de descanso
  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    
    // Actualizar notificación inmediatamente y cuando cambia el tiempo
    updateRestNotification(timeLeft, nextSetLabel);
    
    // Limpiar notificación al desmontar
    return () => {
      closeNotification();
    };
  }, [timeLeft, nextSetLabel, notificationPermission, updateRestNotification, closeNotification]);

  // Pausar/reanudar timer
  useEffect(() => {
    if (!isRunning && timeLeft > 0 && !isComplete) {
      // Timer está pausado, no hacer nada aquí ya que el interval ya está corriendo
    }
  }, [isRunning, timeLeft, isComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((initialTime - timeLeft) / initialTime) * 100;
  const isWarning = timeLeft <= 10 && timeLeft > 0;

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setTimeLeft(initialTime);
    setIsRunning(true);
    setIsComplete(false);
    hasPlayedRef.current.clear();
  };

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  // Calcular tamaños según orientación - más grandes para LCD
  const ringSize = isLandscape ? 'w-72 h-72 sm:w-96 sm:h-96' : 'w-72 h-72 sm:w-80 sm:h-80';
  const ringRadius = isLandscape ? 140 : 120;
  const ringCenter = isLandscape ? 160 : 144;
  const svgSize = isLandscape ? 320 : 288;
  const fontSize = isLandscape ? 'text-7xl sm:text-9xl' : 'text-6xl sm:text-8xl';

  // Formatear tiempo del cronómetro global
  const formatGlobalTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-4",
        isLandscape && "flex-row gap-8"
      )}
    >
      {/* Cronómetro global siempre visible arriba */}
      {globalElapsedTime !== undefined && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-xl bg-secondary/70 backdrop-blur-sm border border-border">
          <span className="font-lcd text-2xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] min-w-[96px] text-center">
            {formatGlobalTime(globalElapsedTime)}
          </span>
          {onGlobalToggle && (
            <button
              onClick={onGlobalToggle}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                globalIsRunning 
                  ? "bg-warning/20 text-warning hover:bg-warning/30" 
                  : "bg-primary/20 text-primary hover:bg-primary/30"
              )}
              title={globalIsRunning ? "Pausar cronómetro" : "Reanudar cronómetro"}
            >
              {globalIsRunning ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Close button - solo visible cuando está completo */}
      {!isComplete && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      )}
      
      {/* Background glow */}
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-500 pointer-events-none",
          isWarning ? "bg-warning/10" : "bg-primary/5",
          isComplete && "bg-primary/20"
        )}
      />
      
      {/* Main content */}
      <div className={cn(
        "relative flex flex-col items-center",
        isLandscape && "flex-1"
      )}>
        <p className={cn(
          "text-muted-foreground mb-4 font-medium text-center",
          isLandscape ? "text-xl" : "text-lg"
        )}>
          {label}
        </p>
        
        {/* Progress ring */}
        <div className={cn("relative", ringSize)}>
          <svg 
            className="w-full h-full transform -rotate-90"
            viewBox={`0 0 ${svgSize} ${svgSize}`}
          >
            {/* Background circle */}
            <circle
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              fill="none"
              stroke={isComplete ? "hsl(var(--primary))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))"}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * ringRadius}
              strokeDashoffset={2 * Math.PI * ringRadius * (1 - progress / 100)}
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Time display - LCD style */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              "font-lcd font-bold transition-all tracking-wider",
              fontSize,
              isWarning && "text-warning animate-pulse",
              isComplete && "text-primary",
              "drop-shadow-[0_0_10px_currentColor]"
            )}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className={cn(
        "relative flex flex-col items-center gap-4",
        isLandscape ? "flex-1" : "mt-8"
      )}>
        {!isComplete ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <button
                onClick={handleToggle}
                className={cn(
                  "w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
                  isRunning 
                    ? "bg-warning text-warning-foreground hover:bg-warning/90" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-energy"
                )}
              >
                {isRunning ? (
                  <Pause className="w-8 h-8 sm:w-10 sm:h-10" />
                ) : (
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1" />
                )}
              </button>
              
              <button
                onClick={handleReset}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
              >
                <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            </div>
            
            {nextSetLabel && (
              <p className="text-sm text-muted-foreground text-center max-w-xs px-4 py-2 rounded-lg bg-secondary/50">
                {nextSetLabel}
              </p>
            )}
            
            <button
              onClick={handleContinue}
              className="px-6 py-3 rounded-xl bg-primary/20 text-primary font-medium flex items-center gap-2 hover:bg-primary/30 transition-all border border-primary/30"
            >
              <ArrowRight className="w-5 h-5" />
              Saltar y continuar
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center mb-4">
              <p className="text-2xl sm:text-3xl font-display font-bold text-primary mb-2">
                ¡Tiempo completado!
              </p>
              {nextSetLabel && (
                <p className="text-muted-foreground">
                  {nextSetLabel}
                </p>
              )}
            </div>
            
            <button
              onClick={handleContinue}
              className="px-8 py-4 sm:px-12 sm:py-5 rounded-2xl bg-primary text-primary-foreground font-bold text-lg sm:text-xl flex items-center gap-3 hover:bg-primary/90 transition-all shadow-energy animate-pulse"
            >
              <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" />
              Comenzar siguiente serie
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
