import { useEffect } from 'react';
import { X, Check, Clock, Dumbbell, Flame } from 'lucide-react';
import { SetConfig } from '@/types/exercise';
import { cn } from '@/lib/utils';
import { formatReps, isWarmupSet } from '@/utils/workoutStats';

interface ExercisePlanDialogProps {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  muscleGroup: string;
  isUnilateral?: boolean;
  /** Configuración efectiva de esta aparición (incluye ajustes de sesión / IA) */
  setConfigs: SetConfig[];
  completedSets: number[];
}

/**
 * Vista de solo lectura del plan completo del ejercicio en curso.
 * No edita nada ni interfiere con temporizadores o registro de series.
 */
export const ExercisePlanDialog = ({
  open,
  onClose,
  exerciseName,
  muscleGroup,
  isUnilateral,
  setConfigs,
  completedSets,
}: ExercisePlanDialogProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const total = setConfigs.length;
  const done = setConfigs.filter((c, i) => completedSets.includes(i + 1)).length;
  const nextPending = setConfigs.findIndex((c, i) => !completedSets.includes(i + 1)) + 1;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/80"
      data-testid="exercise-plan-overlay"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ejercicio completo"
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-primary/30 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground break-words">{exerciseName}</h2>
            <p className="text-xs text-primary font-medium">{muscleGroup}</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="p-2 rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-3">
          {done} de {total} series realizadas
        </p>

        <div className="space-y-2">
          {setConfigs.map((config, index) => {
            const setNumber = index + 1;
            const isCompleted = completedSets.includes(setNumber);
            const isNext = !isCompleted && setNumber === nextPending;
            const warmup = isWarmupSet(exerciseName, config);
            return (
              <div
                key={setNumber}
                data-testid={`plan-set-${setNumber}`}
                className={cn(
                  'p-3 rounded-xl border',
                  isCompleted
                    ? 'bg-primary/10 border-primary/40'
                    : isNext
                      ? 'bg-secondary/60 border-primary/30'
                      : 'bg-secondary/30 border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold">Serie {setNumber}</span>
                  <span
                    className={cn(
                      'text-xs font-bold flex items-center gap-1',
                      isCompleted ? 'text-primary' : isNext ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {isCompleted && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
                    {isCompleted ? 'Realizada' : isNext ? 'Siguiente' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatReps(isUnilateral === true, config.reps)} reps</span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="w-3 h-3" aria-hidden="true" />
                    {config.weight} kg
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {config.restTime}s
                  </span>
                  {warmup && (
                    <span className="flex items-center gap-1 text-warning font-semibold">
                      <Flame className="w-3 h-3" aria-hidden="true" />
                      Calentamiento
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-secondary text-foreground font-semibold"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
