import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { AISuggestion } from '@/hooks/useAISuggestion';
import { SetConfig } from '@/types/exercise';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  suggestion: AISuggestion | null;
  exerciseName: string;
  currentConfig: SetConfig[];
  currentRest?: number;
}

export const AISuggestionDialog = ({ open, onOpenChange, loading, suggestion, exerciseName, currentConfig, currentRest }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-primary/40">
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
            {/* Comparison table */}
            <div className="rounded-xl border border-primary/30 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 px-3 py-2 text-xs font-medium bg-primary/10 text-primary">
                <span>Serie</span>
                <span>Actual</span>
                <span></span>
                <span>Sugerido</span>
              </div>
              {suggestion.setSuggestions.map((s) => {
                const cur = currentConfig.find(c => c.setNumber === s.setNumber);
                return (
                  <div key={s.setNumber} className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-2 px-3 py-2 border-t border-border text-sm">
                    <span className="font-semibold">#{s.setNumber}</span>
                    <span className="text-muted-foreground">
                      {cur ? `${cur.reps} × ${cur.weight}kg` : '—'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-primary">
                      {s.reps} × {s.weight}kg
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rest */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                Descanso entre series
              </span>
              <span>
                {currentRest !== undefined && (
                  <span className="text-muted-foreground mr-2">{currentRest}s →</span>
                )}
                <span className="font-semibold text-primary">{suggestion.restBetweenSets}s</span>
              </span>
            </div>

            {/* Coaching */}
            {suggestion.coaching && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion.coaching}</p>
              </div>
            )}

            {/* Basis */}
            {suggestion.basis && (
              <p className="text-xs text-muted-foreground italic">Base: {suggestion.basis}</p>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Sugerencia informativa. Ajusta manualmente si decides aplicarla.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
