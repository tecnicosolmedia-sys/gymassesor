import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutFlow } from '@/components/WorkoutFlow';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise } from '@/types/exercise';
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

vi.mock('@/hooks/usePersonalData', () => ({
  usePersonalData: () => ({ personalData: null, loading: false }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    auth: { getUser: async () => ({ data: { user: null } }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
  },
}));

const makeExercise = (weight: number): Exercise => ({
  id: 'ex-1',
  name: 'Press banca',
  sets: 1,
  reps: 8,
  weight,
  setConfigs: [{ setNumber: 1, reps: 8, weight, restTime: 45 }],
  restBetweenSets: 45,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

/** Histórico con una marca previa de 50 kg para que 100 kg sea récord. */
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

const flowProps = (exercise: Exercise) => ({
  routineName: 'Rutina test',
  exercises: [exercise],
  allExercises: [exercise],
  onClose: vi.fn(),
  onSetComplete: vi.fn(),
  onEditExercise: vi.fn(),
  onDeleteExercise: vi.fn(),
  workoutSessions: history,
});

const RECORD_TITLE = /RÉCORD PERSONAL/i;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('secuencia de la cartela de récord personal', () => {
  it('no muestra la cartela durante la serie ni en el resumen, y sí al pasar al descanso', async () => {
    const user = userEvent.setup();
    render(<WorkoutFlow {...flowProps(makeExercise(100))} />);

    await user.click(screen.getByText(/Completar Serie 1/i));

    // Durante/tras la serie no aparece la cartela
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();

    // Resumen del ejercicio: tampoco
    const continueBtn = await screen.findByText(/Continuar/i);
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();

    await user.click(continueBtn);

    // Descanso entre ejercicios + cartela montados simultáneamente
    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();
  });

  it('el temporizador sigue descontando mientras la cartela está visible y el cierre no lo reinicia', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<WorkoutFlow {...flowProps(makeExercise(100))} />);

    await user.click(screen.getByText(/Completar Serie 1/i));
    await user.click(await screen.findByText(/Continuar/i));

    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();
    const before = screen.getByText(/^\d{1,2}:\d{2}$/).textContent;

    await act(async () => { vi.advanceTimersByTime(3000); });
    const during = screen.getByText(/^\d{1,2}:\d{2}$/).textContent;
    expect(during).not.toEqual(before);

    // Autocierre a los 5 s: el contador sigue avanzando, no se reinicia
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
    const after = screen.getByText(/^\d{1,2}:\d{2}$/).textContent;
    expect(after).not.toEqual(during);
    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
  });

  it('no reaparece al omitir el descanso', async () => {
    const user = userEvent.setup();
    render(<WorkoutFlow {...flowProps(makeExercise(100))} />);

    await user.click(screen.getByText(/Completar Serie 1/i));
    await user.click(await screen.findByText(/Continuar/i));
    expect(screen.getByText(RECORD_TITLE)).toBeTruthy();

    await user.click(screen.getByText(/Saltar y continuar/i));

    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
    expect(await screen.findByText(/Siguiente Ejercicio|¿Seguimos\?/i)).toBeTruthy();
  });

  it('sin récord el flujo queda intacto (descanso sin cartela)', async () => {
    const user = userEvent.setup();
    render(<WorkoutFlow {...flowProps(makeExercise(40))} />);

    await user.click(screen.getByText(/Completar Serie 1/i));
    await user.click(await screen.findByText(/Continuar/i));

    expect(screen.getByText(/Descanso entre ejercicios/i)).toBeTruthy();
    expect(screen.queryByText(RECORD_TITLE)).toBeNull();
  });
});

describe('ExerciseCard fuera de WorkoutFlow', () => {
  it('mantiene el comportamiento anterior: abre la cartela al batir el récord', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        exercise={makeExercise(100)}
        isActive
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        workoutSessions={history}
      />
    );

    await user.click(screen.getByText(/Completar Serie 1/i));
    expect(await screen.findByText(RECORD_TITLE)).toBeTruthy();
  });
});
