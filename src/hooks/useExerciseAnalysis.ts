import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExerciseAnalysisDigest } from '@/utils/exerciseSessionAnalysis';

export interface ExerciseAnalysisReport {
  summary: string;
  previousComparison: string;
  weightAnalysis: string;
  repsAnalysis: string;
  volumeAnalysis: string;
  restAnalysis: string;
  coaching: string;
  nextSessionRecommendation: string;
  basis: string;
}

const txt = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+\n/g, '\n').trim().slice(0, max) : '';

export const useExerciseAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ExerciseAnalysisReport | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<ExerciseAnalysisDigest | null>(null);

  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  /** Cancelación lógica: invalida cualquier respuesta en vuelo. */
  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) close();
    else setOpen(true);
  }, [close]);

  /** Invalida el informe mostrado (p. ej. tras corregir peso o repeticiones). */
  const invalidate = useCallback(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    setLoading(false);
    setReport(null);
    setDigest(null);
    setError(null);
    setOpen(false);
  }, []);

  const analyze = useCallback(async (input: ExerciseAnalysisDigest) => {
    if (inFlightRef.current) return; // evita doble petición
    if (!input || input.today.setCount === 0) {
      toast.error('No hay series efectivas registradas para analizar');
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    setDigest(input);
    setReport(null);
    setError(null);
    setLoading(true);
    setOpen(true);

    const isStale = () => requestId !== requestIdRef.current;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-exercise-session', {
        body: {
          exerciseName: input.exerciseName,
          muscleGroup: input.muscleGroup,
          isUnilateral: input.isUnilateral,
          analysisDate: input.analysisDate,
          today: {
            setCount: input.today.setCount,
            totalReps: input.today.totalReps,
            totalVolume: input.today.totalVolume,
            maxWeight: input.today.maxWeight,
            avgRest: input.today.avgRest,
            sets: input.today.sets,
          },
          previous: input.previous,
          previousBest: input.previousBest,
          records: input.records,
          deltas: input.deltas,
          history: input.history,
        },
      });

      if (isStale()) return;
      if (fnError) throw fnError;

      const err = (data as any)?.error;
      if (err) {
        const msg =
          err === 'rate_limited' ? 'Demasiadas peticiones. Espera un momento.'
          : err === 'credits_exhausted' ? 'Créditos IA agotados en el workspace.'
          : err === 'ai_parse_error' ? 'Respuesta IA no válida. Inténtalo de nuevo.'
          : err === 'no_data' ? 'No hay datos suficientes para analizar.'
          : 'No se pudo completar el análisis.';
        setError(msg);
        toast.error(msg);
        return;
      }

      setReport({
        summary: txt((data as any)?.summary, 600),
        previousComparison: txt((data as any)?.previousComparison, 600),
        weightAnalysis: txt((data as any)?.weightAnalysis, 400),
        repsAnalysis: txt((data as any)?.repsAnalysis, 400),
        volumeAnalysis: txt((data as any)?.volumeAnalysis, 400),
        restAnalysis: txt((data as any)?.restAnalysis, 400),
        coaching: txt((data as any)?.coaching, 400),
        nextSessionRecommendation: txt((data as any)?.nextSessionRecommendation, 400),
        basis: txt((data as any)?.basis, 300),
      });
    } catch {
      if (isStale()) return;
      const msg = 'No se pudo completar el análisis. Inténtalo de nuevo.';
      setError(msg);
      toast.error(msg);
    } finally {
      if (!isStale()) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  return {
    loading,
    report,
    error,
    digest,
    open,
    setOpen: handleOpenChange,
    close,
    invalidate,
    analyze,
  };
};
