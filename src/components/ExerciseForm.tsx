import { useState, useEffect } from 'react';
import { Exercise } from '@/types/exercise';
import { X, Image, Video, Save, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseFormProps {
  exercise?: Exercise | null;
  onSave: (exercise: Omit<Exercise, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

const muscleGroups = [
  'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 
  'Piernas', 'Glúteos', 'Abdomen', 'Core', 'Cardio'
];

export const ExerciseForm = ({ exercise, onSave, onClose }: ExerciseFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    videoUrl: '',
    sets: 3,
    reps: 10,
    weight: 20,
    restBetweenSets: 60,
    restAfterExercise: 120,
    notes: '',
    caloriesPerSet: 5,
    muscleGroup: 'Pecho',
  });

  useEffect(() => {
    if (exercise) {
      setFormData({
        name: exercise.name,
        imageUrl: exercise.imageUrl || '',
        videoUrl: exercise.videoUrl || '',
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        restBetweenSets: exercise.restBetweenSets,
        restAfterExercise: exercise.restAfterExercise,
        notes: exercise.notes,
        caloriesPerSet: exercise.caloriesPerSet,
        muscleGroup: exercise.muscleGroup,
      });
    }
  }, [exercise]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, videoUrl: url }));
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl animate-scale-in my-8">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl">
                {exercise ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Nombre del ejercicio</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="Ej: Press de banca"
                required
              />
            </div>

            {/* Muscle group */}
            <div>
              <label className="block text-sm font-medium mb-2">Grupo muscular</label>
              <div className="flex flex-wrap gap-2">
                {muscleGroups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, muscleGroup: group }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                      formData.muscleGroup === group
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            {/* Media uploads */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Imagen</label>
                <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors overflow-hidden">
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Image className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Subir imagen</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Video</label>
                <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors overflow-hidden">
                  {formData.videoUrl ? (
                    <video src={formData.videoUrl} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Video className="w-6 h-6 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Subir video</span>
                    </>
                  )}
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Sets, reps, weight */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Series</label>
                <input
                  type="number"
                  value={formData.sets}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sets: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reps</label>
                <input
                  type="number"
                  value={formData.reps}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Peso (kg)</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData((prev) => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="0"
                  step="0.5"
                  required
                />
              </div>
            </div>

            {/* Rest times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Descanso entre series (seg)</label>
                <input
                  type="number"
                  value={formData.restBetweenSets}
                  onChange={(e) => setFormData((prev) => ({ ...prev, restBetweenSets: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="0"
                  step="5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descanso entre ejercicios (seg)</label>
                <input
                  type="number"
                  value={formData.restAfterExercise}
                  onChange={(e) => setFormData((prev) => ({ ...prev, restAfterExercise: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="0"
                  step="5"
                  required
                />
              </div>
            </div>

            {/* Calories */}
            <div>
              <label className="block text-sm font-medium mb-2">Calorías por serie (aprox)</label>
              <input
                type="number"
                value={formData.caloriesPerSet}
                onChange={(e) => setFormData((prev) => ({ ...prev, caloriesPerSet: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none font-semibold"
                min="0"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Observaciones</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none resize-none h-24"
                placeholder="Consejos de ejecución, variantes, etc..."
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
            >
              <Save className="w-5 h-5" />
              {exercise ? 'Guardar Cambios' : 'Crear Ejercicio'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
