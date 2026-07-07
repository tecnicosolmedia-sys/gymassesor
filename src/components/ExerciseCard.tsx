import { Exercise, SetConfig } from '@/types/exercise';
import { FullscreenTimer } from './FullscreenTimer';
import { SetCard } from './SetCard';
import { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Dumbbell,
  Clock,
  FileText,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import { WorkoutSession } from '@/types/workoutHistory';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { cn } from '@/lib/utils';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';
import { PersonalRecordDialog } from './PersonalRecordDialog';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';

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
  // Cronómetro global del entrenamiento
  globalElapsedTime?: number;
  globalIsRunning?: boolean;
  onGlobalToggle?: () => void;
  // Historial para gráfica de progresión
  workoutSessions?: WorkoutSession[];
  onDeleteCompletedSet?: (sessionId: string, exerciseId: string, setNumber: number) => void | Promise<void>;
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
  globalElapsedTime,
  globalIsRunning,
  onGlobalToggle,
  workoutSessions = [],
  onDeleteCompletedSet,
}: ExerciseCardProps) => {
  const [expanded, setExpanded] = useState(isActive);
  const [currentSet, setCurrentSet] = useState(initialCurrentSet);
  const [showFullscreenTimer, setShowFullscreenTimer] = useState(false);
  const [timerType, setTimerType] = useState<'set' | 'exercise'>('set');
  const [completedSets, setCompletedSets] = useState<number[]>(initialCompletedSets);
  
  const [showChart, setShowChart] = useState(false);

  // Récord personal
  const [recordFlash, setRecordFlash] = useState(false);
  const [recordDialog, setRecordDialog] = useState<{
    open: boolean;
    weight: number;
    reps: number;
    previous: number;
  }>({ open: false, weight: 0, reps: 0, previous: 0 });

  // Máximo peso histórico registrado para este ejercicio (sesiones previas)
  const previousMaxWeight = useMemo(() => {
    let max = 0;
    workoutSessions.forEach((s) => {
      s.exercises.forEach((e) => {
        if (e.exerciseId === exercise.id) {
          e.completedSets.forEach((set) => {
            if (set.weight > max) max = set.weight;
          });
        }
      });
    });
    return max;
  }, [workoutSessions, exercise.id]);

  // Mejor peso conseguido en la sesión EN CURSO (para no disparar el récord
  // varias veces con la misma marca dentro del mismo entrenamiento).
  const [sessionBestWeight, setSessionBestWeight] = useState(0);
  useEffect(() => {
    setSessionBestWeight(0);
  }, [exercise.id]);

  // Buscar la última sesión completada de este ejercicio para precargar pesos/reps
  const getLastSessionConfigs = (): SetConfig[] | null => {
    if (!workoutSessions || workoutSessions.length === 0) return null;
    // workoutSessions viene ordenado descendente por fecha, pero por seguridad ordenamos
    const sorted = [...workoutSessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const session of sorted) {
      const exSession = session.exercises.find(e => e.exerciseId === exercise.id);
      if (exSession && exSession.completedSets.length > 0) {
        // Construir configs basados en las series de la última sesión
        const sortedSets = [...exSession.completedSets].sort((a, b) => a.setNumber - b.setNumber);
        return Array.from({ length: exercise.sets }, (_, i) => {
          // Buscar la serie correspondiente o usar la última registrada como fallback
          const matched = sortedSets.find(s => s.setNumber === i + 1) || sortedSets[sortedSets.length - 1];
          return {
            setNumber: i + 1,
            reps: matched.reps,
            weight: matched.weight,
            restTime: matched.restTime || exercise.restBetweenSets,
          };
        });
      }
    }
    return null;
  };

  // Construir configs iniciales: prioridad a última sesión > setConfigs > valores del ejercicio
  const buildInitialConfigs = (): SetConfig[] => {
    const lastSession = getLastSessionConfigs();
    if (lastSession) return lastSession;
    return exercise.setConfigs && exercise.setConfigs.length > 0
      ? exercise.setConfigs
      : Array.from({ length: exercise.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: exercise.reps,
          weight: exercise.weight,
          restTime: exercise.restBetweenSets,
        }));
  };

  // Estado local para las configuraciones editables
  const [localSetConfigs, setLocalSetConfigs] = useState<SetConfig[]>(buildInitialConfigs);

  // Sincronizar estado de series cuando cambia el ejercicio o se restaura sesión
  useEffect(() => {
    setCurrentSet(initialCurrentSet);
    setCompletedSets(initialCompletedSets);
  }, [exercise.id, initialCurrentSet, initialCompletedSets]);

  // Sincronizar SOLO cuando cambia el ejercicio activo (no cuando cambia el historial,
  // para no sobreescribir las ediciones del usuario durante el entrenamiento).
  useEffect(() => {
    setLocalSetConfigs(buildInitialConfigs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, exercise.sets]);

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

  // Eliminar una serie (solo si no está completada y queda más de una)
  const removeSet = (index: number) => {
    if (localSetConfigs.length <= 1) return;
    const setNumberToRemove = index + 1;
    if (completedSets.includes(setNumberToRemove)) return;

    setLocalSetConfigs((prev) => {
      // Eliminar y renumerar
      const updated = prev
        .filter((_, i) => i !== index)
        .map((config, i) => ({ ...config, setNumber: i + 1 }));

      // Actualizar series completadas: las posteriores se desplazan -1
      const newCompletedSets = completedSets
        .filter((s) => s !== setNumberToRemove)
        .map((s) => (s > setNumberToRemove ? s - 1 : s));

      // Ajustar serie actual
      let newCurrentSet = currentSet;
      if (currentSet > setNumberToRemove) {
        newCurrentSet = currentSet - 1;
      } else if (currentSet === setNumberToRemove) {
        // Mantener el mismo índice (que ahora es la siguiente serie) o retroceder si era la última
        newCurrentSet = Math.min(currentSet, updated.length);
      }

      setCompletedSets(newCompletedSets);
      setCurrentSet(newCurrentSet);

      // Notificar cambios al padre
      onUpdateSetConfig?.(exercise.id, updated);
      onSetStateChange?.(exercise.id, newCurrentSet, newCompletedSets);

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

    // Detección de récord personal: peso superior al máximo histórico
    // y mejor que cualquier marca ya conseguida en esta misma sesión.
    const benchmark = Math.max(previousMaxWeight, sessionBestWeight);
    if (config.weight > 0 && benchmark > 0 && config.weight > benchmark) {
      setSessionBestWeight(config.weight);
      setRecordDialog({
        open: true,
        weight: config.weight,
        reps: config.reps,
        previous: previousMaxWeight,
      });
      setRecordFlash(true);
      window.setTimeout(() => setRecordFlash(false), 3000);
    } else if (config.weight > sessionBestWeight) {
      setSessionBestWeight(config.weight);
    }

    const newCompletedSets = [...completedSets, currentSet];
    setCompletedSets(newCompletedSets);
    
    // Sincronizar estado inmediatamente antes de notificar al padre
    onSetStateChange?.(exercise.id, currentSet, newCompletedSets);

    
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
    // Auto-avanzar a la siguiente serie cuando termina el descanso entre series.
    // En la última serie (timerType === 'exercise') mostramos el resumen y esperamos confirmación.
    if (timerType === 'set') {
      handleContinue();
    }
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
      // Usar localSetConfigs (que ya incluye los valores precargados de la última sesión)
      // en vez de exercise.setConfigs (configuración estática del ejercicio).
      const nextConfig = localSetConfigs[currentSet] || localSetConfigs[localSetConfigs.length - 1] || {
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
                  className="w-full h-full object-contain p-1"
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
              <h3 className="font-display font-bold text-lg break-words">{exercise.name}</h3>
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
            {/* Image carousel - múltiples imágenes con deslizamiento lateral */}
            <ExerciseImagesCarousel exercise={exercise} />
            
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
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
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
                  
                  // Build live session for the inline progression chart of the active set
                  const liveCompletedSetObjects = completedSets.map(setNum => {
                    const cfg = localSetConfigs[setNum - 1];
                    return cfg ? {
                      setNumber: setNum,
                      reps: cfg.reps,
                      weight: cfg.weight,
                      restTime: cfg.restTime,
                      completedAt: new Date(),
                    } : null;
                  }).filter(Boolean);

                  const inlineLiveSession: WorkoutSession | null = liveCompletedSetObjects.length > 0 ? {
                    id: 'live-session-set',
                    date: new Date(),
                    exercises: [{
                      exerciseId: exercise.id,
                      exerciseName: exercise.name,
                      muscleGroup: exercise.muscleGroup,
                      completedSets: liveCompletedSetObjects as any,
                      totalSets: exercise.sets,
                      startedAt: new Date(),
                    }],
                    totalDuration: 0,
                    startedAt: new Date(),
                    isComplete: false,
                  } : null;

                  const inlineSessions = inlineLiveSession
                    ? [...(workoutSessions || []), inlineLiveSession]
                    : (workoutSessions || []);

                  return (
                    <div key={index} className="space-y-2">
                      <SetCard
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
                        onRemoveSet={!isCompleted && localSetConfigs.length > 1 ? removeSet : undefined}
                      />
                      {isCurrent && (
                        <div className="p-3 rounded-xl bg-secondary/30 border border-primary/30">
                          <ExerciseProgressChart
                            exerciseId={exercise.id}
                            exerciseName={exercise.name}
                            sessions={inlineSessions}
                            inline
                            setNumberFilter={currentSet}
                            onDeleteSet={onDeleteCompletedSet ? (sId, sn) => onDeleteCompletedSet(sId, exercise.id, sn) : undefined}
                          />
                        </div>
                      )}
                    </div>
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
            
            {/* Progresión de peso (gráfica inline) — incluye sesión actual en vivo */}
            {(() => {
              // Build a virtual session from current completed sets
              const currentCompletedSetObjects = completedSets.map(setNum => {
                const cfg = localSetConfigs[setNum - 1];
                return cfg ? {
                  setNumber: setNum,
                  reps: cfg.reps,
                  weight: cfg.weight,
                  restTime: cfg.restTime,
                  completedAt: new Date(),
                } : null;
              }).filter(Boolean);

              const liveSession: WorkoutSession | null = currentCompletedSetObjects.length > 0 ? {
                id: 'live-session',
                date: new Date(),
                exercises: [{
                  exerciseId: exercise.id,
                  exerciseName: exercise.name,
                  muscleGroup: exercise.muscleGroup,
                  completedSets: currentCompletedSetObjects as any,
                  totalSets: exercise.sets,
                  startedAt: new Date(),
                }],
                totalDuration: 0,
                startedAt: new Date(),
                isComplete: false,
              } : null;

              const sessionsWithLive = liveSession
                ? [...(workoutSessions || []), liveSession]
                : (workoutSessions || []);

              return sessionsWithLive.length > 0 ? (
                <div className="p-3 rounded-xl bg-secondary/30">
                  <ExerciseProgressChart
                    exerciseId={exercise.id}
                    exerciseName={exercise.name}
                    sessions={sessionsWithLive}
                    inline
                    maxSetNumber={exercise.sets}
                    onDeleteSet={onDeleteCompletedSet ? (sId, sn) => onDeleteCompletedSet(sId, exercise.id, sn) : undefined}
                  />
                </div>
              ) : null;
            })()}

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
      {showFullscreenTimer && (() => {
        // Construir sesión "en vivo" con las series ya completadas para que la
        // gráfica de la siguiente serie refleje los datos del entrenamiento actual.
        const liveCompletedSetObjects = completedSets.map(setNum => {
          const cfg = localSetConfigs[setNum - 1];
          return cfg ? {
            setNumber: setNum,
            reps: cfg.reps,
            weight: cfg.weight,
            restTime: cfg.restTime,
            completedAt: new Date(),
          } : null;
        }).filter(Boolean);

        const liveSession: WorkoutSession | null = liveCompletedSetObjects.length > 0 ? {
          id: 'live-session-timer',
          date: new Date(),
          exercises: [{
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup,
            completedSets: liveCompletedSetObjects as any,
            totalSets: exercise.sets,
            startedAt: new Date(),
          }],
          totalDuration: 0,
          startedAt: new Date(),
          isComplete: false,
        } : null;

        const timerSessions = liveSession
          ? [...(workoutSessions || []), liveSession]
          : (workoutSessions || []);

        // Solo mostramos la gráfica entre series (no en el descanso entre ejercicios)
        const showChartInTimer = timerType === 'set' && currentSet < exercise.sets;

        return (
          <FullscreenTimer
            initialTime={getTimerDuration()}
            label={getTimerLabel()}
            nextSetLabel={getNextSetLabel()}
            onComplete={handleTimerComplete}
            onContinue={handleContinue}
            onClose={handleCloseTimer}
            globalElapsedTime={globalElapsedTime}
            globalIsRunning={globalIsRunning}
            onGlobalToggle={onGlobalToggle}
            chartExerciseId={showChartInTimer ? exercise.id : undefined}
            chartExerciseName={showChartInTimer ? exercise.name : undefined}
            chartSessions={showChartInTimer ? timerSessions : undefined}
            chartNextSetNumber={showChartInTimer ? currentSet + 1 : undefined}
            chartOnDeleteSet={showChartInTimer && onDeleteCompletedSet ? (sId, sn) => onDeleteCompletedSet(sId, exercise.id, sn) : undefined}
          />
        );
      })()}

      <PersonalRecordDialog
        open={recordDialog.open}
        onClose={() => setRecordDialog((r) => ({ ...r, open: false }))}
        exerciseName={exercise.name}
        weight={recordDialog.weight}
        reps={recordDialog.reps}
        previousRecord={recordDialog.previous}
      />

      {recordFlash && (
        <div className="fixed inset-0 z-[300] pointer-events-none animate-strobe-flash" />
      )}
    </>
  );
};

// Carrusel de imágenes para la ficha de ejercicio
const ExerciseImagesCarousel = ({ exercise }: { exercise: Exercise }) => {
  const images = useMemo(() => {
    if (exercise.imageUrls && exercise.imageUrls.length > 0) return exercise.imageUrls;
    if (exercise.imageUrl) return [exercise.imageUrl];
    return [];
  }, [exercise.imageUrls, exercise.imageUrl]);

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  if (images.length === 0) return null;

  // Una sola imagen: render simple sin controles de carrusel
  if (images.length === 1) {
    return (
      <div className="w-full aspect-square rounded-xl bg-secondary overflow-hidden">
        <img
          src={images[0]}
          alt={exercise.name}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Carousel setApi={setApi} opts={{ loop: true, align: 'start' }} className="w-full">
        <CarouselContent className="-ml-0">
          {images.map((url, idx) => (
            <CarouselItem key={`${url}-${idx}`} className="pl-0 basis-full">
              <div className="w-full aspect-square rounded-xl bg-secondary overflow-hidden">
                <img
                  src={url}
                  alt={`${exercise.name} ${idx + 1}`}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          type="button"
          className="left-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm border-border hover:bg-background"
        />
        <CarouselNext
          type="button"
          className="right-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm border-border hover:bg-background"
        />
      </Carousel>

      {/* Indicadores (puntos) */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: count }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => api?.scrollTo(idx)}
            aria-label={`Ir a imagen ${idx + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all',
              idx === current ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70'
            )}
          />
        ))}
      </div>
    </div>
  );
};
