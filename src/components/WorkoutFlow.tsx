import { useState, useRef, useEffect, useCallback } from 'react';
import { Exercise, SetConfig } from '@/types/exercise';
import { FullscreenTimer } from './FullscreenTimer';
import { ExerciseCard } from './ExerciseCard';
import { WorkoutStopwatch, useWorkoutStopwatch } from './WorkoutStopwatch';
import { X, Dumbbell, ChevronRight, Plus, Trophy, ArrowRight, LogOut, Timer, AlertTriangle, Bell, BellOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useWorkoutNotification } from '@/hooks/useWorkoutNotification';

import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

// Clave para persistencia en localStorage
const WORKOUT_STATE_KEY = 'gym-tracker-active-workout';

interface WorkoutFlowProps {
  routineId?: string;
  routineName: string;
  exercises: Exercise[];
  allExercises: Exercise[]; // Para añadir ejercicios extra
  onClose: (elapsedTime?: number) => void;
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
  onWorkoutComplete?: (elapsedTime?: number) => void;
  // Props opcionales para restaurar estado
  initialCompletedExerciseIds?: string[];
  initialFlowState?: FlowState;
  initialElapsedTime?: number;
}

export type FlowState = 
  | { type: 'exercising'; exerciseIndex: number }
  | { type: 'rest-between-exercises'; completedExerciseIndex: number }
  | { type: 'select-next-exercise'; completedExerciseIndex: number }
  | { type: 'routine-complete' }
  | { type: 'add-extra-exercise' };

export const WorkoutFlow = ({
  routineId,
  routineName,
  exercises: initialExercises,
  allExercises,
  onClose,
  onSetComplete,
  onEditExercise,
  onDeleteExercise,
  onUpdateSetConfig,
  onWorkoutComplete,
  initialCompletedExerciseIds = [],
  initialFlowState,
  initialElapsedTime = 0,
}: WorkoutFlowProps) => {
  const [workoutExercises, setWorkoutExercises] = useState<Exercise[]>(initialExercises);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(
    new Set(initialCompletedExerciseIds)
  );
  const [flowState, setFlowState] = useState<FlowState>(
    initialFlowState || { type: 'exercising', exerciseIndex: 0 }
  );
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  
  // Mantener pantalla activa durante el entrenamiento
  useWakeLock(true);
  
  // Notificaciones para pantalla de bloqueo
  const { 
    isSupported: notificationsSupported,
    permission: notificationPermission,
    requestPermission,
    updateWorkoutNotification,
    stopUpdates: stopNotifications,
  } = useWorkoutNotification();
  
  // Cronómetro del entrenamiento (con tiempo inicial si se está restaurando)
  const { elapsedTime, isRunning, toggle, stop } = useWorkoutStopwatch(true, initialElapsedTime);

  // Formatear tiempo para mostrar
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Persistir estado del entrenamiento en localStorage
  useEffect(() => {
    const stateToSave = {
      routineId,
      routineName,
      workoutExerciseIds: workoutExercises.map(e => e.id),
      completedExerciseIds: Array.from(completedExerciseIds),
      flowState,
      elapsedTime,
      extraExerciseIds: extraExercises.map(e => e.id),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(WORKOUT_STATE_KEY, JSON.stringify(stateToSave));
  }, [routineId, routineName, workoutExercises, completedExerciseIds, flowState, elapsedTime, extraExercises]);

  // Limpiar estado guardado al finalizar
  const clearSavedState = useCallback(() => {
    localStorage.removeItem(WORKOUT_STATE_KEY);
  }, []);

  // Manejar intento de cerrar
  const handleCloseAttempt = () => {
    setShowExitConfirmation(true);
  };

  // Confirmar salida y finalizar
  const handleConfirmExit = () => {
    clearSavedState();
    stop();
    onWorkoutComplete?.(elapsedTime);
    onClose(elapsedTime);
  };

  // Cancelar salida
  const handleCancelExit = () => {
    setShowExitConfirmation(false);
  };

  const currentExercise = flowState.type === 'exercising' 
    ? workoutExercises[flowState.exerciseIndex] 
    : null;

  // Actualizar notificación periódicamente cuando está activo
  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    
    // Actualizar notificación cada 5 segundos
    const interval = setInterval(() => {
      updateWorkoutNotification(elapsedTime, currentExercise?.name);
    }, 5000);
    
    // Actualizar inmediatamente
    updateWorkoutNotification(elapsedTime, currentExercise?.name);
    
    return () => clearInterval(interval);
  }, [elapsedTime, currentExercise?.name, notificationPermission, updateWorkoutNotification]);
  
  // Limpiar notificaciones al salir
  useEffect(() => {
    return () => {
      stopNotifications();
    };
  }, [stopNotifications]);

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
          {/* Cronómetro */}
          <div className="flex justify-center mb-4">
            <WorkoutStopwatch 
              elapsedTime={elapsedTime}
              isRunning={isRunning}
              onToggle={toggle}
            />
          </div>

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
              onClick={handleCloseAttempt}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Salir del entrenamiento"
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
          <p className="text-muted-foreground mb-4">
            Has completado {completedExerciseIds.size} ejercicios en {routineName}
          </p>
          
          {/* Tiempo total del entrenamiento */}
          <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-secondary/50 mb-8">
            <Timer className="w-6 h-6 text-primary" />
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Tiempo total</p>
              <p className="font-lcd text-2xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
                {formatTime(elapsedTime)}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => setFlowState({ type: 'add-extra-exercise' })}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <Plus className="w-5 h-5" />
              Añadir ejercicio extra
            </button>
            
            <button
              onClick={() => {
                clearSavedState();
                stop();
                onWorkoutComplete?.(elapsedTime);
                onClose(elapsedTime);
              }}
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
          {/* Cronómetro y notificaciones */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <WorkoutStopwatch 
              elapsedTime={elapsedTime}
              isRunning={isRunning}
              onToggle={toggle}
            />
            {notificationsSupported && (
              <button
                onClick={requestPermission}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  notificationPermission === 'granted'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                }`}
                title={notificationPermission === 'granted' 
                  ? 'Notificaciones activas' 
                  : 'Activar notificaciones para pantalla de bloqueo'}
              >
                {notificationPermission === 'granted' ? (
                  <Bell className="w-5 h-5" />
                ) : (
                  <BellOff className="w-5 h-5" />
                )}
              </button>
            )}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">{routineName}</p>
              <h2 className="font-display font-bold text-xl text-gradient-energy">
                Ejercicio {flowState.exerciseIndex + 1} de {workoutExercises.length}
              </h2>
            </div>
            <button
              onClick={handleCloseAttempt}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Salir del entrenamiento"
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

          {/* Botón para terminar sesión anticipadamente */}
          <div className="mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setFlowState({ type: 'routine-complete' })}
              className="w-full py-3 rounded-xl bg-secondary text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/20 hover:text-destructive transition-all"
            >
              <LogOut className="w-5 h-5" />
              Terminar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Diálogo de confirmación de salida
  const ExitConfirmationDialog = (
    <Dialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            ¿Salir del entrenamiento?
          </DialogTitle>
          <DialogDescription>
            Tu progreso se guardará automáticamente. Podrás continuar donde lo dejaste al volver a abrir esta rutina.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 rounded-xl bg-secondary/50 my-2">
          <div className="flex items-center gap-3">
            <Timer className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Tiempo transcurrido</p>
              <p className="font-lcd text-xl text-primary">{formatTime(elapsedTime)}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {completedExerciseIds.size} de {workoutExercises.length} ejercicios completados
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleCancelExit} className="w-full sm:w-auto">
            Continuar entrenando
          </Button>
          <Button variant="destructive" onClick={handleConfirmExit} className="w-full sm:w-auto">
            Salir y guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return ExitConfirmationDialog;
};
