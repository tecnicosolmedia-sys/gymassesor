/**
 * Motor de análisis técnico (entrenador virtual) — 100% puro, determinista y testeable.
 *
 * Privacidad: este módulo solo recibe landmarks ya calculados en el dispositivo.
 * No hace red, no persiste nada, no depende del DOM.
 */

import { normalizeName, isWarmupExerciseName } from '@/utils/workoutStats';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Índices MediaPipe Pose (BlazePose 33). */
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
} as const;

export type ExerciseCategory =
  | 'chest_press'
  | 'shoulder_press'
  | 'pulldown'
  | 'row'
  | 'triceps_extension'
  | 'unilateral_press'
  | 'lower_back';

export type Side = 'left' | 'right' | 'auto';
export type Plane = 'frontal' | 'lateral';
export type Quality = 'good' | 'warn' | 'bad';
export type Phase = 'start' | 'moving' | 'end';

export interface ExerciseCoachConfig {
  category: ExerciseCategory;
  label: string;
  /** Lado a analizar: 'auto' elige el de mayor visibilidad/movimiento. */
  side: Side;
  plane: Plane;
  bilateral: boolean;
  /** Colocación recomendada de la cámara (texto para el usuario). */
  placement: string;
  /** Ángulo de codo (grados) considerado "extensión" del movimiento. */
  extendedAngle: number;
  /** Ángulo de codo (grados) considerado "flexión" del movimiento. */
  flexedAngle: number;
  /** Rango mínimo (grados) para validar una repetición completa. */
  minRange: number;
  /** Inclinación máxima del tronco respecto a la vertical (grados). */
  maxTrunkLean: number;
  /** Desalineación máxima muñeca-codo (fracción del ancho de hombros). */
  maxWristDrift: number;
  /** Asimetría máxima de hombros (fracción del ancho de hombros). */
  maxShoulderTilt: number;
}

/* ------------------------------------------------------------------ */
/* Clasificación por nombre                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_RULES: Array<{ test: (n: string) => boolean; category: ExerciseCategory }> = [
  { test: n => n.includes('chest press'), category: 'chest_press' },
  { test: n => n.includes('shoulder press'), category: 'shoulder_press' },
  { test: n => n.includes('pull down') || n.includes('pulldown') || n.includes('jalon'), category: 'pulldown' },
  { test: n => n.includes('lower back') || n.includes('lumbar'), category: 'lower_back' },
  {
    test: n => n.includes('triceps') || n.includes('tricep') || n.includes('ext 1l'),
    category: 'triceps_extension',
  },
  {
    test: n =>
      (n.includes('press') && (n.includes('unilateral') || n.includes('1l'))) ||
      (n.includes('press') && n.includes('polea')),
    category: 'unilateral_press',
  },
  { test: n => n.includes('row') || n.includes('remo'), category: 'row' },
];

/** Clasifica un ejercicio por su nombre normalizado. `null` si no es compatible. */
export const classifyExercise = (name: string): ExerciseCategory | null => {
  if (isWarmupExerciseName(name)) return null;
  const n = normalizeName(name);
  if (!n) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.test(n)) return rule.category;
  }
  return null;
};

const BASE: Omit<ExerciseCoachConfig, 'category' | 'label' | 'side' | 'plane' | 'bilateral' | 'placement'> = {
  extendedAngle: 160,
  flexedAngle: 90,
  minRange: 45,
  maxTrunkLean: 20,
  maxWristDrift: 0.35,
  maxShoulderTilt: 0.12,
};

/* ------------------------------------------------------------------ */
/* Lumbar: driver explícito por inclinación de tronco                  */
/* ------------------------------------------------------------------ */

/**
 * Convierte la inclinación del tronco (grados respecto a la vertical) en un
 * "driver" con la misma escala que un ángulo articular, para reutilizar la
 * máquina de estados: 180 = erguido, valores menores = más flexión.
 */
export const trunkDriver = (lean: number | null): number | null => {
  if (lean === null || !Number.isFinite(lean)) return null;
  return 180 - Math.max(0, lean) * 2;
};

/** Umbral de extensión del lumbar (tronco erguido, lean <= ~7.5º). */
export const LOWER_BACK_EXTENDED = 165;
/** Umbral de flexión del lumbar (lean >= ~35º). */
export const LOWER_BACK_FLEXED = 110;
/** Rango mínimo del driver lumbar (~20º reales de tronco). */
export const LOWER_BACK_MIN_RANGE = 40;

const CONFIGS: Record<ExerciseCategory, ExerciseCoachConfig> = {

  chest_press: {
    ...BASE,
    category: 'chest_press',
    label: 'Press de pecho',
    side: 'auto',
    plane: 'lateral',
    bilateral: true,
    placement: 'Cámara lateral o a 45º, torso y brazos visibles, a 2–3 m.',
    extendedAngle: 160,
    flexedAngle: 85,
    minRange: 50,
  },
  shoulder_press: {
    ...BASE,
    category: 'shoulder_press',
    label: 'Press de hombro',
    side: 'auto',
    plane: 'frontal',
    bilateral: true,
    placement: 'Cámara frontal, cuerpo superior completo visible, a 2–3 m.',
    extendedAngle: 165,
    flexedAngle: 80,
    minRange: 55,
    maxTrunkLean: 15,
  },
  pulldown: {
    ...BASE,
    category: 'pulldown',
    label: 'Jalón / Pull down',
    side: 'auto',
    plane: 'frontal',
    bilateral: true,
    placement: 'Cámara frontal, brazos y cabeza visibles, a 2–3 m.',
    extendedAngle: 165,
    flexedAngle: 75,
    minRange: 60,
    maxTrunkLean: 25,
  },
  row: {
    ...BASE,
    category: 'row',
    label: 'Remo',
    side: 'auto',
    plane: 'lateral',
    bilateral: true,
    placement: 'Cámara lateral o a 45º, espalda y brazos visibles, a 2–3 m.',
    extendedAngle: 155,
    flexedAngle: 75,
    minRange: 50,
    maxTrunkLean: 25,
  },
  triceps_extension: {
    ...BASE,
    category: 'triceps_extension',
    label: 'Extensión de tríceps',
    side: 'auto',
    plane: 'lateral',
    bilateral: false,
    placement: 'Cámara lateral, codo y muñeca del lado que trabajas visibles, a 2–3 m.',
    extendedAngle: 160,
    flexedAngle: 70,
    minRange: 55,
    maxTrunkLean: 18,
  },
  unilateral_press: {
    ...BASE,
    category: 'unilateral_press',
    label: 'Press unilateral',
    side: 'auto',
    plane: 'lateral',
    bilateral: false,
    placement: 'Cámara lateral o a 45º del lado que trabajas, a 2–3 m.',
    extendedAngle: 160,
    flexedAngle: 85,
    minRange: 50,
    maxTrunkLean: 20,
  },
  lower_back: {
    ...BASE,
    category: 'lower_back',
    label: 'Lumbar',
    side: 'auto',
    plane: 'lateral',
    bilateral: true,
    placement: 'Cámara lateral, tronco y caderas visibles, a 2–3 m.',
    // El lumbar no se mide por el codo: el "driver" del contador es
    // trunkDriver(inclinación del tronco) = 180 - 2 * lean, de modo que:
    //   tronco erguido (lean ~0º)   -> driver ~180 (extensión)
    //   tronco flexionado (lean 45º) -> driver ~90  (flexión)
    // Umbrales explícitos y coherentes con ese driver:
    extendedAngle: LOWER_BACK_EXTENDED, // lean <= ~7.5º (con histéresis)
    flexedAngle: LOWER_BACK_FLEXED, // lean >= ~35º
    minRange: LOWER_BACK_MIN_RANGE, // ~20º reales de tronco
    maxTrunkLean: 90,
  },
};


/** ¿El nombre indica trabajo unilateral? (no se exige simetría). */
export const isUnilateralName = (name: string): boolean => {
  const n = normalizeName(name);
  return n.includes('unilateral') || /\b1l\b/.test(n) || n.includes('1 lado');
};

export const getCoachConfig = (name: string): ExerciseCoachConfig | null => {
  const category = classifyExercise(name);
  if (!category) return null;
  const base = CONFIGS[category];
  if (base.bilateral && isUnilateralName(name)) {
    return { ...base, bilateral: false, plane: 'lateral' };
  }
  return base;
};

export const isCoachAvailable = (name: string): boolean => getCoachConfig(name) !== null;

/* ------------------------------------------------------------------ */
/* Geometría                                                           */
/* ------------------------------------------------------------------ */

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isVisible = (lm: Landmark | undefined | null, min = 0.5): boolean => {
  if (!lm || !finite(lm.x) || !finite(lm.y)) return false;
  if (lm.visibility === undefined) return true;
  return finite(lm.visibility) && lm.visibility >= min;
};

/** Ángulo ABC en grados (2D). `null` si faltan datos o los puntos son degenerados. */
export const angle2D = (
  a?: Landmark | null,
  b?: Landmark | null,
  c?: Landmark | null,
): number | null => {
  if (!a || !b || !c) return null;
  for (const p of [a, b, c]) if (!finite(p.x) || !finite(p.y)) return null;
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu < 1e-6 || nv < 1e-6) return null;
  let cos = (ux * vx + uy * vy) / (nu * nv);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
};

/** Ángulo ABC en grados (3D si hay z en los tres puntos, si no cae a 2D). */
export const angle3D = (
  a?: Landmark | null,
  b?: Landmark | null,
  c?: Landmark | null,
): number | null => {
  if (!a || !b || !c) return null;
  if (!finite(a.z) || !finite(b.z) || !finite(c.z)) return angle2D(a, b, c);
  const ux = a.x - b.x, uy = a.y - b.y, uz = (a.z as number) - (b.z as number);
  const vx = c.x - b.x, vy = c.y - b.y, vz = (c.z as number) - (b.z as number);
  const nu = Math.hypot(ux, uy, uz);
  const nv = Math.hypot(vx, vy, vz);
  if (nu < 1e-6 || nv < 1e-6) return null;
  let cos = (ux * vx + uy * vy + uz * vz) / (nu * nv);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
};

/** Inclinación del tronco respecto a la vertical, en grados. */
export const trunkLean = (landmarks: Landmark[]): number | null => {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  const lh = landmarks[LM.LEFT_HIP];
  const rh = landmarks[LM.RIGHT_HIP];
  const shoulders = [ls, rs].filter(p => isVisible(p, 0.3));
  const hips = [lh, rh].filter(p => isVisible(p, 0.3));
  if (shoulders.length === 0 || hips.length === 0) return null;
  const sx = shoulders.reduce((s, p) => s + p.x, 0) / shoulders.length;
  const sy = shoulders.reduce((s, p) => s + p.y, 0) / shoulders.length;
  const hx = hips.reduce((s, p) => s + p.x, 0) / hips.length;
  const hy = hips.reduce((s, p) => s + p.y, 0) / hips.length;
  const dx = sx - hx;
  const dy = sy - hy;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
};

export const shoulderWidth = (landmarks: Landmark[]): number | null => {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  if (!isVisible(ls, 0.3) || !isVisible(rs, 0.3)) return null;
  const w = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  return w > 1e-3 ? w : null;
};

export const elbowAngle = (landmarks: Landmark[], side: 'left' | 'right'): number | null => {
  const s = side === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const e = side === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
  const w = side === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
  if (!isVisible(landmarks[s]) || !isVisible(landmarks[e]) || !isVisible(landmarks[w])) return null;
  return angle2D(landmarks[s], landmarks[e], landmarks[w]);
};

/** Visibilidad media del torso (hombros + caderas). Usada en lumbar. */
export const torsoVisibility = (landmarks: Landmark[]): number => {
  const idx = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  let sum = 0;
  for (const i of idx) {
    const lm = landmarks[i];
    if (!lm || !finite(lm.x) || !finite(lm.y)) continue;
    sum += lm.visibility === undefined ? 1 : finite(lm.visibility) ? lm.visibility : 0;
  }
  return sum / idx.length;
};

export const sideVisibility = (landmarks: Landmark[], side: 'left' | 'right'): number => {

  const idx =
    side === 'left'
      ? [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST]
      : [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST];
  let sum = 0;
  for (const i of idx) {
    const lm = landmarks[i];
    if (!lm || !finite(lm.x) || !finite(lm.y)) continue;
    sum += lm.visibility === undefined ? 1 : finite(lm.visibility) ? lm.visibility : 0;
  }
  return sum / idx.length;
};

/** Elige el lado a analizar: visibilidad y, en empate, mayor movimiento acumulado. */
export const pickSide = (
  landmarks: Landmark[],
  config: ExerciseCoachConfig,
  movement?: { left: number; right: number },
): 'left' | 'right' => {
  if (config.side === 'left' || config.side === 'right') return config.side;
  const l = sideVisibility(landmarks, 'left');
  const r = sideVisibility(landmarks, 'right');
  if (Math.abs(l - r) > 0.1) return l > r ? 'left' : 'right';
  if (movement && Math.abs(movement.left - movement.right) > 1) {
    return movement.left > movement.right ? 'left' : 'right';
  }
  return l >= r ? 'left' : 'right';
};

/** Desalineación muñeca-codo, normalizada por el ancho de hombros. */
export const wristDrift = (
  landmarks: Landmark[],
  side: 'left' | 'right',
): number | null => {
  const e = landmarks[side === 'left' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW];
  const w = landmarks[side === 'left' ? LM.LEFT_WRIST : LM.RIGHT_WRIST];
  const width = shoulderWidth(landmarks);
  if (!isVisible(e) || !isVisible(w) || width === null) return null;
  return Math.abs(w.x - e.x) / width;
};

/** Asimetría vertical de hombros, normalizada por el ancho de hombros. */
export const shoulderTilt = (landmarks: Landmark[]): number | null => {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  const width = shoulderWidth(landmarks);
  if (!isVisible(ls, 0.3) || !isVisible(rs, 0.3) || width === null) return null;
  return Math.abs(ls.y - rs.y) / width;
};

/* ------------------------------------------------------------------ */
/* Suavizado                                                           */
/* ------------------------------------------------------------------ */

export const createSmoother = (size = 5) => {
  const buf: number[] = [];
  return {
    push(value: number | null): number | null {
      if (value === null || !finite(value)) return buf.length ? avg(buf) : null;
      buf.push(value);
      if (buf.length > size) buf.shift();
      return avg(buf);
    },
    reset() {
      buf.length = 0;
    },
  };
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/* ------------------------------------------------------------------ */
/* Máquina de estados de repeticiones (con histéresis)                 */
/* ------------------------------------------------------------------ */

export interface RepCounterOptions {
  extendedAngle: number;
  flexedAngle: number;
  minRange: number;
  /** Histéresis en grados aplicada a los dos umbrales. */
  hysteresis?: number;
  /** Tiempo mínimo entre repeticiones válidas (ms). */
  cooldownMs?: number;
  /** Visibilidad mínima del lado analizado. */
  minVisibility?: number;
}

export interface RepUpdate {
  reps: number;
  phase: Phase;
  counted: boolean;
  /** Rango recorrido en el ciclo en curso (grados). */
  range: number;
  /** Motivo por el que no se contó, si aplica. */
  rejected?: 'cooldown' | 'range' | 'visibility';
}

export const createRepCounter = (opts: RepCounterOptions) => {
  const hyst = opts.hysteresis ?? 8;
  const cooldown = opts.cooldownMs ?? 600;
  const minVis = opts.minVisibility ?? 0.4;

  let reps = 0;
  let phase: Phase = 'start';
  let minAngle = Infinity;
  let maxAngle = -Infinity;
  let lastRepAt = -Infinity;
  let lastRange = 0;
  let reachedFlexion = false;

  return {
    update(angle: number | null, timeMs: number, visibility = 1): RepUpdate {
      if (angle === null || !finite(angle)) {
        return { reps, phase, counted: false, range: lastRange, rejected: 'visibility' };
      }
      if (visibility < minVis) {
        return { reps, phase, counted: false, range: lastRange, rejected: 'visibility' };
      }

      minAngle = Math.min(minAngle, angle);
      maxAngle = Math.max(maxAngle, angle);

      const extendedIn = angle >= opts.extendedAngle - hyst;
      const flexedIn = angle <= opts.flexedAngle + hyst;

      let counted = false;
      let rejected: RepUpdate['rejected'];

      if (extendedIn) {
        // Vuelta a extensión: cierra el ciclo si realmente se pasó por flexión.
        if (reachedFlexion) {
          const range = maxAngle - minAngle;
          lastRange = range;
          if (range < opts.minRange) {
            rejected = 'range';
          } else if (timeMs - lastRepAt < cooldown) {
            rejected = 'cooldown';
          } else {
            reps += 1;
            counted = true;
            lastRepAt = timeMs;
          }
        }
        // Sin flexión previa es un rebote: se descarta el ciclo.
        reachedFlexion = false;
        phase = 'start';
        minAngle = angle;
        maxAngle = angle;
      } else if (flexedIn) {
        reachedFlexion = true;
        phase = 'end';
        lastRange = maxAngle - minAngle;
      } else {
        phase = 'moving';
      }

      return { reps, phase, counted, range: lastRange, rejected };
    },
    reset() {
      reps = 0;
      phase = 'start';
      minAngle = Infinity;
      maxAngle = -Infinity;
      lastRepAt = -Infinity;
      lastRange = 0;
      reachedFlexion = false;
    },
    get reps() {
      return reps;
    },
    get phase() {
      return phase;
    },
  };
};

/* ------------------------------------------------------------------ */
/* Reglas de feedback                                                  */
/* ------------------------------------------------------------------ */

export interface FeedbackInput {
  config: ExerciseCoachConfig;
  side: 'left' | 'right';
  elbow: number | null;
  trunk: number | null;
  drift: number | null;
  tilt: number | null;
  range: number;
  phase: Phase;
}

export interface FeedbackResult {
  quality: Quality;
  /** Mensaje breve y accionable (nunca vacío). */
  message: string;
  /** Etiqueta textual de la calidad, para no depender solo del color. */
  qualityLabel: string;
}

const QUALITY_LABEL: Record<Quality, string> = {
  good: 'Correcto',
  warn: 'Mejorable',
  bad: 'Corrige',
};

export const evaluateFeedback = (input: FeedbackInput): FeedbackResult => {
  const { config, elbow, trunk, drift, tilt, range, phase } = input;

  if (config.category === 'lower_back') {
    if (trunk === null) {
      return build('warn', 'Colócate de lado para ver el tronco completo.');
    }
    if (trunk > 55) return build('bad', 'No hiperextiendas: sube con control.');
    if (trunk < 8 && phase !== 'start') return build('warn', 'Amplía el recorrido del tronco.');
    return build('good', 'Buen control lumbar.');
  }

  if (elbow === null) {
    return build('warn', 'No veo bien el brazo: ajusta el encuadre.');
  }

  if (trunk !== null && trunk > config.maxTrunkLean + 10) {
    return build('bad', 'Estás usando impulso del tronco: estabiliza la espalda.');
  }
  if (drift !== null && drift > config.maxWristDrift + 0.15) {
    return build('bad', 'Alinea la muñeca con el codo.');
  }
  if (config.bilateral && tilt !== null && tilt > config.maxShoulderTilt + 0.06) {
    return build('bad', 'Hombros descompensados: empuja por igual con los dos lados.');
  }

  if (trunk !== null && trunk > config.maxTrunkLean) {
    return build('warn', 'Reduce la inclinación del tronco.');
  }
  if (drift !== null && drift > config.maxWristDrift) {
    return build('warn', 'Cuida la muñeca: mantenla sobre el codo.');
  }
  if (config.bilateral && tilt !== null && tilt > config.maxShoulderTilt) {
    return build('warn', 'Nivela los hombros.');
  }
  if (phase === 'start' && range > 0 && range < config.minRange) {
    return build('warn', 'Recorrido corto: baja o estira algo más.');
  }

  return build('good', 'Buena técnica, mantén el ritmo.');
};

const build = (quality: Quality, message: string): FeedbackResult => ({
  quality,
  message,
  qualityLabel: QUALITY_LABEL[quality],
});

/* ------------------------------------------------------------------ */
/* Rate limit de voz                                                   */
/* ------------------------------------------------------------------ */

/** Limita mensajes hablados: mínimo `minIntervalMs` y sin repetir el mismo texto seguido. */
export const createSpeechGate = (minIntervalMs = 4000) => {
  let lastAt = -Infinity;
  let lastMessage = '';
  return {
    allow(message: string, nowMs: number): boolean {
      if (!message) return false;
      if (message === lastMessage && nowMs - lastAt < minIntervalMs * 2) return false;
      if (nowMs - lastAt < minIntervalMs) return false;
      lastAt = nowMs;
      lastMessage = message;
      return true;
    },
    reset() {
      lastAt = -Infinity;
      lastMessage = '';
    },
  };
};

/** Conexiones de esqueleto (subconjunto de cuerpo superior) para el overlay. */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
];
