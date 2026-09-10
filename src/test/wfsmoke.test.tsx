import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: vi.fn(), close: vi.fn() })) },
}));
vi.mock('@/hooks/useWakeLock', () => ({ useWakeLock: () => {} }));
vi.mock('@/hooks/useWorkoutNotification', () => ({ useWorkoutNotification: () => ({ notificationPermission: 'denied', updateWorkoutNotification: () => {}, stopNotifications: () => {}, requestPermission: async () => 'denied' }) }));
vi.mock('@/components/ExerciseCard', () => ({ ExerciseCard: () => <div>CARD</div> }));
import { WorkoutFlow } from '@/components/WorkoutFlow';
import { Exercise } from '@/types/exercise';
const ex: Exercise = { id: 'ex-1', name: 'P', sets: 1, reps: 8, weight: 100, setConfigs: [{ setNumber: 1, reps: 8, weight: 100, restTime: 45 }], restBetweenSets: 45, restAfterExercise: 90, notes: '', caloriesPerSet: 5, muscleGroup: 'Pecho', createdAt: new Date('2026-01-01') };
describe('smoke', () => {
  it('renders', () => {
    const { container } = render(<WorkoutFlow routineName="R" exercises={[ex]} allExercises={[ex]} onClose={vi.fn()} onSetComplete={vi.fn()} onEditExercise={vi.fn()} onDeleteExercise={vi.fn()} />);
    expect(container.textContent).toContain('CARD');
  });
});
