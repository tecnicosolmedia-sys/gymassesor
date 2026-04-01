import { useState } from 'react';
import { SetConfig } from '@/types/exercise';
import { CheckCircle, Edit2, Dumbbell, Clock, ArrowRight, Minus, Plus, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';
import { WorkoutSession } from '@/types/workoutHistory';

interface ExerciseSummaryProps {
  exerciseName: string;
  exerciseId: string;
  muscleGroup: string;
  setConfigs: SetConfig[];
  completedSets: number[]; // indices of completed sets (1-based)
  onContinue: (updatedConfigs: SetConfig[]) => void;
  onGoBack?: () => void;
  historySessions?: WorkoutSession[];
}

export const ExerciseSummary = ({
  exerciseName,
  exerciseId,
  muscleGroup,
  setConfigs,
  completedSets,
  onContinue,
  onGoBack,
  historySessions = [],
}: ExerciseSummaryProps) => {
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [localConfigs, setLocalConfigs] = useState<SetConfig[]>([...setConfigs]);
  const [editField, setEditField] = useState<'reps' | 'weight' | null>(null);
  const [editValue, setEditValue] = useState('');

  const completedConfigs = localConfigs.filter((_, i) => completedSets.includes(i + 1));

  const totalKg = completedConfigs.reduce((sum, c) => sum + c.weight * c.reps, 0);

  const handleUpdateField = (index: number, field: 'reps' | 'weight', delta: number) => {
    setLocalConfigs(prev => prev.map((c, i) => {
      if (i !== index) return c;
      let newVal = c[field] + delta;
      if (field === 'reps') newVal = Math.max(1, Math.min(99, newVal));
      if (field === 'weight') newVal = Math.max(0, Math.min(999, Math.round(newVal * 2) / 2));
      return { ...c, [field]: newVal };
    }));
  };

  const handleDirectEdit = (index: number, field: 'reps' | 'weight') => {
    setEditingSetIndex(index);
    setEditField(field);
    setEditValue(localConfigs[index][field].toString());
  };

  const handleDirectEditSubmit = () => {
    if (editingSetIndex === null || !editField) return;
    const numVal = parseFloat(editValue);
    if (!isNaN(numVal) && numVal >= 0) {
      setLocalConfigs(prev => prev.map((c, i) => {
        if (i !== editingSetIndex) return c;
        let val = numVal;
        if (editField === 'reps') val = Math.max(1, Math.min(99, Math.round(val)));
        if (editField === 'weight') val = Math.max(0, Math.min(999, Math.round(val * 2) / 2));
        return { ...c, [editField]: val };
      }));
    }
    setEditingSetIndex(null);
    setEditField(null);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display font-bold text-2xl text-gradient-energy mb-1">
            {exerciseName}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            {muscleGroup}
          </span>
          <p className="text-muted-foreground text-sm mt-2">
            {completedSets.length} series completadas · {totalKg.toLocaleString()} kg totales
          </p>
        </div>

        {/* Set summary table */}
        <div className="rounded-2xl border border-border overflow-hidden mb-6">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-secondary/50 text-xs text-muted-foreground font-medium">
            <span>Serie</span>
            <span className="text-center">Reps</span>
            <span className="text-center">Peso (kg)</span>
            <span className="text-center">Descanso</span>
          </div>

          {/* Rows */}
          {localConfigs.map((config, index) => {
            const isCompleted = completedSets.includes(index + 1);
            if (!isCompleted) return null;

            return (
              <div
                key={index}
                className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-border items-center"
              >
                {/* Set number */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                </div>

                {/* Reps - editable */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleUpdateField(index, 'reps', -1)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className="font-lcd text-lg text-primary min-w-[2ch] text-center cursor-pointer"
                    onClick={() => handleDirectEdit(index, 'reps')}
                  >
                    {config.reps}
                  </span>
                  <button
                    onClick={() => handleUpdateField(index, 'reps', 1)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Weight - editable */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleUpdateField(index, 'weight', -0.5)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className="font-lcd text-lg text-primary min-w-[3ch] text-center cursor-pointer"
                    onClick={() => handleDirectEdit(index, 'weight')}
                  >
                    {config.weight}
                  </span>
                  <button
                    onClick={() => handleUpdateField(index, 'weight', 0.5)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Rest time - read only */}
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {config.restTime}s
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <button
          onClick={() => onContinue(localConfigs)}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Direct edit dialog */}
      <Dialog open={editingSetIndex !== null && editField !== null} onOpenChange={(open) => { if (!open) { setEditingSetIndex(null); setEditField(null); } }}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>
              Editar {editField === 'reps' ? 'Repeticiones' : 'Peso (kg)'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              step={editField === 'weight' ? '0.5' : '1'}
              min="0"
              className="text-center text-2xl font-lcd"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleDirectEditSubmit(); }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setEditingSetIndex(null); setEditField(null); }}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleDirectEditSubmit}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
