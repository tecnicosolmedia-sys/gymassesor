import { Exercise, SetConfig } from '@/types/exercise';
import { FullscreenTimer } from './FullscreenTimer';
import { SetCard } from './SetCard';
import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Dumbbell,
  Clock,
  FileText,
  CheckCircle,
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
  // Si es true, no muestra el temporizador de ejercicio completo (lo maneja el padre)
  skipExerciseRestTimer?: boolean;
  onExerciseComplete?: () => void;
  // Callback para guardar cambios en la configuración
  onUpdateSetConfig?: (exerciseId: string, setConfigs: SetConfig[]) => void;
  // Estado inicial para restaurar sesión (serie actual y series completadas)
  initialCurrentSet?: number;
  initialCompletedSets?: number[];
  // Callback cuando cambia el estado de las series (para persistir)
  onSetStateChange?: (exerciseId: string, currentSet: number, completedSets: number[]) => void;
}

export const ExerciseCard = ({ 
  exercise, 
  onEdit, 
  onDelete,
  isActive = false,
  onActivate,
  onSetComplete,
  skipExerciseRestTimer = false,
  onExerciseComplete,
  onUpdateSetConfig,
  initialCurrentSet = 1,
  initialCompletedSets = [],
  onSetStateChange,
}: ExerciseCardProps) => {
  const [expanded, setExpanded] = useState(isActive);
  const [currentSet, setCurrentSet] = useState(initialCurrentSet);
  const [showFullscreenTimer, setShowFullscreenTimer] = useState(false);
  const [timerType, setTimerType] = useState<'set' | 'exercise'>('set');
  const [completedSets, setCompletedSets] = useState<number[]>(initialCompletedSets);
  
  // Estado local para las configuraciones editables
  const [localSetConfigs, setLocalSetConfigs] = useState<SetConfig[]>(() => {
    return exercise.setConfigs || Array.from({ length: exercise.sets }, (_, i) => ({
      setNumber: i + 1,
      reps: exercise.reps,
      weight: exercise.weight,
      restTime: exercise.restBetweenSets,
    }));
  });

  // Sincronizar cuando cambia el ejercicio
  useEffect(() => {
    setLocalSetConfigs(
      exercise.setConfigs || Array.from({ length: exercise.sets }, (_, i) => ({
        setNumber: i + 1,
        reps: exercise.reps,
        weight: exercise.weight,
        restTime: exercise.restBetweenSets,
      }))
    );
  }, [exercise.id, exercise.setConfigs, exercise.sets, exercise.reps, exercise.weight, exercise.restBetweenSets]);

  // Notificar cambios en el estado de las series al padre (para persistencia)
  useEffect(() => {
    onSetStateChange?.(exercise.id, currentSet, completedSets);
  }, [exercise.id, currentSet, completedSets, onSetStateChange]);

  const getCurrentSetConfig = (): SetConfig => {
    if (localSetConfigs && localSetConfigs[currentSet - 1]) {
      return localSetConfigs[currentSet - 1];
    }
    return {
      setNumber: currentSet,
      reps: exercise.reps,
      weight: exercise.weight,
      restTime: exercise.restBetweenSets,
    };
  };

  // Actualizar configuración de una serie
  const updateSetConfig = (index: number, field: keyof Omit<SetConfig, 'setNumber'>, delta: number) => {
    setLocalSetConfigs((prev) => {
      const updated = prev.map((config, i) => {
        if (i === index) {
          let newValue = config[field] + delta;
          // Límites según el campo
          if (field === 'reps') {
            newValue = Math.max(1, Math.min(99, newValue));
          } else if (field === 'weight') {
            newValue = Math.max(0, Math.min(999, newValue));
          } else if (field === 'restTime') {
            newValue = Math.max(5, Math.min(600, newValue));
          }
          return { ...config, [field]: newValue };
        }
        return config;
      });
      // Notificar cambios al padre
      onUpdateSetConfig?.(exercise.id, updated);
      return updated;
    });
  };

  // Establecer valor directo en una serie (para edición mediante long press)
  const setDirectValue = (index: number, field: keyof Omit<SetConfig, 'setNumber'>, value: number) => {
    setLocalSetConfigs((prev) => {
      const updated = prev.map((config, i) => {
        if (i === index) {
          let newValue = value;
          // Límites según el campo
          if (field === 'reps') {
            newValue = Math.max(1, Math.min(99, newValue));
          } else if (field === 'weight') {
            // Redondear a 0.5
            newValue = Math.round(newValue * 2) / 2;
            newValue = Math.max(0, Math.min(999, newValue));
          } else if (field === 'restTime') {
            newValue = Math.max(5, Math.min(600, Math.round(newValue)));
          }
          return { ...config, [field]: newValue };
        }
        return config;
      });
      // Notificar cambios al padre
      onUpdateSetConfig?.(exercise.id, updated);
      return updated;
    });
  };

  // Copiar configuración de la serie anterior
  const copyFromPreviousSet = (index: number) => {
    if (index <= 0) return; // No hay serie anterior
    
    setLocalSetConfigs((prev) => {
      const previousConfig = prev[index - 1];
      const updated = prev.map((config, i) => {
        if (i === index) {
          return {
            ...config,
            reps: previousConfig.reps,
            weight: previousConfig.weight,
            restTime: previousConfig.restTime,
          };
        }
        return config;
      });
      // Notificar cambios al padre
      onUpdateSetConfig?.(exercise.id, updated);
      return updated;
    });
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
      // Hay más series, mostrar temporizador entre series
      setTimerType('set');
      setShowFullscreenTimer(true);
    } else {
      // Es la última serie
      if (skipExerciseRestTimer) {
        // El componente padre maneja el temporizador entre ejercicios
        onExerciseComplete?.();
      } else {
        // Mostrar nuestro propio temporizador
        setTimerType('exercise');
        setShowFullscreenTimer(true);
      }
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
              
              {/* Individual set cards - usando SetCard component */}
              <div className="space-y-2">
                {localSetConfigs.map((config, index) => {
                  const isCompleted = completedSets.includes(index + 1);
                  const isCurrent = index + 1 === currentSet && !isCompleted;
                  const previousConfig = index > 0 ? localSetConfigs[index - 1] : undefined;
                  
                  return (
                    <SetCard
                      key={index}
                      config={config}
                      index={index}
                      isCompleted={isCompleted}
                      isCurrent={isCurrent}
                      currentSet={currentSet}
                      currentWeight={currentConfig.weight}
                      previousConfig={previousConfig}
                      onUpdateConfig={updateSetConfig}
                      onCompleteSet={handleSetComplete}
                      onSetDirectValue={setDirectValue}
                      onCopyFromPrevious={copyFromPreviousSet}
                    />
                  );
                })}
              </div>
              
              {/* Exercise completed message */}
              {completedSets.length === exercise.sets && !showFullscreenTimer && (
                <div className="text-center py-3 mt-4">
                  <span className="text-primary font-semibold">¡Ejercicio completado! 🎉</span>
                </div>
              )}

              {/* Botón para terminar ejercicio anticipadamente */}
              {completedSets.length > 0 && completedSets.length < exercise.sets && (
                <button
                  onClick={() => {
                    if (skipExerciseRestTimer) {
                      onExerciseComplete?.();
                    } else {
                      setTimerType('exercise');
                      setShowFullscreenTimer(true);
                    }
                  }}
                  className="w-full mt-4 py-3 rounded-xl bg-secondary text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Terminar ejercicio ({completedSets.length}/{exercise.sets} series)
                </button>
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
