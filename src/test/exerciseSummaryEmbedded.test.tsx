import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseSummary } from '@/components/ExerciseSummary';

const baseProps = {
  exerciseName: 'Press banca',
  exerciseId: 'ex-1',
  muscleGroup: 'Pecho',
  setConfigs: [
    { setNumber: 1, reps: 10, weight: 40, restTime: 60 },
    { setNumber: 2, reps: 10, weight: 40, restTime: 60 },
  ],
  completedSets: [1, 2],
  onContinue: () => {},
};

describe('ExerciseSummary: modo embedded', () => {
  it('por defecto conserva la capa fija (retrocompatible)', () => {
    const { container } = render(<ExerciseSummary {...baseProps} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('fixed');
    expect(root.className).toContain('inset-0');
    expect(root.className).toContain('z-50');
  });

  it('en modo embedded no crea capa fija que tape el cronómetro', () => {
    const { container } = render(<ExerciseSummary {...baseProps} embedded />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain('fixed');
    expect(root.className).not.toContain('inset-0');
    expect(root.className).not.toMatch(/z-\d/);
  });

  it('los botones siguen accesibles en modo embedded', () => {
    render(<ExerciseSummary {...baseProps} embedded onGoBack={() => {}} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
