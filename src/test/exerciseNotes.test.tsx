import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseCard } from '@/components/ExerciseCard';
import { Exercise } from '@/types/exercise';

vi.mock('@/hooks/useGlubSound', () => ({ useGlubSound: () => ({ playGlub: vi.fn() }) }));

const makeExercise = (notes = ''): Exercise => ({
  id: 'ex-1',
  name: 'Press Banca',
  sets: 2,
  reps: 10,
  weight: 20,
  setConfigs: [
    { setNumber: 1, reps: 10, weight: 20, restTime: 60 },
    { setNumber: 2, reps: 10, weight: 20, restTime: 60 },
  ],
  restBetweenSets: 60,
  restAfterExercise: 90,
  notes,
  caloriesPerSet: 5,
  muscleGroup: 'Pecho',
  createdAt: new Date(),
});

describe('Notas del ejercicio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra la nota existente', () => {
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('Bajar despacio\nCodos 45º')} />);
    expect(screen.getByText(/Bajar despacio/)).toBeTruthy();
  });

  it('permite añadir una nota desde vacío y la guarda', () => {
    const onUpdateNotes = vi.fn();
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('')} onUpdateNotes={onUpdateNotes} />);
    fireEvent.click(screen.getByText('+ Añadir nota'));
    const textarea = screen.getByLabelText('Nota del ejercicio');
    fireEvent.change(textarea, { target: { value: 'Linea 1\nLinea 2' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateNotes).toHaveBeenCalledWith('ex-1', 'Linea 1\nLinea 2');
  });

  it('cancelar no persiste nada', () => {
    const onUpdateNotes = vi.fn();
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('Original')} onUpdateNotes={onUpdateNotes} />);
    fireEvent.click(screen.getByLabelText('Editar nota'));
    fireEvent.change(screen.getByLabelText('Nota del ejercicio'), { target: { value: 'Otra' } });
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onUpdateNotes).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeTruthy();
  });

  it('guardar vacío elimina la nota', () => {
    const onUpdateNotes = vi.fn();
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('Original')} onUpdateNotes={onUpdateNotes} />);
    fireEvent.click(screen.getByLabelText('Editar nota'));
    fireEvent.change(screen.getByLabelText('Nota del ejercicio'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateNotes).toHaveBeenCalledWith('ex-1', '');
  });

  it('escribir en el editor no dispara controles de series', () => {
    const onSetComplete = vi.fn();
    const onUpdateNotes = vi.fn();
    render(
      <ExerciseCard
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        exercise={makeExercise('Nota')}
        isActive
        onSetComplete={onSetComplete}
        onUpdateNotes={onUpdateNotes}
      />
    );
    fireEvent.click(screen.getByLabelText('Editar nota'));
    const textarea = screen.getByLabelText('Nota del ejercicio');
    fireEvent.click(textarea);
    fireEvent.change(textarea, { target: { value: 'Nota nueva' } });
    expect(onSetComplete).not.toHaveBeenCalled();
  });

  it('sin callback no ofrece edición', () => {
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('Solo lectura')} />);
    expect(screen.queryByLabelText('Editar nota')).toBeNull();
  });
});
