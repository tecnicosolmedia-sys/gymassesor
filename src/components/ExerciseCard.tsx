import { Exercise } from '@/types/exercise';
import { Timer } from './Timer';
import { useState } from 'react';
import { 
  Play, 
  Pause, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Dumbbell,
  Clock,
  Flame,
  Video,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseCardProps {
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
  isActive?: boolean;
  onActivate?: () => void;
}

export const ExerciseCard = ({ 
  exercise, 
  onEdit, 
  onDelete,
  isActive = false,
  onActivate,
}: ExerciseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [showSetTimer, setShowSetTimer] = useState(false);
  const [showExerciseTimer, setShowExerciseTimer] = useState(false);

  const handleSetComplete = () => {
    if (currentSet < exercise.sets) {
      setShowSetTimer(true);
    } else {
      setShowExerciseTimer(true);
    }
  };

  const handleSetTimerComplete = () => {
    setShowSetTimer(false);
    if (currentSet < exercise.sets) {
      setCurrentSet((prev) => prev + 1);
    }
  };

  const handleExerciseTimerComplete = () => {
    setShowExerciseTimer(false);
    setCurrentSet(1);
  };

  const totalCalories = exercise.caloriesPerSet * exercise.sets;

  return (
    <div 
      className={cn(
        "rounded-2xl card-gradient border transition-all duration-300 overflow-hidden animate-fade-in",
        isActive ? "border-primary glow-energy" : "border-border hover:border-primary/50"
      )}
    >
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Image or placeholder */}
          <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
            {exercise.imageUrl ? (
              <img 
                src={exercise.imageUrl} 
                alt={exercise.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Dumbbell className="w-6 h-6 text-primary" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {exercise.muscleGroup}
              </span>
            </div>
            <h3 className="font-display font-bold text-lg truncate">{exercise.name}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5" />
                {exercise.sets}x{exercise.reps} · {exercise.weight}kg
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-warning" />
                {totalCalories} kcal
              </span>
            </div>
          </div>
          
          {/* Expand button */}
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Video preview */}
          {exercise.videoUrl && (
            <div className="aspect-video rounded-xl bg-secondary overflow-hidden">
              <video 
                src={exercise.videoUrl} 
                controls 
                className="w-full h-full object-cover"
                poster={exercise.imageUrl}
              />
            </div>
          )}
          
          {/* Notes */}
          {exercise.notes && (
            <div className="p-3 rounded-xl bg-secondary/50">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-primary">
                <FileText className="w-4 h-4" />
                Observaciones
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {exercise.notes}
              </p>
            </div>
          )}
          
          {/* Set tracker */}
          <div className="p-4 rounded-xl bg-secondary/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Progreso de series</span>
              <span className="text-sm text-muted-foreground">
                {currentSet} / {exercise.sets}
              </span>
            </div>
            
            {/* Set indicators */}
            <div className="flex gap-2 mb-4">
              {Array.from({ length: exercise.sets }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 h-2 rounded-full transition-all",
                    i < currentSet - 1 
                      ? "bg-primary" 
                      : i === currentSet - 1 
                        ? "bg-primary/50" 
                        : "bg-muted"
                  )}
                />
              ))}
            </div>
            
            {/* Set timer */}
            {showSetTimer && (
              <Timer
                initialTime={exercise.restBetweenSets}
                label="Descanso entre series"
                onComplete={handleSetTimerComplete}
                variant="compact"
                autoStart
              />
            )}
            
            {/* Exercise timer */}
            {showExerciseTimer && (
              <Timer
                initialTime={exercise.restAfterExercise}
                label="Descanso entre ejercicios"
                onComplete={handleExerciseTimerComplete}
                autoStart
              />
            )}
            
            {/* Complete set button */}
            {!showSetTimer && !showExerciseTimer && currentSet <= exercise.sets && (
              <button
                onClick={handleSetComplete}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
              >
                <Play className="w-4 h-4" />
                Completar Serie {currentSet}
              </button>
            )}
            
            {/* Exercise completed */}
            {currentSet > exercise.sets && !showExerciseTimer && (
              <div className="text-center py-3">
                <span className="text-primary font-semibold">¡Ejercicio completado! 🎉</span>
              </div>
            )}
          </div>
          
          {/* Rest times info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-secondary/30 flex items-center gap-3">
              <Clock className="w-5 h-5 text-info" />
              <div>
                <p className="text-xs text-muted-foreground">Entre series</p>
                <p className="font-semibold">{exercise.restBetweenSets}s</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-secondary/30 flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Entre ejercicios</p>
                <p className="font-semibold">{exercise.restAfterExercise}s</p>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onEdit(exercise)}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => onDelete(exercise.id)}
              className="py-2.5 px-4 rounded-xl bg-destructive/10 text-destructive font-medium flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
