import { Exercise, SetConfig } from '@/types/exercise';
import { FullscreenTimer } from './FullscreenTimer';
import { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Dumbbell,
  Clock,
  FileText,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';
interface ExerciseCardProps {
  exercise: Exercise;
  onEdit: (exercise: Exercise) => void;
  onDelete: (id: string) => void;
  isActive?: boolean;
  onActivate?: () => void;
  onSetComplete?: (
    exerciseId: string,
    exerciseName: string,
    muscleGroup: string,
    setData: { setNumber: number; reps: number; weight: number; restTime: number },
    totalSets: number
  ) => void;
}

export const ExerciseCard = ({ 
  exercise, 
  onEdit, 
  onDelete,
  isActive = false,
  onActivate,
  onSetComplete,
}: ExerciseCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [showFullscreenTimer, setShowFullscreenTimer] = useState(false);
  const [timerType, setTimerType] = useState<'set' | 'exercise'>('set');
  const [completedSets, setCompletedSets] = useState<number[]>([]);

  // Obtener configuración de la serie actual
  const getCurrentSetConfig = (): SetConfig => {
    if (exercise.setConfigs && exercise.setConfigs[currentSet - 1]) {
      return exercise.setConfigs[currentSet - 1];
    }
    return {
      setNumber: currentSet,
      reps: exercise.reps,
      weight: exercise.weight,
      restTime: exercise.restBetweenSets,
    };
  };

  const handleSetComplete = () => {
    const config = getCurrentSetConfig();
    
    // Registrar en el historial
    onSetComplete?.(
      exercise.id,
      exercise.name,
      exercise.muscleGroup,
      {
        setNumber: currentSet,
        reps: config.reps,
        weight: config.weight,
        restTime: config.restTime,
      },
      exercise.sets
    );
    
    setCompletedSets((prev) => [...prev, currentSet]);
    
    if (currentSet < exercise.sets) {
      setTimerType('set');
      setShowFullscreenTimer(true);
    } else {
      setTimerType('exercise');
      setShowFullscreenTimer(true);
    }
  };

  const handleTimerComplete = () => {
    // Solo se llama cuando el timer llega a 0
  };

  const handleContinue = () => {
    if (timerType === 'set') {
      if (currentSet < exercise.sets) {
        setCurrentSet((prev) => prev + 1);
      }
    } else {
      // Ejercicio completado
      setCurrentSet(1);
      setCompletedSets([]);
    }
    setShowFullscreenTimer(false);
  };

  const handleCloseTimer = () => {
    setShowFullscreenTimer(false);
  };

  const currentConfig = getCurrentSetConfig();
  
  const getTimerLabel = () => {
    if (timerType === 'set') {
      return `Descanso antes de Serie ${currentSet + 1}`;
    }
    return 'Descanso entre ejercicios';
  };
  
  const getNextSetLabel = () => {
    if (timerType === 'set') {
      const nextConfig = exercise.setConfigs?.[currentSet] || {
        reps: exercise.reps,
        weight: exercise.weight,
      };
      return `Siguiente: Serie ${currentSet + 1} - ${nextConfig.reps} reps × ${nextConfig.weight}kg`;
    }
    return '¡Ejercicio completado! Continúa al siguiente ejercicio.';
  };
  
  const getTimerDuration = () => {
    if (timerType === 'set') {
      return currentConfig.restTime;
    }
    return exercise.restAfterExercise;
  };

  return (
    <>
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
            {/* Image or muscle group icon */}
            <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  className="w-14 h-14 object-contain"
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
                  {exercise.sets}x{exercise.reps}
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
            
            {/* Set tracker with individual configs */}
            <div className="p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Progreso de series</span>
                <span className="text-sm text-muted-foreground">
                  {completedSets.length} / {exercise.sets} completadas
                </span>
              </div>
              
              {/* Individual set cards */}
              <div className="space-y-2 mb-4">
              {(exercise.setConfigs || Array.from({ length: exercise.sets }, (_, i) => ({
                  setNumber: i + 1,
                  reps: exercise.reps,
                  weight: exercise.weight,
                  restTime: exercise.restBetweenSets,
                }))).map((config, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-3 rounded-xl flex items-center gap-3 transition-all",
                      completedSets.includes(index + 1)
                        ? "bg-primary/20 border border-primary"
                        : index + 1 === currentSet
                          ? "bg-secondary border border-primary/50"
                          : "bg-secondary/50 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      completedSets.includes(index + 1)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      {completedSets.includes(index + 1) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{config.reps || exercise.reps} reps</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dumbbell className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold">{config.weight}kg</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-info" />
                        <span className="text-muted-foreground">{config.restTime}s</span>
                      </div>
                    </div>
                    
                    {index + 1 === currentSet && !completedSets.includes(index + 1) && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
                        Actual
                      </span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Complete set button */}
              {currentSet <= exercise.sets && !completedSets.includes(currentSet) && (
                <button
                  onClick={handleSetComplete}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
                >
                  <Play className="w-4 h-4" />
                  Completar Serie {currentSet} ({currentConfig.weight}kg)
                </button>
              )}
              
              {/* Exercise completed */}
              {completedSets.length === exercise.sets && !showFullscreenTimer && (
                <div className="text-center py-3">
                  <span className="text-primary font-semibold">¡Ejercicio completado! 🎉</span>
                </div>
              )}
            </div>
            
            {/* Rest time info */}
            <div className="p-3 rounded-xl bg-secondary/30 flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Descanso entre ejercicios</p>
                <p className="font-semibold">{exercise.restAfterExercise}s</p>
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
      
      {/* Fullscreen Timer */}
      {showFullscreenTimer && (
        <FullscreenTimer
          initialTime={getTimerDuration()}
          label={getTimerLabel()}
          nextSetLabel={getNextSetLabel()}
          onComplete={handleTimerComplete}
          onContinue={handleContinue}
          onClose={handleCloseTimer}
        />
      )}
    </>
  );
};
