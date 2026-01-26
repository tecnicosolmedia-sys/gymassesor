import { useState } from 'react';
import { WorkoutSession, ExerciseSession } from '@/types/workoutHistory';
import { 
  Calendar, 
  Clock, 
  Dumbbell, 
  ChevronDown, 
  ChevronUp, 
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkoutHistoryProps {
  sessions: WorkoutSession[];
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export const WorkoutHistory = ({ sessions, onDeleteSession, onClose }: WorkoutHistoryProps) => {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  const getTotalWeight = (exercise: ExerciseSession) => {
    return exercise.completedSets.reduce((total, set) => total + (set.weight * set.reps), 0);
  };

  const getMaxWeight = (exercise: ExerciseSession) => {
    return Math.max(...exercise.completedSets.map(s => s.weight));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl">Historial de Entrenamientos</h1>
              <p className="text-sm text-muted-foreground">
                {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} registrada{sessions.length !== 1 ? 's' : ''}
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
        
        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Dumbbell className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Sin entrenamientos aún</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Completa series de ejercicios para ver tu historial de entrenamientos aquí
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div 
                key={session.id}
                className="rounded-2xl card-gradient border border-border overflow-hidden"
              >
                {/* Session header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-display font-bold">
                          {format(new Date(session.date), "EEEE, d 'de' MMMM", { locale: es })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(session.totalDuration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Dumbbell className="w-3.5 h-3.5" />
                          {session.exercises.length} ejercicio{session.exercises.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {session.routineName && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
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
                </div>
                
                {/* Expanded content */}
                {expandedSession === session.id && (
                  <div className="px-4 pb-4 space-y-3 animate-fade-in">
                    {session.exercises.map((exercise, exIndex) => (
                      <div 
                        key={`${exercise.exerciseId}-${exIndex}`}
                        className="rounded-xl bg-secondary/30 overflow-hidden"
                      >
                        {/* Exercise header */}
                        <div 
                          className="p-3 cursor-pointer flex items-center justify-between"
                          onClick={() => setExpandedExercise(
                            expandedExercise === `${session.id}-${exercise.exerciseId}` 
                              ? null 
                              : `${session.id}-${exercise.exerciseId}`
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                              <Dumbbell className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{exercise.exerciseName}</p>
                              <p className="text-xs text-muted-foreground">
                                {exercise.muscleGroup} · {exercise.completedSets.length}/{exercise.totalSets} series · Max: {getMaxWeight(exercise)}kg
                              </p>
                            </div>
                          </div>
                          
                          {expandedExercise === `${session.id}-${exercise.exerciseId}` ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        {/* Sets detail */}
                        {expandedExercise === `${session.id}-${exercise.exerciseId}` && (
                          <div className="px-3 pb-3 space-y-2 animate-fade-in">
                            {exercise.completedSets.map((set, setIndex) => (
                              <div 
                                key={setIndex}
                                className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                              >
                                <span className="text-sm font-medium">Serie {set.setNumber}</span>
                                <div className="flex items-center gap-4 text-sm">
                                  <span>{set.reps} reps</span>
                                  <span className="font-semibold text-primary">{set.weight}kg</span>
                                  <span className="text-muted-foreground text-xs">
                                    {format(new Date(set.completedAt), 'HH:mm')}
                                  </span>
                                </div>
                              </div>
                            ))}
                            
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground text-right">
                                Volumen total: <span className="font-semibold text-foreground">{getTotalWeight(exercise)}kg</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
