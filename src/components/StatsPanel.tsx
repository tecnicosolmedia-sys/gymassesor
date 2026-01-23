import { Flame, Beef, Target, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
  totalCalories: number;
  proteinNeeded: number;
  exerciseCount: number;
}

export const StatsPanel = ({ totalCalories, proteinNeeded, exerciseCount }: StatsPanelProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="p-4 rounded-2xl card-gradient border border-border animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
            <Flame className="w-5 h-5 text-warning" />
          </div>
          <span className="text-sm text-muted-foreground">Calorías</span>
        </div>
        <p className="text-2xl font-display font-bold">{totalCalories}</p>
        <p className="text-xs text-muted-foreground">kcal estimadas</p>
      </div>
      
      <div className="p-4 rounded-2xl card-gradient border border-border animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
            <Beef className="w-5 h-5 text-success" />
          </div>
          <span className="text-sm text-muted-foreground">Proteína</span>
        </div>
        <p className="text-2xl font-display font-bold">{proteinNeeded}g</p>
        <p className="text-xs text-muted-foreground">recomendadas</p>
      </div>
      
      <div className="p-4 rounded-2xl card-gradient border border-border animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-info" />
          </div>
          <span className="text-sm text-muted-foreground">Ejercicios</span>
        </div>
        <p className="text-2xl font-display font-bold">{exerciseCount}</p>
        <p className="text-xs text-muted-foreground">en tu rutina</p>
      </div>
      
      <div className="p-4 rounded-2xl card-gradient border border-border animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground">Intensidad</span>
        </div>
        <p className="text-2xl font-display font-bold">
          {totalCalories > 200 ? 'Alta' : totalCalories > 100 ? 'Media' : 'Baja'}
        </p>
        <p className="text-xs text-muted-foreground">nivel estimado</p>
      </div>
    </div>
  );
};
