import { useState, useRef, useEffect } from 'react';
import { SetConfig } from '@/types/exercise';
import { Check, Minus, Plus, Edit2, Dumbbell, Clock, Play, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SetCardProps {
  config: SetConfig;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  currentSet: number;
  currentWeight: number;
  previousConfig?: SetConfig; // Configuración de la serie anterior
  onUpdateConfig: (index: number, field: keyof Omit<SetConfig, 'setNumber'>, delta: number) => void;
  onCompleteSet: () => void;
  onSetDirectValue?: (index: number, field: keyof Omit<SetConfig, 'setNumber'>, value: number) => void;
  onCopyFromPrevious?: (index: number) => void; // Callback para copiar de la serie anterior
}

type EditableField = 'reps' | 'weight' | 'restTime';

export const SetCard = ({
  config,
  index,
  isCompleted,
  isCurrent,
  currentSet,
  currentWeight,
  previousConfig,
  onUpdateConfig,
  onCompleteSet,
  onSetDirectValue,
  onCopyFromPrevious,
}: SetCardProps) => {
  const [isEditingCompleted, setIsEditingCompleted] = useState(false);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [directInputValue, setDirectInputValue] = useState('');
  
  // Refs para long press
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleLongPressStart = (field: EditableField, currentValue: number) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setEditingField(field);
      setDirectInputValue(currentValue.toString());
    }, 1000); // 1 segundo
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDirectValueSubmit = () => {
    if (editingField && onSetDirectValue) {
      const numValue = parseFloat(directInputValue);
      if (!isNaN(numValue) && numValue >= 0) {
        onSetDirectValue(index, editingField, numValue);
      }
    }
    setEditingField(null);
    setDirectInputValue('');
  };

  const getFieldLabel = (field: EditableField) => {
    switch (field) {
      case 'reps': return 'Repeticiones';
      case 'weight': return 'Peso (kg)';
      case 'restTime': return 'Descanso (seg)';
    }
  };

  const getFieldStep = (field: EditableField) => {
    switch (field) {
      case 'reps': return '1';
      case 'weight': return '0.5';
      case 'restTime': return '5';
    }
  };

  return (
    <>
      <div className="space-y-2">
        <div
          className={cn(
            "p-3 rounded-xl transition-all",
            isCompleted
              ? "bg-primary/20 border border-primary"
              : isCurrent
                ? "bg-secondary neon-border-trace"
                : "bg-secondary/50 border border-transparent"
          )}
        >
          {/* Header de la serie */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isCompleted
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            )}>
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="text-sm font-bold">{index + 1}</span>
              )}
            </div>
            <span className="text-sm font-medium">Serie {index + 1}</span>
            {isCurrent && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium ml-auto">
                Actual
              </span>
            )}
            {isCompleted && (
              <button
                onClick={() => setIsEditingCompleted(!isEditingCompleted)}
                className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors ml-auto flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {isEditingCompleted ? 'Cerrar' : 'Editar'}
              </button>
            )}
          </div>
          
          {/* Controles editables - para serie actual o serie completada en modo edición */}
          {(isCurrent || isEditingCompleted) ? (
            <div className="grid grid-cols-3 gap-4">
              {/* Repeticiones */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">Reps</span>
                <span 
                  className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2 cursor-pointer select-none"
                  onTouchStart={() => handleLongPressStart('reps', config.reps)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart('reps', config.reps)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  title="Mantén pulsado para editar directamente"
                >
                  {config.reps}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'reps', -1)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'reps', 1)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Peso */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">Peso</span>
                <span 
                  className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2 cursor-pointer select-none"
                  onTouchStart={() => handleLongPressStart('weight', config.weight)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart('weight', config.weight)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  title="Mantén pulsado para editar directamente"
                >
                  {config.weight}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'weight', -0.5)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'weight', 0.5)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">kg</span>
              </div>
              
              {/* Descanso */}
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">Descanso</span>
                <span 
                  className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2 cursor-pointer select-none"
                  onTouchStart={() => handleLongPressStart('restTime', config.restTime)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart('restTime', config.restTime)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  title="Mantén pulsado para editar directamente"
                >
                  {config.restTime}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'restTime', -5)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig(index, 'restTime', 5)}
                    className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">seg</span>
              </div>
            </div>
          ) : isCompleted ? (
            // Vista compacta para series completadas
            <div className="flex items-center gap-4 text-sm pl-11">
              <span className="text-muted-foreground">{config.reps} reps</span>
              <span className="flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold">{config.weight}kg</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{config.restTime}s</span>
              </span>
            </div>
          ) : (
            // Vista compacta para series futuras (no current)
            <div className="flex items-center gap-4 text-sm pl-11 opacity-60">
              <span className="text-muted-foreground">{config.reps} reps</span>
              <span className="flex items-center gap-1">
                <Dumbbell className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{config.weight}kg</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{config.restTime}s</span>
              </span>
            </div>
          )}
        </div>
        
        {/* Botones de acción para la serie actual */}
        {isCurrent && (
          <div className="space-y-2">
            {/* Botón para copiar de la serie anterior */}
            {previousConfig && onCopyFromPrevious && (
              <button
                onClick={() => onCopyFromPrevious(index)}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
              >
                <Copy className="w-4 h-4" />
                Copiar serie anterior ({previousConfig.weight}kg × {previousConfig.reps})
              </button>
            )}
            
            {/* Botón de completar serie */}
            <button
              onClick={onCompleteSet}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy animate-fade-in"
            >
              <Play className="w-4 h-4" />
              Completar Serie {currentSet} ({currentWeight}kg)
            </button>
          </div>
        )}
      </div>

      {/* Diálogo para edición directa */}
      <Dialog open={editingField !== null} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>
              Editar {editingField && getFieldLabel(editingField)}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={directInputValue}
              onChange={(e) => setDirectInputValue(e.target.value)}
              step={editingField ? getFieldStep(editingField) : '1'}
              min="0"
              className="text-center text-2xl font-lcd"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDirectValueSubmit();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditingField(null)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleDirectValueSubmit}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
