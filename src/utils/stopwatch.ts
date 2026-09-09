/**
 * Lógica pura del cronómetro general del entrenamiento.
 * Basada en marcas temporales reales (no en suma de ticks), para que el tiempo
 * sea exacto aunque la app pase a segundo plano o los intervalos se ralenticen.
 */

export interface StopwatchSnapshot {
  /** Tiempo acumulado en milisegundos mientras el cronómetro estuvo detenido. */
  baseMs: number;
  /** Marca temporal (ms) del último arranque, o null si está pausado. */
  startedAt: number | null;
}

/** Límite razonable al restaurar (12 h) para evitar valores absurdos. */
export const MAX_RESTORE_GAP_SECONDS = 12 * 3600;

export const sanitizeSeconds = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
};

export const createStopwatch = (
  elapsedSeconds = 0,
  running = false,
  now: number = Date.now()
): StopwatchSnapshot => ({
  baseMs: sanitizeSeconds(elapsedSeconds) * 1000,
  startedAt: running ? now : null,
});

/** Segundos transcurridos reales según el reloj. */
export const computeElapsed = (
  state: StopwatchSnapshot,
  now: number = Date.now()
): number => {
  const runMs = state.startedAt === null ? 0 : Math.max(0, now - state.startedAt);
  return Math.floor((state.baseMs + runMs) / 1000);
};

export const isStopwatchRunning = (state: StopwatchSnapshot): boolean =>
  state.startedAt !== null;

export const pauseStopwatch = (
  state: StopwatchSnapshot,
  now: number = Date.now()
): StopwatchSnapshot => {
  if (state.startedAt === null) return state;
  return {
    baseMs: state.baseMs + Math.max(0, now - state.startedAt),
    startedAt: null,
  };
};

export const resumeStopwatch = (
  state: StopwatchSnapshot,
  now: number = Date.now()
): StopwatchSnapshot => {
  if (state.startedAt !== null) return state;
  return { baseMs: state.baseMs, startedAt: now };
};

export const setStopwatchRunning = (
  state: StopwatchSnapshot,
  running: boolean,
  now: number = Date.now()
): StopwatchSnapshot => (running ? resumeStopwatch(state, now) : pauseStopwatch(state, now));

/** Fija el tiempo transcurrido conservando el estado corriendo/pausado. */
export const setStopwatchElapsed = (
  state: StopwatchSnapshot,
  seconds: number,
  now: number = Date.now()
): StopwatchSnapshot => ({
  baseMs: sanitizeSeconds(seconds) * 1000,
  startedAt: state.startedAt === null ? null : now,
});

/**
 * Valida y convierte los campos del diálogo de edición.
 * Devuelve null si hay NaN, negativos o minutos/segundos fuera de 0-59.
 */
export const parseTimeParts = (
  hours: unknown,
  minutes: unknown,
  seconds: unknown
): number | null => {
  const parse = (v: unknown): number | null => {
    if (typeof v === 'boolean' || v === null || v === undefined) return null;
    const raw = typeof v === 'string' ? v.trim() : v;
    if (raw === '') return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
    return n;
  };

  const h = parse(hours);
  const m = parse(minutes);
  const s = parse(seconds);
  if (h === null || m === null || s === null) return null;
  if (h > 99 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
};

export interface SavedStopwatchFields {
  elapsedTime?: number;
  stopwatchIsRunning?: boolean;
  stopwatchUpdatedAt?: string;
  savedAt?: string;
}

/**
 * Reconstruye el cronómetro desde un guardado.
 * - Guardados antiguos (sin campos nuevos): comportamiento previo, corriendo y sin sumar tiempo.
 * - Pausado: no suma nada.
 * - Corriendo: suma el tiempo real transcurrido desde la marca temporal.
 */
export const resolveRestoredStopwatch = (
  saved: SavedStopwatchFields | null | undefined,
  now: number = Date.now()
): { elapsedTime: number; isRunning: boolean } => {
  const base = sanitizeSeconds(saved?.elapsedTime);
  if (!saved || typeof saved.stopwatchIsRunning !== 'boolean') {
    return { elapsedTime: base, isRunning: true };
  }
  if (!saved.stopwatchIsRunning) {
    return { elapsedTime: base, isRunning: false };
  }
  const ts = Date.parse(saved.stopwatchUpdatedAt ?? saved.savedAt ?? '');
  if (!Number.isFinite(ts)) {
    return { elapsedTime: base, isRunning: true };
  }
  const gap = Math.min(
    MAX_RESTORE_GAP_SECONDS,
    Math.max(0, Math.floor((now - ts) / 1000))
  );
  return { elapsedTime: base + gap, isRunning: true };
};
