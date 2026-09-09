import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AISuggestionDialog } from '@/components/AISuggestionDialog';
import { SetConfig } from '@/types/exercise';
import { AISuggestion } from '@/hooks/useAISuggestion';

const current: SetConfig[] = [
  { setNumber: 1, reps: 12, weight: 30, restTime: 60, isWarmup: true },
  { setNumber: 2, reps: 8, weight: 100, restTime: 90 },
];

const suggestion: AISuggestion = {
  setSuggestions: [
    { setNumber: 1, reps: 12, weight: 30, restTime: 60 },
    { setNumber: 2, reps: 9, weight: 102.5, restTime: 105 },
  ],
  restBetweenSets: 105,
  weightAnalysis: 'El peso se mantuvo estable en las últimas sesiones.',
  repsAnalysis: 'Las repeticiones subieron de 7 a 8.',
  restAnalysis: 'El descanso registrado fue de 90 s.',
  coaching: 'Progresa despacio.',
  basis: '3 sesiones registradas.',
};

const base = {
  open: true,
  onOpenChange: () => {},
  loading: false,
  suggestion,
  exerciseName: 'CHEST PRESS TECHNOGYM',
  currentConfig: current,
};

describe('AISuggestionDialog', () => {
  it('muestra los tres análisis y la comparación de los tres parámetros por serie', () => {
    render(<AISuggestionDialog {...base} canApply />);
    expect(screen.getByText('Análisis · Peso')).toBeTruthy();
    expect(screen.getByText('Análisis · Repeticiones')).toBeTruthy();
    expect(screen.getByText('Análisis · Descanso')).toBeTruthy();
    expect(screen.getByText(/Base factual/)).toBeTruthy();

    const serie2 = screen.getByLabelText('Serie 2');
    expect(serie2.textContent).toContain('100 kg');
    expect(serie2.textContent).toContain('102.5 kg');
    expect(serie2.textContent).toContain('90 s');
    expect(serie2.textContent).toContain('105 s');
  });

  it('marca las series de calentamiento como sin cambios', () => {
    render(<AISuggestionDialog {...base} canApply />);
    expect(screen.getByText('Calentamiento (sin cambios)')).toBeTruthy();
  });

  it('permite aplicar cuando canApply es true', () => {
    const onApply = vi.fn();
    render(<AISuggestionDialog {...base} canApply onApply={onApply} />);
    const btn = screen.getByLabelText('Aplicar la sugerencia al ejercicio activo');
    btn.click();
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Mantener los valores actuales del ejercicio')).toBeTruthy();
  });

  it('bloquea aplicar y explica el motivo cuando canApply es false', () => {
    render(
      <AISuggestionDialog
        {...base}
        canApply={false}
        blockedReason="Solo puede aplicarse antes de completar la primera serie"
      />,
    );
    expect(screen.queryByLabelText('Aplicar la sugerencia al ejercicio activo')).toBeNull();
    expect(
      screen.getByText('Solo puede aplicarse antes de completar la primera serie'),
    ).toBeTruthy();
  });
});
