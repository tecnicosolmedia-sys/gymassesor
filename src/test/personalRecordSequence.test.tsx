import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { WorkoutFlow, ExerciseSetState } from '@/components/WorkoutFlow';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise, SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';

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

const exercise: Exercise = {
  id: 'ex-1',
  name: 'Press banca',
  sets: 1,
  reps: 8,
  weight: 50,
  setConfigs: [{ setNumber: 1, reps: 8, weight: 50, restTime: 45 }],
  restBetweenSets: 45,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

/** Histórico con una marca previa de 50 kg. */
const history: WorkoutSession[] = [
  {
    id: 's1',
    date: new Date('2026-01-02T10:00:00Z'),
    exercises: [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Press banca',
        muscleGroup: 'Pecho',
        totalSets: 1,
        startedAt: new Date('2026-01-02T10:00:00Z'),
        completedSets: [
          { setNumber: 1, reps: 8, weight: 50, restTime: 45, completedAt: new Date('2026-01-02T10:05:00Z') },
        ],
      },
    ],
    totalDuration: 600,
    startedAt: new Date('2026-01-02T10:00:00Z'),
    isComplete: true,
  },
];

const configs = (weight: number): SetConfig[] => [
  { setNumber: 1, reps: 8, weight, restTime: 45 },
];

const setStates = (weight: number): ExerciseSetState[] => [
  {
    exerciseId: 'ex-1',
    instanceKey: 'ex-1#0',
    currentSet: 1,
    completedSets: [],
    sessionSetConfigs: configs(weight),
  },
];

const flowProps = (weight: number) => ({
  routineName: 'Rutina test',
  exercises: [exercise],
  allExercises: [exercise],
  onClose: vi.fn(),
  onSetComplete: vi.fn(),
  onEditExercise: vi.fn(),
  onDeleteExercise: vi.fn(),
  workoutSessions: history,
  initialExerciseSetStates: setStates(weight),
});

const RECORD_TITLE = /RÉCORD PERSONAL/i;

/** Dígitos del temporizador de descanso a pantalla completa. */
const timerValue = () =>
  document.querySelector('.font-lcd.tracking-wider')?.textContent ?? '';

const completeSet = () => fireEvent.click(screen.getByText(/Completar Serie 1/i));
const clickContinue = () => fireEvent.click(screen.getByText(/^Continuar$/i));

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('secuencia de la cartela de récord personal', () => {
  it('no muestra la cartela durante la serie ni en el resumen; sí al pasar al descanso', () => {
    render(<WorkoutFlow {...flowProps(100)} />);

    completeSet();
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();

    // Resumen del ejercicio, todavía sin cartela
    expect(screen.getByText(/series completadas/i)).toBeTruthy();
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();

    clickContinue();

    // Temporizador de descanso y cartela montados simultáneamente
    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();
  });

  it('el temporizador avanza mientras la cartela está visible y el autocierre no lo reinicia', () => {
    vi.useFakeTimers();
    render(<WorkoutFlow {...flowProps(100)} />);

    completeSet();
    clickContinue();

    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();
    const before = timerValue();

    act(() => { vi.advanceTimersByTime(3000); });
    const during = timerValue();
    expect(during).not.toEqual(before);
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();

    // Autocierre a los 5 s; el contador sigue avanzando (no se reinicia)
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
    const after = timerValue();
    expect(after).not.toEqual(during);
    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
  });

  it('no reaparece al omitir el descanso', () => {
    render(<WorkoutFlow {...flowProps(100)} />);

    completeSet();
    clickContinue();
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();

    fireEvent.click(screen.getByText(/Saltar y continuar/i));

    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
  });

  it('sin récord el flujo queda idéntico (descanso sin cartela)', () => {
    render(<WorkoutFlow {...flowProps(50)} />);

    completeSet();
    clickContinue();

    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
  });
});

describe('ExerciseCard fuera de WorkoutFlow', () => {
  it('mantiene el comportamiento anterior: abre la cartela al batir el récord', () => {
    render(
      <ExerciseCard
        exercise={exercise}
        isActive
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        workoutSessions={history}
        initialSessionSetConfigs={configs(100)}
      />
    );

    completeSet();
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();
  });
});
