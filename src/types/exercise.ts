export interface Exercise {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  sets: number;
  reps: number;
  weight: number;
  restBetweenSets: number; // seconds
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
