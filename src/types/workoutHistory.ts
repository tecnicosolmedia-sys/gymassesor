export interface CompletedSet {
  setNumber: number;
  reps: number;
  weight: number;
  restTime: number;
  completedAt: Date;
}

export interface ExerciseSession {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  completedSets: CompletedSet[];
  totalSets: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkoutSession {
  id: string;
  date: Date;
  routineId?: string;
  routineName?: string;
  exercises: ExerciseSession[];
  totalDuration: number; // in seconds
  startedAt: Date;
  completedAt?: Date;
  isComplete: boolean;
}

export interface WorkoutStats {
  totalWorkouts: number;
  totalExercises: number;
  totalSets: number;
  totalWeight: number; // kg lifted total
  averageWorkoutDuration: number; // seconds
}
