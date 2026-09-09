import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Loader2, Dumbbell, Repeat, Clock, Info } from 'lucide-react';
import { AISuggestion } from '@/hooks/useAISuggestion';
import { SetConfig } from '@/types/exercise';
import { formatRepsShort } from '@/utils/workoutStats';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  suggestion: AISuggestion | null;
  exerciseName: string;
  currentConfig: SetConfig[];
  currentRest?: number;
  isUnilateral?: boolean;
  /** ¿Se puede aplicar al ejercicio activo de la sesión en curso? */
  canApply?: boolean;
  /** Motivo por el que no se puede aplicar */
  blockedReason?: string;
  onApply?: () => void;
}

export const AISuggestionDialog = ({
  open,
  onOpenChange,
  loading,
  suggestion,
  exerciseName,
  currentConfig,
  currentRest,
  isUnilateral,
  canApply = false,
  blockedReason,
  onApply,
}: Props) => {
  const fmt = (reps: number) => formatRepsShort(isUnilateral === true, reps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-primary/40 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            Sugerencia IA
          </DialogTitle>
          <p className="text-sm text-muted-foreground break-words">{exerciseName}</p>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analizando tu histórico…</p>
          </div>
        )}

        {!loading && suggestion && (
          <div className="space-y-4">
            {/* Comparación por serie: peso, reps y descanso */}
            <div className="space-y-2">
              {suggestion.setSuggestions.map((s) => {
                const cur = currentConfig.find(c => c.setNumber === s.setNumber);
                const isWarmup = cur?.isWarmup === true;
                return (
                  <div
                    key={s.setNumber}
                    className="rounded-xl border border-primary/30 p-3 space-y-2"
                    aria-label={`Serie ${s.setNumber}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Serie #{s.setNumber}</span>
                      {isWarmup && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          Calentamiento (sin cambios)
                        </span>
                      )}
                    </div>

                    <ParamRow
                      icon={<Dumbbell className="w-3.5 h-3.5" aria-hidden="true" />}
                      label="Peso"
                      current={cur ? `${cur.weight} kg` : '—'}
                      suggested={`${s.weight} kg`}
                    />
                    <ParamRow
                      icon={<Repeat className="w-3.5 h-3.5" aria-hidden="true" />}
                      label="Repeticiones"
                      current={cur ? fmt(cur.reps) : '—'}
                      suggested={fmt(s.reps)}
                    />
                    <ParamRow
                      icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}
                      label="Descanso"
                      current={cur ? `${cur.restTime} s` : '—'}
                      suggested={`${s.restTime} s`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tres apartados de análisis */}
            <div className="space-y-2">
              <AnalysisBlock title="Peso" text={suggestion.weightAnalysis} />
              <AnalysisBlock title="Repeticiones" text={suggestion.repsAnalysis} />
              <AnalysisBlock title="Descanso" text={suggestion.restAnalysis} />
            </div>

            {suggestion.coaching && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion.coaching}</p>
              </div>
            )}

            {suggestion.basis && (
              <p className="text-xs text-muted-foreground italic">Base factual: {suggestion.basis}</p>
            )}

            <p className="text-xs text-muted-foreground">
              El descanso mostrado es el descanso registrado en la app, no una medición real.
            </p>

            {!canApply && (
              <p className="text-sm flex items-start gap-2 text-muted-foreground">
                <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{blockedReason ?? 'Solo puede aplicarse antes de completar la primera serie'}</span>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          {!loading && suggestion && canApply && (
            <Button
              onClick={onApply}
              aria-label="Aplicar la sugerencia al ejercicio activo"
              className="w-full sm:w-auto"
            >
              Aplicar al ejercicio
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label="Mantener los valores actuales del ejercicio"
            className="w-full sm:w-auto"
          >
            Mantener valores actuales
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ParamRow = ({
  icon,
  label,
  current,
  suggested,
}: { icon: React.ReactNode; label: string; current: string; suggested: string }) => (
  <div className="flex items-center gap-2 text-sm flex-wrap">
    <span className="flex items-center gap-1 text-muted-foreground min-w-[7rem]">
      {icon}
      {label}
    </span>
    <span className="text-muted-foreground">{current}</span>
    <ArrowRight className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
    <span className="font-semibold text-primary">{suggested}</span>
  </div>
);

const AnalysisBlock = ({ title, text }: { title: string; text: string }) => (
  <div className="p-3 rounded-xl bg-secondary/40">
    <p className="text-xs font-semibold text-primary mb-1">Análisis · {title}</p>
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {text || 'Sin análisis disponible para este parámetro.'}
    </p>
  </div>
);
