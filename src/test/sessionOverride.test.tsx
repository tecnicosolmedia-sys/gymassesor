import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise, SetConfig } from '@/types/exercise';
import {
  hasSessionOverride,
  resolveSummaryConfigTarget,
  syncSessionOverrideOnManualEdit,
  upsertSessionSetConfigs,
  SessionSetStateLike,
} from '@/utils/aiSuggestion';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(async () => ({ detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() })),
  },
}));

const cfg = (weight: number): SetConfig[] => [
  { setNumber: 1, reps: 10, weight, restTime: 60 },
  { setNumber: 2, reps: 10, weight, restTime: 60 },
];

const makeExercise = (): Exercise => ({
  id: 'ex-1',
  name: 'CHEST PRESS TECHNOGYM',
  sets: 2,
  reps: 10,
  weight: 40,
  setConfigs: cfg(40),
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes: '',
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const baseProps = { onEdit: () => {}, onDelete: () => {} };

describe('override de sesión: no fuga a la rutina maestra', () => {
  const states: SessionSetStateLike[] = [
    { exerciseId: 'ex-1', instanceKey: 'ex-1#0', currentSet: 1, completedSets: [], sessionSetConfigs: cfg(72.5) },
    { exerciseId: 'ex-1', instanceKey: 'ex-1#1', currentSet: 1, completedSets: [] },
  ];

  it('detecta el override solo en la aparición que lo tiene', () => {
    expect(hasSessionOverride(states, 'ex-1#0')).toBe(true);
    expect(hasSessionOverride(states, 'ex-1#1')).toBe(false);
    expect(hasSessionOverride(undefined, 'ex-1#0')).toBe(false);
  });

  it('el resumen con override enruta a la sesión, nunca a public.exercises', () => {
    expect(resolveSummaryConfigTarget(states, 'ex-1#0')).toBe('session');
    expect(resolveSummaryConfigTarget(states, 'ex-1#1')).toBe('master');
    // Guardados legacy sin instanceKey siguen usando el comportamiento previo
    expect(resolveSummaryConfigTarget([{ exerciseId: 'ex-1', currentSet: 1, completedSets: [] }], 'ex-1#0')).toBe('master');
  });

  it('confirmar el resumen con override actualiza solo esa aparición', () => {
    const next = upsertSessionSetConfigs(states, 'ex-1#0', 'ex-1', cfg(75));
    expect(next[0].sessionSetConfigs?.[0].weight).toBe(75);
    expect(next[1].sessionSetConfigs).toBeUndefined();
  });

  it('un ajuste manual posterior sincroniza el override (sobrevive recarga)', () => {
    const applied = upsertSessionSetConfigs(states, 'ex-1#0', 'ex-1', cfg(72.5));
    const manual = syncSessionOverrideOnManualEdit(applied, 'ex-1#0', 'ex-1', cfg(70));
    expect(manual[0].sessionSetConfigs?.[0].weight).toBe(70);
    // Rehidratación: el valor restaurado es el manual más reciente
    expect(hasSessionOverride(manual, 'ex-1#0')).toBe(true);
    // Sin override no se crea uno nuevo
    const untouched = syncSessionOverrideOnManualEdit(states, 'ex-1#1', 'ex-1', cfg(99));
    expect(untouched).toBe(states);
  });
});

describe('aislamiento entre apariciones duplicadas', () => {
  it('dos apariciones del mismo exerciseId conservan configs distintas', () => {
    render(
      <>
        <ExerciseCard {...baseProps} exercise={makeExercise()} instanceKey="ex-1#0" isActive initialSessionSetConfigs={cfg(72.5)} />
        <ExerciseCard {...baseProps} exercise={makeExercise()} instanceKey="ex-1#1" isActive initialSessionSetConfigs={cfg(88.5)} />
      </>,
    );
    expect(screen.getAllByText('72.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('88.5').length).toBeGreaterThan(0);
  });

  it('cambiar de aparición reinicializa las configs de la tarjeta', () => {
    const { rerender } = render(
      <ExerciseCard {...baseProps} exercise={makeExercise()} instanceKey="ex-1#0" isActive initialSessionSetConfigs={cfg(72.5)} />,
    );
    expect(screen.getAllByText('72.5').length).toBeGreaterThan(0);

    rerender(
      <ExerciseCard {...baseProps} exercise={makeExercise()} instanceKey="ex-1#1" isActive initialSessionSetConfigs={cfg(88.5)} />,
    );
    expect(screen.getAllByText('88.5').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('72.5').length).toBe(0);
  });
});
