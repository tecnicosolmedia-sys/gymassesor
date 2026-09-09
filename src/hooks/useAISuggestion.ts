import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Exercise, SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { toast } from 'sonner';
import {
  buildAIHistory,
  canonicalizeRest,
  canonicalizeSetSuggestions,
} from '@/utils/aiSuggestion';

export interface AISuggestion {
  setSuggestions: { setNumber: number; reps: number; weight: number }[];
  restBetweenSets: number;
  coaching: string;
  basis: string;
}

export const useAISuggestion = () => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [open, setOpen] = useState(false);
  /** Copia inmutable de la configuración real usada en la petición (fuente del diálogo) */
  const [requestedConfig, setRequestedConfig] = useState<SetConfig[]>([]);
  const [requestedRest, setRequestedRest] = useState<number | undefined>(undefined);

  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const close = useCallback(() => {
    requestIdRef.current += 1; // invalida respuestas en vuelo
    inFlightRef.current = false;
    setLoading(false);
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) close();
    else setOpen(true);
  }, [close]);

  const request = useCallback(async (
    exercise: Exercise,
    sessions: WorkoutSession[],
    currentConfig: SetConfig[],
    currentRest?: number,
  ) => {
    if (inFlightRef.current) return; // evita doble petición accidental

    const config = (currentConfig ?? []).map(c => ({ ...c }));
    if (config.length === 0) {
      toast.error('Configura al menos una serie antes de pedir sugerencia');
      return;
    }

    const history = buildAIHistory(exercise.id, sessions);
    if (history.length === 0) {
      toast.error('Sin histórico efectivo todavía para este ejercicio');
      return;
    }

    const requestId = ++requestIdRef.current;
    inFlightRef.current = true;
    setRequestedConfig(config);
    setRequestedRest(currentRest);
    setSuggestion(null);
    setLoading(true);
    setOpen(true);

    const isStale = () => requestId !== requestIdRef.current;

    try {
      const { data, error } = await supabase.functions.invoke('suggest-exercise-progression', {
        body: {
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          isUnilateral: exercise.isUnilateral === true,
          currentConfig: config.map(c => ({
            setNumber: c.setNumber,
            reps: c.reps,
            weight: c.weight,
            restTime: c.restTime,
          })),
          currentRest: currentRest,
          history,
        },
      });

      if (isStale()) return;

      if (error) throw error;

      const err = (data as any)?.error;
      if (err) {
        if (err === 'rate_limited') toast.error('Demasiadas peticiones. Espera un momento.');
        else if (err === 'credits_exhausted') toast.error('Créditos IA agotados en el workspace.');
        else if (err === 'ai_parse_error') toast.error('Respuesta IA no válida. Inténtalo de nuevo.');
        else if (err === 'no_history') toast.error('Sin histórico efectivo todavía para este ejercicio');
        else toast.error('Error de la IA');
        setOpen(false);
        return;
      }

      const canonical: AISuggestion = {
        setSuggestions: canonicalizeSetSuggestions(config, (data as any)?.setSuggestions),
        restBetweenSets: canonicalizeRest((data as any)?.restBetweenSets, currentRest),
        coaching: String((data as any)?.coaching ?? '').slice(0, 400),
        basis: String((data as any)?.basis ?? '').slice(0, 300),
      };

      setSuggestion(canonical);
    } catch (e) {
      if (isStale()) return;
      toast.error('No se pudo obtener la sugerencia');
      setOpen(false);
    } finally {
      if (!isStale()) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  return {
    loading,
    suggestion,
    open,
    setOpen: handleOpenChange,
    request,
    requestedConfig,
    requestedRest,
  };
};
