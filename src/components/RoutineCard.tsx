import { Routine, WEEKDAYS } from '@/types/routine';
import { Exercise, SetConfig } from '@/types/exercise';
import { ExerciseCard } from './ExerciseCard';
import { WorkoutFlow } from './WorkoutFlow';
import { Edit2, Trash2, Dumbbell, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RoutineCardProps {
  routine: Routine;
  exercises: Exercise[];
  allExercises: Exercise[];
  onEdit: (routine: Routine) => void;
  onDelete: (id: string) => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onSetComplete?: (
    exerciseId: string,
    exerciseName: string,
    muscleGroup: string,
    setData: { setNumber: number; reps: number; weight: number; restTime: number },
    totalSets: number
  ) => void;
  onUpdateSetConfig?: (exerciseId: string, setConfigs: SetConfig[]) => void;
}

export const RoutineCard = ({
  routine,
  exercises,
  allExercises,
  onEdit,
  onDelete,
  onEditExercise,
  onDeleteExercise,
  onSetComplete,
  onUpdateSetConfig,
}: RoutineCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showWorkoutFlow, setShowWorkoutFlow] = useState(false);
  
  const routineExercises = exercises.filter((e) => 
    routine.exerciseIds.includes(e.id)
  );

  const dayLabel = WEEKDAYS.find((d) => d.key === routine.day)?.label || routine.day;

  const handleStartWorkout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (routineExercises.length > 0) {
      setShowWorkoutFlow(true);
    }
  };

  return (
    <>
      <div className="rounded-2xl card-gradient border border-border overflow-hidden animate-fade-in">
        {/* Header */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {dayLabel.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">{routine.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {dayLabel} · {routineExercises.length} ejercicio{routineExercises.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {routineExercises.length > 0 && (
                <button
                  onClick={handleStartWorkout}
                  className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-energy"
                  title="Iniciar entrenamiento"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(routine);
                }}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(routine.id);
                }}
                className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Expanded exercises */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 animate-fade-in">
            {routineExercises.length === 0 ? (
              <div className="py-8 text-center">
                <Dumbbell className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay ejercicios en esta rutina
                </p>
              </div>
            ) : (
              <>
                {/* Botón para iniciar entrenamiento */}
                <button
                  onClick={handleStartWorkout}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy mb-4"
                >
                  <Play className="w-5 h-5" />
                  Iniciar Entrenamiento
                </button>
                
                {routineExercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={onEditExercise}
                    onDelete={onDeleteExercise}
                    onSetComplete={onSetComplete}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Workout Flow Modal */}
      {showWorkoutFlow && (
        <WorkoutFlow
          routineName={routine.name}
          exercises={routineExercises}
          allExercises={allExercises}
          onClose={() => setShowWorkoutFlow(false)}
          onSetComplete={onSetComplete || (() => {})}
          onEditExercise={onEditExercise}
          onDeleteExercise={onDeleteExercise}
          onUpdateSetConfig={onUpdateSetConfig}
        />
      )}
    </>
  );
};
