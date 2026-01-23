import { useState } from 'react';
import { Header } from '@/components/Header';
import { StatsPanel } from '@/components/StatsPanel';
import { ExerciseCard } from '@/components/ExerciseCard';
import { ExerciseForm } from '@/components/ExerciseForm';
import { useExercises } from '@/hooks/useExercises';
import { Exercise } from '@/types/exercise';
import { Dumbbell } from 'lucide-react';

const Index = () => {
  const { 
    exercises, 
    isLoading, 
    addExercise, 
    updateExercise, 
    deleteExercise,
    calculateTotalCalories,
    calculateProteinNeeded,
  } = useExercises();
  
  const [showForm, setShowForm] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  const handleAddExercise = () => {
    setEditingExercise(null);
    setShowForm(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setShowForm(true);
  };

  const handleSaveExercise = (data: Omit<Exercise, 'id' | 'createdAt'>) => {
    if (editingExercise) {
      updateExercise(editingExercise.id, data);
    } else {
      addExercise(data);
    }
  };

  const handleDeleteExercise = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este ejercicio?')) {
      deleteExercise(id);
    }
  };

  const totalCalories = calculateTotalCalories();
  const proteinNeeded = calculateProteinNeeded(totalCalories);

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
      
      <Header onAddExercise={handleAddExercise} />
      
      <main className="container mx-auto px-4 py-6 space-y-6 relative">
        {/* Stats */}
        <StatsPanel 
          totalCalories={totalCalories}
          proteinNeeded={proteinNeeded}
          exerciseCount={exercises.length}
        />
        
        {/* Exercises list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-xl">Mis Ejercicios</h2>
            <span className="text-sm text-muted-foreground">
              {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Dumbbell className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">Sin ejercicios aún</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                Empieza a crear tu rutina personalizada añadiendo tu primer ejercicio
              </p>
              <button
                onClick={handleAddExercise}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-energy"
              >
                Añadir Ejercicio
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onEdit={handleEditExercise}
                  onDelete={handleDeleteExercise}
                  isActive={activeExerciseId === exercise.id}
                  onActivate={() => setActiveExerciseId(exercise.id)}
                />
              ))}
            </div>
          )}
        </section>
        
        {/* Nutrition tip */}
        <section className="p-6 rounded-2xl card-gradient border border-border">
          <h3 className="font-display font-bold text-lg mb-3 text-gradient-energy">
            💡 Sugerencias Nutricionales
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-foreground font-medium">Calorías quemadas estimadas:</span> {totalCalories} kcal 
              — Esto equivale aproximadamente a {Math.round(totalCalories / 100)} galletas o {Math.round(totalCalories / 250)} hamburguesas.
            </p>
            <p>
              <span className="text-foreground font-medium">Ingesta de proteínas recomendada:</span> {proteinNeeded}g 
              — Para optimizar la recuperación muscular, consume esta cantidad repartida en tus comidas del día.
            </p>
            <p>
              <span className="text-foreground font-medium">Hidratación:</span> Bebe al menos {Math.round(totalCalories / 50) + 8} vasos de agua hoy 
              para mantener un rendimiento óptimo.
            </p>
          </div>
        </section>
      </main>
      
      {/* Exercise Form Modal */}
      {showForm && (
        <ExerciseForm
          exercise={editingExercise}
          onSave={handleSaveExercise}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default Index;
