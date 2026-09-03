import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Timer, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WorkoutStopwatchProps {
  elapsedTime: number;
  isRunning: boolean;
  onToggle: () => void;
  onSetTime?: (seconds: number) => void;
  className?: string;
}

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const WorkoutStopwatch = ({ 
  elapsedTime,
  isRunning,
  onToggle,
  onSetTime,
  className 
}: WorkoutStopwatchProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [h, setH] = useState('0');
  const [m, setM] = useState('0');
  const [s, setS] = useState('0');
  const wasRunningRef = useRef(false);

  const openEdit = () => {
    if (!onSetTime) return;
    wasRunningRef.current = isRunning;
    if (isRunning) onToggle(); // pausar mientras se edita
    setH(String(Math.floor(elapsedTime / 3600)));
    setM(String(Math.floor((elapsedTime % 3600) / 60)));
    setS(String(elapsedTime % 60));
    setEditOpen(true);
  };

  const closeEdit = (resume: boolean) => {
    setEditOpen(false);
    if (resume && wasRunningRef.current && !isRunning) onToggle();
  };

  const handleSave = () => {
    const total =
      Math.max(0, parseInt(h || '0', 10) || 0) * 3600 +
      Math.max(0, parseInt(m || '0', 10) || 0) * 60 +
      Math.max(0, parseInt(s || '0', 10) || 0);
    onSetTime?.(total);
    closeEdit(true);
  };

  return (
    <>
      <div className={cn(
        "flex items-center gap-4 px-5 py-2.5 rounded-xl bg-secondary/50 backdrop-blur-sm border border-border",
        className
      )}>
        <Timer className="w-6 h-6 text-primary" />
        
        <button
          type="button"
          onClick={openEdit}
          disabled={!onSetTime}
          className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] min-w-[96px] text-center disabled:cursor-default"
          title={onSetTime ? 'Editar tiempo transcurrido' : undefined}
        >
          {formatTime(elapsedTime)}
        </button>
        
        <button
          onClick={onToggle}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
            isRunning 
              ? "bg-warning/20 text-warning hover:bg-warning/30" 
              : "bg-primary/20 text-primary hover:bg-primary/30"
          )}
          title={isRunning ? "Pausar cronómetro" : "Reanudar cronómetro"}
        >
          {isRunning ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        {onSetTime && (
          <button
            onClick={openEdit}
            className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-all"
            title="Editar tiempo transcurrido"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit(true)}>
        <DialogContent className="z-[10000] max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar tiempo transcurrido</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="sw-h">Horas</Label>
              <Input id="sw-h" type="number" inputMode="numeric" min={0} value={h}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setH(e.target.value)} className="font-lcd text-center" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sw-m">Min</Label>
              <Input id="sw-m" type="number" inputMode="numeric" min={0} max={59} value={m}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setM(e.target.value)} className="font-lcd text-center" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sw-s">Seg</Label>
              <Input id="sw-s" type="number" inputMode="numeric" min={0} max={59} value={s}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setS(e.target.value)} className="font-lcd text-center" />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => closeEdit(true)}>
              Cancelar
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              Guardar y reanudar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Hook para gestionar el tiempo del cronómetro desde el padre
export const useWorkoutStopwatch = (autoStart = true, initialTime = 0) => {
  const [elapsedTime, setElapsedTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialTimeRef = useRef(initialTime);

  // Sincronizar tiempo inicial cuando se restaura una sesión
  useEffect(() => {
    if (initialTime !== initialTimeRef.current) {
      setElapsedTime(initialTime);
      initialTimeRef.current = initialTime;
    }
  }, [initialTime]);

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

  const setTime = useCallback((seconds: number) => {
    setElapsedTime(Math.max(0, Math.round(seconds)));
  }, []);

  return {
    elapsedTime,
    isRunning,
    toggle,
    stop,
    reset,
    setTime,
  };
};
