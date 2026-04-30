import { useMemo, useState } from 'react';
import { WorkoutSession } from '@/types/workoutHistory';
import { Trophy, Calendar, Dumbbell, Crown, Flame, X } from 'lucide-react';
import { MUSCLE_GROUPS, MuscleGroup } from '@/types/exercise';
import { cn } from '@/lib/utils';

interface PersonalRecordsViewProps {
  sessions: WorkoutSession[];
  onClose: () => void;
}

interface RecordEntry {
  date: Date;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  weight: number;
  reps: number;
  type: 'all-time' | 'session';
  previous: number; // récord histórico previo (0 si no había)
}

export const PersonalRecordsView = ({ sessions, onClose }: PersonalRecordsViewProps) => {
  const [filter, setFilter] = useState<'all' | 'all-time' | 'session'>('all');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'todos'>('todos');

  // Calcular todos los récords (totales y de sesión) cronológicamente
  const records = useMemo<RecordEntry[]>(() => {
    // Ordenar sesiones cronológicamente ASC para detectar récords en orden
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const allTimeMax: Record<string, number> = {};
    const result: RecordEntry[] = [];

    for (const session of sorted) {
      // Aplanar sets de la sesión por orden cronológico
      const setsInSession: Array<{
        exerciseId: string;
        exerciseName: string;
        muscleGroup: string;
        weight: number;
        reps: number;
        completedAt: Date;
      }> = [];

      session.exercises.forEach((ex) => {
        ex.completedSets.forEach((s) => {
          setsInSession.push({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            weight: s.weight,
            reps: s.reps,
            completedAt: new Date(s.completedAt),
          });
        });
      });

      setsInSession.sort(
        (a, b) => a.completedAt.getTime() - b.completedAt.getTime()
      );

      // Por cada sesión llevamos también el máximo de sesión por ejercicio
      const sessionMax: Record<string, number> = {};

      for (const s of setsInSession) {
        if (s.weight <= 0) continue;
        const prevAllTime = allTimeMax[s.exerciseId] ?? 0;
        const prevSession = sessionMax[s.exerciseId] ?? 0;

        if (prevAllTime > 0 && s.weight > prevAllTime) {
          result.push({
            date: s.completedAt,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName,
            muscleGroup: s.muscleGroup,
            weight: s.weight,
            reps: s.reps,
            type: 'all-time',
            previous: prevAllTime,
          });
        } else if (prevAllTime > 0 && s.weight === prevAllTime && prevSession < s.weight) {
          // Igualó el récord histórico dentro de la sesión: récord de sesión
          result.push({
            date: s.completedAt,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName,
            muscleGroup: s.muscleGroup,
            weight: s.weight,
            reps: s.reps,
            type: 'session',
            previous: prevSession,
          });
        } else if (prevAllTime === 0) {
          // Primera vez con peso > 0: récord total inicial
          result.push({
            date: s.completedAt,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName,
            muscleGroup: s.muscleGroup,
            weight: s.weight,
            reps: s.reps,
            type: 'all-time',
            previous: 0,
          });
        } else if (s.weight > prevSession && s.weight < prevAllTime) {
          // Mejor de la sesión sin batir el histórico
          result.push({
            date: s.completedAt,
            exerciseId: s.exerciseId,
            exerciseName: s.exerciseName,
            muscleGroup: s.muscleGroup,
            weight: s.weight,
            reps: s.reps,
            type: 'session',
            previous: prevSession,
          });
        }

        if (s.weight > prevSession) sessionMax[s.exerciseId] = s.weight;
        if (s.weight > prevAllTime) allTimeMax[s.exerciseId] = s.weight;
      }
    }

    // Más recientes primero
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sessions]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter !== 'all' && r.type !== filter) return false;
      if (muscleFilter !== 'todos' && r.muscleGroup !== muscleFilter) return false;
      return true;
    });
  }, [records, filter, muscleFilter]);

  // Récords totales actuales por ejercicio
  const topRecords = useMemo(() => {
    const map = new Map<string, RecordEntry>();
    records
      .filter((r) => r.type === 'all-time')
      .forEach((r) => {
        const existing = map.get(r.exerciseId);
        if (!existing || r.weight > existing.weight) map.set(r.exerciseId, r);
      });
    return Array.from(map.values()).sort((a, b) => b.weight - a.weight);
  }, [records]);

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary drop-shadow-[0_0_10px_hsl(var(--primary))]" />
            <h1 className="font-display font-bold text-xl">Récords Personales</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Top récords actuales */}
        {topRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Mejores Marcas</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topRecords.slice(0, 6).map((r) => (
                <div
                  key={r.exerciseId}
                  className="rounded-xl border border-primary/30 bg-gradient-to-br from-secondary/40 to-primary/5 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-primary font-medium truncate">
                        {r.muscleGroup}
                      </p>
                      <p className="font-semibold text-sm break-words leading-tight">
                        {r.exerciseName}
                      </p>
                    </div>
                    <div
                      className="text-2xl font-bold text-primary whitespace-nowrap"
                      style={{ fontFamily: 'Orbitron, monospace' }}
                    >
                      {r.weight} kg
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    × {r.reps} reps · {r.date.toLocaleDateString('es-ES')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filtros */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'all-time', 'session'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'all-time' ? 'Récord total' : 'Récord de sesión'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setMuscleFilter('todos')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition',
                muscleFilter === 'todos'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              Todos
            </button>
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setMuscleFilter(g)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition',
                  muscleFilter === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        {/* Lista cronológica */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-lg">Historial de Récords</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} {filtered.length === 1 ? 'récord' : 'récords'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl card-gradient border border-border">
              <Trophy className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                Aún no hay récords registrados.
                <br />
                ¡Completa entrenamientos para empezar a marcarlos!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r, i) => (
                <div
                  key={`${r.exerciseId}-${r.date.getTime()}-${i}`}
                  className={cn(
                    'rounded-xl border p-3 flex items-center gap-3',
                    r.type === 'all-time'
                      ? 'border-primary/40 bg-gradient-to-r from-primary/10 to-transparent'
                      : 'border-border bg-secondary/30'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                      r.type === 'all-time' ? 'bg-primary/20' : 'bg-secondary'
                    )}
                  >
                    {r.type === 'all-time' ? (
                      <Crown className="w-5 h-5 text-primary" />
                    ) : (
                      <Trophy className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold',
                          r.type === 'all-time'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground'
                        )}
                      >
                        {r.type === 'all-time' ? 'Récord total' : 'Récord de sesión'}
                      </span>
                      <span className="text-[11px] text-primary font-medium">
                        {r.muscleGroup}
                      </span>
                    </div>
                    <p className="font-semibold text-sm break-words leading-tight mt-0.5">
                      {r.exerciseName}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {r.date.toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell className="w-3 h-3" />
                        {r.reps} reps
                      </span>
                      {r.previous > 0 && (
                        <span>antes: {r.previous} kg</span>
                      )}
                    </div>
                  </div>

                  <div
                    className="text-xl font-bold text-primary whitespace-nowrap"
                    style={{ fontFamily: 'Orbitron, monospace' }}
                  >
                    {r.weight} kg
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
