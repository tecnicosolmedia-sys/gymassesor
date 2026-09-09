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
import {
  StopwatchSnapshot,
  computeElapsed,
  createStopwatch,
  isStopwatchRunning,
  parseTimeParts,
  setStopwatchElapsed,
  setStopwatchRunning,
} from '@/utils/stopwatch';

interface WorkoutStopwatchProps {
  elapsedTime: number;
  isRunning: boolean;
  onToggle: () => void;
  onSetTime?: (seconds: number) => void;
  /** Fija explícitamente corriendo/pausado (evita carreras al editar). */
  onSetRunning?: (running: boolean) => void;
  compact?: boolean;
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
  onSetRunning,
  compact = false,
  className 
}: WorkoutStopwatchProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [h, setH] = useState('0');
  const [m, setM] = useState('0');
  const [s, setS] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const wasRunningRef = useRef(false);

  // Aplica el estado corriendo/pausado de forma absoluta (sin depender del valor actual)
  const applyRunning = useCallback((running: boolean) => {
    if (onSetRunning) {
      onSetRunning(running);
      return;
    }
    if (running !== isRunning) onToggle();
  }, [onSetRunning, onToggle, isRunning]);

  const openEdit = () => {
    if (!onSetTime) return;
    wasRunningRef.current = isRunning;
    applyRunning(false); // pausar mientras se edita
    setH(String(Math.floor(elapsedTime / 3600)));
    setM(String(Math.floor((elapsedTime % 3600) / 60)));
    setS(String(elapsedTime % 60));
    setError(null);
    setEditOpen(true);
  };

  // Cierra el diálogo restaurando el estado previo (corriendo o pausado)
  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setError(null);
    applyRunning(wasRunningRef.current);
  }, [applyRunning]);

  const handleSave = () => {
    const total = parseTimeParts(h, m, s);
    if (total === null) {
      setError('Introduce valores válidos (min/seg entre 0 y 59).');
      return;
    }
    onSetTime?.(total);
    closeEdit();
  };

  return (
    <>
      <div className={cn(
        "flex items-center rounded-xl bg-secondary/50 backdrop-blur-sm border border-border",
        compact ? "gap-2 px-3 py-2" : "gap-4 px-5 py-2.5",
        className
      )}>
        <Timer className={cn("text-primary", compact ? "w-5 h-5" : "w-6 h-6")} />
        
        <button
          type="button"
          onClick={openEdit}
          disabled={!onSetTime}
          className={cn(
            "font-lcd text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] min-w-[96px] text-center disabled:cursor-default",
            compact ? "text-2xl" : "text-3xl"
          )}
          title={onSetTime ? 'Editar tiempo transcurrido' : undefined}
        >
          {formatTime(elapsedTime)}
        </button>
        
        <button
          onClick={onToggle}
          className={cn(
            "rounded-lg flex items-center justify-center transition-all",
            compact ? "w-9 h-9" : "w-10 h-10",
            isRunning 
              ? "bg-warning/20 text-warning hover:bg-warning/30" 
              : "bg-primary/20 text-primary hover:bg-primary/30"
          )}
          title={isRunning ? "Pausar cronómetro" : "Reanudar cronómetro"}
        >
          {isRunning ? (
            <Pause className={compact ? "w-4 h-4" : "w-5 h-5"} />
          ) : (
            <Play className={compact ? "w-4 h-4" : "w-5 h-5"} />
          )}
        </button>

        {onSetTime && (
          <button
            onClick={openEdit}
            className={cn(
              "rounded-lg flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground transition-all",
              compact ? "w-9 h-9" : "w-10 h-10"
            )}
            title="Editar tiempo transcurrido"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => closeEdit()}>
              Cancelar
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Hook para gestionar el tiempo del cronómetro desde el padre (basado en reloj real)
export const useWorkoutStopwatch = (autoStart = true, initialTime = 0) => {
  const snapshotRef = useRef<StopwatchSnapshot>(createStopwatch(initialTime, autoStart));
  const [elapsedTime, setElapsedTime] = useState(() => computeElapsed(snapshotRef.current));
  const [isRunning, setIsRunning] = useState(autoStart);
  const initialTimeRef = useRef(initialTime);

  const sync = useCallback(() => {
    setElapsedTime(computeElapsed(snapshotRef.current));
    setIsRunning(isStopwatchRunning(snapshotRef.current));
  }, []);

  const apply = useCallback((next: StopwatchSnapshot) => {
    snapshotRef.current = next;
    sync();
  }, [sync]);

  // Sincronizar tiempo inicial cuando se restaura una sesión
  useEffect(() => {
    if (initialTime !== initialTimeRef.current) {
      initialTimeRef.current = initialTime;
      apply(setStopwatchElapsed(snapshotRef.current, initialTime));
    }
  }, [initialTime, apply]);

  // Tick de refresco visual: el valor siempre se recalcula desde el reloj
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(sync, 500);
    return () => clearInterval(id);
  }, [isRunning, sync]);

  // Resincronizar al volver de segundo plano
  useEffect(() => {
    const onWake = () => sync();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [sync]);

  const setRunning = useCallback((running: boolean) => {
    apply(setStopwatchRunning(snapshotRef.current, running));
  }, [apply]);

  const toggle = useCallback(() => {
    apply(setStopwatchRunning(snapshotRef.current, !isStopwatchRunning(snapshotRef.current)));
  }, [apply]);

  const stop = useCallback(() => setRunning(false), [setRunning]);

  const reset = useCallback(() => {
    apply(createStopwatch(0, false));
  }, [apply]);

  const setTime = useCallback((seconds: number) => {
    apply(setStopwatchElapsed(snapshotRef.current, seconds));
  }, [apply]);

  /** Valor exacto en este instante (para guardar la duración final). */
  const getElapsedNow = useCallback(() => computeElapsed(snapshotRef.current), []);

  return {
    elapsedTime,
    isRunning,
    toggle,
    setRunning,
    stop,
    reset,
    setTime,
    getElapsedNow,
  };
};

