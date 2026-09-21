import { SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { isWarmupSet } from './workoutStats';
import { AIHistoryEntry, buildAIHistory, strictNumber } from './aiSuggestion';

/**
 * Utilidades PURAS para el análisis IA de un ejercicio recién terminado.
 *
 * Reglas:
 * - Los calentamientos nunca entran en volumen, progresión ni récords.
 * - Volumen efectivo = suma(peso × reps) de las series efectivas.
 * - En unilaterales las reps almacenadas son el TOTAL de ambos lados: no se divide ni multiplica.
 * - El descanso es el "descanso registrado" (valor guardado), nunca una medición real.
 * - Los récords se detectan de forma determinista aquí: la IA NUNCA decide si existe récord.
 */

export interface AnalysisSet {
  setNumber: number;
  reps: number;
  weight: number;
  restTime?: number;
}

export interface SessionMetrics {
  /** Series efectivas (sin calentamiento) */
  setCount: number;
  /** Repeticiones totales efectivas (en unilateral siguen siendo totales de ambos lados) */
  totalReps: number;
  /** Volumen efectivo en kg */
  totalVolume: number;
  /** Carga máxima efectiva */
  maxWeight: number;
  /** Descanso registrado medio, si hay algún valor registrado */
  avgRest?: number;
  sets: AnalysisSet[];
}

export interface Delta {
  abs: number;
  /** Porcentaje solo cuando el divisor es > 0 */
  pct?: number;
}

export interface ExerciseAnalysisDigest {
  exerciseName: string;
  muscleGroup: string;
  isUnilateral: boolean;
  /** Fecha del análisis (YYYY-MM-DD) */
  analysisDate: string;
  today: SessionMetrics;
  previous: { date: string; metrics: SessionMetrics } | null;
  /** Mejores marcas históricas PREVIAS (sin la sesión actual) */
  previousBest: { maxWeight: number | null; bestVolume: number | null };
  /** Récords verificados matemáticamente */
  records: { newMaxWeight: boolean; newBestVolume: boolean };
  /** Diferencias frente a la sesión anterior (null si no hay anterior) */
  deltas: {
    maxWeight: Delta;
    totalReps: Delta;
    totalVolume: Delta;
    avgRest?: Delta;
  } | null;
  /** Nº de sesiones históricas válidas comparadas (máx. 10) */
  historySessionCount: number;
  history: AIHistoryEntry[];
  /** No hay histórico previo: es una sesión de referencia inicial */
  isFirstReference: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const delta = (current: number, previous: number): Delta => {
  const abs = round2(current - previous);
  if (previous > 0) return { abs, pct: round2(((current - previous) / previous) * 100) };
  return { abs };
};

/** Métricas de una lista de series efectivas ya filtradas. */
export const computeMetrics = (sets: AnalysisSet[]): SessionMetrics => {
  const valid = (sets ?? []).filter(
    s => Number.isFinite(s.reps) && Number.isFinite(s.weight),
  );
  const rests = valid
    .map(s => strictNumber(s.restTime))
    .filter((n): n is number => n !== undefined);

  return {
    setCount: valid.length,
    totalReps: valid.reduce((sum, s) => sum + s.reps, 0),
    totalVolume: round2(valid.reduce((sum, s) => sum + s.weight * s.reps, 0)),
    maxWeight: valid.reduce((max, s) => Math.max(max, s.weight), 0),
    ...(rests.length > 0
      ? { avgRest: Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) }
      : {}),
    sets: valid.map(s => ({ ...s })),
  };
};

/**
 * Fecha LOCAL del dispositivo en formato YYYY-MM-DD.
 * No usa toISOString() para no desplazar el día por la zona horaria.
 */
export const localDateString = (date: Date = new Date()): string => {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Series efectivas realmente completadas hoy, según localConfigs corregidos.
 * Conserva SIEMPRE el número de serie original (config.setNumber válido o
 * índice original + 1), también cuando se filtran calentamientos previos.
 */
export const getTodaySets = (
  exerciseName: string,
  configs: SetConfig[],
  completedSets: number[],
): AnalysisSet[] => {
  const done = new Set((completedSets ?? []).map(n => Math.round(n)));
  return (configs ?? [])
    .map((c, i) => {
      const sn = strictNumber(c?.setNumber);
      return {
        originalIndex: i,
        config: c,
        setNumber: sn !== undefined && Math.round(sn) >= 1 ? Math.round(sn) : i + 1,
      };
    })
    .filter(({ originalIndex }) => done.has(originalIndex + 1))
    .filter(({ config }) => !isWarmupSet(exerciseName, config))
    .map(({ config, setNumber }) => ({
      setNumber,
      reps: config.reps,
      weight: config.weight,
      restTime: config.restTime,
    }));
};

/**
 * Récords verificados matemáticamente a partir de las métricas de hoy y del
 * histórico PREVIO. Solo hay récord si existe histórico previo válido y hoy
 * lo supera estrictamente. La IA nunca decide esto.
 */
export const computeVerifiedRecords = (
  today: { setCount: number; maxWeight: number; totalVolume: number },
  previousBest: { maxWeight: number | null; bestVolume: number | null },
): { newMaxWeight: boolean; newBestVolume: boolean } => ({
  newMaxWeight:
    today.setCount > 0 &&
    previousBest.maxWeight !== null &&
    today.maxWeight > previousBest.maxWeight,
  newBestVolume:
    today.setCount > 0 &&
    previousBest.bestVolume !== null &&
    today.totalVolume > previousBest.bestVolume,
});

/**
 * Digest verificable para el análisis. Nunca mezcla la sesión actual dentro
 * del histórico previo y limita el histórico enviado a 10 sesiones válidas.
 */
export const buildExerciseAnalysisDigest = (params: {
  exerciseId: string;
  exerciseName: string;
  muscleGroup?: string;
  isUnilateral?: boolean;
  configs: SetConfig[];
  completedSets: number[];
  sessions: WorkoutSession[];
  now?: Date;
}): ExerciseAnalysisDigest => {
  const {
    exerciseId,
    exerciseName,
    muscleGroup = '',
    isUnilateral = false,
    configs,
    completedSets,
    sessions,
    now,
  } = params;

  const today = computeMetrics(getTodaySets(exerciseName, configs, completedSets));
  const history = buildAIHistory(exerciseId, sessions ?? [], 10); // más reciente primero

  const previousEntry = history[0] ?? null;
  const previous = previousEntry
    ? { date: previousEntry.date, metrics: computeMetrics(previousEntry.sets) }
    : null;

  let prevMaxWeight: number | null = null;
  let prevBestVolume: number | null = null;
  history.forEach(entry => {
    const m = computeMetrics(entry.sets);
    if (m.setCount === 0) return;
    prevMaxWeight = prevMaxWeight === null ? m.maxWeight : Math.max(prevMaxWeight, m.maxWeight);
    prevBestVolume = prevBestVolume === null ? m.totalVolume : Math.max(prevBestVolume, m.totalVolume);
  });

  const deltas = previous
    ? {
        maxWeight: delta(today.maxWeight, previous.metrics.maxWeight),
        totalReps: delta(today.totalReps, previous.metrics.totalReps),
        totalVolume: delta(today.totalVolume, previous.metrics.totalVolume),
        ...(today.avgRest !== undefined && previous.metrics.avgRest !== undefined
          ? { avgRest: delta(today.avgRest, previous.metrics.avgRest) }
          : {}),
      }
    : null;

  return {
    exerciseName,
    muscleGroup,
    isUnilateral: isUnilateral === true,
    analysisDate: localDateString(now ?? new Date()),
    today,
    previous,
    previousBest: { maxWeight: prevMaxWeight, bestVolume: prevBestVolume },
    records: computeVerifiedRecords(today, {
      maxWeight: prevMaxWeight,
      bestVolume: prevBestVolume,
    }),
    deltas,
    historySessionCount: history.length,
    history,
    isFirstReference: history.length === 0,
  };
};

/** Firma de los datos analizados: cualquier corrección posterior invalida el informe. */
export const analysisSignature = (
  configs: SetConfig[],
  completedSets: number[],
): string =>
  `${[...(completedSets ?? [])].sort((a, b) => a - b).join('-')}|${(configs ?? [])
    .map(c => `${c.setNumber}:${c.reps}:${c.weight}:${c.restTime}:${c.isWarmup === true ? 'w' : ''}`)
    .join(',')}`;
