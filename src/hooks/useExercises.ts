import { useState, useEffect } from 'react';
import { Exercise } from '@/types/exercise';

const STORAGE_KEY = 'gym-tracker-exercises';

const defaultExercises: Exercise[] = [
  {
    id: '1',
    name: 'Press de Banca',
    sets: 4,
    reps: 10,
    weight: 60,
    restBetweenSets: 90,
    restAfterExercise: 180,
    notes: 'Mantén los codos a 45 grados. Baja la barra hasta el pecho controladamente.',
    caloriesPerSet: 8,
    muscleGroup: 'Pecho',
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Sentadillas',
    sets: 4,
    reps: 12,
    weight: 80,
    restBetweenSets: 120,
    restAfterExercise: 180,
    notes: 'Rodillas en línea con los pies. Profundidad paralela o más.',
    caloriesPerSet: 12,
    muscleGroup: 'Piernas',
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Peso Muerto',
    sets: 3,
    reps: 8,
    weight: 100,
    restBetweenSets: 150,
    restAfterExercise: 180,
    notes: 'Espalda recta. Empuja con los talones. Bloquea cadera arriba.',
    caloriesPerSet: 15,
    muscleGroup: 'Espalda',
    createdAt: new Date(),
  },
];

export const useExercises = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setExercises(parsed.map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
        })));
      } catch {
        setExercises(defaultExercises);
      }
    } else {
      setExercises(defaultExercises);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises));
    }
  }, [exercises, isLoading]);

  const addExercise = (exercise: Omit<Exercise, 'id' | 'createdAt'>) => {
    const newExercise: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setExercises((prev) => [...prev, newExercise]);
    return newExercise;
  };

  const updateExercise = (id: string, updates: Partial<Exercise>) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const deleteExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const calculateTotalCalories = (exerciseIds?: string[]) => {
    const targetExercises = exerciseIds
      ? exercises.filter((e) => exerciseIds.includes(e.id))
      : exercises;
    return targetExercises.reduce((acc, e) => acc + e.caloriesPerSet * e.sets, 0);
  };

  const calculateProteinNeeded = (calories: number) => {
    // Estimación: 1.6-2.2g de proteína por kg de peso corporal
    // Asumiendo 70kg promedio y ajustando por calorías quemadas
    return Math.round((calories / 4) * 0.3); // 30% de calorías de proteína
  };

  return {
    exercises,
    isLoading,
    addExercise,
    updateExercise,
    deleteExercise,
    calculateTotalCalories,
    calculateProteinNeeded,
  };
};
