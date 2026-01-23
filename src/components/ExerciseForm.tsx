import { useState, useEffect } from 'react';
import { Exercise, SetConfig } from '@/types/exercise';
import { X, Image, Video, Save, Dumbbell, ChevronDown } from 'lucide-react';
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

const setOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

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
  
  const [setConfigs, setSetConfigs] = useState<SetConfig[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Inicializar configuración de series
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
      
      if (exercise.setConfigs && exercise.setConfigs.length > 0) {
        setSetConfigs(exercise.setConfigs);
      } else {
        // Crear configuración por defecto basada en valores del ejercicio
        const defaultConfigs: SetConfig[] = Array.from({ length: exercise.sets }, (_, i) => ({
          setNumber: i + 1,
          weight: exercise.weight,
          restTime: exercise.restBetweenSets,
        }));
        setSetConfigs(defaultConfigs);
      }
    } else {
      // Crear configuración inicial para nuevo ejercicio
      const defaultConfigs: SetConfig[] = Array.from({ length: 3 }, (_, i) => ({
        setNumber: i + 1,
        weight: 20,
        restTime: 60,
      }));
      setSetConfigs(defaultConfigs);
    }
  }, [exercise]);

  // Actualizar configuración cuando cambia el número de series
  const handleSetsChange = (newSets: number) => {
    setFormData((prev) => ({ ...prev, sets: newSets }));
    setShowDropdown(false);
    
    setSetConfigs((prev) => {
      if (newSets > prev.length) {
        // Añadir nuevas series
        const lastConfig = prev[prev.length - 1] || { weight: formData.weight, restTime: formData.restBetweenSets };
        const newConfigs = [...prev];
        for (let i = prev.length; i < newSets; i++) {
          newConfigs.push({
            setNumber: i + 1,
            weight: lastConfig.weight,
            restTime: lastConfig.restTime,
          });
        }
        return newConfigs;
      } else {
        // Reducir series
        return prev.slice(0, newSets);
      }
    });
  };

  const updateSetConfig = (index: number, field: 'weight' | 'restTime', value: number) => {
    setSetConfigs((prev) => 
      prev.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      setConfigs,
    });
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

            {/* Sets dropdown and reps */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sets dropdown */}
              <div>
                <label className="block text-sm font-medium mb-2">Número de series</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-left font-semibold flex items-center justify-between transition-all"
                  >
                    <span>{formData.sets} series</span>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform",
                      showDropdown && "rotate-180"
                    )} />
                  </button>
                  
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-scale-in">
                      <div className="max-h-48 overflow-y-auto">
                        {setOptions.map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleSetsChange(num)}
                            className={cn(
                              "w-full px-4 py-3 text-left hover:bg-secondary transition-colors",
                              formData.sets === num && "bg-primary/20 text-primary font-semibold"
                            )}
                          >
                            {num} {num === 1 ? 'serie' : 'series'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Reps */}
              <div>
                <label className="block text-sm font-medium mb-2">Repeticiones</label>
                <input
                  type="number"
                  value={formData.reps}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none text-center font-semibold"
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Individual set configuration */}
            <div>
              <label className="block text-sm font-medium mb-3">Configuración por serie</label>
              <div className="space-y-3">
                {setConfigs.map((config, index) => (
                  <div 
                    key={index}
                    className="p-3 rounded-xl bg-secondary/50 border border-border animate-fade-in"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <span className="text-sm font-medium">Serie {index + 1}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Peso (kg)</label>
                        <input
                          type="number"
                          value={config.weight}
                          onChange={(e) => updateSetConfig(index, 'weight', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-center font-semibold text-sm"
                          min="0"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Descanso (seg)</label>
                        <input
                          type="number"
                          value={config.restTime}
                          onChange={(e) => updateSetConfig(index, 'restTime', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-center font-semibold text-sm"
                          min="0"
                          step="5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rest after exercise */}
            <div>
              <label className="block text-sm font-medium mb-2">Descanso entre ejercicios (seg)</label>
              <input
                type="number"
                value={formData.restAfterExercise}
                onChange={(e) => setFormData((prev) => ({ ...prev, restAfterExercise: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary outline-none font-semibold"
                min="0"
                step="5"
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
