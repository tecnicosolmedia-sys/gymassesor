import { Exercise, SetConfig } from '@/types/exercise';
import { CompletedSet, ExerciseSession, WorkoutSession } from '@/types/workoutHistory';

/**
 * Helpers puros y centralizados para calentamientos, ejercicios efectivos
 * y presentación de repeticiones unilaterales.
 *
 * Reglas (aditivas y retrocompatibles):
 * - Una serie es calentamiento si tiene isWarmup === true, o si el nombre
 *   normalizado del ejercicio es exactamente "calentamiento" o empieza por
 *   "calentamiento ". Esto corrige totales de sesiones antiguas sin tocar datos.
 * - Un ejercicio solo cuenta como realizado si tiene al menos una serie efectiva.
 * - En unilaterales, el número almacenado sigue siendo el TOTAL de ambos lados.
 */

/** Normaliza texto: minúsculas, sin acentos, sin espacios extra. */
export const normalizeName = (name: string): string =>
  (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

/** ¿El ejercicio entero es un calentamiento por su nombre? (retrocompatibilidad) */
export const isWarmupExerciseName = (exerciseName: string): boolean => {
  const n = normalizeName(exerciseName);
  return n === 'calentamiento' || n.startsWith('calentamiento ');
};

/** ¿Esta serie es calentamiento? */
export const isWarmupSet = (
  exerciseName: string,
  set?: { isWarmup?: boolean } | null,
): boolean => {
  if (set?.isWarmup === true) return true;
  return isWarmupExerciseName(exerciseName);
};

/** Series efectivas (no calentamiento) de un ejercicio del historial. */
export const getEffectiveSets = (exercise: ExerciseSession): CompletedSet[] =>
  exercise.completedSets.filter(s => !isWarmupSet(exercise.exerciseName, s));

/** Series efectivas de configuraciones (durante el entrenamiento). */
export const getEffectiveConfigs = (
  exerciseName: string,
  configs: SetConfig[],
): SetConfig[] => configs.filter(c => !isWarmupSet(exerciseName, c));

/** ¿El ejercicio se considera realizado? (al menos una serie registrada) */
export const isExercisePerformed = (exercise: ExerciseSession): boolean =>
  exercise.completedSets.length > 0;

/** Ejercicios realizados de una sesión (excluye fichas con 0 series). */
export const getPerformedExercises = (session: WorkoutSession): ExerciseSession[] =>
  session.exercises.filter(isExercisePerformed);

/** Volumen (kg) de una lista de series: peso × repeticiones totales. */
export const getVolume = (sets: Array<{ weight: number; reps: number }>): number =>
  sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

export interface SessionStats {
  /** Ejercicios con al menos una serie registrada */
  exerciseCount: number;
  /** Series efectivas (sin calentamiento) */
  totalSets: number;
  /** Volumen efectivo en kg (sin calentamiento) */
  totalVolume: number;
  /** Series de calentamiento registradas */
  warmupSets: number;
}

/** Estadísticas de una sesión respetando calentamientos y fichas vacías. */
export const getSessionStats = (session: WorkoutSession): SessionStats => {
  let exerciseCount = 0;
  let totalSets = 0;
  let totalVolume = 0;
  let warmupSets = 0;

  session.exercises.forEach(ex => {
    if (!isExercisePerformed(ex)) return;
    exerciseCount++;
    const effective = getEffectiveSets(ex);
    warmupSets += ex.completedSets.length - effective.length;
    totalSets += effective.length;
    totalVolume += getVolume(effective);
  });

  return { exerciseCount, totalSets, totalVolume, warmupSets };
};

/** Estadísticas agregadas de varias sesiones. */
export const getAggregatedStats = (sessions: WorkoutSession[]) => {
  let totalExercises = 0;
  let totalSets = 0;
  let totalWeight = 0;
  let totalDuration = 0;

  sessions.forEach(session => {
    totalDuration += session.totalDuration;
    const s = getSessionStats(session);
    totalExercises += s.exerciseCount;
    totalSets += s.totalSets;
    totalWeight += s.totalVolume;
  });

  return {
    totalWorkouts: sessions.length,
    totalExercises,
    totalSets,
    totalWeight,
    averageWorkoutDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
  };
};

/* ------------------------------ Unilaterales ------------------------------ */

export type UnilateralSource =
  | boolean
  | undefined
  | null
  | Pick<Exercise, 'isUnilateral'>;

const resolveUnilateral = (source: UnilateralSource): boolean => {
  if (typeof source === 'boolean') return source;
  if (source && typeof source === 'object') return source.isUnilateral === true;
  return false;
};

/** Mapa exerciseId -> isUnilateral, para consultar históricos sin alterarlos. */
export const buildUnilateralMap = (exercises: Exercise[]): Record<string, boolean> => {
  const map: Record<string, boolean> = {};
  exercises.forEach(e => { map[e.id] = e.isUnilateral === true; });
  return map;
};

/**
 * Formatea repeticiones para mostrar.
 * - No unilateral: "12"
 * - Unilateral par: "12 por lado" (24 almacenadas)
 * - Unilateral impar: "23 totales · por lado"
 */
export const formatReps = (source: UnilateralSource, reps: number): string => {
  if (!resolveUnilateral(source)) return `${reps}`;
  if (reps % 2 === 0) return `${reps / 2} por lado`;
  return `${reps} totales · por lado`;
};

/** Variante con el total explícito: "12 por lado (24 totales)". */
export const formatRepsWithTotal = (source: UnilateralSource, reps: number): string => {
  if (!resolveUnilateral(source)) return `${reps}`;
  if (reps % 2 === 0) return `${reps / 2} por lado (${reps} totales)`;
  return `${reps} totales · por lado`;
};

/** Etiqueta corta para chips: "12/lado" o "24". */
export const formatRepsShort = (source: UnilateralSource, reps: number): string => {
  if (!resolveUnilateral(source)) return `${reps}`;
  if (reps % 2 === 0) return `${reps / 2}/lado`;
  return `${reps} tot.`;
};
