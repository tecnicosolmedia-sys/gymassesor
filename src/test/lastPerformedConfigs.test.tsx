import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkoutFlow } from '@/components/WorkoutFlow';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise, SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import {
  getLastPerformedSetConfigs,
  loadStructuralChangeNotice,
} from '@/utils/sessionSetStructure';

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

const initialConfigs: SetConfig[] = [
  { setNumber: 1, reps: 12, weight: 20, restTime: 45 },
  { setNumber: 2, reps: 10, weight: 22.5, restTime: 60 },
];

const exercise: Exercise = {
  id: 'ex-1',
  name: 'Press banca',
  sets: 2,
  reps: 12,
  weight: 20,
  setConfigs: initialConfigs,
  restBetweenSets: 45,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const historyWithTwoSets: WorkoutSession[] = [{
  id: 'session-1',
  date: new Date('2026-02-01T10:00:00Z'),
  routineId: 'routine-1',
  routineName: 'Pecho',
  exercises: [{
    exerciseId: 'ex-1',
    exerciseName: 'Press banca',
    muscleGroup: 'Pecho',
    totalSets: 2,
    startedAt: new Date('2026-02-01T10:00:00Z'),
    completedSets: [
      { setNumber: 1, reps: 14, weight: 42.5, restTime: 50, isWarmup: true, completedAt: new Date('2026-02-01T10:01:00Z') },
      { setNumber: 2, reps: 8, weight: 65, restTime: 120, completedAt: new Date('2026-02-01T10:04:00Z') },
    ],
  }],
  totalDuration: 300,
  startedAt: new Date('2026-02-01T10:00:00Z'),
  completedAt: new Date('2026-02-01T10:05:00Z'),
  isComplete: true,
}];

beforeEach(() => localStorage.clear());

describe('últimas marcas del ejercicio', () => {
  it('recupera el número exacto de series y todos sus valores sin usar la plantilla antigua', () => {
    const result = getLastPerformedSetConfigs({ ...exercise, sets: 4 }, historyWithTwoSets);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { setNumber: 1, reps: 14, weight: 42.5, restTime: 50, isWarmup: true },
      { setNumber: 2, reps: 8, weight: 65, restTime: 120, isWarmup: undefined },
    ]);
  });

  it('la siguiente apertura muestra las series realizadas, aunque la plantilla tenía otro número', () => {
    render(
      <ExerciseCard
        exercise={{ ...exercise, sets: 4 }}
        instanceKey="ex-1#0"
        isActive
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        workoutSessions={historyWithTwoSets}
      />,
    );

    expect(screen.getByText('0 / 2 completadas')).toBeTruthy();
    expect(screen.getAllByLabelText('Eliminar serie')).toHaveLength(2);
  });

  it('al completar el ejercicio guarda también una serie añadida y sus marcas efectivas', () => {
    const onUpdateSetConfig = vi.fn();
    render(
      <WorkoutFlow
        routineId="routine-1"
        routineName="Pecho"
        exercises={[exercise]}
        allExercises={[exercise]}
        onClose={vi.fn()}
        onSetComplete={vi.fn()}
        onEditExercise={vi.fn()}
        onDeleteExercise={vi.fn()}
        onUpdateSetConfig={onUpdateSetConfig}
        workoutSessions={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Añadir serie/ }));
    fireEvent.click(screen.getByText(/Completar Serie 1/i));
    fireEvent.click(screen.getByText(/Saltar y continuar/i));
    fireEvent.click(screen.getByText(/Completar Serie 2/i));
    fireEvent.click(screen.getByText(/Saltar y continuar/i));
    fireEvent.click(screen.getByText(/Completar Serie 3/i));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(onUpdateSetConfig).toHaveBeenCalledTimes(1);
    expect(onUpdateSetConfig).toHaveBeenCalledWith('ex-1', [
      initialConfigs[0],
      initialConfigs[1],
      { setNumber: 3, reps: 12, weight: 20, restTime: 45 },
    ]);
    expect(loadStructuralChangeNotice('ex-1#0')).toBeNull();
  });
});
