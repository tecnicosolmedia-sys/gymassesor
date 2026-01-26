import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkoutStopwatchProps {
  elapsedTime: number;
  isRunning: boolean;
  onToggle: () => void;
  className?: string;
}

export const WorkoutStopwatch = ({ 
  elapsedTime,
  isRunning,
  onToggle,
  className 
}: WorkoutStopwatchProps) => {
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 rounded-xl bg-secondary/50 backdrop-blur-sm border border-border",
      className
    )}>
      <Timer className="w-5 h-5 text-primary" />
      
      <span className="font-lcd text-2xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] min-w-[80px] text-center">
        {formatTime(elapsedTime)}
      </span>
      
      <button
        onClick={onToggle}
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
          isRunning 
            ? "bg-warning/20 text-warning hover:bg-warning/30" 
            : "bg-primary/20 text-primary hover:bg-primary/30"
        )}
        title={isRunning ? "Pausar cronómetro" : "Reanudar cronómetro"}
      >
        {isRunning ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

// Hook para gestionar el tiempo del cronómetro desde el padre
export const useWorkoutStopwatch = (autoStart = true) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setElapsedTime(0);
    setIsRunning(false);
  }, []);

  return {
    elapsedTime,
    isRunning,
    toggle,
    stop,
    reset,
  };
};
