import { useState, useEffect, useCallback } from 'react';
import { WorkoutSession, ExerciseSession, CompletedSet, WorkoutStats } from '@/types/workoutHistory';

const STORAGE_KEY = 'gym-tracker-workout-history';

export const useWorkoutHistory = () => {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar historial del localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessions(parsed.map((s: any) => ({
          ...s,
          date: new Date(s.date),
          startedAt: new Date(s.startedAt),
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
          exercises: s.exercises.map((e: any) => ({
            ...e,
            startedAt: new Date(e.startedAt),
            completedAt: e.completedAt ? new Date(e.completedAt) : undefined,
            completedSets: e.completedSets.map((set: any) => ({
              ...set,
              completedAt: new Date(set.completedAt),
            })),
          })),
        })));
      } catch {
        setSessions([]);
      }
    }
    setIsLoading(false);
  }, []);

  // Guardar en localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isLoading]);

  // Iniciar nueva sesión de entrenamiento
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

  // Registrar serie completada
  const logCompletedSet = useCallback((
    exerciseId: string,
    exerciseName: string,
    muscleGroup: string,
    setData: Omit<CompletedSet, 'completedAt'>,
    totalSets: number
  ) => {
    const completedSet: CompletedSet = {
      ...setData,
      completedAt: new Date(),
    };

    setCurrentSession(prev => {
      if (!prev) {
        // Si no hay sesión, crear una nueva
        const newSession: WorkoutSession = {
          id: crypto.randomUUID(),
          date: new Date(),
          exercises: [{
            exerciseId,
            exerciseName,
            muscleGroup,
            completedSets: [completedSet],
            totalSets,
            startedAt: new Date(),
          }],
          totalDuration: 0,
          startedAt: new Date(),
          isComplete: false,
        };
        return newSession;
      }

      // Buscar si el ejercicio ya existe en la sesión
      const existingExerciseIndex = prev.exercises.findIndex(e => e.exerciseId === exerciseId);
      
      if (existingExerciseIndex >= 0) {
        // Añadir set al ejercicio existente
        const updatedExercises = [...prev.exercises];
        updatedExercises[existingExerciseIndex] = {
          ...updatedExercises[existingExerciseIndex],
          completedSets: [...updatedExercises[existingExerciseIndex].completedSets, completedSet],
        };
        
        // Marcar como completado si se completaron todas las series
        if (updatedExercises[existingExerciseIndex].completedSets.length >= totalSets) {
          updatedExercises[existingExerciseIndex].completedAt = new Date();
        }
        
        return { ...prev, exercises: updatedExercises };
      } else {
        // Nuevo ejercicio en la sesión
        const newExercise: ExerciseSession = {
          exerciseId,
          exerciseName,
          muscleGroup,
          completedSets: [completedSet],
          totalSets,
          startedAt: new Date(),
        };
        return { ...prev, exercises: [...prev.exercises, newExercise] };
      }
    });
  }, []);

  // Finalizar sesión
  const endSession = useCallback(() => {
    if (currentSession && currentSession.exercises.length > 0) {
      const completedSession: WorkoutSession = {
        ...currentSession,
        completedAt: new Date(),
        isComplete: true,
        totalDuration: Math.floor((new Date().getTime() - currentSession.startedAt.getTime()) / 1000),
      };
      
      setSessions(prev => [completedSession, ...prev]);
      setCurrentSession(null);
      return completedSession;
    }
    setCurrentSession(null);
    return null;
  }, [currentSession]);

  // Obtener historial de un ejercicio específico
  const getExerciseHistory = useCallback((exerciseId: string): ExerciseSession[] => {
    const history: ExerciseSession[] = [];
    
    sessions.forEach(session => {
      const exerciseInSession = session.exercises.find(e => e.exerciseId === exerciseId);
      if (exerciseInSession) {
        history.push({
          ...exerciseInSession,
          startedAt: session.date,
        });
      }
    });
    
    return history.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions]);

  // Obtener estadísticas generales
  const getStats = useCallback((): WorkoutStats => {
    let totalSets = 0;
    let totalWeight = 0;
    let totalDuration = 0;
    let totalExercises = 0;

    sessions.forEach(session => {
      totalDuration += session.totalDuration;
      session.exercises.forEach(exercise => {
        totalExercises++;
        exercise.completedSets.forEach(set => {
          totalSets++;
          totalWeight += set.weight * set.reps;
        });
      });
    });

    return {
      totalWorkouts: sessions.length,
      totalExercises,
      totalSets,
      totalWeight,
      averageWorkoutDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  }, [sessions]);

  // Eliminar sesión
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  // Limpiar todo el historial
  const clearHistory = useCallback(() => {
    setSessions([]);
    setCurrentSession(null);
  }, []);

  return {
    sessions,
    currentSession,
    isLoading,
    startSession,
    logCompletedSet,
    endSession,
    getExerciseHistory,
    getStats,
    deleteSession,
    clearHistory,
  };
};
