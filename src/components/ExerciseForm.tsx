import { useState, useEffect, useRef } from 'react';
import { Exercise, SetConfig } from '@/types/exercise';
import { X, Image, Save, Dumbbell, ChevronDown, Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ExerciseFormProps {
  exercise?: Exercise | null;
  onSave: (exercise: Omit<Exercise, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

const muscleGroups = [
  'Pecho', 'Espalda', 'Hombros', 'Brazos', 
  'Piernas', 'Glúteos', 'Core'
];

const setOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Generar opciones de repeticiones (1-99)
const repsOptions = Array.from({ length: 99 }, (_, i) => i + 1);

// Generar opciones de peso (0-999 en intervalos de 0.5)
const weightOptions = Array.from({ length: 1999 }, (_, i) => i * 0.5);

// Generar opciones de tiempo de descanso (5-300 en intervalos de 5)
const restTimeOptions = Array.from({ length: 60 }, (_, i) => (i + 1) * 5);

interface DropdownSelectProps {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  formatLabel?: (value: number) => string;
  label: string;
  parentRef?: React.RefObject<HTMLDivElement>;
}

const DropdownSelect = ({ value, options, onChange, formatLabel, label, parentRef }: DropdownSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const displayValue = formatLabel ? formatLabel(value) : value.toString();

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Si hay poco espacio abajo, abrir hacia arriba
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setDropdownStyle({
          bottom: '100%',
          top: 'auto',
          marginBottom: '4px',
          marginTop: 0,
        });
      } else {
        setDropdownStyle({
          top: '100%',
          bottom: 'auto',
          marginTop: '4px',
          marginBottom: 0,
        });
      }
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const dropdownEl = buttonRef.current?.parentElement?.querySelector('[data-dropdown]');
      if (
        buttonRef.current && 
        !buttonRef.current.contains(e.target as Node) &&
        (!dropdownEl || !dropdownEl.contains(e.target as Node))
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      // Use 'click' instead of 'mousedown' to allow option clicks to complete first
      document.addEventListener('click', handleClickOutside, true);
    }
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isOpen]);

  return (
    <div className="relative">
      {label && <label className="block text-xs text-muted-foreground mb-1">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border focus:border-primary outline-none text-center font-semibold text-sm flex items-center justify-between transition-all"
      >
        <span className="flex-1 text-center">{displayValue}</span>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>
      
      {isOpen && (
        <div 
          data-dropdown
          className="absolute left-0 right-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-scale-in"
          style={{ ...dropdownStyle, zIndex: 9999 }}
        >
          <div className="max-h-40 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-center text-sm hover:bg-secondary transition-colors",
                  value === opt && "bg-primary/20 text-primary font-semibold"
                )}
              >
                {formatLabel ? formatLabel(opt) : opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ExerciseForm = ({ exercise, onSave, onClose }: ExerciseFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    imageUrls: [] as string[],
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
  const [expandedSets, setExpandedSets] = useState<number[]>([0]);
  const formRef = useRef<HTMLDivElement>(null);

  // Inicializar configuración de series - usar la última configuración guardada del ejercicio
  useEffect(() => {
    if (exercise) {
      const initialImageUrls = exercise.imageUrls && exercise.imageUrls.length > 0
        ? exercise.imageUrls
        : (exercise.imageUrl ? [exercise.imageUrl] : []);
      setFormData({
        name: exercise.name,
        imageUrl: initialImageUrls[0] || '',
        imageUrls: initialImageUrls,
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
      
      // Usar la configuración guardada del ejercicio (que ya tiene la última sesión)
      if (exercise.setConfigs && exercise.setConfigs.length > 0) {
        const configsWithReps = exercise.setConfigs.map((config, i) => ({
          ...config,
          reps: config.reps || exercise.reps,
        }));
        setSetConfigs(configsWithReps);
      } else {
        const defaultConfigs: SetConfig[] = Array.from({ length: exercise.sets }, (_, i) => ({
          setNumber: i + 1,
          reps: exercise.reps,
          weight: exercise.weight,
          restTime: exercise.restBetweenSets,
        }));
        setSetConfigs(defaultConfigs);
      }
    } else {
      const defaultConfigs: SetConfig[] = Array.from({ length: 3 }, (_, i) => ({
        setNumber: i + 1,
        reps: 10,
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
        const lastConfig = prev[prev.length - 1] || { reps: formData.reps, weight: formData.weight, restTime: formData.restBetweenSets };
        const newConfigs = [...prev];
        for (let i = prev.length; i < newSets; i++) {
          newConfigs.push({
            setNumber: i + 1,
            reps: lastConfig.reps,
            weight: lastConfig.weight,
            restTime: lastConfig.restTime,
          });
        }
        return newConfigs;
      } else {
        return prev.slice(0, newSets);
      }
    });
  };

  const updateSetConfig = (index: number, field: keyof Omit<SetConfig, 'setNumber'>, value: number) => {
    setSetConfigs((prev) => 
      prev.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    );
  };

  // Copiar configuración de una serie a la siguiente
  const copyConfigToNext = (sourceIndex: number) => {
    if (sourceIndex >= setConfigs.length - 1) return; // No hay serie siguiente
    
    const sourceConfig = setConfigs[sourceIndex];
    setSetConfigs((prev) => 
      prev.map((config, i) => 
        i === sourceIndex + 1 
          ? {
              ...config,
              reps: sourceConfig.reps,
              weight: sourceConfig.weight,
              restTime: sourceConfig.restTime,
            }
          : config
      )
    );
    
    // Expandir la siguiente serie para mostrar los cambios
    if (!expandedSets.includes(sourceIndex + 1)) {
      setExpandedSets((prev) => [...prev, sourceIndex + 1]);
    }
  };

  const toggleSetExpanded = (index: number) => {
    setExpandedSets((prev) => 
      prev.includes(index) 
        ? prev.filter((i) => i !== index)
        : [...prev, index]
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

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingImage(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of files) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${crypto.randomUUID()}.${fileExt}`;
          const filePath = `exercises/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('exercise-images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('exercise-images')
            .getPublicUrl(filePath);

          uploadedUrls.push(publicUrl);
        } catch (error) {
          console.error('Error uploading image, fallback to base64:', error);
          // Fallback to base64
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          uploadedUrls.push(dataUrl);
        }
      }

      setFormData((prev) => {
        const newUrls = [...prev.imageUrls, ...uploadedUrls];
        return {
          ...prev,
          imageUrls: newUrls,
          imageUrl: newUrls[0] || '',
        };
      });
    } finally {
      setIsUploadingImage(false);
      // Reset input para permitir re-subir el mismo archivo
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => {
      const newUrls = prev.imageUrls.filter((_, i) => i !== index);
      return {
        ...prev,
        imageUrls: newUrls,
        imageUrl: newUrls[0] || '',
      };
    });
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const newUrls = [...prev.imageUrls];
      const target = index + direction;
      if (target < 0 || target >= newUrls.length) return prev;
      [newUrls[index], newUrls[target]] = [newUrls[target], newUrls[index]];
      return {
        ...prev,
        imageUrls: newUrls,
        imageUrl: newUrls[0] || '',
      };
    });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, videoUrl: url }));
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[60] overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div ref={formRef} className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl animate-scale-in my-8">
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

            {/* Image upload - square full width */}
            <div>
              <label className="block text-sm font-medium mb-2">Imagen del ejercicio</label>
              <label className="flex flex-col items-center justify-center w-full aspect-square rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors overflow-hidden relative">
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <Image className="w-10 h-10 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Toca para subir imagen</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              {formData.imageUrl && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                  className="mt-2 text-xs text-destructive hover:underline"
                >
                  Eliminar imagen
                </button>
              )}
            </div>

            {/* Sets with +/- buttons */}
            <div>
              <label className="block text-sm font-medium mb-2">Número de series</label>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary border border-border">
                <span 
                  className="font-lcd text-4xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                >
                  {formData.sets}
                </span>
                <span className="text-xs text-muted-foreground mb-1">
                  {formData.sets === 1 ? 'serie' : 'series'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => formData.sets > 1 && handleSetsChange(formData.sets - 1)}
                    className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-lg font-bold hover:bg-primary/20 hover:border-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={formData.sets <= 1}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => formData.sets < 10 && handleSetsChange(formData.sets + 1)}
                    className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-lg font-bold hover:bg-primary/20 hover:border-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={formData.sets >= 10}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Individual set configuration with collapsible tabs */}
            <div>
              <label className="block text-sm font-medium mb-3">Configuración por serie</label>
              <div className="space-y-2">
                {setConfigs.map((config, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "rounded-xl bg-secondary/50 border border-border overflow-visible animate-fade-in",
                      expandedSets.includes(index) && "relative z-10"
                    )}
                    style={{ zIndex: expandedSets.includes(index) ? 100 - index : 1 }}
                  >
                    {/* Set header - clickable to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => toggleSetExpanded(index)}
                      className="w-full p-3 flex items-center justify-between hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">{index + 1}</span>
                        </div>
                        <span className="text-sm font-medium">Serie {index + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {config.reps} reps · {config.weight}kg · {config.restTime}s
                        </span>
                      </div>
                      <ChevronDown className={cn(
                        "w-5 h-5 text-muted-foreground transition-transform",
                        expandedSets.includes(index) && "rotate-180"
                      )} />
                    </button>
                    
                    {/* Expanded content */}
                    {expandedSets.includes(index) && (
                      <div className="p-3 pt-0 animate-fade-in relative" style={{ zIndex: 200 }}>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <DropdownSelect
                            label="Repeticiones"
                            value={config.reps}
                            options={repsOptions}
                            onChange={(value) => updateSetConfig(index, 'reps', value)}
                            formatLabel={(v) => `${v} reps`}
                            parentRef={formRef}
                          />
                          <DropdownSelect
                            label="Peso (kg)"
                            value={config.weight}
                            options={weightOptions}
                            onChange={(value) => updateSetConfig(index, 'weight', value)}
                            formatLabel={(v) => `${v} kg`}
                            parentRef={formRef}
                          />
                          <DropdownSelect
                            label="Descanso (s)"
                            value={config.restTime}
                            options={restTimeOptions}
                            onChange={(value) => updateSetConfig(index, 'restTime', value)}
                            formatLabel={(v) => `${v}s`}
                            parentRef={formRef}
                          />
                        </div>
                        
                        {/* Copy to next set button */}
                        {index < setConfigs.length - 1 && (
                          <button
                            type="button"
                            onClick={() => copyConfigToNext(index)}
                            className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copiar a la siguiente serie
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rest after exercise */}
            <div className="relative" style={{ zIndex: 50 }}>
              <label className="block text-sm font-medium mb-2">Descanso entre ejercicios</label>
              <DropdownSelect
                label=""
                value={formData.restAfterExercise}
                options={[...restTimeOptions, 180, 240, 300].sort((a, b) => a - b)}
                onChange={(value) => setFormData((prev) => ({ ...prev, restAfterExercise: value }))}
                formatLabel={(v) => `${v} segundos`}
                parentRef={formRef}
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
