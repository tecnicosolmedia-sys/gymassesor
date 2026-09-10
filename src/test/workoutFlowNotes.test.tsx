import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  { setNumber: 1, reps: 12, weight: 20, restTime: 60 },
  { setNumber: 2, reps: 12, weight: 20, restTime: 60 },
];

const exercise: Exercise = {
  id: 'ex-press',
  name: 'Press Banca',
  sets: 2,
  reps: 12,
  weight: 20,
  setConfigs,
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes: 'Nota inicial',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const initialStates: ExerciseSetState[] = [
  { exerciseId: 'ex-press', instanceKey: 'ex-press#0', currentSet: 1, completedSets: [] },
];

beforeEach(() => localStorage.clear());

describe('Notas durante el entrenamiento', () => {
  it('editar y guardar la nota se ve al instante y persiste con exerciseId + texto', () => {
    const onUpdateNotes = vi.fn();
    render(
      <WorkoutFlow
        routineName="Pecho"
        exercises={[exercise]}
        allExercises={[exercise]}
        onClose={vi.fn()}
        onSetComplete={vi.fn()}
        onEditExercise={vi.fn()}
        onDeleteExercise={vi.fn()}
        workoutSessions={[]}
        initialExerciseSetStates={initialStates}
        onUpdateNotes={onUpdateNotes}
      />
    );

    expect(screen.getByText('Nota inicial')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Editar nota'));
    fireEvent.change(screen.getByLabelText('Nota del ejercicio'), {
      target: { value: 'Nota durante sesion\nSegunda linea' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    expect(onUpdateNotes).toHaveBeenCalledTimes(1);
    expect(onUpdateNotes).toHaveBeenCalledWith('ex-press', 'Nota durante sesion\nSegunda linea');
    expect(screen.getByText(/Nota durante sesion/)).toBeTruthy();
    expect(screen.queryByText('Nota inicial')).toBeNull();
  });
});
