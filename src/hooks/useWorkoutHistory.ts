import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutSession, ExerciseSession, CompletedSet, WorkoutStats } from '@/types/workoutHistory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAggregatedStats, isWarmupSet } from '@/utils/workoutStats';


export const useWorkoutHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fuente síncrona de verdad para las escrituras de la sesión activa.
   * Evita que endSession persista una versión anterior cuando se llama
   * inmediatamente después de registrar la última serie (el estado React
   * todavía no se ha propagado al cierre del render).
   */
  const currentSessionRef = useRef<WorkoutSession | null>(null);

  /** Escribe el siguiente valor en la ref (síncrono) y en el estado (render) */
  const commitSession = useCallback((next: WorkoutSession | null) => {
    currentSessionRef.current = next;
    setCurrentSession(next);
  }, []);

  // Fetch sessions from DB
  const fetchSessions = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }

    const { data: sessionsData, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error || !sessionsData) { setIsLoading(false); return; }

    // Fetch exercises + sets for all sessions
    const sessionIds = sessionsData.map(s => s.id);
    if (sessionIds.length === 0) { setSessions([]); setIsLoading(false); return; }

    const { data: exercisesData } = await supabase
      .from('workout_session_exercises')
      .select('*')
      .in('session_id', sessionIds);

    const exerciseIds = (exercisesData || []).map(e => e.id);
    let setsData: any[] = [];
    if (exerciseIds.length > 0) {
      const { data } = await supabase
        .from('workout_completed_sets')
        .select('*')
        .in('exercise_session_id', exerciseIds);
      setsData = data || [];
    }

    // Build sessions
    const builtSessions: WorkoutSession[] = sessionsData.map(s => {
      const exs = (exercisesData || []).filter(e => e.session_id === s.id);
      const exercises: ExerciseSession[] = exs.map(e => {
        const sets = setsData.filter(set => set.exercise_session_id === e.id);
        return {
          exerciseId: e.exercise_id,
          exerciseName: e.exercise_name,
          muscleGroup: e.muscle_group,
          completedSets: sets.map(set => ({
            setNumber: set.set_number,
            reps: set.reps,
            weight: Number(set.weight),
            restTime: set.rest_time,
            completedAt: new Date(set.completed_at),
            isWarmup: (set as any).is_warmup === true,
          })),

          totalSets: e.total_sets,
          startedAt: new Date(e.started_at),
          completedAt: e.completed_at ? new Date(e.completed_at) : undefined,
        };
      });

      return {
        id: s.id,
        date: new Date(s.date),
        routineId: s.routine_id ?? undefined,
        routineName: s.routine_name ?? undefined,
        exercises,
        totalDuration: s.total_duration,
        startedAt: new Date(s.started_at),
        completedAt: s.completed_at ? new Date(s.completed_at) : undefined,
        isComplete: s.is_complete,
      };
    });

    setSessions(builtSessions);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const startSession = useCallback((routineId?: string, routineName?: string) => {
    const newSession: WorkoutSession = {
      id: crypto.randomUUID(),
      date: new Date(),
      routineId,
      routineName,
      exercises: [],
      totalDuration: 0,
      startedAt: new Date(),
      isComplete: false,
    };
    setCurrentSession(newSession);
    return newSession;
  }, []);

  const logCompletedSet = useCallback((
    exerciseId: string,
    exerciseName: string,
    muscleGroup: string,
    setData: Omit<CompletedSet, 'completedAt'>,
    totalSets: number
  ) => {
    const completedSet: CompletedSet = { ...setData, completedAt: new Date() };

    setCurrentSession(prev => {
      if (!prev) {
        return {
          id: crypto.randomUUID(),
          date: new Date(),
          exercises: [{
            exerciseId, exerciseName, muscleGroup,
            completedSets: [completedSet], totalSets, startedAt: new Date(),
          }],
          totalDuration: 0, startedAt: new Date(), isComplete: false,
        };
      }

      const idx = prev.exercises.findIndex(e => e.exerciseId === exerciseId);
      if (idx >= 0) {
        const updated = [...prev.exercises];
        updated[idx] = {
          ...updated[idx],
          completedSets: [...updated[idx].completedSets, completedSet],
          ...(updated[idx].completedSets.length + 1 >= totalSets ? { completedAt: new Date() } : {}),
        };
        return { ...prev, exercises: updated };
      }

      return {
        ...prev,
        exercises: [...prev.exercises, {
          exerciseId, exerciseName, muscleGroup,
          completedSets: [completedSet], totalSets, startedAt: new Date(),
        }],
      };
    });
  }, []);

  const endSession = useCallback(async () => {
    if (!currentSession || currentSession.exercises.length === 0 || !user) {
      setCurrentSession(null);
      return null;
    }

    const completedSession: WorkoutSession = {
      ...currentSession,
      completedAt: new Date(),
      isComplete: true,
      totalDuration: Math.floor((Date.now() - currentSession.startedAt.getTime()) / 1000),
    };

    // Save to DB
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('workout_sessions')
      .insert([{
        id: completedSession.id,
        user_id: user.id,
        date: completedSession.date.toISOString(),
        routine_id: completedSession.routineId || null,
        routine_name: completedSession.routineName || null,
        total_duration: completedSession.totalDuration,
        started_at: completedSession.startedAt.toISOString(),
        completed_at: completedSession.completedAt!.toISOString(),
        is_complete: true,
      }])
      .select()
      .single();

    if (!sessionErr && sessionRow) {
      for (const ex of completedSession.exercises) {
        const { data: exRow } = await supabase
          .from('workout_session_exercises')
          .insert([{
            session_id: sessionRow.id,
            exercise_id: ex.exerciseId,
            exercise_name: ex.exerciseName,
            muscle_group: ex.muscleGroup,
            total_sets: ex.totalSets,
            started_at: ex.startedAt.toISOString(),
            completed_at: ex.completedAt?.toISOString() || null,
          }])
          .select()
          .single();

        if (exRow) {
          const setsToInsert = ex.completedSets.map(s => ({
            exercise_session_id: exRow.id,
            set_number: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            rest_time: s.restTime,
            completed_at: s.completedAt.toISOString(),
            is_warmup: isWarmupSet(ex.exerciseName, s),
          }));

          await supabase.from('workout_completed_sets').insert(setsToInsert);
        }
      }
    }

    setSessions(prev => [completedSession, ...prev]);
    setCurrentSession(null);
    return completedSession;
  }, [currentSession, user]);

  const getExerciseHistory = useCallback((exerciseId: string): ExerciseSession[] => {
    const history: ExerciseSession[] = [];
    sessions.forEach(session => {
      const ex = session.exercises.find(e => e.exerciseId === exerciseId);
      if (ex) history.push({ ...ex, startedAt: session.date });
    });
    return history.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions]);

  // Estadísticas: solo ejercicios con series registradas y sin contar calentamientos
  const getStats = useCallback((): WorkoutStats => getAggregatedStats(sessions), [sessions]);


  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase.from('workout_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Delete a single completed set from a historical session, by sessionId + exerciseId + setNumber
  const deleteCompletedSet = useCallback(async (
    sessionId: string,
    exerciseId: string,
    setNumber: number,
  ) => {
    // Find the exercise_session row id in DB
    const { data: exRows } = await supabase
      .from('workout_session_exercises')
      .select('id')
      .eq('session_id', sessionId)
      .eq('exercise_id', exerciseId)
      .limit(1);
    const exSessionId = exRows?.[0]?.id;
    if (!exSessionId) return;

    await supabase
      .from('workout_completed_sets')
      .delete()
      .eq('exercise_session_id', exSessionId)
      .eq('set_number', setNumber);

    // Si era la última serie, limpiar la ficha de ejercicio vacía de esa sesión
    const { data: remainingSets } = await supabase
      .from('workout_completed_sets')
      .select('id')
      .eq('exercise_session_id', exSessionId)
      .limit(1);

    if (!remainingSets || remainingSets.length === 0) {
      await supabase.from('workout_session_exercises').delete().eq('id', exSessionId);

      // Y si la sesión se queda sin ejercicios, eliminarla también
      const { data: remainingExercises } = await supabase
        .from('workout_session_exercises')
        .select('id')
        .eq('session_id', sessionId)
        .limit(1);
      if (!remainingExercises || remainingExercises.length === 0) {
        await supabase.from('workout_sessions').delete().eq('id', sessionId);
      }
    }



    // Update local state
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e.exerciseId !== exerciseId) return e;
          return {
            ...e,
            completedSets: e.completedSets.filter(set => set.setNumber !== setNumber),
          };
        }).filter(e => e.completedSets.length > 0),
      };
    }).filter(s => s.exercises.length > 0));
  }, []);

  // Update a single completed set's reps/weight in a historical session
  const updateCompletedSet = useCallback(async (
    sessionId: string,
    exerciseId: string,
    setNumber: number,
    updates: { reps?: number; weight?: number },
  ) => {
    const { data: exRows } = await supabase
      .from('workout_session_exercises')
      .select('id')
      .eq('session_id', sessionId)
      .eq('exercise_id', exerciseId)
      .limit(1);
    const exSessionId = exRows?.[0]?.id;
    if (!exSessionId) return;

    const dbUpdates: Record<string, number> = {};
    if (typeof updates.reps === 'number') dbUpdates.reps = updates.reps;
    if (typeof updates.weight === 'number') dbUpdates.weight = updates.weight;
    if (Object.keys(dbUpdates).length === 0) return;

    await supabase
      .from('workout_completed_sets')
      .update(dbUpdates)
      .eq('exercise_session_id', exSessionId)
      .eq('set_number', setNumber);

    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        exercises: s.exercises.map(e => {
          if (e.exerciseId !== exerciseId) return e;
          return {
            ...e,
            completedSets: e.completedSets.map(set =>
              set.setNumber === setNumber ? { ...set, ...updates } : set
            ),
          };
        }),
      };
    }));
  }, []);

  const clearHistory = useCallback(async () => {
    if (!user) return;
    // Delete all user sessions (cascade will handle exercises and sets)
    await supabase.from('workout_sessions').delete().eq('user_id', user.id);
    setSessions([]);
    setCurrentSession(null);
  }, [user]);

  return {
    sessions, currentSession, isLoading, startSession, logCompletedSet,
    endSession, getExerciseHistory, getStats, deleteSession, deleteCompletedSet, updateCompletedSet, clearHistory,
  };
};

