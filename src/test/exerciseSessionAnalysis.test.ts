import { describe, it, expect } from 'vitest';
import {
  buildExerciseAnalysisDigest,
  computeMetrics,
  getTodaySets,
  analysisSignature,
  localDateString,
  computeVerifiedRecords,
} from '@/utils/exerciseSessionAnalysis';
import { SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';

const configs: SetConfig[] = [
  { setNumber: 1, reps: 15, weight: 20, restTime: 60, isWarmup: true },
  { setNumber: 2, reps: 10, weight: 50, restTime: 90 },
  { setNumber: 3, reps: 8, weight: 55, restTime: 90 },
];

const session = (date: string, sets: { setNumber: number; reps: number; weight: number; restTime: number; isWarmup?: boolean }[]): WorkoutSession => ({
  id: `s-${date}`,
  date: new Date(date),
  exercises: [{
    exerciseId: 'ex-1',
    exerciseName: 'Press banca',
    muscleGroup: 'Pecho',
    totalSets: sets.length,
    startedAt: new Date(date),
    completedSets: sets.map(s => ({ ...s, completedAt: new Date(date) })),
  }],
  totalDuration: 0,
  startedAt: new Date(date),
  isComplete: true,
});

const base = {
  exerciseId: 'ex-1',
  exerciseName: 'Press banca',
  muscleGroup: 'Pecho',
  configs,
  completedSets: [1, 2, 3],
};

describe('exerciseSessionAnalysis', () => {
  it('excluye calentamientos de las series de hoy y calcula las métricas', () => {
    const sets = getTodaySets('Press banca', configs, [1, 2, 3]);
    expect(sets).toHaveLength(2);
    const m = computeMetrics(sets);
    expect(m.setCount).toBe(2);
    expect(m.totalReps).toBe(18);
    expect(m.totalVolume).toBe(10 * 50 + 8 * 55);
    expect(m.maxWeight).toBe(55);
    expect(m.avgRest).toBe(90);
  });

  it('usa solo las series completadas', () => {
    const sets = getTodaySets('Press banca', configs, [1, 2]);
    expect(sets).toHaveLength(1);
    expect(sets[0].weight).toBe(50);
  });

  it('sin histórico marca sesión de referencia inicial y sin comparación', () => {
    const d = buildExerciseAnalysisDigest({ ...base, sessions: [] });
    expect(d.isFirstReference).toBe(true);
    expect(d.previous).toBeNull();
    expect(d.deltas).toBeNull();
    expect(d.records).toEqual({ newMaxWeight: false, newBestVolume: false });
    expect(d.historySessionCount).toBe(0);
  });

  it('detecta de forma determinista récord de peso y de volumen', () => {
    const sessions = [
      session('2026-01-01', [{ setNumber: 1, reps: 10, weight: 45, restTime: 90 }]),
      session('2026-02-01', [{ setNumber: 1, reps: 10, weight: 50, restTime: 90 }]),
    ];
    const d = buildExerciseAnalysisDigest({ ...base, sessions });
    expect(d.previous?.date).toBe('2026-02-01');
    expect(d.previousBest.maxWeight).toBe(50);
    expect(d.records.newMaxWeight).toBe(true);
    expect(d.records.newBestVolume).toBe(true);
    expect(d.deltas?.maxWeight.abs).toBe(5);
    expect(d.deltas?.maxWeight.pct).toBe(10);
  });

  it('no declara récord cuando no se supera la marca previa', () => {
    const sessions = [session('2026-02-01', [{ setNumber: 1, reps: 20, weight: 80, restTime: 90 }])];
    const d = buildExerciseAnalysisDigest({ ...base, sessions });
    expect(d.records.newMaxWeight).toBe(false);
    expect(d.records.newBestVolume).toBe(false);
  });

  it('ignora calentamientos del histórico', () => {
    const sessions = [session('2026-02-01', [
      { setNumber: 1, reps: 20, weight: 200, restTime: 60, isWarmup: true },
      { setNumber: 2, reps: 10, weight: 40, restTime: 90 },
    ])];
    const d = buildExerciseAnalysisDigest({ ...base, sessions });
    expect(d.previousBest.maxWeight).toBe(40);
    expect(d.records.newMaxWeight).toBe(true);
  });

  it('unilateral: no convierte las repeticiones', () => {
    const d = buildExerciseAnalysisDigest({ ...base, sessions: [], isUnilateral: true });
    expect(d.isUnilateral).toBe(true);
    expect(d.today.totalReps).toBe(18);
  });

  it('limita el histórico a 10 sesiones y no mezcla la actual', () => {
    const sessions = Array.from({ length: 14 }, (_, i) =>
      session(`2026-0${(i % 9) + 1}-0${(i % 9) + 1}`, [{ setNumber: 1, reps: 10, weight: 40, restTime: 90 }]),
    );
    const d = buildExerciseAnalysisDigest({ ...base, sessions });
    expect(d.history.length).toBe(10);
    expect(d.historySessionCount).toBe(10);
    expect(d.today.maxWeight).toBe(55);
  });

  it('la firma cambia al corregir valores', () => {
    const a = analysisSignature(configs, [1, 2, 3]);
    const edited = configs.map(c => (c.setNumber === 3 ? { ...c, weight: 60 } : c));
    expect(analysisSignature(edited, [1, 2, 3])).not.toBe(a);
  });
});

describe('correcciones de auditoría', () => {
  it('conserva el número de serie original cuando la S1 es calentamiento', () => {
    const d = buildExerciseAnalysisDigest({ ...base, sessions: [] });
    expect(d.today.sets.map(s => s.setNumber)).toEqual([2, 3]);
    const sets = getTodaySets('Press banca', configs, [1, 2, 3]);
    expect(sets.map(s => s.setNumber)).toEqual([2, 3]);
  });

  it('usa el índice original + 1 si setNumber no es válido', () => {
    const raw = [
      { setNumber: NaN as unknown as number, reps: 12, weight: 30, restTime: 60, isWarmup: true },
      { setNumber: 0, reps: 10, weight: 40, restTime: 90 },
    ] as SetConfig[];
    expect(getTodaySets('Press banca', raw, [1, 2]).map(s => s.setNumber)).toEqual([2]);
  });

  it('localDateString usa la fecha LOCAL, no UTC', () => {
    const d = new Date(2026, 8, 21, 0, 30, 0); // 21 de septiembre, hora local
    expect(localDateString(d)).toBe('2026-09-21');
    expect(localDateString(d)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    // Un instante cercano al cambio de día en UTC no desplaza el día local
    const late = new Date(2026, 8, 21, 23, 45, 0);
    expect(localDateString(late)).toBe('2026-09-21');
    const digest = buildExerciseAnalysisDigest({ ...base, sessions: [], now: late });
    expect(digest.analysisDate).toBe('2026-09-21');
  });

  it('computeVerifiedRecords no admite récords manipulados', () => {
    // Marcas de hoy inferiores a las previas: nunca hay récord aunque se afirme
    expect(
      computeVerifiedRecords(
        { setCount: 2, maxWeight: 40, totalVolume: 500 },
        { maxWeight: 60, bestVolume: 900 },
      ),
    ).toEqual({ newMaxWeight: false, newBestVolume: false });
    // Sin histórico previo tampoco hay récord
    expect(
      computeVerifiedRecords(
        { setCount: 2, maxWeight: 100, totalVolume: 2000 },
        { maxWeight: null, bestVolume: null },
      ),
    ).toEqual({ newMaxWeight: false, newBestVolume: false });
    // Igualar no es superar
    expect(
      computeVerifiedRecords(
        { setCount: 2, maxWeight: 60, totalVolume: 900 },
        { maxWeight: 60, bestVolume: 900 },
      ),
    ).toEqual({ newMaxWeight: false, newBestVolume: false });
    // Superar estrictamente sí
    expect(
      computeVerifiedRecords(
        { setCount: 2, maxWeight: 62.5, totalVolume: 950 },
        { maxWeight: 60, bestVolume: 900 },
      ),
    ).toEqual({ newMaxWeight: true, newBestVolume: true });
  });

  it('el digest ignora cualquier récord que no se verifique con el histórico', () => {
    const sessions = [session('2026-02-01', [{ setNumber: 1, reps: 12, weight: 70, restTime: 90 }])];
    const d = buildExerciseAnalysisDigest({ ...base, sessions });
    expect(d.records).toEqual(computeVerifiedRecords(d.today, d.previousBest));
    expect(d.records.newMaxWeight).toBe(false);
  });
});
