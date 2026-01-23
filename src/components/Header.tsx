import { Dumbbell, Plus } from 'lucide-react';

interface HeaderProps {
  onAddExercise: () => void;
}

export const Header = ({ onAddExercise }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center glow-energy">
              <Dumbbell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-gradient-energy">
                GymTracker
              </h1>
              <p className="text-xs text-muted-foreground">Tu rutina personal</p>
            </div>
          </div>
          
          <button
            onClick={onAddExercise}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-energy"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Añadir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
