import { useState } from 'react';
import { Header } from '@/components/Header';
import { WeekTabs } from '@/components/WeekTabs';
import { RoutineCard } from '@/components/RoutineCard';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExerciseForm } from '@/components/ExerciseForm';
import { RoutineForm } from '@/components/RoutineForm';
import { WorkoutHistory } from '@/components/WorkoutHistory';
import { useExercises } from '@/hooks/useExercises';
import { useRoutines } from '@/hooks/useRoutines';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { Exercise } from '@/types/exercise';
import { Routine, WeekDay } from '@/types/routine';
import { Dumbbell, Calendar } from 'lucide-react';

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
  } = useRoutines();
  
  const {
    sessions,
    logCompletedSet,
    deleteSession,
  } = useWorkoutHistory();
  
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showRoutineForm, setShowRoutineForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [selectedDay, setSelectedDay] = useState<WeekDay | 'all'>('all');

  const handleAddExercise = () => {
    setEditingExercise(null);
    setShowExerciseForm(true);
  };

  const handleAddRoutine = () => {
    setEditingRoutine(null);
    setShowRoutineForm(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setShowExerciseForm(true);
  };

  const handleEditRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setShowRoutineForm(true);
  };

  const handleSaveExercise = (data: Omit<Exercise, 'id' | 'createdAt'>) => {
    if (editingExercise) {
      updateExercise(editingExercise.id, data);
    } else {
      addExercise(data);
    }
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

  // Filtrar rutinas por día seleccionado
  const filteredRoutines = selectedDay === 'all' 
    ? routines 
    : routines.filter((r) => r.day === selectedDay);

  // Ejercicios que no están en ninguna rutina
  const exerciseIdsInRoutines = new Set(routines.flatMap((r) => r.exerciseIds));
  const unassignedExercises = exercises.filter((e) => !exerciseIdsInRoutines.has(e.id));

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
    <div className="min-h-screen bg-background">
      {/* Background glow effect */}
      <div className="fixed inset-0 bg-glow pointer-events-none opacity-30" />
      
      <Header onAddExercise={handleAddExercise} onAddRoutine={handleAddRoutine} onShowHistory={() => setShowHistory(true)} />
      
      <main className="container mx-auto px-4 py-6 space-y-6 relative">
        {/* Week tabs */}
        <WeekTabs selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        
        {/* Routines section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-xl">Rutinas</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredRoutines.length} rutina{filteredRoutines.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {filteredRoutines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl card-gradient border border-border">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">
                {selectedDay === 'all' ? 'Sin rutinas aún' : 'Sin rutinas para este día'}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                Crea rutinas para organizar tus ejercicios por día de la semana
              </p>
              <button
                onClick={handleAddRoutine}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-energy"
              >
                Crear Rutina
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRoutines.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  exercises={exercises}
                  allExercises={exercises}
                  onEdit={handleEditRoutine}
                  onDelete={handleDeleteRoutine}
                  onEditExercise={handleEditExercise}
                  onDeleteExercise={handleDeleteExercise}
                  onSetComplete={logCompletedSet}
                />
              ))}
            </div>
          )}
        </section>
        
        {/* Unassigned exercises */}
        {unassignedExercises.length > 0 && selectedDay === 'all' && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-display font-bold text-xl">Ejercicios sin asignar</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {unassignedExercises.length} ejercicio{unassignedExercises.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-4">
              {unassignedExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onEdit={handleEditExercise}
                  onDelete={handleDeleteExercise}
                  onSetComplete={logCompletedSet}
                />
              ))}
            </div>
          </section>
        )}
        
        {/* All exercises library */}
        {selectedDay === 'all' && exercises.length > 0 && (
          <section className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-xl">Biblioteca de Ejercicios</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {exercises.length} total
              </span>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="p-4 rounded-xl card-gradient border border-border hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      {exercise.imageUrl ? (
                        <img 
                          src={exercise.imageUrl} 
                          alt={exercise.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Dumbbell className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {exercise.muscleGroup} · {exercise.sets}x{exercise.reps}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  );
};

export default Index;
