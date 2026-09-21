import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExerciseSummary } from '@/components/ExerciseSummary';
import { SetConfig } from '@/types/exercise';

const invoke = vi.fn();
const from = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invoke(...args) },
    from: (...args: any[]) => from(...args),
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const setConfigs: SetConfig[] = [
  { setNumber: 1, reps: 10, weight: 50, restTime: 90 },
  { setNumber: 2, reps: 8, weight: 55, restTime: 90 },
];

const props = {
  exerciseName: 'Press banca',
  exerciseId: 'ex-1',
  muscleGroup: 'Pecho',
  setConfigs,
  completedSets: [1, 2],
  onContinue: () => {},
};

const report = {
  summary: 'Sesión sólida y estable.',
  previousComparison: 'No hay sesión anterior registrada.',
  weightAnalysis: 'Carga máxima 55 kg.',
  repsAnalysis: '18 repeticiones efectivas.',
  volumeAnalysis: 'Volumen 940 kg.',
  restAnalysis: 'Descanso registrado 90 s.',
  coaching: 'Buen trabajo.',
  nextSessionRecommendation: 'Repite la carga y cierra repeticiones.',
  basis: 'Basado en las series registradas.',
};

describe('Análisis IA del ejercicio en el resumen', () => {
  beforeEach(() => {
    invoke.mockReset();
    from.mockReset();
  });

  it('un doble clic solo lanza una invocación y muestra el informe', async () => {
    let resolveFn: (v: any) => void = () => {};
    invoke.mockImplementation(() => new Promise(res => { resolveFn = res; }));

    render(<ExerciseSummary {...props} />);
    const btn = screen.getByLabelText('Analizar ejercicio con IA');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe('analyze-exercise-session');

    resolveFn({ data: report, error: null });
    await waitFor(() => expect(screen.getByText('Sesión sólida y estable.')).toBeTruthy());
    expect(screen.getByLabelText('Sesión de referencia inicial')).toBeTruthy();
    expect(screen.getByLabelText('Base de datos utilizada').textContent).toContain('0 sesiones');
    // Nada se guarda en la base de datos
    expect(from).not.toHaveBeenCalled();
  });

  it('envía solo las series completadas con los valores corregidos', async () => {
    invoke.mockResolvedValue({ data: report, error: null });
    render(<ExerciseSummary {...props} />);

    // Corrige el peso de la primera serie (+0.5 kg)
    const plusButtons = screen.getAllByRole('button');
    fireEvent.click(plusButtons.find(b => b.className.includes('rounded bg-secondary'))!); // -1 rep serie 1

    fireEvent.click(screen.getByLabelText('Analizar ejercicio con IA'));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const body = invoke.mock.calls[0][1].body;
    expect(body.today.sets).toHaveLength(2);
    expect(body.today.sets[0].reps).toBe(9);
  });

  it('una corrección posterior invalida el informe', async () => {
    invoke.mockResolvedValue({ data: report, error: null });
    render(<ExerciseSummary {...props} />);
    fireEvent.click(screen.getByLabelText('Analizar ejercicio con IA'));
    await waitFor(() => expect(screen.getByText('Sesión sólida y estable.')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Cerrar el análisis'));
    const stepper = await waitFor(() => {
      const b = screen.getAllByRole('button').find(x => x.className.includes('rounded bg-secondary'));
      if (!b) throw new Error('sin stepper');
      return b;
    });
    fireEvent.click(stepper);
    // El informe anterior deja de estar disponible: hay que volver a analizar
    await waitFor(() => expect(screen.queryByText('Sesión sólida y estable.')).toBeNull());
    fireEvent.click(screen.getByLabelText('Analizar ejercicio con IA'));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  });

  it('muestra un error legible y permite reintentar', async () => {
    invoke.mockResolvedValueOnce({ data: { error: 'rate_limited' }, error: null });
    render(<ExerciseSummary {...props} />);
    fireEvent.click(screen.getByLabelText('Analizar ejercicio con IA'));
    await waitFor(() =>
      expect(screen.getByText('Demasiadas peticiones. Espera un momento.')).toBeTruthy(),
    );

    invoke.mockResolvedValueOnce({ data: report, error: null });
    fireEvent.click(screen.getByLabelText('Reintentar el análisis'));
    await waitFor(() => expect(screen.getByText('Sesión sólida y estable.')).toBeTruthy());
  });

  it('ignora la respuesta tardía si se cierra el diálogo o se desmonta', async () => {
    let resolveFn: (v: any) => void = () => {};
    invoke.mockImplementation(() => new Promise(res => { resolveFn = res; }));

    const { unmount } = render(<ExerciseSummary {...props} />);
    fireEvent.click(screen.getByLabelText('Analizar ejercicio con IA'));
    unmount();
    resolveFn({ data: report, error: null });
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByText('Sesión sólida y estable.')).toBeNull();
  });
});
