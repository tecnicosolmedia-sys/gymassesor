import { useState, useMemo } from 'react';
import { Routine } from '@/types/routine';
import { Exercise, MuscleGroup, MUSCLE_GROUPS, SetConfig } from '@/types/exercise';
import { X, Calendar, Plus, Check, ChevronUp, ChevronDown, GripVertical, Settings2, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

interface RoutineFormProps {
  routine?: Routine | null;
  exercises: Exercise[];
  onSave: (routine: Omit<Routine, 'id' | 'createdAt'>) => void;
  onUpdateExercise?: (id: string, updates: Partial<Exercise>) => void;
  onClose: () => void;
}

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

  const handleUpdateExerciseField = (exerciseId: string, field: string, delta: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise || !onUpdateExercise) return;

    if (field === 'sets') {
      const newSets = Math.max(1, Math.min(10, exercise.sets + delta));
      const newConfigs = [...exercise.setConfigs];
      while (newConfigs.length < newSets) {
        const last = newConfigs[newConfigs.length - 1] || { reps: exercise.reps, weight: exercise.weight, restTime: exercise.restBetweenSets };
        newConfigs.push({ setNumber: newConfigs.length + 1, reps: last.reps, weight: last.weight, restTime: last.restTime });
      }
      onUpdateExercise(exerciseId, { sets: newSets, setConfigs: newConfigs.slice(0, newSets) });
    } else if (field === 'reps') {
      const newReps = Math.max(1, exercise.reps + delta);
      const newConfigs = exercise.setConfigs.map(c => ({ ...c, reps: newReps }));
      onUpdateExercise(exerciseId, { reps: newReps, setConfigs: newConfigs });
    } else if (field === 'weight') {
      const newWeight = Math.max(0, exercise.weight + delta);
      const newConfigs = exercise.setConfigs.map(c => ({ ...c, weight: newWeight }));
      onUpdateExercise(exerciseId, { weight: newWeight, setConfigs: newConfigs });
    } else if (field === 'restBetweenSets') {
      const newRest = Math.max(0, exercise.restBetweenSets + delta);
      const newConfigs = exercise.setConfigs.map(c => ({ ...c, restTime: newRest }));
      onUpdateExercise(exerciseId, { restBetweenSets: newRest, setConfigs: newConfigs });
    }
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

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...selectedExercises];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setSelectedExercises(newOrder);
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
                <div className="space-y-2 p-3 rounded-xl bg-secondary/50 border border-border">
                  {orderedSelectedExercises.map((exercise, index) => (
                    <div key={exercise.id} className="space-y-0">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border">
                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                          {getMuscleGroupIcon(exercise.muscleGroup) ? (
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
                          <p className="text-sm font-medium truncate">{exercise.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {exercise.sets}×{exercise.reps} · {exercise.weight}kg · {exercise.restBetweenSets}s
                          </p>
                        </div>
                        {onUpdateExercise && (
                          <button
                            type="button"
                            onClick={() => setExpandedExerciseId(expandedExerciseId === exercise.id ? null : exercise.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors flex-shrink-0",
                              expandedExerciseId === exercise.id
                                ? "bg-primary/20 text-primary"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            )}
                            title="Editar configuración"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveExercise(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveExercise(index, 'down')}
                            disabled={index === orderedSelectedExercises.length - 1}
                            className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExercise(exercise.id)}
                          className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Inline exercise config editor */}
                      {expandedExerciseId === exercise.id && onUpdateExercise && (
                        <div className="mx-2 p-3 rounded-b-lg bg-card/50 border border-t-0 border-border animate-fade-in">
                          <div className="grid grid-cols-2 gap-3">
                            {/* Series */}
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Series</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'sets', -1)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-lcd text-xl text-primary w-8 text-center">{exercise.sets}</span>
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'sets', 1)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Repeticiones */}
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Reps</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'reps', -1)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-lcd text-xl text-primary w-8 text-center">{exercise.reps}</span>
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'reps', 1)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Peso */}
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Peso (kg)</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'weight', -0.5)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-lcd text-xl text-primary w-10 text-center">{exercise.weight}</span>
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'weight', 0.5)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {/* Descanso */}
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs text-muted-foreground">Descanso (s)</span>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'restBetweenSets', -5)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-lcd text-xl text-primary w-10 text-center">{exercise.restBetweenSets}</span>
                                <button type="button" onClick={() => handleUpdateExerciseField(exercise.id, 'restBetweenSets', 5)}
                                  className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                        <p className="font-medium truncate">{exercise.name}</p>
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
