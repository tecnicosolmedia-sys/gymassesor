import { WeekDay, WEEKDAYS } from '@/types/routine';
import { cn } from '@/lib/utils';

interface WeekTabsProps {
  selectedDay: WeekDay | 'all';
  onSelectDay: (day: WeekDay | 'all') => void;
}

export const WeekTabs = ({ selectedDay, onSelectDay }: WeekTabsProps) => {
  // Obtener el día actual
  const today = new Date().getDay();
  const todayMap: Record<number, WeekDay> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
  };
  const currentDay = todayMap[today];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSelectDay('all')}
        className={cn(
          "px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0",
          selectedDay === 'all'
            ? "bg-primary text-primary-foreground shadow-energy"
            : "bg-secondary text-muted-foreground hover:text-foreground"
        )}
      >
        Todas
      </button>
      {WEEKDAYS.map((weekday) => (
        <button
          key={weekday.key}
          onClick={() => onSelectDay(weekday.key)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 relative",
            selectedDay === weekday.key
              ? "bg-primary text-primary-foreground shadow-energy"
              : "bg-secondary text-muted-foreground hover:text-foreground",
            currentDay === weekday.key && selectedDay !== weekday.key && "ring-2 ring-primary/50"
          )}
        >
          {weekday.label}
          {currentDay === weekday.key && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
};
