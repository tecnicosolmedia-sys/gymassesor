import { useState } from 'react';
import { Exercise } from '@/types/exercise';
import { X, Play, Dumbbell, ChevronRight } from 'lucide-react';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

interface StartWorkoutSelectorProps {
  routineName: string;
  exercises: Exercise[];
  onStart: (startIndex: number) => void;
  onClose: () => void;
}

export const StartWorkoutSelector = ({
  routineName,
  exercises,
  onStart,
  onClose,
}: StartWorkoutSelectorProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl animate-scale-in my-8">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl">Iniciar Entrenamiento</h2>
                <p className="text-sm text-muted-foreground">{routineName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona por cuál ejercicio quieres empezar:
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {exercises.map((exercise, index) => (
                <button
                  key={exercise.id}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all text-left ${
                    selectedIndex === index
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-secondary border border-transparent hover:border-border'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center overflow-hidden flex-shrink-0 border border-border">
                    {getMuscleGroupIcon(exercise.muscleGroup) ? (
                      <img 
                        src={getMuscleGroupIcon(exercise.muscleGroup)!} 
                        alt={exercise.muscleGroup}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Dumbbell className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        {index + 1}
                      </span>
                      <p className="font-medium truncate">{exercise.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {exercise.muscleGroup} · {exercise.sets} series
                    </p>
                  </div>
                  {selectedIndex === index && (
                    <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => onStart(selectedIndex)}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
              >
                <Play className="w-5 h-5" />
                Empezar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
