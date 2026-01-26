import { MuscleGroup, MUSCLE_GROUPS } from '@/types/exercise';
import { cn } from '@/lib/utils';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

interface MuscleFilterTabsProps {
  selectedMuscle: MuscleGroup | 'todas';
  onSelectMuscle: (muscle: MuscleGroup | 'todas') => void;
}

export const MuscleFilterTabs = ({ selectedMuscle, onSelectMuscle }: MuscleFilterTabsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSelectMuscle('todas')}
        className={cn(
          "px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2",
          selectedMuscle === 'todas'
            ? "bg-primary text-primary-foreground shadow-energy"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        Todas
      </button>
      {MUSCLE_GROUPS.map((muscle) => {
        const icon = getMuscleGroupIcon(muscle);
        return (
          <button
            key={muscle}
            onClick={() => onSelectMuscle(muscle)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-2",
              selectedMuscle === muscle
                ? "bg-primary text-primary-foreground shadow-energy"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {icon && (
              <img 
                src={icon} 
                alt={muscle}
                className={cn(
                  "w-5 h-5 object-contain",
                  selectedMuscle === muscle ? "brightness-0 invert" : ""
                )}
              />
            )}
            {muscle}
          </button>
        );
      })}
    </div>
  );
};