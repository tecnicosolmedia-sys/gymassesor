import { useState, useMemo, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { MuscleFilterTabs } from '@/components/MuscleFilterTabs';
import { RoutineCard } from '@/components/RoutineCard';
import { DraggableRoutineList } from '@/components/DraggableRoutineList';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExerciseForm } from '@/components/ExerciseForm';
import { RoutineForm } from '@/components/RoutineForm';
import { WorkoutHistory } from '@/components/WorkoutHistory';
import { WorkoutFlow, FlowState, ExerciseSetState } from '@/components/WorkoutFlow';
import { ResumeWorkoutBanner } from '@/components/ResumeWorkoutBanner';
import { PersonalDataForm } from '@/components/PersonalDataForm';
import { useExercises } from '@/hooks/useExercises';
import { useRoutines } from '@/hooks/useRoutines';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { useSavedWorkout } from '@/hooks/useSavedWorkout';
import { Exercise, SetConfig, MuscleGroup, MUSCLE_GROUPS } from '@/types/exercise';
import { Routine } from '@/types/routine';
import { Dumbbell, Calendar, Pencil, Trash2, Play, BarChart3, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';
import { cn } from '@/lib/utils';
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';

const Index = () => {
  const { 
    exercises, 
    isLoading: exercisesLoading, 
    addExercise, 
    updateExercise, 
    deleteExercise,
  } = useExercises();
  
  const {
    routines,
    isLoading: routinesLoading,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addExerciseToRoutine,
    reorderRoutines,
  } = useRoutines();
  
  const {
    sessions,
    currentSession,
    startSession,
    logCompletedSet,
    endSession,
    deleteSession,
  } = useWorkoutHistory();
  
  // Estado de entrenamiento guardado
  const { savedWorkout, clearSavedWorkout, getTimeSinceSaved } = useSavedWorkout();
  const [resumingWorkout, setResumingWorkout] = useState(false);
  
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState<MuscleGroup | 'todas'>('todas');
  const [libraryMuscleFilter, setLibraryMuscleFilter] = useState<MuscleGroup | 'todos'>('todos');
  const [creatingExerciseForWorkout, setCreatingExerciseForWorkout] = useState(false);
  const [newlyCreatedExercise, setNewlyCreatedExercise] = useState<Exercise | null>(null);
  const [showFreeWorkout, setShowFreeWorkout] = useState(false);
  const [libraryChartExercise, setLibraryChartExercise] = useState<{ id: string; name: string } | null>(null);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Manejar restauración de entrenamiento
  const handleResumeWorkout = () => {
    if (savedWorkout) {
      // Iniciar sesión si no hay una activa
      if (!currentSession && savedWorkout.routineId) {
        startSession(savedWorkout.routineId, savedWorkout.routineName);
        
        // Replay de ejercicios completados antes de la interrupción
        savedWorkout.completedExerciseIds.forEach(exId => {
          const exercise = exercises.find(e => e.id === exId);
          const setStateData = savedWorkout.exerciseSetStates?.find(s => s.exerciseId === exId);
          if (exercise && setStateData) {
            setStateData.completedSets.forEach((_, idx) => {
              const setConfig = exercise.setConfigs?.[idx];
              logCompletedSet(
                exercise.id,
                exercise.name,
                exercise.muscleGroup,
                {
                  setNumber: idx + 1,
                  reps: setConfig?.reps || exercise.reps,
                  weight: setConfig?.weight || exercise.weight,
                  restTime: setConfig?.restTime || exercise.restBetweenSets,
                },
                exercise.sets
              );
            });
          }
        });
      }
      setResumingWorkout(true);
    }
  };

  const handleDiscardWorkout = () => {
    clearSavedWorkout();
  };

  // Obtener ejercicios para el entrenamiento a restaurar
  const savedWorkoutExercises = useMemo(() => {
    if (!savedWorkout) return [];
    return exercises.filter(e => savedWorkout.workoutExerciseIds.includes(e.id));
  }, [savedWorkout, exercises]);

  // Obtener la rutina del entrenamiento guardado
  const savedRoutine = useMemo(() => {
    if (!savedWorkout?.routineId) return null;
    return routines.find(r => r.id === savedWorkout.routineId);
  }, [savedWorkout, routines]);

  const handleAddExercise = () => {
    setEditingExercise(null);
    setCreatingExerciseForWorkout(false);
    setShowExerciseForm(true);
  };

  const handleCreateExerciseForWorkout = () => {
    setEditingExercise(null);
    setCreatingExerciseForWorkout(true);
    setShowExerciseForm(true);
  };

  const handleAddRoutine = () => {
    setEditingRoutine(null);
    setShowRoutineForm(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setCreatingExerciseForWorkout(false);
    setShowExerciseForm(true);
  };

  const handleEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setShowRoutineForm(true);
  };

  const handleSaveExercise = async (data: Omit<Exercise, 'id' | 'createdAt'>) => {
    if (editingExercise) {
      await updateExercise(editingExercise.id, data);
    } else {
      const newExercise = await addExercise(data);
      if (creatingExerciseForWorkout && newExercise) {
        setNewlyCreatedExercise(newExercise);
      }
    }
    setCreatingExerciseForWorkout(false);
  };

  const handleSaveRoutine = (data: Omit<Routine, 'id' | 'createdAt'>) => {
    if (editingRoutine) {
      updateRoutine(editingRoutine.id, data);
    } else {
      addRoutine(data);
    }
  };

  const handleDeleteExercise = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este ejercicio?')) {
      deleteExercise(id);
    }
  };

  const handleDeleteRoutine = (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta rutina?')) {
      deleteRoutine(id);
    }
  };

  // Handler para actualizar la configuración de series durante el entrenamiento
  const handleUpdateSetConfig = (exerciseId: string, setConfigs: SetConfig[]) => {
    updateExercise(exerciseId, { setConfigs });
  };

  // Filtrar rutinas por grupo muscular seleccionado
  const filteredRoutines = useMemo(() => {
    if (selectedMuscleFilter === 'todas') return routines;
    
    // Filtrar rutinas que contienen ejercicios del grupo muscular seleccionado
    return routines.filter((routine) => {
      const routineExercises = exercises.filter((e) => routine.exerciseIds.includes(e.id));
      return routineExercises.some((e) => e.muscleGroup === selectedMuscleFilter);
    });
  }, [routines, exercises, selectedMuscleFilter]);

  // Ejercicios que no están en ninguna rutina
  const exerciseIdsInRoutines = new Set(routines.flatMap((r) => r.exerciseIds));
  const unassignedExercises = exercises.filter((e) => !exerciseIdsInRoutines.has(e.id));

  // Filtrar biblioteca por grupo muscular
  const filteredLibraryExercises = useMemo(() => {
    if (libraryMuscleFilter === 'todos') return exercises;
    return exercises.filter((e) => e.muscleGroup === libraryMuscleFilter);
  }, [exercises, libraryMuscleFilter]);

  const isLoading = exercisesLoading || routinesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background w-full max-w-full overflow-x-hidden">
      {/* Background glow effect */}
      <div className="fixed inset-0 bg-glow pointer-events-none opacity-30" />
      
      <Header onAddExercise={handleAddExercise} onAddRoutine={handleAddRoutine} onShowHistory={() => setShowHistory(true)} onShowPersonalData={() => setShowPersonalData(true)} />
      
      <main className="w-full px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 relative pb-safe">
        {/* Banner para restaurar entrenamiento */}
        {savedWorkout && savedRoutine && !resumingWorkout && (
          <ResumeWorkoutBanner
            savedWorkout={savedWorkout}
            timeSinceSaved={getTimeSinceSaved()}
            onResume={handleResumeWorkout}
            onDiscard={handleDiscardWorkout}
            onFinish={() => {
              // Si no hay sesión activa pero hay un entrenamiento guardado,
              // crear la sesión desde el estado guardado antes de finalizarla
              if (!currentSession && savedWorkout) {
                // Reconstruir ejercicios completados desde el estado guardado
                const completedExercises = savedWorkout.completedExerciseIds.map(exId => {
                  const exercise = exercises.find(e => e.id === exId);
                  const setStateData = savedWorkout.exerciseSetStates?.find(s => s.exerciseId === exId);
                  if (exercise && setStateData) {
                    return {
                      exerciseId: exId,
                      exerciseName: exercise.name,
                      muscleGroup: exercise.muscleGroup,
                      completedSets: setStateData.completedSets.length,
                    };
                  }
                  return null;
                }).filter(Boolean);

                // Iniciar y finalizar sesión con los datos guardados
                if (completedExercises.length > 0 || savedWorkout.elapsedTime > 0) {
                  startSession(savedWorkout.routineId, savedWorkout.routineName);
                  // Registrar cada ejercicio completado
                  savedWorkout.completedExerciseIds.forEach(exId => {
                    const exercise = exercises.find(e => e.id === exId);
                    const setStateData = savedWorkout.exerciseSetStates?.find(s => s.exerciseId === exId);
                    if (exercise && setStateData) {
                      setStateData.completedSets.forEach((_, idx) => {
                        const setConfig = exercise.setConfigs?.[idx];
                        logCompletedSet(
                          exercise.id,
                          exercise.name,
                          exercise.muscleGroup,
                          {
                            setNumber: idx + 1,
                            reps: setConfig?.reps || exercise.reps,
                            weight: setConfig?.weight || exercise.weight,
                            restTime: setConfig?.restTime || exercise.restBetweenSets,
                          },
                          exercise.sets
                        );
                      });
                    }
                  });
                  // Pequeño delay para asegurar que el estado se actualice
                  setTimeout(() => {
                    endSession();
                    clearSavedWorkout();
                    setShowHistory(true);
                  }, 100);
                  return;
                }
              }
              endSession();
              clearSavedWorkout();
              setShowHistory(true);
            }}
          />
        )}
        
        {/* Muscle filter tabs */}
        <MuscleFilterTabs selectedMuscle={selectedMuscleFilter} onSelectMuscle={setSelectedMuscleFilter} />
        
        {/* Routines section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-xl">Rutinas</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!currentSession) {
                    startSession('free', 'Entrenamiento Libre');
                  }
                  setShowFreeWorkout(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/30 transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                Libre
              </button>
              <span className="text-sm text-muted-foreground">
                {filteredRoutines.length} rutina{filteredRoutines.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {filteredRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl card-gradient border border-border">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                {selectedMuscleFilter === 'todas' ? 'Sin rutinas aún' : `Sin rutinas con ejercicios de ${selectedMuscleFilter}`}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                Crea rutinas para organizar tus ejercicios por grupo muscular
              </p>
              <button
                onClick={handleAddRoutine}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-energy"
              >
                Crear Rutina
              </button>
            </div>
          ) : (
            <DraggableRoutineList
              routines={filteredRoutines}
              allRoutines={routines}
              reorderRoutines={reorderRoutines}
              exercises={exercises}
              onEdit={handleEditRoutine}
              onDelete={handleDeleteRoutine}
              onEditExercise={handleEditExercise}
              onDeleteExercise={handleDeleteExercise}
              onSetComplete={(routineId, routineName, exerciseId, exerciseName, muscleGroup, setData, totalSets) => {
                if (!currentSession) {
                  startSession(routineId, routineName);
                }
                logCompletedSet(exerciseId, exerciseName, muscleGroup, setData, totalSets);
              }}
              onUpdateSetConfig={handleUpdateSetConfig}
              onWorkoutComplete={() => {
                endSession();
                setShowHistory(true);
              }}
              onAddExerciseToRoutine={addExerciseToRoutine}
              onCreateExercise={handleCreateExerciseForWorkout}
              newExerciseToAdd={newlyCreatedExercise}
              onNewExerciseHandled={() => setNewlyCreatedExercise(null)}
              workoutSessions={sessions}
            />
          )}
        </section>
        
        
        {/* All exercises library */}
        {selectedMuscleFilter === 'todas' && exercises.length > 0 && (
          <section className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-xl">Biblioteca de Ejercicios</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredLibraryExercises.length} de {exercises.length}
              </span>
            </div>
            
            {/* Muscle group filter tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                onClick={() => setLibraryMuscleFilter('todos')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  libraryMuscleFilter === 'todos'
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              {MUSCLE_GROUPS.map((group) => (
                <button
                  key={group}
                  onClick={() => setLibraryMuscleFilter(group)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    libraryMuscleFilter === group
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {group}
                </button>
              ))}
            </div>
            
            {filteredLibraryExercises.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay ejercicios de {libraryMuscleFilter}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLibraryExercises.map((exercise) => {
                  const muscleIcon = getMuscleGroupIcon(exercise.muscleGroup);
                  
                  return (
                    <div
                      key={exercise.id}
                      className="p-3 sm:p-4 rounded-xl card-gradient border border-border hover:border-primary/50 transition-all group cursor-pointer"
                      onClick={() => setPreviewExercise(exercise)}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Icono del grupo muscular - SIEMPRE visible */}
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {exercise.imageUrl ? (
                            <>
                              <img 
                                src={exercise.imageUrl} 
                                alt={exercise.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                              {/* Badge del músculo sobre la imagen */}
                              {muscleIcon && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background border-2 border-primary/50 flex items-center justify-center overflow-hidden">
                                  <img 
                                    src={muscleIcon} 
                                    alt={exercise.muscleGroup}
                                    className="w-3 h-3 sm:w-4 sm:h-4 object-contain"
                                  />
                                </div>
                              )}
                            </>
                          ) : muscleIcon ? (
                            <img 
                              src={muscleIcon} 
                              alt={exercise.muscleGroup}
                              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                            />
                          ) : (
                            <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{exercise.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {exercise.muscleGroup} · {exercise.sets}x{exercise.reps}
                          </p>
                        </div>
                        {/* Botones siempre visibles en móvil, hover en desktop */}
                        <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLibraryChartExercise({ id: exercise.id, name: exercise.name });
                            }}
                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/20 active:bg-primary/20 transition-colors"
                            title="Ver progresión"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditExercise(exercise);
                            }}
                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/20 active:bg-primary/20 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExercise(exercise.id);
                            }}
                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/20 active:bg-destructive/20 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
      
      {/* Exercise Form Modal */}
      {showExerciseForm && (
        <ExerciseForm
          exercise={editingExercise}
          onSave={handleSaveExercise}
          onClose={() => setShowExerciseForm(false)}
        />
      )}
      
      {/* Routine Form Modal */}
      {showRoutineForm && (
        <RoutineForm
          routine={editingRoutine}
          exercises={exercises}
          onSave={handleSaveRoutine}
          onUpdateExercise={(id, updates) => updateExercise(id, updates)}
          onClose={() => setShowRoutineForm(false)}
        />
      )}
      
      {/* Workout History Modal */}
      {showHistory && (
        <WorkoutHistory
          sessions={sessions}
          onDeleteSession={deleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}
      
      {/* Personal Data Form Modal */}
      {showPersonalData && (
        <PersonalDataForm onClose={() => setShowPersonalData(false)} />
      )}

      {/* Exercise Preview Modal */}
      {previewExercise && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[60] overflow-y-auto" onClick={() => setPreviewExercise(null)}>
          <div className="min-h-screen p-4 flex items-start justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl animate-scale-in my-8 overflow-hidden">
              <div className="p-4 space-y-4">
                {/* Header */}
                <div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {previewExercise.muscleGroup}
                  </span>
                  <h2 className="font-display font-bold text-2xl mt-2">{previewExercise.name}</h2>
                </div>

                {/* Image after title */}
                <div className="w-full aspect-square rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
                  {previewExercise.imageUrl ? (
                    <img 
                      src={previewExercise.imageUrl} 
                      alt={previewExercise.name}
                      className="w-full h-full object-contain"
                    />
                  ) : getMuscleGroupIcon(previewExercise.muscleGroup) ? (
                    <img 
                      src={getMuscleGroupIcon(previewExercise.muscleGroup)!} 
                      alt={previewExercise.muscleGroup}
                      className="w-2/3 h-2/3 object-contain opacity-60"
                    />
                  ) : (
                    <Dumbbell className="w-16 h-16 text-muted-foreground opacity-40" />
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-secondary text-center">
                    <p className="text-xs text-muted-foreground">Series</p>
                    <p className="font-bold text-lg">{previewExercise.sets}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary text-center">
                    <p className="text-xs text-muted-foreground">Reps</p>
                    <p className="font-bold text-lg">{previewExercise.reps}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary text-center">
                    <p className="text-xs text-muted-foreground">Peso</p>
                    <p className="font-bold text-lg">{previewExercise.weight}kg</p>
                  </div>
                </div>

                {/* Set configs */}
                {previewExercise.setConfigs && previewExercise.setConfigs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">Detalle por serie</p>
                    {previewExercise.setConfigs.map((config, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50 text-sm">
                        <span className="w-6 h-6 rounded-md bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span>{config.reps} reps</span>
                        <span>·</span>
                        <span>{config.weight}kg</span>
                        <span>·</span>
                        <span className="text-muted-foreground">{config.restTime}s</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {previewExercise.notes && (
                  <div className="p-3 rounded-xl bg-secondary/50">
                    <p className="text-sm font-medium mb-1">Observaciones</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{previewExercise.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setPreviewExercise(null);
                      handleEditExercise(previewExercise);
                    }}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => setPreviewExercise(null)}
                    className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Library Chart Modal */}
      {libraryChartExercise && (
        <ExerciseProgressChart
          exerciseId={libraryChartExercise.id}
          exerciseName={libraryChartExercise.name}
          sessions={sessions}
          onClose={() => setLibraryChartExercise(null)}
        />
      )}
      
      {/* Workout Flow para restaurar entrenamiento */}
      {resumingWorkout && savedWorkout && savedRoutine && (
        <WorkoutFlow
          routineId={savedRoutine.id}
          routineName={savedRoutine.name}
          exercises={savedWorkoutExercises}
          allExercises={exercises}
          onClose={() => {
            setResumingWorkout(false);
            clearSavedWorkout();
          }}
          onSetComplete={(exerciseId, exerciseName, muscleGroup, setData, totalSets) => {
            logCompletedSet(exerciseId, exerciseName, muscleGroup, setData, totalSets);
          }}
          onEditExercise={handleEditExercise}
          onDeleteExercise={handleDeleteExercise}
          onUpdateSetConfig={handleUpdateSetConfig}
          onWorkoutComplete={() => {
            endSession();
            setResumingWorkout(false);
            clearSavedWorkout();
            setShowHistory(true);
          }}
           onAddExerciseToRoutine={(exerciseId) => {
             addExerciseToRoutine(savedRoutine.id, exerciseId);
           }}
           onCreateExercise={handleCreateExerciseForWorkout}
           newExerciseToAdd={newlyCreatedExercise}
           onNewExerciseHandled={() => setNewlyCreatedExercise(null)}
          initialCompletedExerciseIds={savedWorkout.completedExerciseIds}
          initialFlowState={savedWorkout.flowState as FlowState}
          initialElapsedTime={savedWorkout.elapsedTime}
          initialExerciseSetStates={(savedWorkout.exerciseSetStates || []) as ExerciseSetState[]}
          workoutSessions={sessions}
        />
      )}

      {/* Free Workout Flow */}
      {showFreeWorkout && (
        <WorkoutFlow
          routineName="Entrenamiento Libre"
          exercises={[]}
          allExercises={exercises}
          onClose={() => {
            setShowFreeWorkout(false);
          }}
          onSetComplete={(exerciseId, exerciseName, muscleGroup, setData, totalSets) => {
            logCompletedSet(exerciseId, exerciseName, muscleGroup, setData, totalSets);
          }}
          onEditExercise={handleEditExercise}
          onDeleteExercise={handleDeleteExercise}
          onUpdateSetConfig={handleUpdateSetConfig}
          onWorkoutComplete={() => {
            endSession();
            setShowFreeWorkout(false);
            setShowHistory(true);
          }}
          onCreateExercise={handleCreateExerciseForWorkout}
          newExerciseToAdd={newlyCreatedExercise}
          onNewExerciseHandled={() => setNewlyCreatedExercise(null)}
          initialFlowState={{ type: 'add-extra-exercise' }}
          workoutSessions={sessions}
        />
      )}
    </div>
  );
};

export default Index;
