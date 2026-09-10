import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/** Captura de las series insertadas en la BD (mock) */
const insertedSets: any[] = [];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string) => ({
    select: () => ({
      eq: () => ({ order: async () => ({ data: [], error: null }), limit: async () => ({ data: [], error: null }) }),
      in: async () => ({ data: [], error: null }),
      single: async () => ({ data: { id: `${table}-row` }, error: null }),
    }),
    insert: (rows: any[]) => {
      if (table === 'workout_completed_sets') insertedSets.push(...rows);
      return {
        select: () => ({ single: async () => ({ data: { id: `${table}-row` }, error: null }) }),
        then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res),
      };
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
    update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
  });
  return { supabase: { from: (table: string) => chain(table) } };
});

import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';

const logSet = (hook: any, setNumber: number) =>
  hook.current.logCompletedSet(
    'ex-lat',
    'Vuelo Lateral Deltoides de Pie',
    'Hombros',
    { setNumber, reps: 10, weight: 12 + setNumber, restTime: 60 },
    4,
  );

beforeEach(() => { insertedSets.length = 0; });

describe('useWorkoutHistory: la última serie sobrevive a endSession inmediato', () => {
  it('startSession + series 1..4 + endSession sin render intermedio persiste [1,2,3,4]', async () => {
    const { result } = renderHook(() => useWorkoutHistory());

    let session: any = null;
    await act(async () => {
      result.current.startSession('rut-1', 'Hombros');
      logSet(result, 1);
      logSet(result, 2);
      logSet(result, 3);
      logSet(result, 4);
      // Sin esperar otro render: endSession debe ver la cuarta serie
      session = await result.current.endSession();
    });

    const sets = session.exercises[0].completedSets.map((s: any) => s.setNumber);
    expect(sets).toEqual([1, 2, 3, 4]);
    expect(insertedSets.map(s => s.set_number)).toEqual([1, 2, 3, 4]);
    expect(session.isComplete).toBe(true);
  });

  it('no deduplica apariciones legítimas: dos ejercicios distintos conservan sus series', async () => {
    const { result } = renderHook(() => useWorkoutHistory());

    let session: any = null;
    await act(async () => {
      result.current.startSession();
      logSet(result, 1);
      result.current.logCompletedSet('ex-press', 'Press Militar', 'Hombros',
        { setNumber: 1, reps: 8, weight: 30, restTime: 90 }, 3);
      logSet(result, 2);
      session = await result.current.endSession();
    });

    expect(session.exercises.length).toBe(2);
    expect(session.exercises[0].completedSets.map((s: any) => s.setNumber)).toEqual([1, 2]);
    expect(session.exercises[1].completedSets.map((s: any) => s.setNumber)).toEqual([1]);
  });
});
