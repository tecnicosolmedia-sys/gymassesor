import { useState, useMemo } from 'react';
import { WorkoutSession, ExerciseSession } from '@/types/workoutHistory';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { MuscleFilterTabs } from './MuscleFilterTabs';
import { MuscleGroup } from '@/types/exercise';
import { 
  Calendar, 
  Clock, 
  Dumbbell, 
  ChevronDown, 
  ChevronUp, 
  Trash2,
  TrendingUp,
  X,
  Weight,
  BarChart3,
  ListTree,
  User,
  FileDown,
} from 'lucide-react';
import { exportSessionFromHistory } from '@/utils/exportWorkoutPDF';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getMuscleGroupIcon } from '@/lib/muscleGroupIcons';

interface WorkoutHistoryProps {
  sessions: WorkoutSession[];
  routineNames?: string[];
  onDeleteSession: (id: string) => void;
  onDeleteCompletedSet?: (sessionId: string, exerciseId: string, setNumber: number) => void | Promise<void>;
  onClose: () => void;
}

type ViewMode = 'routines' | 'exercises';

interface ExerciseHistoryEntry {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  entries: {
    sessionId: string;
    sessionDate: Date;
    routineName?: string;
    sets: ExerciseSession['completedSets'];
  }[];
}

export const WorkoutHistory = ({ sessions, routineNames: externalRoutineNames, onDeleteSession, onDeleteCompletedSet, onClose }: WorkoutHistoryProps) => {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<string | 'todas'>('todas');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | 'todas'>('todas');
  const [viewMode, setViewMode] = useState<ViewMode>('routines');
  const [chartExercise, setChartExercise] = useState<{ id: string; name: string } | null>(null);

  // Usar rutinas existentes si se proporcionan, si no extraer de sesiones
  const routineNames = useMemo(() => {
    if (externalRoutineNames && externalRoutineNames.length > 0) {
      return externalRoutineNames;
    }
    const names = new Set<string>();
    sessions.forEach(session => {
      if (session.routineName) {
        names.add(session.routineName);
      }
    });
    return Array.from(names);
  }, [sessions, externalRoutineNames]);

  // Filtrar sesiones por rutina y músculo
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];
    
    if (selectedRoutine !== 'todas') {
      filtered = filtered.filter(s => s.routineName === selectedRoutine);
    }

    if (selectedMuscle !== 'todas') {
      filtered = filtered.filter(s => 
        s.exercises.some(e => 
          e.muscleGroup.toLowerCase() === selectedMuscle.toLowerCase()
        )
      );
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedRoutine, selectedMuscle]);

  // Agrupar historial por ejercicio
  const exerciseHistory = useMemo(() => {
    const map = new Map<string, ExerciseHistoryEntry>();

    sessions.forEach(session => {
      session.exercises.forEach(ex => {
        if (selectedMuscle !== 'todas' && ex.muscleGroup.toLowerCase() !== selectedMuscle.toLowerCase()) {
          return;
        }

        if (!map.has(ex.exerciseId)) {
          map.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            muscleGroup: ex.muscleGroup,
            entries: [],
          });
        }

        map.get(ex.exerciseId)!.entries.push({
          sessionId: session.id,
          sessionDate: session.date,
          routineName: session.routineName,
          sets: ex.completedSets,
        });
      });
    });

    // Ordenar entries de cada ejercicio por fecha desc
    const result = Array.from(map.values());
    result.forEach(entry => {
      entry.entries.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
    });

    // Ordenar ejercicios por última fecha de realización
    result.sort((a, b) => {
      const aDate = a.entries[0]?.sessionDate ? new Date(a.entries[0].sessionDate).getTime() : 0;
      const bDate = b.entries[0]?.sessionDate ? new Date(b.entries[0].sessionDate).getTime() : 0;
      return bDate - aDate;
    });

    return result;
  }, [sessions, selectedMuscle]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  const getTotalWeight = (session: WorkoutSession) => {
    return session.exercises.reduce((total, exercise) => {
      return total + exercise.completedSets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0);
    }, 0);
  };

  const getTotalSets = (session: WorkoutSession) => {
    return session.exercises.reduce((total, exercise) => total + exercise.completedSets.length, 0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Historial</h1>
              <p className="text-sm text-muted-foreground">
                {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* View mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('routines')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
              viewMode === 'routines'
                ? "bg-primary text-primary-foreground shadow-energy"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <ListTree className="w-4 h-4" />
            Por Rutina
          </button>
          <button
            onClick={() => setViewMode('exercises')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
              viewMode === 'exercises'
                ? "bg-primary text-primary-foreground shadow-energy"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Dumbbell className="w-4 h-4" />
            Por Ejercicio
          </button>
        </div>

        {/* Muscle filter */}
        <div className="mb-4">
          <MuscleFilterTabs selectedMuscle={selectedMuscle} onSelectMuscle={setSelectedMuscle} />
        </div>

        {/* Routine filter (only in routine view) */}
        {viewMode === 'routines' && routineNames.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Filtrar por rutina:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRoutine('todas')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  selectedRoutine === 'todas'
                    ? "bg-primary text-primary-foreground shadow-energy"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                Todas
              </button>
              {routineNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedRoutine(name)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    selectedRoutine === name
                      ? "bg-primary text-primary-foreground shadow-energy"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* ========== ROUTINE VIEW ========== */}
        {viewMode === 'routines' && (
          <>
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Dumbbell className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">
                  {sessions.length === 0 ? 'Sin entrenamientos aún' : 'Sin resultados'}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {sessions.length === 0 
                    ? 'Completa series de ejercicios para ver tu historial aquí'
                    : 'No hay sesiones para los filtros seleccionados'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSessions.map((session, index) => (
                  <div 
                    key={session.id}
                    className={cn(
                      "rounded-2xl card-gradient border overflow-hidden",
                      index === 0 ? "border-primary/50 ring-2 ring-primary/20" : "border-border"
                    )}
                  >
                    {index === 0 && (
                      <div className="bg-primary/10 px-4 py-1.5 border-b border-primary/20">
                        <span className="text-xs font-medium text-primary">✨ Último entrenamiento</span>
                      </div>
                    )}
                    
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="font-display font-bold">
                              {format(new Date(session.date), "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                          </div>
                          {session.routineName && (
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                              {session.routineName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('¿Eliminar esta sesión del historial?')) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedSession === session.id ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(session.totalDuration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-3.5 h-3.5" />
                          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Weight className="w-3.5 h-3.5" />
                          {getTotalWeight(session)}kg
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {session.exercises.map((exercise, exIndex) => (
                          <div 
                            key={`${exercise.exerciseId}-${exIndex}`}
                            className="p-3 rounded-xl bg-secondary/30"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                  {getMuscleGroupIcon(exercise.muscleGroup) ? (
                                    <img 
                                      src={getMuscleGroupIcon(exercise.muscleGroup)!} 
                                      alt={exercise.muscleGroup}
                                      className="w-6 h-6 object-contain"
                                    />
                                  ) : (
                                    <Dumbbell className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{exercise.exerciseName}</p>
                                  <p className="text-xs text-muted-foreground">{exercise.muscleGroup}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setChartExercise({ id: exercise.exerciseId, name: exercise.exerciseName });
                                  }}
                                  className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Ver progresión"
                                >
                                  <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {exercise.completedSets.length} series
                                </span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {exercise.completedSets.map((set, setIndex) => (
                                <div 
                                  key={setIndex}
                                  className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-secondary/50 text-xs"
                                >
                                  <span className="font-medium text-muted-foreground">S{set.setNumber}</span>
                                  <span className="font-semibold">{set.reps}x{set.weight}kg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {expandedSession === session.id && (
                      <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-border pt-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-xl bg-secondary/30">
                            <p className="text-2xl font-lcd font-bold text-primary">{getTotalSets(session)}</p>
                            <p className="text-xs text-muted-foreground">Series totales</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-secondary/30">
                            <p className="text-2xl font-lcd font-bold text-primary">{session.exercises.length}</p>
                            <p className="text-xs text-muted-foreground">Ejercicios</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-secondary/30">
                            <p className="text-2xl font-lcd font-bold text-primary">{getTotalWeight(session)}</p>
                            <p className="text-xs text-muted-foreground">Kg totales</p>
                          </div>
                        </div>
                        <div className="text-center text-xs text-muted-foreground pt-2">
                          Inicio: {format(new Date(session.startedAt), 'HH:mm')} · 
                          Fin: {session.completedAt ? format(new Date(session.completedAt), 'HH:mm') : '--'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportSessionFromHistory(session);
                          }}
                          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
                        >
                          <FileDown className="w-4 h-4" />
                          Exportar a PDF
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ========== EXERCISE VIEW ========== */}
        {viewMode === 'exercises' && (
          <>
            {exerciseHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Dumbbell className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">Sin ejercicios registrados</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  No hay ejercicios para el músculo seleccionado
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {exerciseHistory.map((exHistory) => (
                  <div 
                    key={exHistory.exerciseId}
                    className="rounded-2xl card-gradient border border-border overflow-hidden"
                  >
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedExercise(expandedExercise === exHistory.exerciseId ? null : exHistory.exerciseId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center overflow-hidden">
                            {getMuscleGroupIcon(exHistory.muscleGroup) ? (
                              <img 
                                src={getMuscleGroupIcon(exHistory.muscleGroup)!} 
                                alt={exHistory.muscleGroup}
                                className="w-7 h-7 object-contain"
                              />
                            ) : (
                              <Dumbbell className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-display font-bold text-sm break-words hyphens-auto">{exHistory.exerciseName}</p>
                            <p className="text-xs text-muted-foreground">{exHistory.muscleGroup} · {exHistory.entries.length} sesión{exHistory.entries.length !== 1 ? 'es' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChartExercise({ id: exHistory.exerciseId, name: exHistory.exerciseName });
                            }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Ver progresión"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          {expandedExercise === exHistory.exerciseId ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedExercise === exHistory.exerciseId && (
                      <div className="px-4 pb-4 space-y-2 animate-fade-in border-t border-border pt-3">
                        {exHistory.entries.map((entry, idx) => (
                          <div key={`${entry.sessionId}-${idx}`} className="p-3 rounded-xl bg-secondary/30">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span className="text-xs font-medium">
                                  {format(new Date(entry.sessionDate), "d MMM yyyy", { locale: es })}
                                </span>
                              </div>
                              {entry.routineName && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {entry.routineName}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {entry.sets.map((set, setIdx) => (
                                <div 
                                  key={setIdx}
                                  className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-secondary/50 text-xs"
                                >
                                  <span className="font-medium text-muted-foreground">S{set.setNumber}</span>
                                  <span className="font-semibold">{set.reps}x{set.weight}kg</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chart modal */}
      {chartExercise && (
        <ExerciseProgressChart
          exerciseId={chartExercise.id}
          exerciseName={chartExercise.name}
          sessions={sessions}
          onClose={() => setChartExercise(null)}
          onDeleteSet={
            onDeleteCompletedSet
              ? (sessionId, setNumber) => onDeleteCompletedSet(sessionId, chartExercise.id, setNumber)
              : undefined
          }
        />
      )}
    </div>
  );
};
