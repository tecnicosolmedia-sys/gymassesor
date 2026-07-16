import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Exercise } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { toast } from 'sonner';

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

  const request = useCallback(async (exercise: Exercise, sessions: WorkoutSession[]) => {
    setLoading(true);
    setOpen(true);
    setSuggestion(null);

    // Build history digest: last 10 sessions with this exercise
    const history = sessions
      .filter(s => s.exercises.some(e => e.exerciseId === exercise.id && e.completedSets.length > 0))
      .slice(0, 10)
      .map(s => {
        const ex = s.exercises.find(e => e.exerciseId === exercise.id)!;
        return {
          date: new Date(s.date).toISOString().slice(0, 10),
          sets: ex.completedSets.map(cs => ({
            setNumber: cs.setNumber,
            reps: cs.reps,
            weight: cs.weight,
          })),
        };
      });

    if (history.length === 0) {
      setLoading(false);
      setOpen(false);
      toast.error('Sin histórico todavía para este ejercicio');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('suggest-exercise-progression', {
        body: {
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          currentConfig: exercise.setConfigs.map(c => ({
            setNumber: c.setNumber,
            reps: c.reps,
            weight: c.weight,
            restTime: c.restTime,
          })),
          history,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) {
        const err = (data as any).error;
        if (err === 'rate_limited') toast.error('Demasiadas peticiones. Espera un momento.');
        else if (err === 'credits_exhausted') toast.error('Créditos IA agotados en el workspace.');
        else toast.error('Error de la IA');
        setOpen(false);
        return;
      }

      setSuggestion(data as AISuggestion);
    } catch (e: any) {
      console.error(e);
      toast.error('No se pudo obtener la sugerencia');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, suggestion, open, setOpen, request };
};
