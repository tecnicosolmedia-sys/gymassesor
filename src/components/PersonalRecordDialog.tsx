import { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonalRecordDialogProps {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  weight: number;
  reps: number;
  previousRecord: number;
}

export const PersonalRecordDialog = ({
  open,
  onClose,
  exerciseName,
  weight,
  reps,
  previousRecord,
}: PersonalRecordDialogProps) => {
  // Auto cierre tras 5s
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full max-w-sm rounded-3xl border-2 border-primary p-6",
          "bg-gradient-to-br from-background via-background to-primary/10",
          "shadow-[0_0_60px_-5px_hsl(var(--primary)/0.6)]",
          "animate-scale-in text-center"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex justify-center mb-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
            <Trophy className="relative w-20 h-20 text-primary drop-shadow-[0_0_15px_hsl(var(--primary))]" />
          </div>
        </div>

        <h2 className="font-display font-extrabold text-2xl text-primary tracking-wider mb-1">
          ¡RÉCORD PERSONAL!
        </h2>
        <p className="text-sm text-muted-foreground mb-4 break-words">
          {exerciseName}
        </p>

        <div className="rounded-2xl bg-secondary/50 border border-primary/30 p-4 mb-3">
          <div className="font-mono text-4xl font-bold text-primary"
               style={{ fontFamily: 'Orbitron, monospace' }}>
            {weight} kg
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            × {reps} reps
          </div>
        </div>

        {previousRecord > 0 && (
          <p className="text-xs text-muted-foreground">
            Marca anterior: <span className="font-semibold">{previousRecord} kg</span>
          </p>
        )}
      </div>
    </div>
  );
};
