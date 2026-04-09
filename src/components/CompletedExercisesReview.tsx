import { Exercise, SetConfig } from '@/types/exercise';
import { ExerciseSetState } from './WorkoutFlow';
import { CheckCircle, ChevronDown, ChevronUp, Edit2, Minus, Plus, Dumbbell } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';
import { cn } from '@/lib/utils';

interface CompletedExercisesReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  completedExerciseIds: Set<string>;
  exerciseSetStates: ExerciseSetState[];
  onGoToExercise: (exerciseIndex: number, exerciseId: string) => void;
}

export const CompletedExercisesReview = ({
  open,
  onOpenChange,
  exercises,
  completedExerciseIds,
  exerciseSetStates,
  onGoToExercise,
}: CompletedExercisesReviewProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completedExercises = exercises.filter(e => completedExerciseIds.has(e.id));

  if (completedExercises.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Ejercicios completados ({completedExercises.length})
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {completedExercises.map((exercise, idx) => {
            const exIndex = exercises.findIndex(e => e.id === exercise.id);
            const setState = exerciseSetStates.find(s => s.exerciseId === exercise.id);
            const configs: SetConfig[] = exercise.setConfigs || Array.from({ length: exercise.sets }, (_, i) => ({
              setNumber: i + 1,
              reps: exercise.reps,
              weight: exercise.weight,
              restTime: exercise.restBetweenSets,
            }));
            const completedSetNums = setState?.completedSets || [];
            const isExpanded = expandedId === exercise.id;
            const MuscleIcon = getMuscleGroupIcon(exercise.muscleGroup);
            const totalKg = completedSetNums.reduce((sum, setNum) => {
              const cfg = configs[setNum - 1];
              return cfg ? sum + cfg.weight * cfg.reps : sum;
            }, 0);

            return (
              <div key={exercise.id} className="rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : exercise.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                    <MuscleIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm">{exercise.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {completedSetNums.length} series · {totalKg.toLocaleString()} kg
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Set table */}
                    <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-secondary/30 text-xs text-muted-foreground font-medium">
                      <span>Serie</span>
                      <span className="text-center">Reps</span>
                      <span className="text-center">Peso (kg)</span>
                    </div>
                    {completedSetNums.map(setNum => {
                      const cfg = configs[setNum - 1];
                      if (!cfg) return null;
                      return (
                        <div key={setNum} className="grid grid-cols-3 gap-2 px-4 py-2 border-t border-border/50 items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                              {setNum}
                            </div>
                          </div>
                          <span className="text-center font-medium">{cfg.reps}</span>
                          <span className="text-center font-medium">{cfg.weight}</span>
                        </div>
                      );
                    })}

                    {/* Edit button */}
                    <div className="p-3 border-t border-border">
                      <button
                        onClick={() => {
                          onOpenChange(false);
                          onGoToExercise(exIndex, exercise.id);
                        }}
                        className="w-full py-2.5 rounded-xl bg-primary/10 text-primary font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Modificar registro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
