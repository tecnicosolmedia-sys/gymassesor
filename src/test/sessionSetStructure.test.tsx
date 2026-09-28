import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExerciseSummary } from '@/components/ExerciseSummary';
import { FullscreenTimer } from '@/components/FullscreenTimer';
import { Exercise, SetConfig } from '@/types/exercise';
import {
  addSessionSet,
  removeSessionSet,
  hasStructuralChange,
  normalizeSetConfigs,
  saveStructuralChangeNotice,
  loadStructuralChangeNotice,
  consumeStructuralChangeNotice,
  STRUCTURAL_NOTICE_KEY,
} from '@/utils/sessionSetStructure';
import { upsertSessionSetConfigs, SessionSetStateLike } from '@/utils/aiSuggestion';

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: vi.fn(async () => ({ detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() })) },
}));

const cfg = (n: number, weight = 40): SetConfig[] =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, reps: 10, weight, restTime: 60 }));

const makeExercise = (sets = 3): Exercise => ({
  id: 'ex-1', name: 'PRESS BANCA', sets, reps: 10, weight: 40, setConfigs: cfg(sets),
  restBetweenSets: 60, restAfterExercise: 90, notes: '', caloriesPerSet: 5, muscleGroup: 'Pecho',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

beforeEach(() => localStorage.clear());

describe('utilidades de estructura de series', () => {
  it('añadir renumera consecutivamente', () => {
    const next = addSessionSet(cfg(2));
    expect(next.map(c => c.setNumber)).toEqual([1, 2, 3]);
  });

  it('eliminar remapea completedSets y currentSet', () => {
    const r = removeSessionSet(cfg(4), [1, 2, 3], 4, 1);
    expect(r.nextConfigs.map(c => c.setNumber)).toEqual([1, 2, 3]);
    expect(r.nextCompletedSets).toEqual([1, 2]);
    expect(r.nextCurrentSet).toBe(3);
  });

  it('solo el cambio de número de series es estructural', () => {
    expect(hasStructuralChange(cfg(3), cfg(3, 80))).toBe(false);
    expect(hasStructuralChange(cfg(3), cfg(4))).toBe(true);
  });

  it('normaliza pesos a 0,5 kg y numeración', () => {
    expect(normalizeSetConfigs([{ setNumber: 7, reps: 10, weight: 40.3, restTime: 60 }])[0]).toMatchObject({ setNumber: 1, weight: 40.5 });
  });

  it('avisos aislados por instanceKey y consumibles', () => {
    const base = { exerciseId: 'ex-1', exerciseName: 'X', originalConfigs: cfg(3), modifiedConfigs: cfg(4), savedAt: '' };
    saveStructuralChangeNotice({ ...base, instanceKey: 'ex-1#0' });
    expect(loadStructuralChangeNotice('ex-1#0')).not.toBeNull();
    expect(loadStructuralChangeNotice('ex-1#1')).toBeNull();
    consumeStructuralChangeNotice('ex-1#0');
    expect(loadStructuralChangeNotice('ex-1#0')).toBeNull();
  });

  it('rehidratación antigua sin sessionSetConfigs es compatible', () => {
    const legacy: SessionSetStateLike[] = [{ exerciseId: 'ex-1', currentSet: 2, completedSets: [1] }];
    const next = upsertSessionSetConfigs(legacy, 'ex-1#0', 'ex-1', cfg(4));
    expect(next.some(s => s.sessionSetConfigs?.length === 4)).toBe(true);
    expect(() => loadStructuralChangeNotice('ex-1#0')).not.toThrow();
    localStorage.setItem(STRUCTURAL_NOTICE_KEY, 'no-json');
    expect(loadStructuralChangeNotice('ex-1#0')).toBeNull();
  });
});

describe('ExerciseCard activo: añadir/eliminar series', () => {
  const props = { onEdit: () => {}, onDelete: () => {} };

  it('añadir serie durante el ejercicio notifica la sesión, no la plantilla', () => {
    const onSession = vi.fn();
    const onTemplate = vi.fn();
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive
      onUpdateSessionSetConfig={onSession} onUpdateSetConfig={onTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /Añadir serie/ }));
    expect(screen.getAllByLabelText('Eliminar serie').length).toBe(4);
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('eliminar pendiente sin confirmación', () => {
    const spy = vi.spyOn(window, 'confirm');
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive />);
    fireEvent.click(screen.getAllByLabelText('Eliminar serie')[2]);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText('Eliminar serie').length).toBe(2);
    spy.mockRestore();
  });

  it('eliminar completada exige confirmación', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive
      initialCompletedSets={[1]} initialCurrentSet={2} />);
    fireEvent.click(screen.getAllByLabelText('Eliminar serie')[0]);
    expect(spy).toHaveBeenCalled();
    expect(screen.getAllByLabelText('Eliminar serie').length).toBe(3);
    spy.mockReturnValue(true);
    fireEvent.click(screen.getAllByLabelText('Eliminar serie')[0]);
    expect(screen.getAllByLabelText('Eliminar serie').length).toBe(2);
    spy.mockRestore();
  });

  it('dos apariciones del mismo ejercicio no comparten estructura', () => {
    render(<>
      <div data-testid="a"><ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive initialSessionSetConfigs={cfg(4)} /></div>
      <div data-testid="b"><ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#1" isActive /></div>
    </>);
    expect(screen.getByTestId('a').querySelectorAll('[aria-label="Eliminar serie"]').length).toBe(4);
    expect(screen.getByTestId('b').querySelectorAll('[aria-label="Eliminar serie"]').length).toBe(3);
  });
});

describe('aviso de estructura modificada', () => {
  const props = { onEdit: () => {}, onDelete: () => {} };
  const seed = () => saveStructuralChangeNotice({
    exerciseId: 'ex-1', instanceKey: 'ex-1#0', exerciseName: 'PRESS BANCA',
    originalConfigs: cfg(3), modifiedConfigs: cfg(4, 42.5), savedAt: '',
  });

  it('"Guardar versión modificada para el futuro" actualiza plantilla y consume aviso', () => {
    seed();
    const onSave = vi.fn();
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive onSaveTemplateSetConfig={onSave} />);
    expect(screen.getByText('Plantilla original')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar versión modificada para el futuro' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toHaveLength(4);
    expect(loadStructuralChangeNotice('ex-1#0')).toBeNull();
  });

  it('"Volver a la original" no toca la plantilla y consume aviso', () => {
    seed();
    const onSave = vi.fn();
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#0" isActive onSaveTemplateSetConfig={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la original' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(loadStructuralChangeNotice('ex-1#0')).toBeNull();
  });

  it('no aparece en otra aparición', () => {
    seed();
    render(<ExerciseCard {...props} exercise={makeExercise()} instanceKey="ex-1#1" isActive />);
    expect(screen.queryByText('Plantilla original')).toBeNull();
  });
});

describe('ExerciseSummary: editar y añadir tras cerrar', () => {
  const base = {
    exerciseName: 'Press', exerciseId: 'ex-1', muscleGroup: 'Pecho',
    setConfigs: cfg(3), completedSets: [1, 2, 3], embedded: true,
  };

  it('añadir serie realizada y continuar devuelve la estructura final', () => {
    const onContinue = vi.fn();
    render(<ExerciseSummary {...base} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /Añadir serie/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    const [configs, done] = onContinue.mock.calls[0];
    expect(configs).toHaveLength(4);
    expect(done).toEqual([1, 2, 3, 4]);
  });

  it('editar registros y eliminar con confirmación renumera', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onContinue = vi.fn();
    render(<ExerciseSummary {...base} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /Editar registros/ }));
    fireEvent.click(screen.getByLabelText('Eliminar serie 1'));
    expect(spy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Continuar/ }));
    const [configs, done] = onContinue.mock.calls[0];
    expect(configs.map((c: SetConfig) => c.setNumber)).toEqual([1, 2]);
    expect(done).toEqual([1, 2]);
    spy.mockRestore();
  });
});

describe('FullscreenTimer: layout y continuidad', () => {
  const setViewport = (w: number, h: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
    act(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); });
  };
  const props = {
    initialTime: 90, label: 'Descanso', onComplete: () => {}, onContinue: () => {}, onClose: () => {},
    globalElapsedTime: 125, globalIsRunning: true, onGlobalToggle: () => {}, onShowExercisePlan: () => {},
  };

  it('cabecera global en capa superior separada y esfera responsiva', () => {
    setViewport(390, 844);
    render(<FullscreenTimer {...props} />);
    const header = screen.getByTestId('workout-global-header');
    const root = screen.getByTestId('rest-timer-root');
    expect(header.className).toContain('z-[10200]');
    expect(header.className).toContain('workout-global-header');
    expect(root.contains(header)).toBe(false);
    expect(root.className).toContain('rest-portrait');
    expect(root.className).toContain('overflow-x-hidden');
    expect(screen.getByTestId('rest-ring').className).toContain('rest-ring');
    expect(screen.getByTestId('rest-digits').className).toContain('rest-digits');
    expect(screen.getByRole('button', { name: /Ver ejercicio completo/ })).toBeTruthy();
  });

  it('rotar conserva la misma instancia y tiempo', () => {
    vi.useFakeTimers();
    setViewport(390, 844);
    render(<FullscreenTimer {...props} />);
    act(() => { vi.advanceTimersByTime(5000); });
    const digits = screen.getByTestId('rest-digits');
    const before = digits.textContent;
    setViewport(844, 390);
    expect(screen.getByTestId('rest-timer-root').dataset.orientation).toBe('landscape');
    expect(screen.getByTestId('rest-timer-root').className).toContain('rest-landscape');
    expect(screen.getByTestId('rest-digits')).toBe(digits);
    expect(screen.getByTestId('rest-digits').textContent).toBe(before);
    vi.useRealTimers();
  });
});
