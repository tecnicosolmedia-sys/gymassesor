import { useState, useRef, useCallback } from 'react';
import { RoutineCard } from './RoutineCard';
import { Exercise, SetConfig } from '@/types/exercise';
import { Routine } from '@/types/routine';
import { WorkoutSession } from '@/types/workoutHistory';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableRoutineListProps {
  routines: Routine[];
  allRoutines: Routine[];
  reorderRoutines: (from: number, to: number) => void;
  exercises: Exercise[];
  onEdit: (routine: Routine) => void;
  onDelete: (id: string) => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onSetComplete: (routineId: string, routineName: string, exerciseId: string, exerciseName: string, muscleGroup: string, setData: { setNumber: number; reps: number; weight: number; restTime: number }, totalSets: number) => void;
  onUpdateSetConfig: (exerciseId: string, setConfigs: SetConfig[]) => void;
  onWorkoutComplete: () => void;
  onAddExerciseToRoutine: (routineId: string, exerciseId: string) => void;
  onCreateExercise: () => void;
  newExerciseToAdd?: Exercise | null;
  onNewExerciseHandled: () => void;
  workoutSessions: WorkoutSession[];
}

export const DraggableRoutineList = ({
  routines, allRoutines, reorderRoutines, exercises,
  onEdit, onDelete, onEditExercise, onDeleteExercise,
  onSetComplete, onUpdateSetConfig, onWorkoutComplete,
  onAddExerciseToRoutine, onCreateExercise, newExerciseToAdd, onNewExerciseHandled,
  workoutSessions,
}: DraggableRoutineListProps) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragElement = useRef<HTMLDivElement | null>(null);

  const getGlobalIndex = useCallback((routine: Routine) => {
    return allRoutines.findIndex(r => r.id === routine.id);
  }, [allRoutines]);

  // Touch drag handlers
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    setDragIndex(index);
    setOverIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragIndex === null || !containerRef.current) return;
    const touch = e.touches[0];
    const items = containerRef.current.querySelectorAll('[data-routine-item]');
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        setOverIndex(i);
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const fromGlobal = getGlobalIndex(routines[dragIndex]);
      const toGlobal = getGlobalIndex(routines[overIndex]);
      if (fromGlobal !== -1 && toGlobal !== -1) {
        reorderRoutines(fromGlobal, toGlobal);
      }
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  // Mouse drag handlers (HTML5 drag & drop)
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      const fromGlobal = getGlobalIndex(routines[dragIndex]);
      const toGlobal = getGlobalIndex(routines[index]);
      if (fromGlobal !== -1 && toGlobal !== -1) {
        reorderRoutines(fromGlobal, toGlobal);
      }
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div ref={containerRef} className="space-y-4" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {routines.map((routine, index) => {
        const globalIndex = getGlobalIndex(routine);
        return (
          <div
            key={routine.id}
            data-routine-item
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(index, e)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "flex items-start gap-1 transition-all",
              dragIndex === index && "opacity-50",
              overIndex === index && dragIndex !== null && dragIndex !== index && "border-t-2 border-primary rounded-t-lg"
            )}
          >
            <div className="flex flex-col items-center gap-0.5 pt-3">
              <div
                className="p-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground"
                onTouchStart={(e) => handleTouchStart(index, e)}
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <button
                onClick={() => reorderRoutines(globalIndex, globalIndex - 1)}
                disabled={globalIndex === 0}
                className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => reorderRoutines(globalIndex, globalIndex + 1)}
                disabled={globalIndex === allRoutines.length - 1}
                className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <RoutineCard
                routine={routine}
                exercises={exercises}
                allExercises={exercises}
                onEdit={onEdit}
                onDelete={onDelete}
                onEditExercise={onEditExercise}
                onDeleteExercise={onDeleteExercise}
                onSetComplete={(exerciseId, exerciseName, muscleGroup, setData, totalSets) => {
                  onSetComplete(routine.id, routine.name, exerciseId, exerciseName, muscleGroup, setData, totalSets);
                }}
                onUpdateSetConfig={onUpdateSetConfig}
                onWorkoutComplete={onWorkoutComplete}
                onAddExerciseToRoutine={onAddExerciseToRoutine}
                onCreateExercise={onCreateExercise}
                newExerciseToAdd={newExerciseToAdd}
                onNewExerciseHandled={onNewExerciseHandled}
                workoutSessions={workoutSessions}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
