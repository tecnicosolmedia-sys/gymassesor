import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Trash2, Save } from 'lucide-react';

export interface EditableSetTarget {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number;
}

interface Props {
  target: EditableSetTarget | null;
  onClose: () => void;
  onSave: (sessionId: string, exerciseId: string, setNumber: number, updates: { reps: number; weight: number }) => void | Promise<void>;
  onDelete?: (sessionId: string, exerciseId: string, setNumber: number) => void | Promise<void>;
}

export const EditCompletedSetDialog = ({ target, onClose, onSave, onDelete }: Props) => {
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);

  useEffect(() => {
    if (target) {
      setReps(target.reps);
      setWeight(target.weight);
    }
  }, [target]);

  if (!target) return null;

  const adjustReps = (delta: number) => setReps(v => Math.max(1, Math.min(99, v + delta)));
  const adjustWeight = (delta: number) => setWeight(v => Math.max(0, Math.min(999, +(v + delta).toFixed(1))));

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Editar serie {target.setNumber}
          </DialogTitle>
          <p className="text-xs text-muted-foreground break-words">{target.exerciseName}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Reps */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground">Reps</Label>
            <div className="w-full py-3 rounded-xl bg-secondary/50 border border-border font-lcd text-3xl font-bold text-primary text-center">
              {reps}
            </div>
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => adjustReps(-1)}
                className="flex-1 py-2 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => adjustReps(1)}
                className="flex-1 py-2 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weight */}
          <div className="flex flex-col items-center gap-2">
            <Label className="text-xs text-muted-foreground">Peso (kg)</Label>
            <div className="w-full py-3 rounded-xl bg-secondary/50 border border-border font-lcd text-3xl font-bold text-primary text-center">
              {weight}
            </div>
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => adjustWeight(-0.5)}
                className="flex-1 py-2 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => adjustWeight(0.5)}
                className="flex-1 py-2 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {onDelete && (
            <button
              onClick={async () => {
                if (!window.confirm('¿Eliminar esta serie del historial?')) return;
                await onDelete(target.sessionId, target.exerciseId, target.setNumber);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          )}
          <button
            onClick={async () => {
              await onSave(target.sessionId, target.exerciseId, target.setNumber, { reps, weight });
              onClose();
            }}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-energy hover:bg-primary/90"
          >
            <Save className="w-4 h-4" />
            Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
