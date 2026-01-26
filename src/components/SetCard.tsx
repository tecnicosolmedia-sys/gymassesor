import { useState } from 'react';
import { SetConfig } from '@/types/exercise';
import { Check, Minus, Plus, Edit2, Dumbbell, Clock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetCardProps {
  config: SetConfig;
  index: number;
  isCompleted: boolean;
  isCurrent: boolean;
  currentSet: number;
  currentWeight: number;
  onUpdateConfig: (index: number, field: keyof Omit<SetConfig, 'setNumber'>, delta: number) => void;
  onCompleteSet: () => void;
}

export const SetCard = ({
  config,
  index,
  isCompleted,
  isCurrent,
  currentSet,
  currentWeight,
  onUpdateConfig,
  onCompleteSet,
}: SetCardProps) => {
  const [isEditingCompleted, setIsEditingCompleted] = useState(false);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "p-3 rounded-xl transition-all",
          isCompleted
            ? "bg-primary/20 border border-primary"
            : isCurrent
              ? "bg-secondary border border-primary/50"
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
              <span className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2">
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
              <span className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2">
                {config.weight}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateConfig(index, 'weight', -2.5)}
                  className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig(index, 'weight', 2.5)}
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
              <span className="font-lcd text-3xl text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)] mb-2">
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
      
      {/* Botón de completar serie - flotante justo debajo de la serie actual */}
      {isCurrent && (
        <button
          onClick={onCompleteSet}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy animate-fade-in"
        >
          <Play className="w-4 h-4" />
          Completar Serie {currentSet} ({currentWeight}kg)
        </button>
      )}
    </div>
  );
};
