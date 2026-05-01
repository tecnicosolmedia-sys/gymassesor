import { useState, useMemo, useRef, useEffect } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Routine } from '@/types/routine';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, SetConfig } from '@/types/exercise';
import { X, Calendar, Plus, Check, GripVertical, Settings2, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

// Dropdown selector component for numeric values
const ValueDropdown = ({ 
  value, unit, options, onChange 
}: { 
  value: number; unit: string; options: number[]; onChange: (v: number) => void 
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) activeEl.scrollIntoView({ block: 'center' });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="font-lcd text-sm text-primary min-w-[32px] text-center px-1 py-0.5 rounded-md bg-background border border-border hover:border-primary transition-colors cursor-pointer"
      >
        {value}<span className="text-[8px] text-muted-foreground">{unit}</span>
      </button>
      {open && (
        <div 
          ref={listRef}
          className="absolute z-50 bottom-full mb-1 left-1/2 -translate-x-1/2 w-16 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
        >
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              data-active={opt === value}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "w-full px-2 py-1.5 text-sm text-center transition-colors",
                opt === value 
                  ? "bg-primary text-primary-foreground font-bold" 
                  : "hover:bg-accent text-foreground"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface RoutineFormProps {
  routine?: Routine | null;
  exercises: Exercise[];
  onSave: (routine: Omit<Routine, 'id' | 'createdAt'>) => void;
  onUpdateExercise?: (id: string, updates: Partial<Exercise>) => void;
  onClose: () => void;
}

interface SortableRoutineExerciseItemProps {
  exercise: Exercise;
  index: number;
  expandedExerciseId: string | null;
  setExpandedExerciseId: (id: string | null) => void;
  onUpdateExercise?: (id: string, updates: Partial<Exercise>) => void;
  onToggleExercise: (exerciseId: string) => void;
  handleUpdateSets: (exerciseId: string, delta: number) => void;
  handleCopySetToNext: (exerciseId: string, setIndex: number) => void;
  handleCopyFromPrevious: (exerciseId: string, setIndex: number) => void;
}

const SortableRoutineExerciseItem = ({
  exercise,
  index,
  expandedExerciseId,
  setExpandedExerciseId,
  onUpdateExercise,
  onToggleExercise,
  handleUpdateSets,
  handleCopySetToNext,
  handleCopyFromPrevious,
}: SortableRoutineExerciseItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'space-y-0 select-none',
        isDragging && 'z-20 opacity-70 scale-[0.98]'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg bg-card border border-border cursor-grab active:cursor-grabbing touch-none',
          isDragging && 'ring-2 ring-primary shadow-lg'
        )}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
          {(exercise.imageUrls?.[0] || exercise.imageUrl) ? (
            <img
              src={exercise.imageUrls?.[0] || exercise.imageUrl!}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
          ) : getMuscleGroupIcon(exercise.muscleGroup) ? (
            <img
              src={getMuscleGroupIcon(exercise.muscleGroup)!}
              alt={exercise.muscleGroup}
              className="w-6 h-6 object-contain"
            />
          ) : (
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium break-words">{exercise.name}</p>
          <p className="text-xs text-muted-foreground">
            {exercise.sets}×{exercise.reps} · {exercise.weight}kg · {exercise.restBetweenSets}s
          </p>
        </div>
        {onUpdateExercise && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setExpandedExerciseId(expandedExerciseId === exercise.id ? null : exercise.id);
            }}
            className={cn(
              'p-1.5 rounded-lg transition-colors flex-shrink-0',
              expandedExerciseId === exercise.id
                ? 'bg-primary/20 text-primary'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
            title="Editar configuración"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExercise(exercise.id);
          }}
          className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {expandedExerciseId === exercise.id && onUpdateExercise && (
        <div className="mx-2 p-3 rounded-b-lg bg-card/50 border border-t-0 border-border animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">Nº de Series</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleUpdateSets(exercise.id, -1)}
                className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-lcd text-lg text-primary w-6 text-center">{exercise.sets}</span>
              <button type="button" onClick={() => handleUpdateSets(exercise.id, 1)}
                className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {exercise.setConfigs.map((setConfig, si) => (
              <div key={setConfig.setNumber} className="p-2 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-primary">Serie {setConfig.setNumber}</span>
                  <div className="flex items-center gap-1">
                    {si > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCopyFromPrevious(exercise.id, si)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      >
                        ← Prev
                      </button>
                    )}
                    {si < exercise.setConfigs.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleCopySetToNext(exercise.id, si)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Reps</span>
                    <ValueDropdown
                      value={setConfig.reps}
                      unit=""
                      options={Array.from({ length: 50 }, (_, i) => i + 1)}
                      onChange={(v) => {
                        const newConfigs = exercise.setConfigs.map((c, i) => i === si ? { ...c, reps: v } : c);
                        onUpdateExercise(exercise.id, { setConfigs: newConfigs });
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Peso</span>
                    <ValueDropdown
                      value={setConfig.weight}
                      unit="kg"
                      options={Array.from({ length: 501 }, (_, i) => i * 0.5)}
                      onChange={(v) => {
                        const newConfigs = exercise.setConfigs.map((c, i) => i === si ? { ...c, weight: v } : c);
                        onUpdateExercise(exercise.id, { setConfigs: newConfigs });
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Desc.</span>
                    <ValueDropdown
                      value={setConfig.restTime}
                      unit="s"
                      options={[0, 5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 150, 180, 240, 300]}
                      onChange={(v) => {
                        const newConfigs = exercise.setConfigs.map((c, i) => i === si ? { ...c, restTime: v } : c);
                        onUpdateExercise(exercise.id, { setConfigs: newConfigs });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const RoutineForm = ({ routine, exercises, onSave, onUpdateExercise, onClose }: RoutineFormProps) => {
  const [name, setName] = useState(routine?.name || '');
  const [selectedExercises, setSelectedExercises] = useState<string[]>(routine?.exerciseIds || []);
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'todos'>('todos');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  const filteredExercises = useMemo(() => {
    if (muscleFilter === 'todos') return exercises;
    return exercises.filter((e) => e.muscleGroup === muscleFilter);
  }, [exercises, muscleFilter]);

  // Obtener ejercicios seleccionados en orden
  const orderedSelectedExercises = useMemo(() => {
    return selectedExercises
      .map(id => exercises.find(e => e.id === id))
      .filter((e): e is Exercise => e !== undefined);
  }, [selectedExercises, exercises]);

  const handleUpdateSets = (exerciseId: string, delta: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise || !onUpdateExercise) return;
    const newSets = Math.max(1, Math.min(10, exercise.sets + delta));
    const newConfigs = [...exercise.setConfigs];
    while (newConfigs.length < newSets) {
      const last = newConfigs[newConfigs.length - 1] || { reps: exercise.reps, weight: exercise.weight, restTime: exercise.restBetweenSets };
      newConfigs.push({ setNumber: newConfigs.length + 1, reps: last.reps, weight: last.weight, restTime: last.restTime });
    }
    onUpdateExercise(exerciseId, { sets: newSets, setConfigs: newConfigs.slice(0, newSets) });
  };

  const handleUpdateSetField = (exerciseId: string, setIndex: number, field: 'reps' | 'weight' | 'restTime', delta: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise || !onUpdateExercise) return;
    const newConfigs = exercise.setConfigs.map((c, i) => {
      if (i !== setIndex) return c;
      const newVal = field === 'weight' ? Math.max(0, c[field] + delta) : Math.max(field === 'reps' ? 1 : 0, c[field] + delta);
      return { ...c, [field]: newVal };
    });
    onUpdateExercise(exerciseId, { setConfigs: newConfigs });
  };

  const handleCopySetToNext = (exerciseId: string, setIndex: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise || !onUpdateExercise || setIndex >= exercise.setConfigs.length - 1) return;
    const source = exercise.setConfigs[setIndex];
    const newConfigs = exercise.setConfigs.map((c, i) => 
      i === setIndex + 1 ? { ...c, reps: source.reps, weight: source.weight, restTime: source.restTime } : c
    );
    onUpdateExercise(exerciseId, { setConfigs: newConfigs });
  };

  const handleCopyFromPrevious = (exerciseId: string, setIndex: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise || !onUpdateExercise || setIndex <= 0) return;
    const source = exercise.setConfigs[setIndex - 1];
    const newConfigs = exercise.setConfigs.map((c, i) => 
      i === setIndex ? { ...c, reps: source.reps, weight: source.weight, restTime: source.restTime } : c
    );
    onUpdateExercise(exerciseId, { setConfigs: newConfigs });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      exerciseIds: selectedExercises,
    });
    onClose();
  };

  const toggleExercise = (exerciseId: string) => {
    setSelectedExercises((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setSelectedExercises((prev) => {
      // Build the visual order (only ids that currently exist in exercises)
      const visualIds = prev.filter((id) => exercises.some((e) => e.id === id));
      const orphanIds = prev.filter((id) => !exercises.some((e) => e.id === id));

      const oldIndex = visualIds.indexOf(activeId);
      const newIndex = visualIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(visualIds, oldIndex, newIndex);
      return [...reordered, ...orphanIds];
    });
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl animate-scale-in my-8">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl">
                {routine ? 'Editar Rutina' : 'Nueva Rutina'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Nombre de la rutina</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="Ej: Día de Pecho"
                required
              />
            </div>

            {/* Selected exercises order */}
            {orderedSelectedExercises.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Orden de ejercicios ({orderedSelectedExercises.length})
                </label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={orderedSelectedExercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 p-3 rounded-xl bg-secondary/50 border border-border">
                      {orderedSelectedExercises.map((exercise, index) => (
                        <SortableRoutineExerciseItem
                          key={exercise.id}
                          exercise={exercise}
                          index={index}
                          expandedExerciseId={expandedExerciseId}
                          setExpandedExerciseId={setExpandedExerciseId}
                          onUpdateExercise={onUpdateExercise}
                          onToggleExercise={toggleExercise}
                          handleUpdateSets={handleUpdateSets}
                          handleCopySetToNext={handleCopySetToNext}
                          handleCopyFromPrevious={handleCopyFromPrevious}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Exercise selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Añadir ejercicios
              </label>
              
              {/* Muscle group filter tabs */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setMuscleFilter('todos')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    muscleFilter === 'todos'
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todos
                </button>
                {MUSCLE_GROUPS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setMuscleFilter(group)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      muscleFilter === group
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {group}
                  </button>
                ))}
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay ejercicios. Crea algunos primero.
                  </p>
                ) : filteredExercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay ejercicios de {muscleFilter}.
                  </p>
                ) : (
                  filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => toggleExercise(exercise.id)}
                      className={cn(
                        "w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left",
                        selectedExercises.includes(exercise.id)
                          ? "bg-primary/20 border border-primary"
                          : "bg-secondary border border-transparent hover:border-border"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                        {(exercise.imageUrls?.[0] || exercise.imageUrl) ? (
                          <img src={exercise.imageUrls?.[0] || exercise.imageUrl!} alt={exercise.name} className="w-full h-full object-cover" />
                        ) : getMuscleGroupIcon(exercise.muscleGroup) ? (
                          <img src={getMuscleGroupIcon(exercise.muscleGroup)!} alt={exercise.muscleGroup} className="w-7 h-7 object-contain opacity-70" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">💪</span>
                        )}
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0",
                        selectedExercises.includes(exercise.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}>
                        {selectedExercises.includes(exercise.id) && (
                          <Check className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium break-words">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.muscleGroup} · {exercise.sets}x{exercise.reps}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
            >
              <Plus className="w-5 h-5" />
              {routine ? 'Guardar Cambios' : 'Crear Rutina'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
