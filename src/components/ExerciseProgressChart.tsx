import { useState } from 'react';
import { WorkoutSession } from '@/types/workoutHistory';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExerciseProgressChartProps {
  exerciseId: string;
  exerciseName: string;
  sessions: WorkoutSession[];
  inline?: boolean; // If true, render without modal wrapper
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

export const ExerciseProgressChart = ({
  exerciseId,
  exerciseName,
  sessions,
  inline = false,
  onClose,
}: ExerciseProgressChartProps) => {
  // Extract data for this exercise across all sessions
  const chartData: { date: string; fullDate: string; [key: string]: number | string }[] = [];
  let maxSets = 0;

  // Sort sessions by date ascending
  const sortedSessions = [...sessions]
    .filter(s => s.exercises.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedSessions.forEach(session => {
    const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
    if (!exercise || exercise.completedSets.length === 0) return;

    const entry: { date: string; fullDate: string; [key: string]: number | string } = {
      date: format(new Date(session.date), 'd MMM', { locale: es }),
      fullDate: format(new Date(session.date), "EEEE d 'de' MMMM", { locale: es }),
    };

    exercise.completedSets.forEach(set => {
      entry[`Serie ${set.setNumber}`] = set.weight;
      if (set.setNumber > maxSets) maxSets = set.setNumber;
    });

    chartData.push(entry);
  });

  if (chartData.length === 0) {
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

  const setKeys = Array.from({ length: maxSets }, (_, i) => `Serie ${i + 1}`);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const fullDate = payload[0]?.payload?.fullDate || label;
    return (
      <div className="rounded-xl border border-border bg-background px-3 py-2 shadow-xl text-xs">
        <p className="font-medium mb-1 capitalize">{fullDate}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold">{p.value}kg</span>
          </div>
        ))}
      </div>
    );
  };

  const chart = (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--border))"
            unit="kg"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
          />
          {setKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SET_COLORS[i % SET_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <BarChart3 className="w-4 h-4" />
          Progresión de peso
        </div>
        {chart}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl card-gradient border border-border p-4">
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
        {chart}
        <p className="text-xs text-muted-foreground text-center mt-2">
          {chartData.length} sesión{chartData.length !== 1 ? 'es' : ''} registrada{chartData.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};
