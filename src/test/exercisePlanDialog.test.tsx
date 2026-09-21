import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkoutFlow, ExerciseSetState } from '@/components/WorkoutFlow';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise, SetConfig } from '@/types/exercise';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: vi.fn(() => ({ landmarks: [] })),
      close: vi.fn(),
    })),
  },
}));

vi.mock('@/hooks/useWakeLock', () => ({ useWakeLock: () => {} }));

vi.mock('@/hooks/useWorkoutNotification', () => ({
  useWorkoutNotification: () => ({
    isSupported: false,
    permission: 'denied',
    requestPermission: async () => 'denied',
    showNotification: () => {},
    closeNotification: () => {},
    updateWorkoutNotification: () => {},
    updateRestNotification: () => {},
    startWorkoutUpdates: () => {},
    stopUpdates: () => {},
  }),
}));

const setConfigs: SetConfig[] = [
  { setNumber: 1, reps: 12, weight: 20, restTime: 60, isWarmup: true },
  { setNumber: 2, reps: 10, weight: 30, restTime: 90 },
  { setNumber: 3, reps: 8, weight: 35, restTime: 120 },
];

const exercise: Exercise = {
  id: 'ex-plan',
  name: 'Press Banca',
  sets: 3,
  reps: 10,
  weight: 30,
  setConfigs,
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const initialStates: ExerciseSetState[] = [
  { exerciseId: 'ex-plan', instanceKey: 'ex-plan#0', currentSet: 1, completedSets: [] },
];

const flowProps = (onSetComplete = vi.fn()) => ({
  routineName: 'Pecho',
  exercises: [exercise],
  allExercises: [exercise],
  onClose: vi.fn(),
  onSetComplete,
  onEditExercise: vi.fn(),
  onDeleteExercise: vi.fn(),
  workoutSessions: [],
  initialExerciseSetStates: initialStates,
});

const openPlan = () => fireEvent.click(screen.getByText(/Ver ejercicio completo/i));
const planSet = (n: number) => screen.getByTestId(`plan-set-${n}`);

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('vista del ejercicio completo durante la ejecución', () => {
  it('al inicio muestra todas las series, 0 de Y, primera Siguiente y resto Pendiente', () => {
    render(<WorkoutFlow {...flowProps()} />);
    openPlan();

    expect(screen.getByText(/0 de 3 series realizadas/i)).toBeTruthy();
    expect(planSet(1).textContent).toContain('Siguiente');
    expect(planSet(2).textContent).toContain('Pendiente');
    expect(planSet(3).textContent).toContain('Pendiente');
    // Valores efectivos y calentamiento
    expect(planSet(1).textContent).toContain('Calentamiento');
    expect(planSet(3).textContent).toContain('35 kg');
    expect(planSet(3).textContent).toContain('120s');
  });

  it('durante el descanso el botón abre la vista con la primera Realizada y la segunda Siguiente', () => {
    render(<WorkoutFlow {...flowProps()} />);
    fireEvent.click(screen.getByText(/Completar Serie 1/i));

    // Estamos en el descanso entre series (FullscreenTimer)
    expect(screen.getByText(/Saltar y continuar/i)).toBeTruthy();
    openPlan();

    expect(screen.getByText(/1 de 3 series realizadas/i)).toBeTruthy();
    expect(planSet(1).textContent).toContain('Realizada');
    expect(planSet(2).textContent).toContain('Siguiente');
  });

  it('el temporizador sigue avanzando mientras la ventana está abierta', () => {
    vi.useFakeTimers();
    render(<WorkoutFlow {...flowProps()} />);
    fireEvent.click(screen.getByText(/Completar Serie 1/i));

    const before = document.querySelector('.font-lcd')?.textContent;
    openPlan();
    act(() => { vi.advanceTimersByTime(3000); });
    const after = document.querySelector('.font-lcd')?.textContent;

    expect(before).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it('cerrar por X, Escape o fuera no altera el estado ni dispara onSetComplete', () => {
    const onSetComplete = vi.fn();
    render(<WorkoutFlow {...flowProps(onSetComplete)} />);
    openPlan();

    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(screen.queryByTestId('plan-set-1')).toBeNull();

    openPlan();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('plan-set-1')).toBeNull();

    openPlan();
    fireEvent.click(screen.getByTestId('exercise-plan-overlay'));
    expect(screen.queryByTestId('plan-set-1')).toBeNull();

    expect(onSetComplete).not.toHaveBeenCalled();
    // Seguimos en la serie 1, sin series completadas
    expect(screen.getByText(/Completar Serie 1/i)).toBeTruthy();
    expect(screen.getByText('0 / 3 completadas')).toBeTruthy();
  });

  it('refleja los cambios de valores hechos durante la sesión', () => {
    render(<WorkoutFlow {...flowProps()} />);
    openPlan();
    expect(planSet(2).textContent).toContain('30 kg');
    fireEvent.click(screen.getByLabelText('Cerrar'));

    // Cambio de sesión: completar la serie 1 con el peso modificado no afecta,
    // pero un cambio en la configuración efectiva sí debe verse.
    const plus = screen.getAllByLabelText(/Aumentar peso/i)[1];
    fireEvent.click(plus);

    openPlan();
    expect(planSet(2).textContent).toContain('30.5 kg');
  });

  it('no aparece el botón en una ficha inactiva de rutina/biblioteca', () => {
    render(
      <ExerciseCard
        exercise={exercise}
        isActive={false}
        onActivate={vi.fn()}
        onSetComplete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Ver ejercicio completo/i)).toBeNull();
  });
});
