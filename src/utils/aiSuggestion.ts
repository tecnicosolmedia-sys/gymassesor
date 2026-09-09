import { SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { isWarmupSet } from './workoutStats';

/**
 * Helpers puros para la sugerencia IA de progresión.
 * Reglas:
 * - Solo se usan datos realmente registrados (carga, reps, fechas).
 * - Los calentamientos (explícitos o por nombre) nunca entran en el digest.
 * - En unilaterales, reps es SIEMPRE el total de ambos lados: no se divide ni multiplica.
 */

export interface AIHistorySet {
  setNumber: number;
  reps: number;
  weight: number;
}

export interface AIHistoryEntry {
  date: string; // YYYY-MM-DD
  sets: AIHistorySet[];
}

export interface AISetSuggestion {
  setNumber: number;
  reps: number;
  weight: number;
}

/** Número finito estricto: rechaza null, undefined, '', booleanos y textos no numéricos. */
export const strictNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/** Peso en pasos de 0.5 kg, 0-999. */
export const roundHalfKg = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.round(n * 2) / 2));
};

/** Reps enteras entre 1 y 99. */
export const clampReps = (n: number): number => {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.round(n)));
};

/** Descanso entre 15 y 600 segundos. */
export const clampRest = (n: number): number => {
  if (!Number.isFinite(n)) return 90;
  return Math.max(15, Math.min(600, Math.round(n)));
};

/** Límites conservadores de cambio respecto a la configuración actual. */
export const MAX_WEIGHT_DELTA_KG = 5;
export const MAX_REPS_DELTA = 3;

const toDateValue = (d: Date | string): number => {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Construye el digest de histórico para un ejercicio:
 * - ordena por fecha descendente
 * - reúne TODAS las apariciones del mismo exerciseId dentro de una sesión
 * - excluye calentamientos (explícitos o por nombre)
 * - omite sesiones sin series efectivas
 * - devuelve como máximo las 10 sesiones más recientes
 * No muta ningún objeto de entrada.
 */
export const buildAIHistory = (
  exerciseId: string,
  sessions: WorkoutSession[],
  maxSessions = 10,
): AIHistoryEntry[] => {
  const entries: AIHistoryEntry[] = [];

  const sorted = [...(sessions ?? [])].sort(
    (a, b) => toDateValue(b.date) - toDateValue(a.date),
  );

  for (const session of sorted) {
    const appearances = (session.exercises ?? []).filter(e => e.exerciseId === exerciseId);
    if (appearances.length === 0) continue;

    const sets: AIHistorySet[] = [];
    appearances.forEach(app => {
      (app.completedSets ?? []).forEach(cs => {
        if (isWarmupSet(app.exerciseName, cs)) return;
        if (!Number.isFinite(cs.reps) || !Number.isFinite(cs.weight)) return;
        sets.push({
          setNumber: sets.length + 1,
          reps: cs.reps,
          weight: cs.weight,
        });
      });
    });

    if (sets.length === 0) continue;

    entries.push({
      date: new Date(session.date).toISOString().slice(0, 10),
      sets,
    });

    if (entries.length >= maxSessions) break;
  }

  return entries;
};

/**
 * Canonicaliza la salida del modelo:
 * - exactamente una sugerencia por serie actual, en el mismo orden y setNumber
 * - descarta duplicados, faltantes, NaN e infinitos
 * - aplica pasos de 0.5 kg, reps 1-99 y límites conservadores de cambio
 * - fallback seguro: la configuración actual (nunca ceros ni tabla vacía)
 */
export const canonicalizeSetSuggestions = (
  currentConfig: SetConfig[],
  raw: unknown,
): AISetSuggestion[] => {
  const list = Array.isArray(raw) ? raw : [];
  const bySetNumber = new Map<number, any>();
  list.forEach(item => {
    const n = strictNumber((item as any)?.setNumber);
    if (n === undefined) return;
    const key = Math.round(n);
    if (!bySetNumber.has(key)) bySetNumber.set(key, item); // primer valor gana, duplicados descartados
  });
  // Solo se usa la posición cuando ninguna entrada trae setNumber utilizable.
  const usePositional = bySetNumber.size === 0;

  return (currentConfig ?? []).map((cfg, idx) => {
    const candidate = bySetNumber.get(cfg.setNumber) ?? (usePositional ? list[idx] : undefined);
    const curReps = clampReps(Number(cfg.reps));
    const curWeight = roundHalfKg(Number(cfg.weight));

    const rawReps = strictNumber((candidate as any)?.reps);
    const rawWeight = strictNumber((candidate as any)?.weight);

    const reps = rawReps !== undefined
      ? Math.max(
          clampReps(curReps - MAX_REPS_DELTA),
          Math.min(clampReps(curReps + MAX_REPS_DELTA), clampReps(rawReps)),
        )
      : curReps;

    const weight = rawWeight !== undefined
      ? Math.max(
          roundHalfKg(Math.max(0, curWeight - MAX_WEIGHT_DELTA_KG)),
          Math.min(roundHalfKg(curWeight + MAX_WEIGHT_DELTA_KG), roundHalfKg(rawWeight)),
        )
      : curWeight;

    return { setNumber: cfg.setNumber, reps, weight };
  });
};

/** Descanso canonicalizado con fallback al actual. */
export const canonicalizeRest = (raw: unknown, currentRest?: number): number => {
  const n = strictNumber(raw);
  if (n !== undefined) return clampRest(n);
  const cur = strictNumber(currentRest);
  return clampRest(cur !== undefined ? cur : 90);
};
