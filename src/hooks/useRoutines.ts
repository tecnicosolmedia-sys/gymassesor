import { useState, useEffect } from 'react';
import { Routine } from '@/types/routine';

const STORAGE_KEY = 'gym-tracker-routines';

const defaultRoutines: Routine[] = [
  {
    id: '1',
    name: 'Día de Pecho',
    exerciseIds: ['1'],
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Día de Pierna',
    exerciseIds: ['2'],
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Día de Espalda',
    exerciseIds: ['3'],
    createdAt: new Date(),
  },
];

export const useRoutines = () => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRoutines(parsed.map((r: any) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })));
      } catch {
        setRoutines(defaultRoutines);
      }
    } else {
      setRoutines(defaultRoutines);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
    }
  }, [routines, isLoading]);

  const addRoutine = (routine: Omit<Routine, 'id' | 'createdAt'>) => {
    const newRoutine: Routine = {
      ...routine,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setRoutines((prev) => [...prev, newRoutine]);
    return newRoutine;
  };

  const updateRoutine = (id: string, updates: Partial<Routine>) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const deleteRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const addExerciseToRoutine = (routineId: string, exerciseId: string) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === routineId
          ? { ...r, exerciseIds: [...r.exerciseIds, exerciseId] }
          : r
      )
    );
  };

  const removeExerciseFromRoutine = (routineId: string, exerciseId: string) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === routineId
          ? { ...r, exerciseIds: r.exerciseIds.filter((id) => id !== exerciseId) }
          : r
      )
    );
  };

  return {
    routines,
    isLoading,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addExerciseToRoutine,
    removeExerciseFromRoutine,
  };
};
