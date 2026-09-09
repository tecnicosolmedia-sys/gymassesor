import { describe, it, expect } from 'vitest';
import {
  LM,
  angle2D,
  angle3D,
  classifyExercise,
  createRepCounter,
  createSmoother,
  createSpeechGate,
  elbowAngle,
  evaluateFeedback,
  getCoachConfig,
  isCoachAvailable,
  isVisible,
  pickSide,
  shoulderTilt,
  trunkLean,
  wristDrift,
  type Landmark,
} from '@/utils/poseCoach';

const REAL_NAMES: Array<[string, string]> = [
  ['CHEST PRESS TECHNOGYM', 'chest_press'],
  ['SHOULDER PRESS TECHNOGYM', 'shoulder_press'],
  ['PULL DOWN TECHNOGYM', 'pulldown'],
  ['Low Row Agarre ancho', 'row'],
  ['Remo unilateral neutro', 'row'],
  ['Triceps Ext 1l polea baja', 'triceps_extension'],
  ['Press inferior polea alta unilateral', 'unilateral_press'],
  ['LOWER BACK (Lumbar) TECHNOGYM', 'lower_back'],
];

describe('clasificación por nombre', () => {
  it.each(REAL_NAMES)('clasifica %s', (name, category) => {
    expect(classifyExercise(name)).toBe(category);
    expect(isCoachAvailable(name)).toBe(true);
  });

  it('ignora mayúsculas, acentos y espacios extra', () => {
    expect(classifyExercise('  chest   PRÉSS   technogym ')).toBe('chest_press');
    expect(classifyExercise('JALÓN al pecho')).toBe('pulldown');
  });

  it('excluye calentamientos', () => {
    expect(classifyExercise('Calentamiento')).toBeNull();
    expect(classifyExercise('calentamiento cinta 5 min')).toBeNull();
    expect(isCoachAvailable('CALENTAMIENTO')).toBe(false);
  });

  it('devuelve null para nombres desconocidos o vacíos', () => {
    expect(classifyExercise('Bicicleta estática')).toBeNull();
    expect(classifyExercise('')).toBeNull();
  });

  it('marca unilaterales como no bilaterales', () => {
    expect(getCoachConfig('Remo unilateral neutro')!.bilateral).toBe(false);
    expect(getCoachConfig('Triceps Ext 1l polea baja')!.bilateral).toBe(false);
    expect(getCoachConfig('Low Row Agarre ancho')!.bilateral).toBe(true);
  });
});

describe('geometría', () => {
  it('calcula ángulos de 90 y 180 grados', () => {
    expect(angle2D({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
    expect(angle2D({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5);
  });

  it('devuelve null con puntos degenerados o datos inválidos', () => {
    expect(angle2D({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(angle2D(undefined, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(angle2D({ x: NaN, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });

  it('angle3D cae a 2D si falta z', () => {
    expect(angle3D({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
    expect(
      angle3D({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }),
    ).toBeCloseTo(90, 5);
  });

  it('respeta la visibilidad mínima', () => {
    expect(isVisible({ x: 0, y: 0, visibility: 0.9 })).toBe(true);
    expect(isVisible({ x: 0, y: 0, visibility: 0.1 })).toBe(false);
    expect(isVisible(undefined)).toBe(false);
    expect(isVisible({ x: 0, y: 0 })).toBe(true);
  });
});

const buildPose = (over: Partial<Record<number, Landmark>> = {}): Landmark[] => {
  const base: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  base[LM.LEFT_SHOULDER] = { x: 0.4, y: 0.3, visibility: 0.9 };
  base[LM.RIGHT_SHOULDER] = { x: 0.6, y: 0.3, visibility: 0.9 };
  base[LM.LEFT_ELBOW] = { x: 0.4, y: 0.45, visibility: 0.9 };
  base[LM.RIGHT_ELBOW] = { x: 0.6, y: 0.45, visibility: 0.9 };
  base[LM.LEFT_WRIST] = { x: 0.4, y: 0.6, visibility: 0.9 };
  base[LM.RIGHT_WRIST] = { x: 0.6, y: 0.6, visibility: 0.9 };
  base[LM.LEFT_HIP] = { x: 0.42, y: 0.7, visibility: 0.9 };
  base[LM.RIGHT_HIP] = { x: 0.58, y: 0.7, visibility: 0.9 };
  Object.entries(over).forEach(([k, v]) => {
    base[Number(k)] = v as Landmark;
  });
  return base;
};

describe('métricas sobre landmarks', () => {
  it('brazo estirado da ~180 grados', () => {
    expect(elbowAngle(buildPose(), 'left')!).toBeCloseTo(180, 1);
  });

  it('devuelve null si falta visibilidad en la muñeca', () => {
    const pose = buildPose({ [LM.LEFT_WRIST]: { x: 0.4, y: 0.6, visibility: 0.1 } });
    expect(elbowAngle(pose, 'left')).toBeNull();
  });

  it('tronco vertical da inclinación ~0', () => {
    expect(trunkLean(buildPose())!).toBeCloseTo(0, 1);
  });

  it('detecta desalineación de muñeca y desnivel de hombros', () => {
    const drifted = buildPose({ [LM.LEFT_WRIST]: { x: 0.55, y: 0.6, visibility: 0.9 } });
    expect(wristDrift(drifted, 'left')!).toBeGreaterThan(0.5);
    const tilted = buildPose({ [LM.LEFT_SHOULDER]: { x: 0.4, y: 0.25, visibility: 0.9 } });
    expect(shoulderTilt(tilted)!).toBeGreaterThan(0.1);
  });

  it('elige el lado más visible', () => {
    const pose = buildPose({
      [LM.LEFT_WRIST]: { x: 0.4, y: 0.6, visibility: 0.1 },
      [LM.LEFT_ELBOW]: { x: 0.4, y: 0.45, visibility: 0.1 },
    });
    const config = getCoachConfig('CHEST PRESS TECHNOGYM')!;
    expect(pickSide(pose, config)).toBe('right');
  });
});

describe('contador de repeticiones', () => {
  const make = () =>
    createRepCounter({ extendedAngle: 160, flexedAngle: 90, minRange: 50, cooldownMs: 600 });

  const rep = (c: ReturnType<typeof make>, t: number, flexed = 80) => {
    c.update(170, t, 1);
    c.update(130, t + 100, 1);
    c.update(flexed, t + 200, 1);
    c.update(130, t + 300, 1);
    return c.update(170, t + 400, 1);
  };

  it('cuenta una repetición completa con histéresis', () => {
    const c = make();
    const r = rep(c, 1000);
    expect(r.counted).toBe(true);
    expect(r.reps).toBe(1);
    expect(r.phase).toBe('start');
  });

  it('no cuenta rebotes sin llegar a flexión', () => {
    const c = make();
    c.update(170, 0, 1);
    c.update(140, 100, 1);
    c.update(170, 200, 1);
    c.update(145, 300, 1);
    expect(c.reps).toBe(0);
  });

  it('rechaza recorridos insuficientes', () => {
    const c = createRepCounter({ extendedAngle: 160, flexedAngle: 120, minRange: 60, cooldownMs: 0 });
    c.update(170, 0, 1);
    c.update(118, 100, 1); // llega a flexión pero con recorrido de solo 52º
    const r = c.update(170, 200, 1);
    expect(r.counted).toBe(false);
    expect(r.rejected).toBe('range');
    expect(c.reps).toBe(0);
  });

  it('aplica cooldown entre repeticiones', () => {
    const c = make();
    rep(c, 0);
    const second = rep(c, 500); // termina en 900ms, < 600ms tras la primera (400ms)
    expect(second.rejected).toBe('cooldown');
    expect(c.reps).toBe(1);
  });

  it('ignora fotogramas de baja visibilidad y ángulos nulos', () => {
    const c = make();
    expect(c.update(null, 0, 1).rejected).toBe('visibility');
    expect(c.update(80, 100, 0.1).rejected).toBe('visibility');
    expect(c.reps).toBe(0);
  });

  it('reset vuelve al estado inicial', () => {
    const c = make();
    rep(c, 0);
    c.reset();
    expect(c.reps).toBe(0);
    expect(c.phase).toBe('start');
  });
});

describe('ciclo lumbar (driver por inclinación de tronco)', () => {
  const lb = getCoachConfig('LOWER BACK (Lumbar) TECHNOGYM')!;
  const make = () =>
    createRepCounter({
      extendedAngle: lb.extendedAngle,
      flexedAngle: lb.flexedAngle,
      minRange: lb.minRange,
      cooldownMs: 600,
    });

  it('define umbrales explícitos coherentes con trunkDriver', () => {
    expect(lb.extendedAngle).toBe(LOWER_BACK_EXTENDED);
    expect(lb.flexedAngle).toBe(LOWER_BACK_FLEXED);
    expect(lb.minRange).toBe(LOWER_BACK_MIN_RANGE);
    expect(trunkDriver(0)).toBe(180);
    expect(trunkDriver(45)).toBe(90);
    expect(trunkDriver(null)).toBeNull();
    expect(lb.extendedAngle).toBeGreaterThan(lb.flexedAngle);
  });

  it('un ciclo completo cuenta exactamente 1 repetición', () => {
    const c = make();
    c.update(trunkDriver(2), 0, 1); // erguido
    c.update(trunkDriver(20), 100, 1); // recorrido
    c.update(trunkDriver(40), 200, 1); // flexión
    c.update(trunkDriver(20), 300, 1);
    const r = c.update(trunkDriver(2), 400, 1); // vuelta a erguido
    expect(r.counted).toBe(true);
    expect(c.reps).toBe(1);
  });

  it('un recorrido insuficiente no cuenta', () => {
    const c = make();
    c.update(trunkDriver(2), 0, 1);
    c.update(trunkDriver(18), 100, 1); // no llega a flexión
    const r = c.update(trunkDriver(2), 200, 1);
    expect(r.counted).toBe(false);
    expect(c.reps).toBe(0);
  });

  it('baja visibilidad del torso no cuenta', () => {
    const c = make();
    const invisibleTorso = buildPose({
      [LM.LEFT_HIP]: { x: 0.42, y: 0.7, visibility: 0.05 },
      [LM.RIGHT_HIP]: { x: 0.58, y: 0.7, visibility: 0.05 },
      [LM.LEFT_SHOULDER]: { x: 0.4, y: 0.3, visibility: 0.05 },
      [LM.RIGHT_SHOULDER]: { x: 0.6, y: 0.3, visibility: 0.05 },
    });
    const vis = torsoVisibility(invisibleTorso);
    expect(vis).toBeLessThan(0.4);
    c.update(trunkDriver(2), 0, vis);
    c.update(trunkDriver(40), 100, vis);
    const r = c.update(trunkDriver(2), 200, vis);
    expect(r.rejected).toBe('visibility');
    expect(c.reps).toBe(0);
  });

  it('la visibilidad de torso no depende del brazo', () => {
    const noArm = buildPose({
      [LM.LEFT_WRIST]: { x: 0.4, y: 0.6, visibility: 0.05 },
      [LM.RIGHT_WRIST]: { x: 0.6, y: 0.6, visibility: 0.05 },
      [LM.LEFT_ELBOW]: { x: 0.4, y: 0.45, visibility: 0.05 },
      [LM.RIGHT_ELBOW]: { x: 0.6, y: 0.45, visibility: 0.05 },
    });
    expect(torsoVisibility(noArm)).toBeGreaterThan(0.8);
    expect(sideVisibility(noArm, 'left')).toBeLessThan(0.4);
  });
});

describe('suavizado', () => {
  it('promedia la ventana y mantiene el último valor con datos nulos', () => {
    const s = createSmoother(3);
    expect(s.push(10)).toBe(10);
    expect(s.push(20)).toBe(15);
    expect(s.push(null)).toBe(15);
    s.reset();
    expect(s.push(null)).toBeNull();
  });

  it('el contador no debe contar con el promedio antiguo si se pierde el brazo', () => {
    // El suavizado sirve para el feedback, pero el contador recibe el valor crudo.
    const s = createSmoother(5);
    const c = createRepCounter({ extendedAngle: 160, flexedAngle: 90, minRange: 50, cooldownMs: 0 });
    c.update(170, 0, 1);
    c.update(80, 100, 1);
    s.push(80);
    // Fotograma sin brazo: el smoother devuelve 80, pero el crudo es null.
    expect(s.push(null)).toBe(80);
    expect(c.update(null, 200, 1).rejected).toBe('visibility');
    expect(c.reps).toBe(0);
  });
});


describe('reglas de feedback', () => {
  const bi = getCoachConfig('CHEST PRESS TECHNOGYM')!;
  const uni = getCoachConfig('Press inferior polea alta unilateral')!;

  it('buena técnica cuando todo está en rango', () => {
    const r = evaluateFeedback({
      config: bi, side: 'left', elbow: 150, trunk: 5, drift: 0.1, tilt: 0.02,
      range: 60, phase: 'moving',
    });
    expect(r.quality).toBe('good');
    expect(r.qualityLabel).toBe('Correcto');
  });

  it('penaliza asimetría solo en bilaterales', () => {
    const shared = { side: 'left' as const, elbow: 150, trunk: 5, drift: 0.1, tilt: 0.3, range: 60, phase: 'moving' as const };
    expect(evaluateFeedback({ config: bi, ...shared }).quality).toBe('bad');
    expect(evaluateFeedback({ config: uni, ...shared }).quality).toBe('good');
  });

  it('avisa de impulso de tronco y muñeca desalineada', () => {
    expect(
      evaluateFeedback({ config: bi, side: 'left', elbow: 150, trunk: 45, drift: 0.1, tilt: 0.01, range: 60, phase: 'moving' }).quality,
    ).toBe('bad');
    expect(
      evaluateFeedback({ config: bi, side: 'left', elbow: 150, trunk: 5, drift: 0.6, tilt: 0.01, range: 60, phase: 'moving' }).quality,
    ).toBe('bad');
  });

  it('mensaje accionable cuando no ve el brazo', () => {
    const r = evaluateFeedback({ config: bi, side: 'left', elbow: null, trunk: 5, drift: null, tilt: null, range: 0, phase: 'start' });
    expect(r.quality).toBe('warn');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('lumbar se evalúa por inclinación del tronco', () => {
    const lb = getCoachConfig('LOWER BACK (Lumbar) TECHNOGYM')!;
    expect(evaluateFeedback({ config: lb, side: 'left', elbow: null, trunk: 70, drift: null, tilt: null, range: 30, phase: 'moving' }).quality).toBe('bad');
    expect(evaluateFeedback({ config: lb, side: 'left', elbow: null, trunk: 30, drift: null, tilt: null, range: 30, phase: 'moving' }).quality).toBe('good');
  });
});

describe('rate limit de voz', () => {
  it('respeta el mínimo de 4 s y no repite el mismo mensaje', () => {
    const gate = createSpeechGate(4000);
    expect(gate.allow('Nivela los hombros.', 0)).toBe(true);
    expect(gate.allow('Nivela los hombros.', 1000)).toBe(false);
    expect(gate.allow('Otro aviso.', 2000)).toBe(false);
    expect(gate.allow('Nivela los hombros.', 5000)).toBe(false);
    expect(gate.allow('Otro aviso.', 5000)).toBe(true);
    expect(gate.allow('', 20000)).toBe(false);
  });
});
