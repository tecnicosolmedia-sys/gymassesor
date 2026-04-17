import { useState } from 'react';
import { WorkoutSession } from '@/types/workoutHistory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, X, TrendingUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface ExerciseProgressChartProps {
  exerciseId: string;
  exerciseName: string;
  sessions: WorkoutSession[];
  inline?: boolean;
  onClose?: () => void;
  /** When provided, the tooltip shows a delete button to remove that specific set from history. */
  onDeleteSet?: (sessionId: string, setNumber: number) => void | Promise<void>;
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

type MetricMode = 'weight' | 'reps';

interface SetChartData {
  date: string;
  fullDate: string;
  weight: number;
  reps: number;
  sessionId: string;
  setNumber: number;
}

export const ExerciseProgressChart = ({
  exerciseId,
  exerciseName,
  sessions,
  inline = false,
  onClose,
  onDeleteSet,
}: ExerciseProgressChartProps) => {
  const [metric, setMetric] = useState<MetricMode>('weight');
  const [selectedPoint, setSelectedPoint] = useState<{ setNum: number; index: number } | null>(null);

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
        reps: set.reps,
        sessionId: session.id,
        setNumber: set.setNumber,
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
  const unit = metric === 'weight' ? 'kg' : 'reps';

  const CustomTooltip = ({ active, payload, label }: any) => {
    // Hide hover tooltip when a point is selected (we show our own modal popover instead)
    if (selectedPoint) return null;
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;
    return (
      <div className="rounded-xl border border-border bg-background px-3 py-2 shadow-xl text-xs">
        <p className="font-medium mb-1 capitalize">{fullDate}</p>
        <span className="font-semibold">{payload[0].value}{unit}</span>
        {onDeleteSet && (
          <p className="text-[9px] text-muted-foreground mt-1">Toca el punto para opciones</p>
        )}
      </div>
    );
  };

  const selectedData = selectedPoint
    ? perSetData.get(selectedPoint.setNum)?.[selectedPoint.index]
    : null;

  const metricToggle = (
    <div className="flex items-center gap-3 mb-2">
      <label
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={() => setMetric('weight')}
      >
        <Checkbox checked={metric === 'weight'} onCheckedChange={() => setMetric('weight')} />
        <span className={cn("text-xs font-medium", metric === 'weight' ? 'text-foreground' : 'text-muted-foreground')}>Peso</span>
      </label>
      <label
        className="flex items-center gap-1.5 cursor-pointer"
        onClick={() => setMetric('reps')}
      >
        <Checkbox checked={metric === 'reps'} onCheckedChange={() => setMetric('reps')} />
        <span className={cn("text-xs font-medium", metric === 'reps' ? 'text-foreground' : 'text-muted-foreground')}>Repeticiones</span>
      </label>
    </div>
  );

  const renderSetChart = (setNum: number) => {
    const data = perSetData.get(setNum) || [];
    if (data.length === 0) return null;
    const values = data.map(d => d[metric]);
    const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const color = SET_COLORS[(setNum - 1) % SET_COLORS.length];

    const range = maxVal - minVal;
    const padding = range > 0 ? Math.max(range * 0.2, 1) : Math.max(maxVal * 0.1, 2.5);
    const yMin = Math.max(0, Math.floor((minVal - padding) * 2) / 2);
    const yMax = Math.ceil((maxVal + padding) * 2) / 2;

    return (
      <div key={setNum} className="rounded-xl border border-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold">Serie {setNum}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-primary font-bold">
            <TrendingUp className="w-3 h-3" />
            {maxVal}{unit}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              tickLine={false}
              axisLine={false}
              width={30}
              domain={[yMin, yMax]}
              ticks={uniqueValues}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={maxVal} stroke={color} strokeDasharray="3 3" opacity={0.5} />
            <Line
              type="monotone"
              dataKey={metric}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <BarChart3 className="w-4 h-4" />
            Progresión
          </div>
          {metricToggle}
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
            <p className="text-xs text-muted-foreground">Progresión por serie</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {metricToggle}
        {charts}
        <p className="text-xs text-muted-foreground text-center mt-3">
          {sortedSessions.length} sesión{sortedSessions.length !== 1 ? 'es' : ''} registrada{sortedSessions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};
