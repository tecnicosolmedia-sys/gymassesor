import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Trophy, AlertCircle } from 'lucide-react';
import { ExerciseAnalysisReport } from '@/hooks/useExerciseAnalysis';
import { ExerciseAnalysisDigest } from '@/utils/exerciseSessionAnalysis';
import { formatRepsShort } from '@/utils/workoutStats';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  report: ExerciseAnalysisReport | null;
  error?: string | null;
  digest: ExerciseAnalysisDigest | null;
  exerciseName: string;
  onRetry?: () => void;
}

const Block = ({ title, text }: { title: string; text: string }) => (
  <div className="p-3 rounded-xl bg-secondary/40">
    <p className="text-xs font-semibold text-primary mb-1">{title}</p>
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {text || 'Sin datos comentables para este apartado.'}
    </p>
  </div>
);

export const ExerciseAnalysisDialog = ({
  open,
  onOpenChange,
  loading,
  report,
  error,
  digest,
  exerciseName,
  onRetry,
}: Props) => {
  const fmtReps = (reps: number) => formatRepsShort(digest?.isUnilateral === true, reps);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-primary/40 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            Análisis IA del ejercicio
          </DialogTitle>
          <p className="text-sm text-muted-foreground break-words">{exerciseName}</p>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analizando tus marcas…</p>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3 py-4">
            <p className="text-sm flex items-start gap-2 text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
            {onRetry && (
              <Button onClick={onRetry} aria-label="Reintentar el análisis" className="w-full">
                Reintentar
              </Button>
            )}
          </div>
        )}

        {!loading && !error && report && digest && (
          <div className="space-y-4">
            {/* Marcas deterministas (nunca decididas por la IA) */}
            {(digest.records.newMaxWeight || digest.records.newBestVolume) && (
              <div
                className="p-3 rounded-xl bg-primary/10 border border-primary/30 space-y-1"
                aria-label="Marcas destacadas"
              >
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
                  Marcas destacadas
                </p>
                {digest.records.newMaxWeight && (
                  <p className="text-sm">Nueva carga máxima: {digest.today.maxWeight} kg</p>
                )}
                {digest.records.newBestVolume && (
                  <p className="text-sm">
                    Nuevo mejor volumen efectivo: {digest.today.totalVolume.toLocaleString()} kg
                  </p>
                )}
              </div>
            )}

            {/* Datos verificables de hoy */}
            <div className="rounded-xl border border-border p-3 text-sm space-y-1" aria-label="Datos de la sesión">
              <p>Series efectivas: {digest.today.setCount}</p>
              <p>Repeticiones efectivas: {fmtReps(digest.today.totalReps)}</p>
              <p>Carga máxima: {digest.today.maxWeight} kg</p>
              <p>Volumen efectivo: {digest.today.totalVolume.toLocaleString()} kg</p>
              {digest.today.avgRest !== undefined && (
                <p>Descanso registrado medio: {digest.today.avgRest} s</p>
              )}
            </div>

            {digest.isFirstReference && (
              <p className="text-sm text-muted-foreground" aria-label="Sesión de referencia inicial">
                Sesión de referencia inicial: todavía no hay histórico de este ejercicio con el que comparar.
              </p>
            )}

            <Block title="Resumen" text={report.summary} />
            {!digest.isFirstReference && (
              <Block title="Comparación con la sesión anterior" text={report.previousComparison} />
            )}
            <Block title="Análisis · Peso" text={report.weightAnalysis} />
            <Block title="Análisis · Repeticiones" text={report.repsAnalysis} />
            <Block title="Análisis · Volumen efectivo" text={report.volumeAnalysis} />
            <Block title="Análisis · Descanso registrado" text={report.restAnalysis} />

            {report.coaching && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.coaching}</p>
              </div>
            )}

            <Block title="Recomendación para la próxima sesión" text={report.nextSessionRecommendation} />

            <p className="text-xs text-muted-foreground" aria-label="Base de datos utilizada">
              Base utilizada: {digest.analysisDate} · {digest.historySessionCount} sesiones históricas comparadas.
            </p>
            <p className="text-xs text-muted-foreground italic">
              El descanso mostrado es el descanso registrado en la app, no una medición real.
              {report.basis ? ` ${report.basis}` : ''}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar el análisis"
            className="w-full sm:w-auto"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
