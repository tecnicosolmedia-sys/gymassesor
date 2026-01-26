import { Play, X, Timer, RotateCcw } from 'lucide-react';
import { SavedWorkoutState } from '@/hooks/useSavedWorkout';
import { cn } from '@/lib/utils';

interface ResumeWorkoutBannerProps {
  savedWorkout: SavedWorkoutState;
  timeSinceSaved: string;
  onResume: () => void;
  onDiscard: () => void;
  className?: string;
}

export const ResumeWorkoutBanner = ({
  savedWorkout,
  timeSinceSaved,
  onResume,
  onDiscard,
  className,
}: ResumeWorkoutBannerProps) => {
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const completedCount = savedWorkout.completedExerciseIds.length;
  const totalCount = savedWorkout.workoutExerciseIds.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className={cn(
      "rounded-2xl bg-gradient-to-r from-primary/20 to-warning/20 border border-primary/30 p-4 animate-fade-in",
      className
    )}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <RotateCcw className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-lg">Entrenamiento en curso</h3>
          <p className="text-sm text-muted-foreground">
            {savedWorkout.routineName} · {timeSinceSaved}
          </p>
          
          {/* Progress bar */}
          <div className="mt-2 mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{completedCount}/{totalCount} ejercicios</span>
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatTime(savedWorkout.elapsedTime)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onResume}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all text-sm"
            >
              <Play className="w-4 h-4" />
              Continuar
            </button>
            <button
              onClick={onDiscard}
              className="py-2.5 px-4 rounded-xl bg-secondary text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/20 hover:text-destructive transition-all text-sm"
              title="Descartar entrenamiento"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
