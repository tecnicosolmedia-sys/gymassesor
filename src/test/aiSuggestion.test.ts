import { describe, it, expect } from 'vitest';
import {
  buildAIHistory,
  canonicalizeSetSuggestions,
  canonicalizeRest,
  strictNumber,
  applySuggestionToConfigs,
  upsertSessionSetConfigs,
  configSignature,
  SessionSetStateLike,
} from '@/utils/aiSuggestion';
import { WorkoutSession } from '@/types/workoutHistory';
import { SetConfig } from '@/types/exercise';

const set = (setNumber: number, reps: number, weight: number, isWarmup?: boolean, restTime: any = 90) => ({
  setNumber, reps, weight, restTime, completedAt: new Date('2026-01-01'), isWarmup,
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

const cfg = (setNumber: number, reps: number, weight: number, restTime = 90, isWarmup?: boolean): SetConfig => ({
  setNumber, reps, weight, restTime, ...(isWarmup !== undefined ? { isWarmup } : {}),
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

  it('incluye el descanso registrado de cada serie válida', () => {
    const sessions = [session('a', '2026-02-01', [ex('e1', 'Press', [set(1, 8, 100, undefined, 120)])])];
    expect(buildAIHistory('e1', sessions)[0].sets).toEqual([
      { setNumber: 1, reps: 8, weight: 100, restTime: 120 },
    ]);
  });

  it('omite el descanso cuando no es un número válido, sin fabricarlo', () => {
    const sessions = [session('a', '2026-02-01', [ex('e1', 'Press', [set(1, 8, 100, undefined, null)])])];
    expect(buildAIHistory('e1', sessions)[0].sets).toEqual([
      { setNumber: 1, reps: 8, weight: 100 },
    ]);
  });

  it('excluye calentamientos explícitos y por nombre, y omite sesiones sin series efectivas', () => {
    const sessions = [
      session('a', '2026-02-01', [ex('e1', 'Press', [set(1, 10, 40, true), set(2, 8, 100)])]),
      session('b', '2026-01-01', [ex('e1', 'Calentamiento press', [set(1, 15, 20)])]),
    ];
    const h = buildAIHistory('e1', sessions);
    expect(h).toHaveLength(1);
    expect(h[0].sets).toEqual([{ setNumber: 1, reps: 8, weight: 100, restTime: 90 }]);
  });

  it('omite series con reps o peso inválidos', () => {
    const sessions = [
      session('a', '2026-02-01', [ex('e1', 'Press', [set(1, NaN, 100), set(2, 8, 100)])]),
    ];
    expect(buildAIHistory('e1', sessions)[0].sets).toEqual([
      { setNumber: 1, reps: 8, weight: 100, restTime: 90 },
    ]);
  });

  it('reúne todas las apariciones del mismo ejercicio en una sesión', () => {
    const sessions = [
      session('a', '2026-02-01', [
        ex('e1', 'Press', [set(1, 8, 100)]),
        ex('e1', 'Press', [set(1, 6, 105)]),
      ]),
    ];
    const h = buildAIHistory('e1', sessions);
    expect(h[0].sets.map(s => [s.setNumber, s.reps, s.weight])).toEqual([[1, 8, 100], [2, 6, 105]]);
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
      { setNumber: 3, reps: 9, weight: 100, restTime: 90 },
      { setNumber: 1, reps: 9, weight: 102.5, restTime: 90 },
    ]);
    expect(out.map(s => s.setNumber)).toEqual([1, 2, 3]);
    expect(out[1]).toEqual({ setNumber: 2, reps: 8, weight: 100, restTime: 90 });
  });

  it('descarta duplicados quedándose con el primero', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 9, weight: 102.5, restTime: 100 },
      { setNumber: 1, reps: 6, weight: 90, restTime: 30 },
    ]);
    expect(out).toEqual([{ setNumber: 1, reps: 9, weight: 102.5, restTime: 100 }]);
  });

  it('rechaza null, cadena vacía y booleanos sin convertirlos a números', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100), cfg(2, 8, 100)], [
      { setNumber: 1, reps: null, weight: '', restTime: null },
      { setNumber: 2, reps: true, weight: false, restTime: true },
    ]);
    expect(out).toEqual([
      { setNumber: 1, reps: 8, weight: 100, restTime: 90 },
      { setNumber: 2, reps: 8, weight: 100, restTime: 90 },
    ]);
  });

  it('ignora entradas cuyo setNumber es null, booleano o vacío', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: null, reps: 10, weight: 102.5, restTime: 95 },
    ]);
    expect(out).toEqual([{ setNumber: 1, reps: 10, weight: 102.5, restTime: 95 }]);
  });

  it('sustituye NaN, infinitos y valores ausentes por la configuración actual', () => {
    const out = canonicalizeSetSuggestions(current, [
      { setNumber: 1, reps: NaN, weight: Infinity, restTime: NaN },
      { setNumber: 2, reps: 'x', weight: null },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 8, weight: 100, restTime: 90 });
    expect(out[1]).toEqual({ setNumber: 2, reps: 8, weight: 100, restTime: 90 });
    expect(out[2]).toEqual({ setNumber: 3, reps: 8, weight: 100, restTime: 90 });
  });

  it('aplica límites exactos de ±2.5kg y ±2 reps con pasos de 0.5kg', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 40, weight: 200 },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 10, weight: 102.5, restTime: 90 });

    const down = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 1, weight: 10 },
    ]);
    expect(down[0]).toEqual({ setNumber: 1, reps: 6, weight: 97.5, restTime: 90 });

    const step = canonicalizeSetSuggestions([cfg(1, 8, 100)], [
      { setNumber: 1, reps: 8, weight: 101.3 },
    ]);
    expect(step[0].weight).toBe(101.5);
  });

  it('acota el descanso a ±30s y pasos de 5s', () => {
    expect(canonicalizeSetSuggestions([cfg(1, 8, 100, 90)], [
      { setNumber: 1, reps: 8, weight: 100, restTime: 600 },
    ])[0].restTime).toBe(120);

    expect(canonicalizeSetSuggestions([cfg(1, 8, 100, 90)], [
      { setNumber: 1, reps: 8, weight: 100, restTime: 15 },
    ])[0].restTime).toBe(60);

    expect(canonicalizeSetSuggestions([cfg(1, 8, 100, 90)], [
      { setNumber: 1, reps: 8, weight: 100, restTime: 97 },
    ])[0].restTime).toBe(95);

    // Nunca por debajo de 15s
    expect(canonicalizeSetSuggestions([cfg(1, 8, 100, 20)], [
      { setNumber: 1, reps: 8, weight: 100, restTime: 1 },
    ])[0].restTime).toBe(15);
  });

  it('las series de calentamiento conservan peso, reps y descanso', () => {
    const out = canonicalizeSetSuggestions([cfg(1, 12, 30, 60, true), cfg(2, 8, 100, 90)], [
      { setNumber: 1, reps: 20, weight: 60, restTime: 300 },
      { setNumber: 2, reps: 9, weight: 102.5, restTime: 100 },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 12, weight: 30, restTime: 60 });
    expect(out[1]).toEqual({ setNumber: 2, reps: 9, weight: 102.5, restTime: 100 });
  });

  it('fallback seguro: tabla vacía o inválida devuelve la configuración actual', () => {
    expect(canonicalizeSetSuggestions(current, null)).toEqual([
      { setNumber: 1, reps: 8, weight: 100, restTime: 90 },
      { setNumber: 2, reps: 8, weight: 100, restTime: 90 },
      { setNumber: 3, reps: 8, weight: 100, restTime: 90 },
    ]);
  });
});

describe('applySuggestionToConfigs', () => {
  it('reemplaza los tres parámetros preservando setNumber e isWarmup', () => {
    const current = [cfg(1, 12, 30, 60, true), cfg(2, 8, 100, 90), cfg(3, 8, 100, 90)];
    const out = applySuggestionToConfigs(current, [
      { setNumber: 1, reps: 20, weight: 60, restTime: 300 },
      { setNumber: 2, reps: 9, weight: 102.5, restTime: 110 },
      { setNumber: 3, reps: 10, weight: 101, restTime: 60 },
    ]);
    expect(out[0]).toEqual({ setNumber: 1, reps: 12, weight: 30, restTime: 60, isWarmup: true });
    expect(out[1]).toEqual({ setNumber: 2, reps: 9, weight: 102.5, restTime: 110 });
    expect(out[2]).toEqual({ setNumber: 3, reps: 10, weight: 101, restTime: 60 });
    // No muta la entrada
    expect(current[1]).toEqual({ setNumber: 2, reps: 8, weight: 100, restTime: 90 });
  });
});

describe('upsertSessionSetConfigs', () => {
  const states: SessionSetStateLike[] = [
    { instanceKey: 'e1#0', exerciseId: 'e1', currentSet: 1, completedSets: [] },
    { instanceKey: 'e1#1', exerciseId: 'e1', currentSet: 1, completedSets: [] },
  ];

  it('solo modifica la aparición indicada por instanceKey', () => {
    const out = upsertSessionSetConfigs(states, 'e1#1', 'e1', [cfg(1, 9, 102.5, 95)]);
    expect(out[0].sessionSetConfigs).toBeUndefined();
    expect(out[1].sessionSetConfigs).toEqual([cfg(1, 9, 102.5, 95)]);
  });

  it('crea la entrada si no existía y sobrevive a serialización', () => {
    const out = upsertSessionSetConfigs([], 'e2#0', 'e2', [cfg(1, 9, 50, 75)]);
    const restored = JSON.parse(JSON.stringify(out));
    expect(restored[0]).toEqual({
      instanceKey: 'e2#0', exerciseId: 'e2', currentSet: 1, completedSets: [],
      sessionSetConfigs: [{ setNumber: 1, reps: 9, weight: 50, restTime: 75 }],
    });
  });

  it('guardados antiguos sin instanceKey ni sessionSetConfigs siguen intactos', () => {
    const legacy: SessionSetStateLike[] = [{ exerciseId: 'e9', currentSet: 2, completedSets: [1] }];
    const out = upsertSessionSetConfigs(legacy, 'e1#0', 'e1', [cfg(1, 8, 100)]);
    expect(out[0]).toEqual(legacy[0]);
    expect(out).toHaveLength(2);
  });
});

describe('configSignature', () => {
  it('cambia si cambia la configuración o el número de series completadas', () => {
    const a = configSignature([cfg(1, 8, 100)], 0);
    expect(configSignature([cfg(1, 8, 100)], 0)).toBe(a);
    expect(configSignature([cfg(1, 8, 102.5)], 0)).not.toBe(a);
    expect(configSignature([cfg(1, 8, 100)], 1)).not.toBe(a);
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
