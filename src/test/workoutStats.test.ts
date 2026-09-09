import { describe, it, expect } from 'vitest';
import {
  formatReps,
  formatRepsShort,
  getEffectiveConfigs,
  getEffectiveSets,
  getSessionStats,
  isExercisePerformed,
  isWarmupExerciseName,
  isWarmupSet,
} from '@/utils/workoutStats';
import type { WorkoutSession, ExerciseSession, CompletedSet } from '@/types/workoutHistory';

const set = (setNumber: number, reps: number, weight: number, isWarmup?: boolean): CompletedSet => ({
  setNumber,
  reps,
  weight,
  restTime: 90,
  completedAt: new Date('2026-01-01T10:00:00Z'),
  ...(isWarmup !== undefined ? { isWarmup } : {}),
}) as CompletedSet;

const exercise = (
  exerciseName: string,
  completedSets: CompletedSet[],
  exerciseId = exerciseName,
): ExerciseSession => ({
  exerciseId,
  exerciseName,
  muscleGroup: 'Pecho',
  totalSets: completedSets.length,
  completedSets,
  startedAt: new Date('2026-01-01T10:00:00Z'),
} as ExerciseSession);

const session = (exercises: ExerciseSession[]): WorkoutSession => ({
  id: 's1',
  date: new Date('2026-01-01T10:00:00Z'),
  totalDuration: 3600,
  exercises,
} as WorkoutSession);

describe('ejercicios sin series', () => {
  it('no cuenta como realizado', () => {
    expect(isExercisePerformed(exercise('Press banca', []))).toBe(false);
  });

  it('no aporta ejercicios, series ni volumen', () => {
    const stats = getSessionStats(session([
      exercise('Press banca', []),
      exercise('Remo', [set(1, 10, 50)]),
    ]));
    expect(stats.exerciseCount).toBe(1);
    expect(stats.totalSets).toBe(1);
    expect(stats.totalVolume).toBe(500);
  });
});

describe('calentamientos', () => {
  it('detecta calentamiento explícito', () => {
    expect(isWarmupSet('Press banca', { isWarmup: true })).toBe(true);
    expect(isWarmupSet('Press banca', { isWarmup: false })).toBe(false);
  });

  it('detecta ejercicios históricos llamados "Calentamiento"', () => {
    expect(isWarmupSet('Calentamiento', {})).toBe(true);
    expect(isWarmupSet('calentamiento cinta 10 min', {})).toBe(true);
    expect(isWarmupSet('Press calentamiento', {})).toBe(false);
  });

  it('no suma volumen ni series efectivas', () => {
    const stats = getSessionStats(session([
      exercise('Press banca', [set(1, 10, 40, true), set(2, 10, 60)]),
      exercise('Calentamiento', [set(1, 20, 10)]),
    ]));
    expect(stats.exerciseCount).toBe(2);
    expect(stats.totalSets).toBe(1);
    expect(stats.totalVolume).toBe(600);
    expect(stats.warmupSets).toBe(2);
  });

  it('filtra configuraciones de calentamiento', () => {
    const configs = [
      { setNumber: 1, reps: 10, weight: 20, restTime: 60, isWarmup: true },
      { setNumber: 2, reps: 10, weight: 60, restTime: 60 },
    ];
    expect(getEffectiveConfigs('Press banca', configs)).toHaveLength(1);
  });

  it('contador efectivo: excluye calentamientos explícitos y por nombre', () => {
    const ex = exercise('Press banca', [set(1, 10, 20, true), set(2, 10, 60), set(3, 8, 60)]);
    expect(getEffectiveSets(ex)).toHaveLength(2);
    expect(ex.completedSets.length - getEffectiveSets(ex).length).toBe(1);

    const legacy = exercise('Calentamiento movilidad', [set(1, 15, 0), set(2, 15, 0)]);
    expect(getEffectiveSets(legacy)).toHaveLength(0);
    expect(legacy.completedSets.length).toBe(2);
  });

  it('la regla por nombre no se desactiva con isWarmup: false', () => {
    expect(isWarmupExerciseName('Calentamiento hombro')).toBe(true);
    expect(isWarmupSet('Calentamiento hombro', { isWarmup: false })).toBe(true);
    expect(isWarmupSet('Calentamiento hombro', {})).toBe(true);
    expect(isWarmupSet('Press banca', { isWarmup: false })).toBe(false);
  });
});

describe('unilaterales', () => {
  it('par: 24 se muestra como 12 por lado', () => {
    expect(formatReps(true, 24)).toBe('12 por lado');
    expect(formatRepsShort(true, 24)).toBe('12/lado');
  });

  it('impar: no inventa mitades', () => {
    expect(formatReps(true, 23)).toBe('23 totales · por lado');
    expect(formatRepsShort(true, 23)).toBe('23 tot.');
  });

  it('no unilateral se muestra tal cual', () => {
    expect(formatReps(false, 12)).toBe('12');
    expect(formatReps(undefined, 12)).toBe('12');
  });

  it('el volumen usa las reps totales', () => {
    const stats = getSessionStats(session([
      exercise('Press unilateral', [set(1, 24, 30)]),
    ]));
    expect(stats.totalVolume).toBe(720);
  });
});
