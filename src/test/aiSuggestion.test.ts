import { describe, it, expect } from 'vitest';
import {
  buildAIHistory,
  canonicalizeSetSuggestions,
  canonicalizeRest,
  strictNumber,
} from '@/utils/aiSuggestion';
import { WorkoutSession } from '@/types/workoutHistory';
import { SetConfig } from '@/types/exercise';

const set = (setNumber: number, reps: number, weight: number, isWarmup?: boolean) => ({
  setNumber, reps, weight, restTime: 90, completedAt: new Date('2026-01-01'), isWarmup,
});

const session = (id: string, date: string, exercises: any[]): WorkoutSession => ({
  id,
  date: new Date(date),
  exercises,
  totalDuration: 0,
  startedAt: new Date(date),
  isComplete: true,
});

const ex = (exerciseId: string, exerciseName: string, sets: any[]) => ({
  exerciseId,
  exerciseName,
  muscleGroup: 'Pecho',
  completedSets: sets,
  totalSets: sets.length,
  startedAt: new Date('2026-01-01'),
});

const cfg = (setNumber: number, reps: number, weight: number): SetConfig => ({
  setNumber, reps, weight, restTime: 90,
});

describe('buildAIHistory', () => {
  it('ordena por fecha descendente', () => {
    const sessions = [
      session('a', '2026-01-01', [ex('e1', 'Press', [set(1, 8, 100)])]),
      session('b', '2026-03-01', [ex('e1', 'Press', [set(1, 8, 110)])]),
      session('c', '2026-02-01', [ex('e1', 'Press', [set(1, 8, 105)])]),
    ];
    const h = buildAIHistory('e1', sessions);
    expect(h.map(x => x.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('excluye calentamientos explícitos y por nombre, y omite sesiones sin series efectivas', () => {
    const sessions = [
      session('a', '2026-02-01', [ex('e1', 'Press', [set(1, 10, 40, true), set(2, 8, 100)])]),
      session('b', '2026-01-01', [ex('e1', 'Calentamiento press', [set(1, 15, 20)])]),
    ];
    const h = buildAIHistory('e1', sessions);
    expect(h).toHaveLength(1);
    expect(h[0].sets).toEqual([{ setNumber: 1, reps: 8, weight: 100 }]);
  });

  it('reúne todas las apariciones del mismo ejercicio en una sesión', () => {
    const sessions = [
      session('a', '2026-02-01', [
        ex('e1', 'Press', [set(1, 8, 100)]),
        ex('e1', 'Press', [set(1, 6, 105)]),
      ]),
    ];
    const h = buildAIHistory('e1', sessions);
    expect(h[0].sets).toEqual([
      { setNumber: 1, reps: 8, weight: 100 },
      { setNumber: 2, reps: 6, weight: 105 },
    ]);
  });

  it('limita a las 10 sesiones más recientes y no muta la entrada', () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      session(`s${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`, [ex('e1', 'Press', [set(1, 8, 100 + i)])]),
    );
    const copy = JSON.stringify(sessions);
    const h = buildAIHistory('e1', sessions);
    expect(h).toHaveLength(10);
    expect(h[0].date).toBe('2026-01-12');
    expect(JSON.stringify(sessions)).toBe(copy);
  });

  it('devuelve vacío si el histórico solo contiene calentamientos', () => {
    const sessions = [
      session('a', '2026-02-01', [ex('e1', 'Press', [set(1, 12, 30, true), set(2, 12, 30, true)])]),
      session('b', '2026-01-01', [ex('e1', 'Calentamiento', [set(1, 15, 20)])]),
    ];
    expect(buildAIHistory('e1', sessions)).toEqual([]);
  });

  it('conserva reps totales en unilateral (24 total)', () => {
    const sessions = [session('a', '2026-02-01', [ex('e1', 'Zancada', [set(1, 24, 20)])])];
    expect(buildAIHistory('e1', sessions)[0].sets[0].reps).toBe(24);
  });
});

describe('canonicalizeSetSuggestions', () => {
  const current = [cfg(1, 8, 100), cfg(2, 8, 100), cfg(3, 8, 100)];

  it('devuelve exactamente una sugerencia por serie actual, en orden', () => {
    const out = canonicalizeSetSuggestions(current, [
      { setNumber: 3, reps: 9, weight: 100 },
      { setNumber: 1, reps: 9, weight: 102.5 },
    ]);
    expect(out.map(s => s.setNumber)).toEqual([1, 2, 3]);
    expect(out[1]).toEqual({ setNumber: 2, reps: 8, weight: 100 });
  });

  it('descarta duplicados quedándose con el primero', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 9, weight: 102.5 },
      { setNumber: 1, reps: 6, weight: 90 },
    ]);
    expect(out).toEqual([{ setNumber: 1, reps: 9, weight: 102.5 }]);
  });

  it('rechaza null, cadena vacía y booleanos sin convertirlos a números', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100), cfg(2, 8, 100)], [
      { setNumber: 1, reps: null, weight: '' },
      { setNumber: 2, reps: true, weight: false },
    ]);
    expect(out).toEqual([
      { setNumber: 1, reps: 8, weight: 100 },
      { setNumber: 2, reps: 8, weight: 100 },
    ]);
  });

  it('ignora entradas cuyo setNumber es null, booleano o vacío', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: null, reps: 10, weight: 102.5 },
    ]);
    // Sin setNumber válido en ninguna entrada se admite el orden posicional.
    expect(out).toEqual([{ setNumber: 1, reps: 10, weight: 102.5 }]);
  });

  it('sustituye NaN, infinitos y valores ausentes por la configuración actual', () => {
    const out = canonicalizeSetSuggestions(current, [
      { setNumber: 1, reps: NaN, weight: Infinity },
      { setNumber: 2, reps: 'x', weight: null },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 8, weight: 100 });
    expect(out[1]).toEqual({ setNumber: 2, reps: 8, weight: 100 });
    expect(out[2]).toEqual({ setNumber: 3, reps: 8, weight: 100 });
  });

  it('aplica límites exactos de ±2.5kg y ±2 reps con pasos de 0.5kg', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 40, weight: 200 },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 10, weight: 102.5 });

    const down = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 1, weight: 10 },
    ]);
    expect(down[0]).toEqual({ setNumber: 1, reps: 6, weight: 97.5 });

    // Justo en el límite: se acepta sin recortar.
    const edge = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 10, weight: 102.5 },
    ]);
    expect(edge[0]).toEqual({ setNumber: 1, reps: 10, weight: 102.5 });

    const step = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 8, weight: 101.3 },
    ]);
    expect(step[0].weight).toBe(101.5);
  });

  it('fallback seguro: tabla vacía o inválida devuelve la configuración actual', () => {
    expect(canonicalizeSetSuggestions(current, null)).toEqual([
      { setNumber: 1, reps: 8, weight: 100 },
      { setNumber: 2, reps: 8, weight: 100 },
      { setNumber: 3, reps: 8, weight: 100 },
    ]);
  });
});

describe('canonicalizeRest', () => {
  it('acota entre 15 y 600 y usa fallback', () => {
    expect(canonicalizeRest(1000, 90)).toBe(600);
    expect(canonicalizeRest(1, 90)).toBe(15);
    expect(canonicalizeRest('x', 120)).toBe(120);
    expect(canonicalizeRest(undefined, undefined)).toBe(90);
  });
});

describe('strictNumber', () => {
  it('rechaza null, undefined, cadenas vacías, booleanos y texto no numérico', () => {
    [null, undefined, '', '   ', true, false, 'abc', NaN, Infinity, {}, []].forEach(v => {
      expect(strictNumber(v)).toBeUndefined();
    });
  });

  it('acepta números finitos y cadenas numéricas', () => {
    expect(strictNumber(0)).toBe(0);
    expect(strictNumber(-2.5)).toBe(-2.5);
    expect(strictNumber('12.5')).toBe(12.5);
  });
});
