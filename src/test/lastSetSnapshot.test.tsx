import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutFlow, ExerciseSetState } from '@/components/WorkoutFlow';
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
  { setNumber: 1, reps: 12, weight: 12, restTime: 60 },
  { setNumber: 2, reps: 12, weight: 14, restTime: 60 },
  { setNumber: 3, reps: 10, weight: 18, restTime: 60 },
  { setNumber: 4, reps: 8, weight: 20, restTime: 75 },
];

const exercise: Exercise = {
  id: 'ex-lat',
  name: 'Vuelo Lateral Deltoides de Pie',
  sets: 4,
  reps: 12,
  weight: 12,
  setConfigs,
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Hombros',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const initialStates: ExerciseSetState[] = [
  { exerciseId: 'ex-lat', instanceKey: 'ex-lat#0', currentSet: 1, completedSets: [] },
];

const flowProps = (onSetComplete = vi.fn()) => ({
  routineName: 'Hombros',
  exercises: [exercise],
  allExercises: [exercise],
  onClose: vi.fn(),
  onSetComplete,
  onEditExercise: vi.fn(),
  onDeleteExercise: vi.fn(),
  workoutSessions: [],
  initialExerciseSetStates: initialStates,
});

const completeSet = (n: number) =>
  fireEvent.click(screen.getByText(new RegExp(`Completar Serie ${n}`, 'i')));

/** Cierra el descanso entre series avanzando a la siguiente. */
const skipRest = () => fireEvent.click(screen.getByText(/Saltar y continuar/i));

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

const summaryRows = () =>
  Array.from(document.querySelectorAll('.grid.grid-cols-4')).slice(1);

describe('última serie: sin pérdida ni duplicación', () => {
  it('tras completar 1,2,3,4 el resumen muestra 4 filas y 4 series completadas', () => {
    render(<WorkoutFlow {...flowProps()} />);

    completeSet(1); skipRest();
    completeSet(2); skipRest();
    completeSet(3); skipRest();
    completeSet(4);

    expect(screen.getByText(/4 series completadas/i)).toBeTruthy();
    expect(summaryRows().length).toBe(4);
  });

  it('la cuarta serie usa exactamente sus reps/peso/descanso efectivos', () => {
    render(<WorkoutFlow {...flowProps()} />);

    completeSet(1); skipRest();
    completeSet(2); skipRest();
    completeSet(3); skipRest();
    completeSet(4);

    const row = summaryRows()[3];
    expect(row.textContent).toContain('8');
    expect(row.textContent).toContain('20');
    expect(row.textContent).toContain('75s');
  });

  it('doble tap rápido en la cuarta: una sola llamada y una sola transición', () => {
    const onSetComplete = vi.fn();
    render(<WorkoutFlow {...flowProps(onSetComplete)} />);

    completeSet(1); skipRest();
    completeSet(2); skipRest();
    completeSet(3); skipRest();

    const button = screen.getByText(/Completar Serie 4/i);
    fireEvent.click(button);
    fireEvent.click(button);

    const fourthCalls = onSetComplete.mock.calls.filter(c => c[3].setNumber === 4);
    expect(fourthCalls.length).toBe(1);
    expect(onSetComplete.mock.calls.length).toBe(4);
    expect(screen.getByText(/4 series completadas/i)).toBeTruthy();
    expect(summaryRows().length).toBe(4);
  });

  it('"Terminar ejercicio" con 3 de 4 resume solo 3 series', () => {
    render(<WorkoutFlow {...flowProps()} />);

    completeSet(1); skipRest();
    completeSet(2); skipRest();
    completeSet(3); skipRest();

    fireEvent.click(screen.getByText(/Terminar ejercicio \(3\/4 series\)/i));

    expect(screen.getByText(/3 series completadas/i)).toBeTruthy();
    expect(summaryRows().length).toBe(3);
  });
});
