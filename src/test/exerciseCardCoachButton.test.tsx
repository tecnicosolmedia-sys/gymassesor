import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise } from '@/types/exercise';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(async () => ({ detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() })),
  },
}));

const makeExercise = (name: string): Exercise => ({
  id: 'ex-1',
  name,
  sets: 2,
  reps: 10,
  weight: 40,
  setConfigs: [
    { setNumber: 1, reps: 10, weight: 40, restTime: 60 },
    { setNumber: 2, reps: 10, weight: 40, restTime: 60 },
  ],
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const baseProps = {
  onEdit: () => {},
  onDelete: () => {},
};

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) },
  });
});

afterEach(() => vi.restoreAllMocks());

describe('ExerciseCard: botón de entrenador virtual', () => {
  const LABEL = 'Abrir entrenador virtual con cámara';

  it('aparece solo en el ejercicio activo compatible', () => {
    const { unmount } = render(
      <ExerciseCard {...baseProps} exercise={makeExercise('CHEST PRESS TECHNOGYM')} isActive />,
    );
    expect(screen.getByLabelText(LABEL)).toBeTruthy();
    unmount();

    render(<ExerciseCard {...baseProps} exercise={makeExercise('CHEST PRESS TECHNOGYM')} />);
    expect(screen.queryByLabelText(LABEL)).toBeNull();
  });

  it('no aparece en calentamientos y avisa de que no está disponible', () => {
    render(<ExerciseCard {...baseProps} exercise={makeExercise('Calentamiento cinta')} isActive />);
    expect(screen.queryByLabelText(LABEL)).toBeNull();
    expect(screen.getByText(/no disponible para este ejercicio/i)).toBeTruthy();
  });

  it('abrir y cerrar conserva el estado y los callbacks de la tarjeta', async () => {
    const onSetStateChange = vi.fn();
    render(
      <ExerciseCard
        {...baseProps}
        exercise={makeExercise('SHOULDER PRESS TECHNOGYM')}
        isActive
        initialCurrentSet={2}
        initialCompletedSets={[1]}
        onSetStateChange={onSetStateChange}
      />,
    );
    const before = screen.getByText(/1 \/ 2 completadas/i).textContent;

    await userEvent.click(screen.getByLabelText(LABEL));
    await waitFor(() => expect(screen.getByLabelText('Cerrar entrenador virtual')).toBeTruthy());

    await userEvent.click(screen.getByLabelText('Cerrar entrenador virtual'));
    await waitFor(() => expect(screen.queryByLabelText('Cerrar entrenador virtual')).toBeNull());

    expect(screen.getByText(/1 \/ 2 completadas/i).textContent).toBe(before);
    expect(screen.getByLabelText(LABEL)).toBeTruthy();
    // No se registran series ni se altera el estado por abrir/cerrar el entrenador.
    expect(onSetStateChange.mock.calls.every(c => c[1] === 2 && Array.isArray(c[2]) && c[2].length === 1)).toBe(true);
  });
});
