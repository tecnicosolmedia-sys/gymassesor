import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExerciseAnalysis } from '@/hooks/useExerciseAnalysis';
import { buildExerciseAnalysisDigest } from '@/utils/exerciseSessionAnalysis';
import { SetConfig } from '@/types/exercise';

const invoke = vi.fn();
const toastError = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: any[]) => invoke(...a) } },
}));
vi.mock('sonner', () => ({ toast: { error: (...a: any[]) => toastError(...a), success: vi.fn() } }));

const configs: SetConfig[] = [
  { setNumber: 1, reps: 10, weight: 50, restTime: 90 },
  { setNumber: 2, reps: 8, weight: 55, restTime: 90 },
];

const digest = buildExerciseAnalysisDigest({
  exerciseId: 'ex-1',
  exerciseName: 'Press banca',
  muscleGroup: 'Pecho',
  configs,
  completedSets: [1, 2],
  sessions: [],
});

describe('cancelación real al desmontar useExerciseAnalysis', () => {
  beforeEach(() => {
    invoke.mockReset();
    toastError.mockReset();
  });

  it('una respuesta tardía tras unmount no se procesa ni produce efectos', async () => {
    let resolveFn: (v: any) => void = () => {};
    invoke.mockImplementation(() => new Promise(res => { resolveFn = res; }));

    const { result, unmount } = renderHook(() => useExerciseAnalysis());
    await act(async () => { result.current.analyze(digest); });
    expect(invoke).toHaveBeenCalledTimes(1);

    unmount();
    // La respuesta llega después del desmontaje
    await act(async () => {
      resolveFn({ data: { summary: 'texto tardío' }, error: null });
      await Promise.resolve();
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(result.current.report).toBeNull();
  });

  it('un error tardío tras unmount no muestra aviso', async () => {
    let rejectFn: (e: unknown) => void = () => {};
    invoke.mockImplementation(() => new Promise((_res, rej) => { rejectFn = rej; }));

    const { unmount } = renderHook(() => useExerciseAnalysis());
    unmount();
    // Petición ya cancelada por el cleanup: nada debe notificarse
    await act(async () => {
      rejectFn(new Error('late failure'));
      await Promise.resolve();
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('cancela y libera el bloqueo: cerrar permite volver a analizar', async () => {
    invoke.mockResolvedValue({ data: { summary: 'ok' }, error: null });
    const { result } = renderHook(() => useExerciseAnalysis());

    await act(async () => { await result.current.analyze(digest); });
    expect(result.current.report?.summary).toBe('ok');

    act(() => { result.current.close(); });
    expect(result.current.open).toBe(false);

    await act(async () => { await result.current.analyze(digest); });
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
