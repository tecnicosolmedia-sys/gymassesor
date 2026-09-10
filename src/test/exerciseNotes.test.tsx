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
    // Visible de inmediato, sin rerender del padre ni esperar la red
    expect(screen.getByText(/Linea 1/)).toBeTruthy();
    expect(screen.queryByText('+ Añadir nota')).toBeNull();
  });

  it('borrar la nota muestra al instante "Añadir nota" sin rerender del padre', () => {
    const onUpdateNotes = vi.fn();
    render(<ExerciseCard isActive onEdit={vi.fn()} onDelete={vi.fn()} exercise={makeExercise('Original')} onUpdateNotes={onUpdateNotes} />);
    fireEvent.click(screen.getByLabelText('Editar nota'));
    fireEvent.change(screen.getByLabelText('Nota del ejercicio'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateNotes).toHaveBeenCalledWith('ex-1', '');
    expect(screen.getByText('+ Añadir nota')).toBeTruthy();
  });

  it('en tarjeta inactiva, usar el editor no activa el ejercicio', () => {
    const onActivate = vi.fn();
    const onUpdateNotes = vi.fn();
    render(
      <ExerciseCard
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        exercise={makeExercise('Nota inactiva')}
        onActivate={onActivate}
        onUpdateNotes={onUpdateNotes}
      />
    );
    // Expandir la tarjeta para acceder a las observaciones
    fireEvent.click(screen.getByText('Press Banca'));
    onActivate.mockClear();

    fireEvent.click(screen.getByLabelText('Editar nota'));
    const textarea = screen.getByLabelText('Nota del ejercicio');
    fireEvent.click(textarea);
    fireEvent.change(textarea, { target: { value: 'Texto nuevo' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onActivate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Editar nota'));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onActivate).not.toHaveBeenCalled();
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
