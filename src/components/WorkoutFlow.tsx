import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Exercise, SetConfig, MUSCLE_GROUPS, MuscleGroup } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { FullscreenTimer } from './FullscreenTimer';
import { ExerciseCard, type ExerciseCompletionSnapshot } from './ExerciseCard';
import { WorkoutStopwatch, useWorkoutStopwatch } from './WorkoutStopwatch';
import { AddExerciseDuringWorkoutDialog } from './AddExerciseDuringWorkoutDialog';
import { X, Dumbbell, ChevronRight, Plus, Trophy, ArrowRight, LogOut, Timer, AlertTriangle, Bell, BellOff, Flame, Weight, RefreshCw, ClipboardList, FileDown, ListChecks, ChevronUp, ChevronDown } from 'lucide-react';
import { exportWorkoutToPDF } from '@/utils/exportWorkoutPDF';
import { isWarmupSet } from '@/utils/workoutStats';

import { CompletedExercisesReview } from './CompletedExercisesReview';
import { ExerciseSummary } from './ExerciseSummary';
import { PersonalRecordDialog } from './PersonalRecordDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useWorkoutNotification } from '@/hooks/useWorkoutNotification';
import { usePersonalData } from '@/hooks/usePersonalData';
import { calculateAge, calculateCaloriesBurned } from '@/types/personalData';

import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';
import { cn } from '@/lib/utils';
import {
  upsertSessionSetConfigs,
  resolveSummaryConfigTarget,
  syncSessionOverrideOnManualEdit,
} from '@/utils/aiSuggestion';


// Clave para persistencia en localStorage
const WORKOUT_STATE_KEY = 'gym-tracker-active-workout';

export interface ExerciseSetState {
  exerciseId: string;
  /** Clave única de la aparición del ejercicio dentro del entrenamiento */
  instanceKey?: string;
  currentSet: number;
  completedSets: number[];
  /** Configuración aplicada SOLO a esta aparición del entrenamiento (IA) */
  sessionSetConfigs?: SetConfig[];
}

/** Ejercicio dentro de un entrenamiento, con clave de instancia única y estable */
export type WorkoutExercise = Exercise & { instanceKey: string };

/**
 * Asigna claves de instancia deterministas: `${exerciseId}#${nºAparición}`.
 * Respeta una instanceKey ya presente (guardados nuevos) y solo genera claves
 * para entradas antiguas sin ella, evitando colisiones con las existentes.
 */
const withInstanceKeys = (list: (Exercise & { instanceKey?: string })[]): WorkoutExercise[] => {
  const used = new Set<string>(list.map((e) => e.instanceKey).filter((k): k is string => Boolean(k)));
  const counts = new Map<string, number>();
  return list.map((e) => {
    if (e.instanceKey) return { ...e, instanceKey: e.instanceKey } as WorkoutExercise;
    let n = counts.get(e.id) ?? 0;
    while (used.has(`${e.id}#${n}`)) n++;
    counts.set(e.id, n + 1);
    used.add(`${e.id}#${n}`);
    return { ...e, instanceKey: `${e.id}#${n}` };
  });
};

const nextInstanceKey = (list: WorkoutExercise[], exerciseId: string) => {
  let n = 0;
  while (list.some((e) => e.instanceKey === `${exerciseId}#${n}`)) n++;
  return `${exerciseId}#${n}`;
};

/** Compatibilidad con entrenamientos guardados antes de las claves de instancia */
const normalizeKey = (key: string) => (key.includes('#') ? key : `${key}#0`);


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
  onAddExerciseToRoutine?: (exerciseId: string) => void;
  onRemoveExerciseFromRoutine?: (exerciseId: string) => void;
  onCreateExercise?: () => void;
  newExerciseToAdd?: Exercise | null;
  onNewExerciseHandled?: () => void;
  // Props opcionales para restaurar estado
  initialCompletedExerciseIds?: string[];
  initialFlowState?: FlowState;
  initialElapsedTime?: number;
  initialIsRunning?: boolean;
  // Estado inicial de series por ejercicio
  initialExerciseSetStates?: ExerciseSetState[];
  workoutSessions?: WorkoutSession[];
  onDeleteCompletedSet?: (sessionId: string, exerciseId: string, setNumber: number) => void | Promise<void>;
}

export type FlowState = 
  | { type: 'exercising'; exerciseIndex: number }
  | { type: 'exercise-summary'; completedExerciseIndex: number }
  | { type: 'rest-between-exercises'; completedExerciseIndex: number }
  | { type: 'select-next-exercise'; completedExerciseIndex: number }
  | { type: 'routine-complete' }
  | { type: 'add-extra-exercise' }
  | { type: 'substitute-exercise'; substituteIndex: number };

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
  onAddExerciseToRoutine,
  onRemoveExerciseFromRoutine,
  onCreateExercise,
  newExerciseToAdd,
  onNewExerciseHandled,
  initialCompletedExerciseIds = [],
  initialFlowState,
  initialElapsedTime = 0,
  initialIsRunning = true,
  initialExerciseSetStates = [],
  workoutSessions = [],
  onDeleteCompletedSet,
}: WorkoutFlowProps) => {
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>(() => withInstanceKeys(initialExercises));
  // Estado para el diálogo de guardar ejercicio en rutina
  const [pendingExerciseToAdd, setPendingExerciseToAdd] = useState<Exercise | null>(null);
  const [showSaveToRoutineDialog, setShowSaveToRoutineDialog] = useState(false);
  // Se guardan claves de instancia (compatibles con ids antiguos)
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(
    () => new Set(initialCompletedExerciseIds.map(normalizeKey))
  );

  const [flowState, setFlowState] = useState<FlowState>(
    initialFlowState || { type: 'exercising', exerciseIndex: 0 }
  );
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [extraMuscleFilter, setExtraMuscleFilter] = useState<MuscleGroup | 'todos'>('todos');
  const [substituteMuscleFilter, setSubstituteMuscleFilter] = useState<MuscleGroup | 'todos'>('todos');
  const [substituteOriginalIndex, setSubstituteOriginalIndex] = useState<number | null>(null);
  const [showCompletedReview, setShowCompletedReview] = useState(false);

  // Récord personal: se detecta durante la serie pero se muestra al pasar al
  // descanso entre ejercicios, superpuesto al temporizador.
  interface PendingRecord {
    exerciseName: string;
    weight: number;
    reps: number;
    previousRecord: number;
  }
  const [pendingRecord, setPendingRecord] = useState<PendingRecord | null>(null);
  const [shownRecord, setShownRecord] = useState<PendingRecord | null>(null);
  const [recordFlash, setRecordFlash] = useState(false);

  const consumeShownRecord = useCallback(() => {
    setShownRecord(null);
    setRecordFlash(false);
  }, []);
  
  // Estado de series por ejercicio (para persistir y restaurar)
  const [exerciseSetStates, setExerciseSetStates] = useState<ExerciseSetState[]>(
    () => initialExerciseSetStates.map(s => ({ ...s, instanceKey: s.instanceKey ?? `${s.exerciseId}#0` }))
  );

  /**
   * Instantáneas por instanceKey del momento exacto en que se terminó el ejercicio.
   * El resumen las usa como fuente directa, sin depender de setStates asíncronos.
   */
  const [summarySnapshots, setSummarySnapshots] = useState<Record<string, ExerciseCompletionSnapshot>>({});

  

  
  
  // Datos personales para cálculo de calorías
  const { personalData } = usePersonalData();
  
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
  const { elapsedTime, isRunning, toggle, setRunning, stop, setTime, getElapsedNow } = useWorkoutStopwatch(initialIsRunning, initialElapsedTime);

  // Estado para guardar las series completadas con peso
  const [completedSetsData, setCompletedSetsData] = useState<{exerciseId: string; exerciseName?: string; weight: number; reps: number; isWarmup?: boolean}[]>([]);

  // Calcular kg totales movidos y calorías
  const workoutStats = useMemo(() => {
    let totalKgMoved = 0;

    completedSetsData.forEach(set => {
      // Los calentamientos no suman volumen
      if (isWarmupSet(set.exerciseName ?? '', set)) return;
      totalKgMoved += set.weight * set.reps;
    });

    
    let caloriesBurned = 0;
    if (personalData) {
      const age = calculateAge(personalData.birthDate);
      caloriesBurned = calculateCaloriesBurned(
        personalData.weight,
        elapsedTime,
        age,
        personalData.sex
      );
    }
    
    return { totalKgMoved, caloriesBurned };
  }, [completedSetsData, elapsedTime, personalData]);

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

  // Persistir estado del entrenamiento en localStorage (sin escribir cada segundo)
  const finishedRef = useRef(false);
  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (finishedRef.current) return;
    const stateToSave = {
      routineId,
      routineName,
      workoutExerciseIds: workoutExercises.map(e => e.instanceKey),
      completedExerciseIds: Array.from(completedExerciseIds),
      flowState,
      elapsedTime: getElapsedNow(),
      stopwatchIsRunning: isRunning,
      stopwatchUpdatedAt: new Date().toISOString(),
      extraExerciseIds: extraExercises.map(e => e.id),
      savedAt: new Date().toISOString(),
      exerciseSetStates,
    };
    localStorage.setItem(WORKOUT_STATE_KEY, JSON.stringify(stateToSave));
  };

  // Guardar al cambiar cualquier estado relevante (incluido corriendo/pausado)
  useEffect(() => {
    persistRef.current();
  }, [routineId, routineName, workoutExercises, completedExerciseIds, flowState, isRunning, extraExercises, exerciseSetStates]);

  // Heartbeat moderado + guardado al ocultar la app
  useEffect(() => {
    const persist = () => persistRef.current();
    const interval = setInterval(persist, 10000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onHide);
      persist();
    };
  }, []);

  // Actualizar estado de series de una aparición concreta del ejercicio
  const handleSetStateChange = useCallback((instanceKey: string, exerciseId: string, currentSet: number, completedSets: number[]) => {
    setExerciseSetStates(prev => {
      const existing = prev.findIndex(s => s.instanceKey === instanceKey);
      const newState = {
        instanceKey,
        exerciseId,
        currentSet,
        completedSets,
        sessionSetConfigs: existing >= 0 ? prev[existing].sessionSetConfigs : undefined,
      };
      if (existing >= 0) {
        const old = prev[existing];
        const same =
          old.exerciseId === newState.exerciseId &&
          old.currentSet === newState.currentSet &&
          old.completedSets.length === completedSets.length &&
          old.completedSets.every((v, i) => v === completedSets[i]);
        if (same) return prev;
        const updated = [...prev];
        updated[existing] = newState;
        return updated;
      }
      return [...prev, newState];
    });
  }, []);


  /**
   * Configuración aplicada por la IA a UNA aparición concreta del entrenamiento.
   * No persiste en public.exercises ni afecta a otras apariciones del mismo ejercicio.
   */
  const handleSessionSetConfig = useCallback((instanceKey: string, exerciseId: string, setConfigs: SetConfig[]) => {
    setExerciseSetStates(prev => upsertSessionSetConfigs(prev, instanceKey, exerciseId, setConfigs));
    setWorkoutExercises(prev => prev.map(e =>
      e.instanceKey === instanceKey ? { ...e, setConfigs: setConfigs.map(c => ({ ...c })) } : e
    ));
  }, []);

  // Limpiar estado guardado al finalizar
  const clearSavedState = useCallback(() => {
    finishedRef.current = true;
    localStorage.removeItem(WORKOUT_STATE_KEY);
  }, []);

  // Manejar intento de cerrar
  const handleCloseAttempt = () => {
    setShowExitConfirmation(true);
  };

  // Confirmar salida y finalizar (duración exacta en este instante)
  const handleConfirmExit = () => {
    const finalElapsed = getElapsedNow();
    clearSavedState();
    stop();
    onWorkoutComplete?.(finalElapsed);
    onClose(finalElapsed);
  };

  // Cancelar salida
  const handleCancelExit = () => {
    setShowExitConfirmation(false);
  };

  const currentExercise = flowState.type === 'exercising' 
    ? workoutExercises[flowState.exerciseIndex] 
    : null;

  // Actualizar notificación periódicamente sin recrear el intervalo cada segundo
  const notifyRef = useRef<() => void>(() => {});
  notifyRef.current = () => {
    updateWorkoutNotification(getElapsedNow(), currentExercise?.name);
  };

  useEffect(() => {
    if (notificationPermission !== 'granted') return;

    const tick = () => notifyRef.current();
    tick();
    const interval = setInterval(tick, 5000);

    return () => clearInterval(interval);
  }, [notificationPermission]);
  
  // Limpiar notificaciones al salir
  useEffect(() => {
    return () => {
      stopNotifications();
    };
  }, [stopNotifications]);

  // Reaccionar a nuevo ejercicio creado desde fuera
  useEffect(() => {
    if (newExerciseToAdd) {
      handleAddExtraExercise(newExerciseToAdd);
      onNewExerciseHandled?.();
    }
  }, [newExerciseToAdd]);

  const remainingExercises = workoutExercises.filter(
    (e) => !completedExerciseIds.has(e.instanceKey)
  );

  // Ids de ejercicios (identidad histórica) con alguna aparición completada
  const completedOriginalIds = useMemo(
    () => new Set(workoutExercises.filter((e) => completedExerciseIds.has(e.instanceKey)).map((e) => e.id)),
    [workoutExercises, completedExerciseIds]
  );

  const availableExtraExercises = allExercises.filter(
    (e) => !workoutExercises.some((we) => we.id === e.id) && 
           !extraExercises.some((ee) => ee.id === e.id)
  );

  const handleExerciseComplete = (instanceKey: string, snapshot?: ExerciseCompletionSnapshot) => {
    const exerciseIndex = workoutExercises.findIndex((e) => e.instanceKey === instanceKey);

    // Aplicar la instantánea de forma atómica ANTES de mostrar el resumen:
    // series completadas reales + configuración efectiva usada en pantalla.
    if (snapshot) {
      setSummarySnapshots(prev => ({ ...prev, [instanceKey]: snapshot }));
      setExerciseSetStates(prev => {
        const idx = prev.findIndex(s => s.instanceKey === instanceKey);
        const merged = {
          instanceKey,
          exerciseId: snapshot.exerciseId,
          currentSet: idx >= 0 ? prev[idx].currentSet : snapshot.completedSets.length,
          completedSets: [...snapshot.completedSets],
          sessionSetConfigs: idx >= 0 ? prev[idx].sessionSetConfigs : undefined,
        };
        if (idx < 0) return [...prev, merged];
        const updated = [...prev];
        updated[idx] = merged;
        return updated;
      });
      setWorkoutExercises(prev => prev.map(e =>
        e.instanceKey === instanceKey
          ? { ...e, setConfigs: snapshot.setConfigs.map(c => ({ ...c })) }
          : e
      ));
    }

    setCompletedExerciseIds((prev) => new Set([...prev, instanceKey]));
    
    // Mostrar resumen del ejercicio antes de continuar
    setFlowState({ 
      type: 'exercise-summary', 
      completedExerciseIndex: exerciseIndex 
    });
  };


  const handleSummaryContinue = (completedExerciseIndex: number, updatedConfigs: SetConfig[]) => {
    const exercise = workoutExercises[completedExerciseIndex];

    // Actualizar configs si fueron editadas en el resumen.
    // Con override de sesión (p. ej. sugerencia IA aplicada) NO se escribe en public.exercises.
    if (exercise) {
      const target = resolveSummaryConfigTarget(exerciseSetStates, exercise.instanceKey);
      if (target === 'session') {
        handleSessionSetConfig(exercise.instanceKey, exercise.id, updatedConfigs);
      } else {
        onUpdateSetConfig?.(exercise.id, updatedConfigs);
      }
    }

    
    // Siempre ir al descanso entre ejercicios y luego al selector
    // Esto permite al usuario añadir más ejercicios o terminar la sesión
    setFlowState({ 
      type: 'rest-between-exercises', 
      completedExerciseIndex 
    });

    // Mostrar ahora el récord pendiente (si hay), superpuesto al temporizador,
    // y consumirlo para que no reaparezca más adelante.
    if (pendingRecord) {
      setShownRecord(pendingRecord);
      setPendingRecord(null);
      setRecordFlash(true);
      window.setTimeout(() => setRecordFlash(false), 3000);
    }
  };

  const handleRestComplete = () => {
    // El temporizador terminó, mostrar selector de siguiente ejercicio
    consumeShownRecord();
    if (flowState.type === 'rest-between-exercises') {
      setFlowState({ 
        type: 'select-next-exercise', 
        completedExerciseIndex: flowState.completedExerciseIndex 
      });
    }
  };

  const handleSelectNextExercise = (exercise: WorkoutExercise) => {
    const exerciseIndex = workoutExercises.findIndex((e) => e.instanceKey === exercise.instanceKey);
    setFlowState({ type: 'exercising', exerciseIndex });
  };

  // Reordenar ejercicios pendientes durante la sesión
  const handleReorderRemaining = (instanceKey: string, direction: 'up' | 'down') => {
    setWorkoutExercises((prev) => {
      const pendingIndices = prev
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => !completedExerciseIds.has(e.instanceKey));
      const posInPending = pendingIndices.findIndex(({ e }) => e.instanceKey === instanceKey);
      if (posInPending === -1) return prev;
      const targetPosInPending = direction === 'up' ? posInPending - 1 : posInPending + 1;
      if (targetPosInPending < 0 || targetPosInPending >= pendingIndices.length) return prev;
      const fromIdx = pendingIndices[posInPending].i;
      const toIdx = pendingIndices[targetPosInPending].i;
      const updated = [...prev];
      [updated[fromIdx], updated[toIdx]] = [updated[toIdx], updated[fromIdx]];
      return updated;
    });
  };

  const handleAddExtraExercise = (exercise: Exercise) => {
    // Guardar el ejercicio pendiente y mostrar el diálogo
    setPendingExerciseToAdd(exercise);
    setShowSaveToRoutineDialog(true);
  };


  const handleConfirmAddExercise = (saveToRoutine: boolean) => {
    if (!pendingExerciseToAdd) return;
    
    if (substituteOriginalIndex !== null) {
      // Sustitución: reemplazar el ejercicio solo en la sesión actual
      setWorkoutExercises((prev) => {
        const updated = [...prev];
        updated[substituteOriginalIndex] = {
          ...pendingExerciseToAdd,
          instanceKey: nextInstanceKey(prev, pendingExerciseToAdd.id),
        };
        return updated;
      });
      
      if (saveToRoutine && routineId && onAddExerciseToRoutine) {
        // Añadir el nuevo a la rutina SIN eliminar el original
        onAddExerciseToRoutine(pendingExerciseToAdd.id);
      }
      
      setShowSaveToRoutineDialog(false);
      setPendingExerciseToAdd(null);
      setSubstituteOriginalIndex(null);
      setFlowState({ type: 'exercising', exerciseIndex: substituteOriginalIndex });
    } else {
      // Añadir extra (flujo original)
      setWorkoutExercises((prev) => [
        ...prev,
        { ...pendingExerciseToAdd, instanceKey: nextInstanceKey(prev, pendingExerciseToAdd.id) },
      ]);
      setExtraExercises((prev) => [...prev, pendingExerciseToAdd]);
      const newIndex = workoutExercises.length;

      
      if (saveToRoutine && routineId && onAddExerciseToRoutine) {
        onAddExerciseToRoutine(pendingExerciseToAdd.id);
      }
      
      setShowSaveToRoutineDialog(false);
      setPendingExerciseToAdd(null);
      setFlowState({ type: 'exercising', exerciseIndex: newIndex });
    }
  };

  const handleSkipRest = () => {
    consumeShownRecord();
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

  // Volver atrás desde el resumen al ejercicio
  const handleSummaryGoBack = (exerciseIndex: number, instanceKey: string) => {
    // Quitar de completados para poder volver a ejercitarse
    setCompletedExerciseIds((prev) => {
      const next = new Set(prev);
      next.delete(instanceKey);
      return next;
    });
    setFlowState({ type: 'exercising', exerciseIndex });
  };


  // Renderizar resumen del ejercicio completado
  if (flowState.type === 'exercise-summary') {
    const summaryExercise = workoutExercises[flowState.completedExerciseIndex];
    const savedSetState = exerciseSetStates.find(s => s.instanceKey === summaryExercise?.instanceKey);
    
    if (summaryExercise) {
      const configs = summaryExercise.setConfigs || Array.from({ length: summaryExercise.sets }, (_, i) => ({
        setNumber: i + 1,
        reps: summaryExercise.reps,
        weight: summaryExercise.weight,
        restTime: summaryExercise.restBetweenSets,
      }));
      
      return (
        <div className="fixed inset-0 bg-background z-50 flex flex-col">
          {/* Cronómetro flotante */}
          <div className="flex-none flex justify-center pt-4 pb-2 px-4 bg-background/95 backdrop-blur-sm border-b border-border z-10">
            <WorkoutStopwatch
              elapsedTime={elapsedTime}
              isRunning={isRunning}
              onToggle={toggle}
              onSetTime={setTime}
              onSetRunning={setRunning}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            <ExerciseSummary
              embedded
              exerciseName={summaryExercise.name}
              exerciseId={summaryExercise.id}
              muscleGroup={summaryExercise.muscleGroup}
              setConfigs={configs}
              isUnilateral={summaryExercise.isUnilateral}
              completedSets={savedSetState?.completedSets || []}
              onContinue={(updatedConfigs) => handleSummaryContinue(flowState.completedExerciseIndex, updatedConfigs)}
              onGoBack={() => handleSummaryGoBack(flowState.completedExerciseIndex, summaryExercise.instanceKey)}
              historySessions={workoutSessions}
              onDeleteCompletedSet={onDeleteCompletedSet}
            />
          </div>
        </div>
      );
    }
  }

  // Renderizar temporizador entre ejercicios
  if (flowState.type === 'rest-between-exercises') {
    const completedExercise = workoutExercises[flowState.completedExerciseIndex];
    return (
      <>
        <FullscreenTimer
          initialTime={getRestTime()}
          label="Descanso entre ejercicios"
          nextSetLabel={`¡${completedExercise?.name} completado! Elige el siguiente ejercicio.`}
          onComplete={handleRestComplete}
          onContinue={handleSkipRest}
          onClose={() => {
            consumeShownRecord();
            setFlowState({
              type: 'select-next-exercise',
              completedExerciseIndex: flowState.completedExerciseIndex,
            });
          }}
          globalElapsedTime={elapsedTime}
          globalIsRunning={isRunning}
          onGlobalToggle={toggle}
          onGlobalSetTime={setTime}
          onGlobalSetRunning={setRunning}
        />

        {shownRecord && (
          <PersonalRecordDialog
            open
            onClose={consumeShownRecord}
            exerciseName={shownRecord.exerciseName}
            weight={shownRecord.weight}
            reps={shownRecord.reps}
            previousRecord={shownRecord.previousRecord}
          />
        )}

        {recordFlash && (
          <div className="fixed inset-0 z-[300] pointer-events-none animate-strobe-flash" />
        )}
      </>
    );
  }

  // Renderizar selector de siguiente ejercicio
  if (flowState.type === 'select-next-exercise') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Cronómetro flotante */}
        <div className="flex-none flex justify-center pt-4 pb-2 px-4 bg-background/95 backdrop-blur-sm border-b border-border z-10">
          <WorkoutStopwatch 
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            onToggle={toggle}
            onSetTime={setTime}
            onSetRunning={setRunning}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">


          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-gradient-energy">
                {remainingExercises.length > 0 ? 'Siguiente Ejercicio' : '¿Seguimos?'}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {routineName} · {completedExerciseIds.size} completado{completedExerciseIds.size !== 1 ? 's' : ''}
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
            {remainingExercises.map((exercise, idx) => (
              <div
                key={exercise.instanceKey}
                className="w-full p-4 rounded-2xl bg-card border border-border hover:border-primary transition-all flex items-center gap-3 group"
              >
                {/* Reorder controls */}
                {remainingExercises.length > 1 && (
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReorderRemaining(exercise.instanceKey, 'up'); }}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Subir"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReorderRemaining(exercise.instanceKey, 'down'); }}
                      disabled={idx === remainingExercises.length - 1}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Bajar"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleSelectNextExercise(exercise)}
                  className="flex-1 min-w-0 flex items-center gap-4 text-left"
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
                    <h3 className="font-display font-bold text-lg mt-1 break-words">{exercise.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {exercise.sets} series · {exercise.reps} reps
                    </p>
                  </div>
                  
                  <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </button>
              </div>
            ))}
          </div>

          {/* Ejercicios completados */}
          {completedExerciseIds.size > 0 && (
            <button
              onClick={() => setShowCompletedReview(true)}
              className="w-full mt-4 py-3 rounded-xl bg-primary/10 border border-primary/30 text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              Ver ejercicios completados ({completedExerciseIds.size})
            </button>
          )}

          {/* Botones de acción */}
          <div className="mt-6 pt-6 border-t border-border space-y-3">
            {availableExtraExercises.length > 0 && (
              <button
                onClick={() => setFlowState({ type: 'add-extra-exercise' })}
                className="w-full py-4 rounded-xl bg-card border border-border text-foreground font-semibold flex items-center justify-center gap-2 hover:border-primary transition-all"
              >
                <Dumbbell className="w-5 h-5" />
                Añadir desde biblioteca
              </button>
            )}
            {onCreateExercise && (
              <button
                onClick={onCreateExercise}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
              >
                <Plus className="w-5 h-5" />
                Crear ejercicio nuevo
              </button>
            )}
            <button
              onClick={() => setFlowState({ type: 'routine-complete' })}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Terminar sesión
            </button>
          </div>
        </div>

        {/* Review completed exercises */}
        <CompletedExercisesReview
          open={showCompletedReview}
          onOpenChange={setShowCompletedReview}
          exercises={workoutExercises}
          completedExerciseIds={completedExerciseIds}
          exerciseSetStates={exerciseSetStates}
          onGoToExercise={(exIndex, exId) => {
            setCompletedExerciseIds((prev) => {
              const next = new Set(prev);
              next.delete(exId);
              return next;
            });
            setFlowState({ type: 'exercising', exerciseIndex: exIndex });
          }}
        />
      </div>
    );
  }

  // Renderizar pantalla de rutina completada
  if (flowState.type === 'routine-complete') {
    return (
      <>
      
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md text-center py-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-6 animate-pulse">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          
          <h2 className="font-display font-bold text-3xl text-gradient-energy mb-2">
            ¡Rutina Completada!
          </h2>
          <p className="text-muted-foreground mb-6">
            Has completado {completedExerciseIds.size} ejercicios en {routineName}
          </p>
          
          {/* Stats del entrenamiento */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Tiempo total */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
              <Timer className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs text-muted-foreground">Tiempo</p>
                <p className="font-lcd text-xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] truncate">
                  {formatTime(elapsedTime)}
                </p>
              </div>
            </div>
            
            {/* Kg movidos */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
              <Weight className="w-6 h-6 text-primary flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs text-muted-foreground">Kg movidos</p>
                <p className="font-lcd text-xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] truncate">
                  {workoutStats.totalKgMoved.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          {/* Calorías quemadas */}
          {personalData ? (
            <div className="flex items-center justify-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 mb-8">
              <Flame className="w-10 h-10 text-orange-500 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm text-orange-200/80">Calorías consumidas</p>
                <p className="font-lcd text-4xl text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.5)]">
                  {workoutStats.caloriesBurned} <span className="text-lg">kcal</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border mb-8 text-left">
              <p className="text-sm text-muted-foreground">
                💡 Añade tus datos personales (peso, edad, sexo) en el perfil para calcular las calorías quemadas.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => {
                const completedExs = workoutExercises.filter(e => completedExerciseIds.has(e.instanceKey));
                exportWorkoutToPDF({
                  routineName,
                  date: new Date(),
                  durationSeconds: elapsedTime,
                  totalKg: workoutStats.totalKgMoved,
                  calories: personalData ? workoutStats.caloriesBurned : undefined,
                  exercises: completedExs.map(ex => {
                    const setState = exerciseSetStates.find(s => s.instanceKey === ex.instanceKey);
                    const configs = ex.setConfigs || Array.from({ length: ex.sets }, (_, i) => ({
                      setNumber: i + 1,
                      reps: ex.reps,
                      weight: ex.weight,
                      restTime: ex.restBetweenSets,
                    }));
                    const completedNums = setState?.completedSets || [];
                    return {
                      name: ex.name,
                      muscleGroup: ex.muscleGroup,
                      isUnilateral: ex.isUnilateral,
                      sets: completedNums.map(n => {
                        const cfg = configs[n - 1];
                        return {
                          setNumber: n,
                          reps: cfg?.reps ?? ex.reps,
                          weight: cfg?.weight ?? ex.weight,
                          restTime: cfg?.restTime ?? ex.restBetweenSets,
                          isWarmup: isWarmupSet(ex.name, { isWarmup: (cfg as SetConfig | undefined)?.isWarmup }),
                        };
                      }),

                    };
                  }),
                });
              }}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <FileDown className="w-5 h-5" />
              Exportar a PDF
            </button>

            <button
              onClick={() => setFlowState({ type: 'add-extra-exercise' })}
              className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <Plus className="w-5 h-5" />
              Añadir ejercicio extra
            </button>
            
            <button
              onClick={() => {
                const finalElapsed = getElapsedNow();
                clearSavedState();
                stop();
                onWorkoutComplete?.(finalElapsed);
                onClose(finalElapsed);
              }}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
            >
              Finalizar entrenamiento
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Renderizar selector de ejercicio extra
  if (flowState.type === 'add-extra-exercise') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Cronómetro flotante */}
        <div className="flex-none flex justify-center pt-4 pb-2 px-4 bg-background/95 backdrop-blur-sm border-b border-border z-10">
          <WorkoutStopwatch 
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            onToggle={toggle}
            onSetTime={setTime}
            onSetRunning={setRunning}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
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


          {/* Filtros por grupo muscular */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setExtraMuscleFilter('todos')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                extraMuscleFilter === 'todos'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </button>
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setExtraMuscleFilter(group)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  extraMuscleFilter === group
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {group}
              </button>
            ))}
          </div>

          {(() => {
            const filteredExercises = extraMuscleFilter === 'todos' 
              ? availableExtraExercises 
              : availableExtraExercises.filter(e => e.muscleGroup === extraMuscleFilter);
            
            return filteredExercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Dumbbell className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {availableExtraExercises.length === 0
                    ? 'No hay más ejercicios disponibles'
                    : `No hay ejercicios de ${extraMuscleFilter}`}
                </p>
                {availableExtraExercises.length === 0 && (
                  <button
                    onClick={() => setFlowState({ type: 'routine-complete' })}
                    className="mt-4 px-6 py-3 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-all"
                  >
                    Volver
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="w-full p-4 rounded-2xl bg-card border border-border flex items-center gap-4 text-left"
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
                    
                    <button
                      onClick={() => {
                        if (routineId && onAddExerciseToRoutine) {
                          onAddExerciseToRoutine(exercise.id);
                        }
                        setWorkoutExercises((prev) => [
                          ...prev,
                          { ...exercise, instanceKey: nextInstanceKey(prev, exercise.id) },
                        ]);
                        setExtraExercises((prev) => [...prev, exercise]);
                        const newIndex = workoutExercises.length;
                        setFlowState({ type: 'exercising', exerciseIndex: newIndex });
                      }}
                      className="flex-shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-energy"
                    >
                      <Plus className="w-4 h-4" />
                      Añadir
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Botones de acción */}
          <div className="mt-6 pt-6 border-t border-border space-y-3">
            {onCreateExercise && (
              <button
                onClick={onCreateExercise}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
              >
                <Plus className="w-5 h-5" />
                Crear ejercicio nuevo
              </button>
            )}
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

  // Renderizar selector de sustitución de ejercicio
  if (flowState.type === 'substitute-exercise') {
    const exerciseBeingSubstituted = workoutExercises[flowState.substituteIndex];
    const availableForSubstitution = allExercises.filter(
      (e) => e.id !== exerciseBeingSubstituted?.id && !completedOriginalIds.has(e.id)
    );
    const filteredSubstitutes = substituteMuscleFilter === 'todos'
      ? availableForSubstitution
      : availableForSubstitution.filter(e => e.muscleGroup === substituteMuscleFilter);

    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Cronómetro flotante */}
        <div className="flex-none flex justify-center pt-4 pb-2 px-4 bg-background/95 backdrop-blur-sm border-b border-border z-10">
          <WorkoutStopwatch 
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            onToggle={toggle}
            onSetTime={setTime}
            onSetRunning={setRunning}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-gradient-energy">
                Realizar en su lugar
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                En lugar de: <strong>{exerciseBeingSubstituted?.name}</strong>
              </p>
            </div>
            <button
              onClick={() => {
                setSubstituteOriginalIndex(null);
                setFlowState({ type: 'exercising', exerciseIndex: flowState.substituteIndex });
              }}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>


          {/* Filtros por grupo muscular */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setSubstituteMuscleFilter('todos')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                substituteMuscleFilter === 'todos'
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </button>
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setSubstituteMuscleFilter(group)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  substituteMuscleFilter === group
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {group}
              </button>
            ))}
          </div>

          {filteredSubstitutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Dumbbell className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {availableForSubstitution.length === 0
                  ? 'No hay ejercicios disponibles para sustituir'
                  : `No hay ejercicios de ${substituteMuscleFilter}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubstitutes.map((exercise) => (
                <div
                  key={exercise.id}
                  className="w-full p-4 rounded-2xl bg-card border border-border flex items-center gap-4 text-left"
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
                    <h3 className="font-display font-bold text-lg mt-1 break-words">{exercise.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {exercise.sets} series · {exercise.reps} reps
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setPendingExerciseToAdd(exercise);
                      setShowSaveToRoutineDialog(true);
                    }}
                    className="flex-shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-1.5 hover:bg-primary/90 transition-all shadow-energy"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Elegir
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Botón volver */}
          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={() => {
                setSubstituteOriginalIndex(null);
                setFlowState({ type: 'exercising', exerciseIndex: flowState.substituteIndex });
              }}
              className="w-full py-3 rounded-xl bg-secondary text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>
          </div>
        </div>

        {/* Diálogo para guardar sustitución en rutina */}
        <AddExerciseDuringWorkoutDialog
          open={showSaveToRoutineDialog}
          onOpenChange={setShowSaveToRoutineDialog}
          exercise={pendingExerciseToAdd}
          routineName={routineName}
          onSaveToRoutine={() => handleConfirmAddExercise(true)}
          onJustThisTime={() => handleConfirmAddExercise(false)}
          isSubstitution={true}
          originalExerciseName={workoutExercises[flowState.substituteIndex]?.name}
        />
      </div>
    );
  }

  // Renderizar ejercicio actual
  if (currentExercise && flowState.type === 'exercising') {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Cronómetro y notificaciones flotantes */}
        <div className="flex-none flex items-center justify-center gap-2 pt-4 pb-2 px-4 bg-background/95 backdrop-blur-sm border-b border-border z-10">
          <WorkoutStopwatch 
            elapsedTime={elapsedTime}
            isRunning={isRunning}
            onToggle={toggle}
            onSetTime={setTime}
            onSetRunning={setRunning}
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
        <div className="flex-1 overflow-y-auto p-4">


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
          <div className="w-full h-2 bg-secondary rounded-full mb-3 overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ 
                width: `${(completedExerciseIds.size / workoutExercises.length) * 100}%` 
              }}
            />
          </div>

          {/* Completed exercises review button */}
          {completedExerciseIds.size > 0 && (
            <button
              onClick={() => setShowCompletedReview(true)}
              className="w-full mb-4 py-2 px-3 rounded-xl bg-secondary/50 border border-border text-sm font-medium flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Ver ejercicios completados ({completedExerciseIds.size})
            </button>
          )}

          {/* Exercise card con props para flujo de entrenamiento */}
          {(() => {
            const savedSetState = exerciseSetStates.find(s => s.instanceKey === currentExercise.instanceKey);
            return (
              <ExerciseCard
                // Aislamiento estricto entre apariciones duplicadas del mismo ejercicio
                key={currentExercise.instanceKey}
                instanceKey={currentExercise.instanceKey}
                exercise={currentExercise}

                onEdit={onEditExercise}
                onDelete={onDeleteExercise}
                onSetComplete={(exerciseId, exerciseName, muscleGroup, setData, totalSets) => {
                  // Registrar los datos de la serie para calcular kg totales
                  setCompletedSetsData(prev => [...prev, {
                    exerciseId,
                    exerciseName,
                    weight: setData.weight,
                    reps: setData.reps,
                    isWarmup: setData.isWarmup,
                  }]);

                  // Llamar al callback original
                  onSetComplete(exerciseId, exerciseName, muscleGroup, setData, totalSets);
                }}
                isActive={true}
                skipExerciseRestTimer={true}
                onExerciseComplete={() => handleExerciseComplete(currentExercise.instanceKey)}
                onUpdateSetConfig={(exerciseId, setConfigs) => {
                  // Actualizar estado local para que el resumen muestre los datos reales
                  setWorkoutExercises(prev => prev.map(e => 
                    e.instanceKey === currentExercise.instanceKey ? { ...e, setConfigs } : e
                  ));
                  // Si esta aparición tiene override de sesión (IA), mantenerlo al día
                  // para que el ajuste manual más reciente sobreviva navegación/recarga.
                  setExerciseSetStates(prev => syncSessionOverrideOnManualEdit(
                    prev, currentExercise.instanceKey, exerciseId, setConfigs,
                  ));
                  // También notificar al padre para persistencia
                  onUpdateSetConfig?.(exerciseId, setConfigs);
                }}

                onUpdateSessionSetConfig={(exerciseId, setConfigs) =>
                  handleSessionSetConfig(currentExercise.instanceKey, exerciseId, setConfigs)
                }
                initialSessionSetConfigs={savedSetState?.sessionSetConfigs}
                initialCurrentSet={savedSetState?.currentSet}
                initialCompletedSets={savedSetState?.completedSets}
                onSetStateChange={(exerciseId, currentSet, completedSets) => handleSetStateChange(currentExercise.instanceKey, exerciseId, currentSet, completedSets)}
                globalElapsedTime={elapsedTime}
                globalIsRunning={isRunning}
                onGlobalToggle={toggle}
                onGlobalSetTime={setTime}
                onGlobalSetRunning={setRunning}
                workoutSessions={workoutSessions}
                onDeleteCompletedSet={onDeleteCompletedSet}
                onPersonalRecord={(record) =>
                  // No mostrar aún: se guarda la mejor marca y se muestra al
                  // pasar al descanso entre ejercicios.
                  setPendingRecord((prev) =>
                    prev && prev.weight > record.weight ? prev : record
                  )
                }
              />
            );
          })()}

          {/* Botones de acciones */}
          <div className="mt-8 pt-6 border-t border-border space-y-3">
            {/* Botón para salir del ejercicio sin completarlo y elegir otro */}
            {workoutExercises.length > 1 && (
              <button
                onClick={() => setFlowState({
                  type: 'select-next-exercise',
                  completedExerciseIndex: flowState.exerciseIndex,
                })}
                className="w-full py-3 rounded-xl bg-secondary/70 text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary transition-all border border-border"
                title="Dejar este ejercicio sin marcarlo como completado y elegir otro"
              >
                <ListChecks className="w-5 h-5" />
                Cambiar de ejercicio
              </button>
            )}

            {/* Botón para sustituir ejercicio */}
            <button
              onClick={() => {
                setSubstituteMuscleFilter('todos');
                setSubstituteOriginalIndex(flowState.exerciseIndex);
                setFlowState({ type: 'substitute-exercise', substituteIndex: flowState.exerciseIndex });
              }}
              className="w-full py-3 rounded-xl bg-accent/50 text-accent-foreground font-medium flex items-center justify-center gap-2 hover:bg-accent transition-all border border-border"
            >
              <RefreshCw className="w-5 h-5" />
              Realizar otro en su lugar
            </button>
            
            {/* Botón para añadir ejercicio */}
            <button
              onClick={() => setFlowState({ type: 'add-extra-exercise' })}
              className="w-full py-3 rounded-xl bg-primary/10 text-primary font-medium flex items-center justify-center gap-2 hover:bg-primary/20 transition-all border border-primary/20"
            >
              <Plus className="w-5 h-5" />
              Añadir ejercicio
            </button>
            
            {/* Botón para terminar sesión anticipadamente */}
            <button
              onClick={() => setFlowState({ type: 'routine-complete' })}
              className="w-full py-3 rounded-xl bg-secondary text-muted-foreground font-medium flex items-center justify-center gap-2 hover:bg-destructive/20 hover:text-destructive transition-all"
            >
              <LogOut className="w-5 h-5" />
              Terminar sesión
            </button>
          </div>

          {/* Diálogo para guardar ejercicio en rutina */}
          <AddExerciseDuringWorkoutDialog
            open={showSaveToRoutineDialog}
            onOpenChange={setShowSaveToRoutineDialog}
            exercise={pendingExerciseToAdd}
            routineName={routineName}
            onSaveToRoutine={() => handleConfirmAddExercise(true)}
            onJustThisTime={() => handleConfirmAddExercise(false)}
          />

          {/* Review completed exercises */}
          <CompletedExercisesReview
            open={showCompletedReview}
            onOpenChange={setShowCompletedReview}
            exercises={workoutExercises}
            completedExerciseIds={completedExerciseIds}
            exerciseSetStates={exerciseSetStates}
            onGoToExercise={(exIndex, exId) => {
              // Re-open the exercise summary for editing
              setCompletedExerciseIds((prev) => {
                const next = new Set(prev);
                next.delete(exId);
                return next;
              });
              setFlowState({ type: 'exercising', exerciseIndex: exIndex });
            }}
          />
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
