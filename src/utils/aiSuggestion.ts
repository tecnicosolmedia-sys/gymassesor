import { SetConfig } from '@/types/exercise';
import { WorkoutSession } from '@/types/workoutHistory';
import { isWarmupSet } from './workoutStats';

/**
 * Helpers puros para la sugerencia IA de progresión.
 * Reglas:
 * - Solo se usan datos realmente registrados (carga, reps, descanso registrado, fechas).
 * - Los calentamientos (explícitos o por nombre) nunca entran en el digest.
 * - En unilaterales, reps es SIEMPRE el total de ambos lados: no se divide ni multiplica.
 */

export interface AIHistorySet {
  setNumber: number;
  reps: number;
  weight: number;
  /** Descanso REGISTRADO en la serie (valor guardado, no medición real) */
  restTime?: number;
}

export interface AIHistoryEntry {
  date: string; // YYYY-MM-DD
  sets: AIHistorySet[];
}

export interface AISetSuggestion {
  setNumber: number;
  reps: number;
  weight: number;
  restTime: number;
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

/** Descanso en pasos de 5 s, acotado a 15-600. */
export const roundRest5 = (n: number): number => {
  if (!Number.isFinite(n)) return 90;
  return Math.max(15, Math.min(600, Math.round(n / 5) * 5));
};

/** Límites conservadores de cambio respecto a la configuración actual. */
export const MAX_WEIGHT_DELTA_KG = 2.5;
export const MAX_REPS_DELTA = 2;
export const MAX_REST_DELTA_S = 30;

/** Rango permitido de descanso (pasos de 5 s) alrededor del descanso actual. */
const restBounds = (current: number) => {
  const cur = clampRest(Number.isFinite(current) ? current : 90);
  const lo = Math.max(15, Math.ceil((cur - MAX_REST_DELTA_S) / 5) * 5);
  const hi = Math.min(600, Math.floor((cur + MAX_REST_DELTA_S) / 5) * 5);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
};

const toDateValue = (d: Date | string): number => {
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Construye el digest de histórico para un ejercicio:
 * - ordena por fecha descendente
 * - reúne TODAS las apariciones del mismo exerciseId dentro de una sesión
 * - excluye calentamientos (explícitos o por nombre)
 * - incluye el descanso registrado cuando es un número finito
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
        const rest = strictNumber(cs.restTime);
        sets.push({
          setNumber: sets.length + 1,
          reps: cs.reps,
          weight: cs.weight,
          ...(rest !== undefined ? { restTime: rest } : {}),
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
 * - pasos de 0.5 kg, reps 1-99, descanso en pasos de 5 s (15-600)
 * - límites conservadores: ±2.5 kg, ±2 reps y ±30 s respecto a esa serie
 * - las series de calentamiento conservan EXACTAMENTE sus valores
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
    const curReps = clampReps(Number(cfg.reps));
    const curWeight = roundHalfKg(Number(cfg.weight));
    const curRest = clampRest(Number(cfg.restTime));

    // Los calentamientos no se modifican ni justifican progresión.
    if (cfg.isWarmup === true) {
      return { setNumber: cfg.setNumber, reps: curReps, weight: curWeight, restTime: curRest };
    }

    const candidate = bySetNumber.get(cfg.setNumber) ?? (usePositional ? list[idx] : undefined);
    const rawReps = strictNumber((candidate as any)?.reps);
    const rawWeight = strictNumber((candidate as any)?.weight);
    const rawRest = strictNumber((candidate as any)?.restTime);

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

    let restTime = curRest;
    if (rawRest !== undefined) {
      const { lo, hi } = restBounds(curRest);
      restTime = Math.max(lo, Math.min(hi, roundRest5(rawRest)));
    }

    return { setNumber: cfg.setNumber, reps, weight, restTime };
  });
};

/** Descanso global canonicalizado con fallback al actual. */
export const canonicalizeRest = (raw: unknown, currentRest?: number): number => {
  const n = strictNumber(raw);
  if (n !== undefined) return clampRest(n);
  const cur = strictNumber(currentRest);
  return clampRest(cur !== undefined ? cur : 90);
};

/**
 * Aplica la sugerencia canonicalizada a la configuración actual:
 * reemplaza weight/reps/restTime preservando setNumber e isWarmup.
 * Las series de calentamiento no se modifican.
 */
export const applySuggestionToConfigs = (
  currentConfig: SetConfig[],
  suggestions: AISetSuggestion[],
): SetConfig[] => {
  const canonical = canonicalizeSetSuggestions(currentConfig, suggestions);
  return (currentConfig ?? []).map((cfg, idx) => {
    if (cfg.isWarmup === true) return { ...cfg };
    const s = canonical[idx];
    if (!s) return { ...cfg };
    return { ...cfg, reps: s.reps, weight: s.weight, restTime: s.restTime };
  });
};

/** Firma estable de la configuración: detecta respuestas obsoletas. */
export const configSignature = (configs: SetConfig[], completedCount = 0): string =>
  `${completedCount}|${(configs ?? [])
    .map(c => `${c.setNumber}:${c.reps}:${c.weight}:${c.restTime}:${c.isWarmup === true ? 'w' : ''}`)
    .join(',')}`;

export interface SessionSetStateLike {
  exerciseId: string;
  instanceKey?: string;
  currentSet: number;
  completedSets: number[];
  /** Configuración aplicada SOLO a esta aparición del entrenamiento */
  sessionSetConfigs?: SetConfig[];
}

/**
 * Guarda la configuración de sesión de UNA sola aparición (instanceKey),
 * sin tocar el resto de apariciones del mismo exerciseId.
 * Retrocompatible: los estados antiguos sin instanceKey se conservan intactos.
 */
export const upsertSessionSetConfigs = <T extends SessionSetStateLike>(
  states: T[],
  instanceKey: string,
  exerciseId: string,
  configs: SetConfig[],
): T[] => {
  const list = states ?? [];
  const idx = list.findIndex(s => s.instanceKey === instanceKey);
  const clone = configs.map(c => ({ ...c }));
  if (idx >= 0) {
    const updated = [...list];
    updated[idx] = { ...list[idx], sessionSetConfigs: clone };
    return updated;
  }
  return [
    ...list,
    { instanceKey, exerciseId, currentSet: 1, completedSets: [], sessionSetConfigs: clone } as T,
  ];
};
