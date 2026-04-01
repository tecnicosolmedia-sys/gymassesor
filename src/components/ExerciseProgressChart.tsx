import { WorkoutSession } from '@/types/workoutHistory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, X, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseProgressChartProps {
  exerciseId: string;
  exerciseName: string;
  sessions: WorkoutSession[];
  inline?: boolean;
  onClose?: () => void;
}

const SET_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning, 45 93% 47%))',
  'hsl(142 71% 45%)',
  'hsl(280 65% 60%)',
  'hsl(200 80% 50%)',
  'hsl(350 80% 55%)',
  'hsl(30 90% 55%)',
  'hsl(170 70% 45%)',
  'hsl(260 50% 50%)',
  'hsl(320 70% 50%)',
];

interface SetChartData {
  date: string;
  fullDate: string;
  weight: number;
}

export const ExerciseProgressChart = ({
  exerciseId,
  exerciseName,
  sessions,
  inline = false,
  onClose,
}: ExerciseProgressChartProps) => {
  // Sort sessions by date ascending
  const sortedSessions = [...sessions]
    .filter(s => s.exercises.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Build per-set data
  let maxSets = 0;
  const perSetData: Map<number, SetChartData[]> = new Map();

  sortedSessions.forEach(session => {
    const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
    if (!exercise || exercise.completedSets.length === 0) return;

    exercise.completedSets.forEach(set => {
      if (set.setNumber > maxSets) maxSets = set.setNumber;
      if (!perSetData.has(set.setNumber)) perSetData.set(set.setNumber, []);
      perSetData.get(set.setNumber)!.push({
        date: format(new Date(session.date), 'd MMM', { locale: es }),
        fullDate: format(new Date(session.date), "EEEE d 'de' MMMM", { locale: es }),
        weight: set.weight,
      });
    });
  });

  if (perSetData.size === 0) {
    const emptyContent = (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Sin datos de historial para este ejercicio</p>
      </div>
    );

    if (inline) return emptyContent;

    return (
      <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl card-gradient border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-lg">{exerciseName}</h3>
            {onClose && (
              <button onClick={onClose} className="p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {emptyContent}
        </div>
      </div>
    );
  }

  const setNumbers = Array.from({ length: maxSets }, (_, i) => i + 1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;
    return (
      <div className="rounded-xl border border-border bg-background px-3 py-2 shadow-xl text-xs">
        <p className="font-medium mb-1 capitalize">{fullDate}</p>
        <span className="font-semibold">{payload[0].value}kg</span>
      </div>
    );
  };

  const renderSetChart = (setNum: number) => {
    const data = perSetData.get(setNum) || [];
    if (data.length === 0) return null;
    const weights = data.map(d => d.weight);
    const uniqueWeights = [...new Set(weights)].sort((a, b) => a - b);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    const color = SET_COLORS[(setNum - 1) % SET_COLORS.length];

    // Tighten Y-axis to make progressions more visible
    const range = maxWeight - minWeight;
    const padding = range > 0 ? Math.max(range * 0.2, 1) : Math.max(maxWeight * 0.1, 2.5);
    const yMin = Math.max(0, Math.floor((minWeight - padding) * 2) / 2);
    const yMax = Math.ceil((maxWeight + padding) * 2) / 2;

    return (
      <div key={setNum} className="rounded-xl border border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold">Serie {setNum}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-bold">
            <TrendingUp className="w-3 h-3" />
            {maxWeight}kg
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
              width={35}
              unit="kg"
              domain={[yMin, yMax]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={maxWeight} stroke={color} strokeDasharray="3 3" opacity={0.5} />
            <Line
              type="monotone"
              dataKey="weight"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, fill: 'hsl(var(--background))' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const charts = (
    <div className="grid grid-cols-2 gap-2">
      {setNumbers.map(renderSetChart)}
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <BarChart3 className="w-4 h-4" />
          Progresión de peso
        </div>
        {charts}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl card-gradient border border-border p-4 my-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-lg">{exerciseName}</h3>
            <p className="text-xs text-muted-foreground">Progresión de peso por serie</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {charts}
        <p className="text-xs text-muted-foreground text-center mt-3">
          {sortedSessions.length} sesión{sortedSessions.length !== 1 ? 'es' : ''} registrada{sortedSessions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};
