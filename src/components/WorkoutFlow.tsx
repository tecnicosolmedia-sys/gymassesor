import { useState } from 'react';
import { Exercise, SetConfig } from '@/types/exercise';
import { FullscreenTimer } from './FullscreenTimer';
import { ExerciseCard } from './ExerciseCard';
import { X, Dumbbell, ChevronRight, Plus, Trophy, ArrowRight } from 'lucide-react';

import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

interface WorkoutFlowProps {
  routineName: string;
  exercises: Exercise[];
  allExercises: Exercise[]; // Para añadir ejercicios extra
  onClose: () => void;
  onSetComplete: (
    exerciseId: string,
    exerciseName: string,
    muscleGroup: string,
    setData: { setNumber: number; reps: number; weight: number; restTime: number },
    totalSets: number
  ) => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onUpdateSetConfig?: (exerciseId: string, setConfigs: SetConfig[]) => void;
}

type FlowState = 
  | { type: 'exercising'; exerciseIndex: number }
  | { type: 'rest-between-exercises'; completedExerciseIndex: number }
  | { type: 'select-next-exercise'; completedExerciseIndex: number }
  | { type: 'routine-complete' }
  | { type: 'add-extra-exercise' };

export const WorkoutFlow = ({
  routineName,
  exercises: initialExercises,
  allExercises,
  onClose,
  onSetComplete,
  onEditExercise,
  onDeleteExercise,
  onUpdateSetConfig,
}: WorkoutFlowProps) => {
  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>(initialExercises);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
  const [flowState, setFlowState] = useState<FlowState>({ type: 'exercising', exerciseIndex: 0 });
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);

  const currentExercise = flowState.type === 'exercising' 
    ? workoutExercises[flowState.exerciseIndex] 
    : null;

  const remainingExercises = workoutExercises.filter(
    (e) => !completedExerciseIds.has(e.id)
  );

  const availableExtraExercises = allExercises.filter(
    (e) => !workoutExercises.some((we) => we.id === e.id) && 
           !extraExercises.some((ee) => ee.id === e.id)
  );

  const handleExerciseComplete = (exerciseId: string) => {
    const exerciseIndex = workoutExercises.findIndex((e) => e.id === exerciseId);
    const exercise = workoutExercises[exerciseIndex];
    
    setCompletedExerciseIds((prev) => new Set([...prev, exerciseId]));
    
    // Si hay más ejercicios, iniciar temporizador entre ejercicios
    const remaining = workoutExercises.filter(
      (e) => !completedExerciseIds.has(e.id) && e.id !== exerciseId
    );
    
    if (remaining.length > 0) {
      setFlowState({ 
        type: 'rest-between-exercises', 
        completedExerciseIndex: exerciseIndex 
      });
    } else if (extraExercises.length > 0) {
      // Si hay ejercicios extra pendientes
      const nextExtraIndex = workoutExercises.length;
      setFlowState({ type: 'exercising', exerciseIndex: nextExtraIndex });
    } else {
      setFlowState({ type: 'routine-complete' });
    }
  };

  const handleRestComplete = () => {
    // El temporizador terminó, mostrar selector de siguiente ejercicio
    if (flowState.type === 'rest-between-exercises') {
      setFlowState({ 
        type: 'select-next-exercise', 
        completedExerciseIndex: flowState.completedExerciseIndex 
      });
    }
  };

  const handleSelectNextExercise = (exercise: Exercise) => {
    const exerciseIndex = workoutExercises.findIndex((e) => e.id === exercise.id);
    setFlowState({ type: 'exercising', exerciseIndex });
  };

  const handleAddExtraExercise = (exercise: Exercise) => {
    setWorkoutExercises((prev) => [...prev, exercise]);
    setExtraExercises((prev) => [...prev, exercise]);
    const newIndex = workoutExercises.length;
    setFlowState({ type: 'exercising', exerciseIndex: newIndex });
  };

  const handleSkipRest = () => {
    if (flowState.type === 'rest-between-exercises') {
      setFlowState({ 
        type: 'select-next-exercise', 
        completedExerciseIndex: flowState.completedExerciseIndex 
      });
    }
  };

  const getRestTime = () => {
    if (flowState.type === 'rest-between-exercises') {
      const exercise = workoutExercises[flowState.completedExerciseIndex];
      return exercise?.restAfterExercise || 120;
    }
    return 120;
  };

  // Renderizar temporizador entre ejercicios
  if (flowState.type === 'rest-between-exercises') {
    const completedExercise = workoutExercises[flowState.completedExerciseIndex];
    return (
      <FullscreenTimer
        initialTime={getRestTime()}
        label="Descanso entre ejercicios"
        nextSetLabel={`¡${completedExercise?.name} completado! Elige el siguiente ejercicio.`}
        onComplete={handleRestComplete}
        onContinue={handleSkipRest}
        onClose={() => setFlowState({ 
          type: 'select-next-exercise', 
          completedExerciseIndex: flowState.completedExerciseIndex 
        })}
      />
    );
  }

  // Renderizar selector de siguiente ejercicio
  if (flowState.type === 'select-next-exercise') {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="min-h-screen p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-gradient-energy">
                Siguiente Ejercicio
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {routineName} · {completedExerciseIds.size}/{workoutExercises.length} completados
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Ejercicios restantes */}
          <div className="space-y-3">
            {remainingExercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => handleSelectNextExercise(exercise)}
                className="w-full p-4 rounded-2xl bg-card border border-border hover:border-primary transition-all flex items-center gap-4 text-left group"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                  {exercise.imageUrl ? (
                    <img 
                      src={exercise.imageUrl} 
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                    />
                  ) : getMuscleGroupIcon(exercise.muscleGroup) ? (
                    <img 
                      src={getMuscleGroupIcon(exercise.muscleGroup)!} 
                      alt={exercise.muscleGroup}
                      className="w-12 h-12 object-contain"
                    />
                  ) : (
                    <Dumbbell className="w-6 h-6 text-primary" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {exercise.muscleGroup}
                  </span>
                  <h3 className="font-display font-bold text-lg mt-1">{exercise.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {exercise.sets} series · {exercise.reps} reps
                  </p>
                </div>
                
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Renderizar pantalla de rutina completada
  if (flowState.type === 'routine-complete') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          
          <h2 className="font-display font-bold text-3xl text-gradient-energy mb-2">
            ¡Rutina Completada!
          </h2>
          <p className="text-muted-foreground mb-8">
            Has completado {completedExerciseIds.size} ejercicios en {routineName}
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setFlowState({ type: 'add-extra-exercise' })}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <Plus className="w-5 h-5" />
              Añadir ejercicio extra
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
            >
              Finalizar entrenamiento
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar selector de ejercicio extra
  if (flowState.type === 'add-extra-exercise') {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="min-h-screen p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-gradient-energy">
                Añadir Ejercicio Extra
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Selecciona un ejercicio de tu biblioteca
              </p>
            </div>
            <button
              onClick={() => setFlowState({ type: 'routine-complete' })}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {availableExtraExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Dumbbell className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay más ejercicios disponibles
              </p>
              <button
                onClick={() => setFlowState({ type: 'routine-complete' })}
                className="mt-4 px-6 py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-all"
              >
                Volver
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {availableExtraExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => handleAddExtraExercise(exercise)}
                  className="w-full p-4 rounded-2xl bg-card border border-border hover:border-primary transition-all flex items-center gap-4 text-left group"
                >
                  <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                    {exercise.imageUrl ? (
                      <img 
                        src={exercise.imageUrl} 
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                      />
                    ) : getMuscleGroupIcon(exercise.muscleGroup) ? (
                      <img 
                        src={getMuscleGroupIcon(exercise.muscleGroup)!} 
                        alt={exercise.muscleGroup}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <Dumbbell className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                      {exercise.muscleGroup}
                    </span>
                    <h3 className="font-display font-bold text-lg mt-1">{exercise.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {exercise.sets} series · {exercise.reps} reps
                    </p>
                  </div>
                  
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Renderizar ejercicio actual
  if (currentExercise && flowState.type === 'exercising') {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        <div className="min-h-screen p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">{routineName}</p>
              <h2 className="font-display font-bold text-xl text-gradient-energy">
                Ejercicio {flowState.exerciseIndex + 1} de {workoutExercises.length}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-secondary rounded-full mb-6 overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ 
                width: `${(completedExerciseIds.size / workoutExercises.length) * 100}%` 
              }}
            />
          </div>

          {/* Exercise card con props para flujo de entrenamiento */}
          <ExerciseCard
            exercise={currentExercise}
            onEdit={onEditExercise}
            onDelete={onDeleteExercise}
            onSetComplete={onSetComplete}
            isActive={true}
            skipExerciseRestTimer={true}
            onExerciseComplete={() => handleExerciseComplete(currentExercise.id)}
            onUpdateSetConfig={onUpdateSetConfig}
          />
        </div>
      </div>
    );
  }

  return null;
};
