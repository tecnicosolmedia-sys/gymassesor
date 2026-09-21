import { useState } from 'react';
import { SetConfig } from '@/types/exercise';
import { CheckCircle, Edit2, Dumbbell, Clock, ArrowRight, Minus, Plus, Undo2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExerciseProgressChart } from '@/components/ExerciseProgressChart';
import { WorkoutSession } from '@/types/workoutHistory';
import { getEffectiveConfigs, getVolume, formatReps, isWarmupSet } from '@/utils/workoutStats';
import { useExerciseAnalysis } from '@/hooks/useExerciseAnalysis';
import { ExerciseAnalysisDialog } from '@/components/ExerciseAnalysisDialog';
import { buildExerciseAnalysisDigest } from '@/utils/exerciseSessionAnalysis';
import { addSessionSet, normalizeSetConfigs, removeSessionSet } from '@/utils/sessionSetStructure';


interface ExerciseSummaryProps {
  exerciseName: string;
  exerciseId: string;
  muscleGroup: string;
  setConfigs: SetConfig[];
  completedSets: number[]; // indices of completed sets (1-based)
  /** El ejercicio se realiza por lado (las reps son el total de ambos lados) */
  isUnilateral?: boolean;
  /** Se renderiza dentro de otro contenedor (sin capa fija propia) */
  embedded?: boolean;
  onContinue: (updatedConfigs: SetConfig[], completedSets: number[]) => void;
  onGoBack?: () => void;
  historySessions?: WorkoutSession[];
  onDeleteCompletedSet?: (sessionId: string, exerciseId: string, setNumber: number) => void | Promise<void>;
}

export const ExerciseSummary = ({
  exerciseName,
  exerciseId,
  muscleGroup,
  setConfigs,
  completedSets,
  isUnilateral = false,
  embedded = false,
  onContinue,
  onGoBack,
  historySessions = [],
  onDeleteCompletedSet,
}: ExerciseSummaryProps) => {
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [localConfigs, setLocalConfigs] = useState<SetConfig[]>(() => normalizeSetConfigs(setConfigs));
  const [localCompletedSets, setLocalCompletedSets] = useState<number[]>(() => [...completedSets].sort((a, b) => a - b));
  const [recordsEditing, setRecordsEditing] = useState(false);
  const [editField, setEditField] = useState<'reps' | 'weight' | 'restTime' | null>(null);
  const [editValue, setEditValue] = useState('');

  const completedConfigs = localConfigs.filter((_, i) => localCompletedSets.includes(i + 1));
  // Las series de calentamiento no suman volumen ni series efectivas
  const effectiveConfigs = getEffectiveConfigs(exerciseName, completedConfigs);

  const totalKg = getVolume(effectiveConfigs);

  // Análisis IA opcional: solo en pantalla, nunca se guarda.
  const analysis = useExerciseAnalysis();

  const runAnalysis = () => {
    analysis.analyze(buildExerciseAnalysisDigest({
      exerciseId,
      exerciseName,
      muscleGroup,
      isUnilateral,
      configs: localConfigs,
      completedSets: localCompletedSets,
      sessions: historySessions,
    }));
  };

  const handleUpdateField = (index: number, field: 'reps' | 'weight' | 'restTime', delta: number) => {
    analysis.invalidate(); // cualquier corrección invalida el informe anterior
    setLocalConfigs(prev => prev.map((c, i) => {
      if (i !== index) return c;
      let newVal = c[field] + delta;
      if (field === 'reps') newVal = Math.max(1, Math.min(99, newVal));
      if (field === 'weight') newVal = Math.max(0, Math.min(999, Math.round(newVal * 2) / 2));
      if (field === 'restTime') newVal = Math.max(5, Math.min(600, Math.round(newVal)));
      return { ...c, [field]: newVal };
    }));
  };

  const handleDirectEdit = (index: number, field: 'reps' | 'weight' | 'restTime') => {
    setEditingSetIndex(index);
    setEditField(field);
    setEditValue(localConfigs[index][field].toString());
  };

  const handleDirectEditSubmit = () => {
    if (editingSetIndex === null || !editField) return;
    const numVal = parseFloat(editValue);
    if (!isNaN(numVal) && numVal >= 0) {
      analysis.invalidate(); // corrección posterior: exige volver a analizar
      setLocalConfigs(prev => prev.map((c, i) => {
        if (i !== editingSetIndex) return c;
        let val = numVal;
        if (editField === 'reps') val = Math.max(1, Math.min(99, Math.round(val)));
        if (editField === 'weight') val = Math.max(0, Math.min(999, Math.round(val * 2) / 2));
        if (editField === 'restTime') val = Math.max(5, Math.min(600, Math.round(val)));
        return { ...c, [editField]: val };
      }));
    }
    setEditingSetIndex(null);
    setEditField(null);
  };

  const handleAddSet = () => {
    analysis.invalidate();
    const nextNumber = localConfigs.length + 1;
    setLocalConfigs(prev => addSessionSet(prev));
    setLocalCompletedSets(prev => Array.from(new Set([...prev, nextNumber])).sort((a, b) => a - b));
    setRecordsEditing(true);
  };

  const handleRemoveSet = (index: number) => {
    if (localConfigs.length <= 1) return;
    if (!confirm(`¿Eliminar definitivamente la Serie ${index + 1} registrada en esta sesión?`)) return;
    analysis.invalidate();
    const { nextConfigs, nextCompletedSets } = removeSessionSet(localConfigs, localCompletedSets, Math.min(localConfigs.length, index + 1), index);
    setLocalConfigs(nextConfigs);
    setLocalCompletedSets(nextCompletedSets);
  };

  return (
    <div className={cn(
      embedded
        ? "w-full min-h-full bg-background flex items-start justify-center p-4"
        : "fixed inset-0 bg-background z-50 flex items-center justify-center p-4 overflow-y-auto"
    )}>
      <div className="w-full max-w-md py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-display font-bold text-2xl text-gradient-energy mb-1">
            {exerciseName}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
            {muscleGroup}
          </span>
          <p className="text-muted-foreground text-sm mt-2">
            {effectiveConfigs.length} series completadas · {totalKg.toLocaleString()} kg totales
            {completedConfigs.length > effectiveConfigs.length && (
              <> · {completedConfigs.length - effectiveConfigs.length} calentamiento</>
            )}

          </p>
        </div>

        {/* Set summary table */}
        <div className="rounded-2xl border border-border overflow-hidden mb-6">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-secondary/50 text-xs text-muted-foreground font-medium">
            <span>Serie</span>
            <span className="text-center">Reps</span>
            <span className="text-center">Peso (kg)</span>
            <span className="text-center">Descanso</span>
          </div>

          {/* Rows */}
          {localConfigs.map((config, index) => {
            const isCompleted = localCompletedSets.includes(index + 1);
            if (!isCompleted) return null;

            return (
              <div
                key={index}
                className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-border items-center"
              >
                {/* Set number */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  {isWarmupSet(exerciseName, config) && (
                    <span className="text-[9px] text-warning font-semibold">Cal.</span>
                  )}
                </div>


                {/* Reps - editable */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    disabled={!recordsEditing}
                    onClick={() => handleUpdateField(index, 'reps', -1)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className="font-lcd text-lg text-primary min-w-[2ch] text-center cursor-pointer"
                    onClick={() => recordsEditing && handleDirectEdit(index, 'reps')}
                  >
                    {config.reps}
                  </span>
                  {isUnilateral && (
                    <span className="text-[9px] text-muted-foreground ml-1">
                      {formatReps(true, config.reps)}
                    </span>
                  )}
                  <button
                    disabled={!recordsEditing}
                    onClick={() => handleUpdateField(index, 'reps', 1)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Weight - editable */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    disabled={!recordsEditing}
                    onClick={() => handleUpdateField(index, 'weight', -0.5)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span
                    className="font-lcd text-lg text-primary min-w-[3ch] text-center cursor-pointer"
                    onClick={() => recordsEditing && handleDirectEdit(index, 'weight')}
                  >
                    {config.weight}
                  </span>
                  <button
                    disabled={!recordsEditing}
                    onClick={() => handleUpdateField(index, 'weight', 0.5)}
                    className="w-6 h-6 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Rest time - read only */}
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                  {recordsEditing && (
                    <button onClick={() => handleUpdateField(index, 'restTime', -5)} className="w-5 h-5 rounded bg-secondary flex items-center justify-center" aria-label={`Reducir descanso serie ${index + 1}`}>
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                  <Clock className="w-3 h-3" />
                  <span onClick={() => recordsEditing && handleDirectEdit(index, 'restTime')} className={recordsEditing ? 'cursor-pointer text-primary font-lcd' : ''}>{config.restTime}s</span>
                  {recordsEditing && (
                    <button onClick={() => handleUpdateField(index, 'restTime', 5)} className="w-5 h-5 rounded bg-secondary flex items-center justify-center" aria-label={`Aumentar descanso serie ${index + 1}`}>
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                  {recordsEditing && (
                    <button onClick={() => handleRemoveSet(index)} className="w-6 h-6 rounded bg-destructive/10 text-destructive flex items-center justify-center ml-1" aria-label={`Eliminar serie ${index + 1}`}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress chart — includes current session data */}
        {(() => {
           const currentCompletedSetObjects = localCompletedSets.map(setNum => {
            const cfg = localConfigs[setNum - 1];
            return cfg ? {
              setNumber: setNum,
              reps: cfg.reps,
              weight: cfg.weight,
              restTime: cfg.restTime,
              isWarmup: cfg.isWarmup,

              completedAt: new Date(),
            } : null;
          }).filter(Boolean);

          const liveSession: WorkoutSession | null = currentCompletedSetObjects.length > 0 ? {
            id: 'live-session',
            date: new Date(),
            exercises: [{
              exerciseId,
              exerciseName,
              muscleGroup,
              completedSets: currentCompletedSetObjects as any,
              totalSets: localConfigs.length,
              startedAt: new Date(),
            }],
            totalDuration: 0,
            startedAt: new Date(),
            isComplete: false,
          } : null;

          const sessionsWithLive = liveSession
            ? [...historySessions, liveSession]
            : historySessions;

          return sessionsWithLive.length > 0 ? (
            <div className="mb-6">
              <ExerciseProgressChart
                exerciseId={exerciseId}
                exerciseName={exerciseName}
                sessions={sessionsWithLive}
                inline
                maxSetNumber={setConfigs.length}
                onDeleteSet={onDeleteCompletedSet ? (sId, sn) => onDeleteCompletedSet(sId, exerciseId, sn) : undefined}
              />
            </div>
          ) : null;
        })()}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            type="button"
            onClick={() => setRecordsEditing(v => !v)}
            className="py-3 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            {recordsEditing ? 'Terminar edición' : 'Editar registros'}
          </button>
          <button
            type="button"
            onClick={handleAddSet}
            className="py-3 rounded-xl bg-primary/10 text-primary font-semibold flex items-center justify-center gap-2 border border-primary/30"
          >
            <Plus className="w-4 h-4" />
            Añadir serie
          </button>
        </div>

        {/* Análisis IA opcional (solo en pantalla) */}
        <button
          onClick={runAnalysis}
          disabled={analysis.loading || effectiveConfigs.length === 0}
          aria-label="Analizar ejercicio con IA"
          className="w-full mb-3 py-3 rounded-xl border border-primary/40 bg-primary/10 text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/20 transition-all disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Analizar ejercicio con IA
        </button>

        {/* Action buttons */}
        <div className="flex gap-3">
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="flex-shrink-0 py-4 px-5 rounded-xl bg-secondary text-foreground font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
            >
              <Undo2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onContinue(normalizeSetConfigs(localConfigs), localCompletedSets)}
            className="flex-1 py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-energy"
          >
            Continuar
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Direct edit dialog */}
      <Dialog open={editingSetIndex !== null && editField !== null} onOpenChange={(open) => { if (!open) { setEditingSetIndex(null); setEditField(null); } }}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>
              Editar {editField === 'reps' ? 'Repeticiones' : editField === 'weight' ? 'Peso (kg)' : 'Descanso'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              step={editField === 'weight' ? '0.5' : '1'}
              min="0"
              className="text-center text-2xl font-lcd"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleDirectEditSubmit(); }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setEditingSetIndex(null); setEditField(null); }}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleDirectEditSubmit}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Informe IA: solo en memoria */}
      <ExerciseAnalysisDialog
        open={analysis.open}
        onOpenChange={analysis.setOpen}
        loading={analysis.loading}
        report={analysis.report}
        error={analysis.error}
        digest={analysis.digest}
        exerciseName={exerciseName}
        onRetry={runAnalysis}
      />
    </div>
  );
};
