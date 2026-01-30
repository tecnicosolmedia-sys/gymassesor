import { useState, useEffect, useCallback } from 'react';

const WORKOUT_STATE_KEY = 'gym-tracker-active-workout';

export interface ExerciseSetState {
  exerciseId: string;
  currentSet: number;
  completedSets: number[];
}

export interface SavedWorkoutState {
  routineId?: string;
  routineName?: string;
  workoutExerciseIds: string[];
  completedExerciseIds: string[];
  flowState: {
    type: 'exercising' | 'rest-between-exercises' | 'select-next-exercise' | 'routine-complete' | 'add-extra-exercise';
    exerciseIndex?: number;
    completedExerciseIndex?: number;
  };
  elapsedTime: number;
  extraExerciseIds: string[];
  savedAt: string;
  // Estado de series por ejercicio
  exerciseSetStates?: ExerciseSetState[];
}

export const useSavedWorkout = () => {
  const [savedWorkout, setSavedWorkout] = useState<SavedWorkoutState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar estado guardado al iniciar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WORKOUT_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedWorkoutState;
        // Solo restaurar si tiene datos válidos y no está completada
        if (parsed.routineId && parsed.flowState.type !== 'routine-complete') {
          setSavedWorkout(parsed);
        } else {
          // Limpiar si estaba completada
          localStorage.removeItem(WORKOUT_STATE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(WORKOUT_STATE_KEY);
    }
    setIsLoading(false);
  }, []);

  // Limpiar estado guardado
  const clearSavedWorkout = useCallback(() => {
    localStorage.removeItem(WORKOUT_STATE_KEY);
    setSavedWorkout(null);
  }, []);

  // Calcular tiempo desde que se guardó
  const getTimeSinceSaved = useCallback(() => {
    if (!savedWorkout) return '';
    
    const savedDate = new Date(savedWorkout.savedAt);
    const now = new Date();
    const diffMs = now.getTime() - savedDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 24) {
      return `hace ${Math.floor(diffHours / 24)} días`;
    }
    if (diffHours > 0) {
      return `hace ${diffHours}h`;
    }
    if (diffMins > 0) {
      return `hace ${diffMins}min`;
    }
    return 'hace un momento';
  }, [savedWorkout]);

  return {
    savedWorkout,
    isLoading,
    clearSavedWorkout,
    getTimeSinceSaved,
  };
};
