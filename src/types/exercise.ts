export interface SetConfig {
  setNumber: number;
  reps: number; // repeticiones (1-99)
  weight: number; // peso en kg (0-999, intervalos de 0.5)
  restTime: number; // segundos de descanso
}

export interface Exercise {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  sets: number;
  reps: number;
  weight: number; // peso por defecto (deprecated, usar setConfigs)
  setConfigs: SetConfig[]; // configuración individual por serie
  restBetweenSets: number; // tiempo por defecto entre series
  restAfterExercise: number; // seconds
  notes: string;
  caloriesPerSet: number;
  muscleGroup: string;
  createdAt: Date;
}

export interface WorkoutSession {
  id: string;
  date: Date;
  exercises: Exercise[];
  totalCalories: number;
  totalDuration: number;
  completed: boolean;
}

export interface UserStats {
  weight: number; // kg
  dailyCalorieGoal: number;
  proteinGoal: number; // grams
}
