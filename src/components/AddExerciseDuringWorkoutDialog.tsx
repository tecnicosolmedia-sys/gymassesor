import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, Dumbbell } from 'lucide-react';
import { Exercise } from '@/types/exercise';

interface AddExerciseDuringWorkoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
  routineName: string;
  onSaveToRoutine: () => void;
  onJustThisTime: () => void;
}

export const AddExerciseDuringWorkoutDialog = ({
  open,
  onOpenChange,
  exercise,
  routineName,
  onSaveToRoutine,
  onJustThisTime,
}: AddExerciseDuringWorkoutDialogProps) => {
  if (!exercise) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            ¿Guardar en la rutina?
          </DialogTitle>
          <DialogDescription>
            Has añadido <strong>{exercise.name}</strong> a tu entrenamiento.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 rounded-xl bg-secondary/50 my-2">
          <p className="text-sm text-muted-foreground">
            ¿Quieres guardar este ejercicio permanentemente en la rutina <strong>"{routineName}"</strong>?
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button 
            variant="outline" 
            onClick={onJustThisTime} 
            className="w-full sm:w-auto gap-2"
          >
            <Dumbbell className="w-4 h-4" />
            Solo esta vez
          </Button>
          <Button 
            onClick={onSaveToRoutine} 
            className="w-full sm:w-auto gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar en rutina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
