import { describe, it, expect } from 'vitest';
import {
  createStopwatch,
  computeElapsed,
  pauseStopwatch,
  resumeStopwatch,
  setStopwatchRunning,
  setStopwatchElapsed,
  parseTimeParts,
  resolveRestoredStopwatch,
  isStopwatchRunning,
} from '@/utils/stopwatch';

const T0 = 1_700_000_000_000;

describe('stopwatch: avance por reloj real', () => {
  it('avanza según el reloj, no por ticks', () => {
    const sw = createStopwatch(0, true, T0);
    expect(computeElapsed(sw, T0)).toBe(0);
    expect(computeElapsed(sw, T0 + 8 * 60_000)).toBe(480);
  });

  it('parte de un tiempo inicial restaurado', () => {
    const sw = createStopwatch(120, true, T0);
    expect(computeElapsed(sw, T0 + 30_000)).toBe(150);
  });
});

describe('stopwatch: pausa y reanudación', () => {
  it('congela el tiempo al pausar', () => {
    const sw = pauseStopwatch(createStopwatch(0, true, T0), T0 + 10_000);
    expect(isStopwatchRunning(sw)).toBe(false);
    expect(computeElapsed(sw, T0 + 10_000)).toBe(10);
    expect(computeElapsed(sw, T0 + 600_000)).toBe(10);
  });

  it('reanuda desde el tiempo congelado sin saltos', () => {
    const paused = pauseStopwatch(createStopwatch(0, true, T0), T0 + 10_000);
    const resumed = resumeStopwatch(paused, T0 + 600_000);
    expect(computeElapsed(resumed, T0 + 600_000)).toBe(10);
    expect(computeElapsed(resumed, T0 + 605_000)).toBe(15);
  });

  it('pausar o reanudar dos veces no cambia el estado (sin dobles cambios)', () => {
    const running = createStopwatch(0, true, T0);
    const once = pauseStopwatch(running, T0 + 5_000);
    const twice = pauseStopwatch(once, T0 + 50_000);
    expect(twice).toBe(once);
    const r1 = resumeStopwatch(once, T0 + 60_000);
    expect(resumeStopwatch(r1, T0 + 90_000)).toBe(r1);
  });

  it('setStopwatchRunning aplica el estado explícito', () => {
    const sw = createStopwatch(30, false, T0);
    const on = setStopwatchRunning(sw, true, T0);
    expect(isStopwatchRunning(on)).toBe(true);
    const off = setStopwatchRunning(on, false, T0 + 4_000);
    expect(computeElapsed(off, T0 + 100_000)).toBe(34);
  });
});

describe('stopwatch: edición del tiempo', () => {
  it('guarda el nuevo tiempo una sola vez estando pausado', () => {
    const paused = createStopwatch(100, false, T0);
    const edited = setStopwatchElapsed(paused, 3_600, T0);
    expect(isStopwatchRunning(edited)).toBe(false);
    expect(computeElapsed(edited, T0 + 60_000)).toBe(3_600);
  });

  it('conserva el estado corriendo tras editar', () => {
    const running = createStopwatch(100, true, T0);
    const edited = setStopwatchElapsed(running, 60, T0);
    expect(isStopwatchRunning(edited)).toBe(true);
    expect(computeElapsed(edited, T0 + 5_000)).toBe(65);
  });

  it('valida horas/minutos/segundos', () => {
    expect(parseTimeParts('1', '2', '3')).toBe(3_723);
    expect(parseTimeParts('', '', '')).toBe(0);
    expect(parseTimeParts('0', '59', '59')).toBe(3_599);
    expect(parseTimeParts('0', '60', '0')).toBeNull();
    expect(parseTimeParts('0', '0', '60')).toBeNull();
    expect(parseTimeParts('-1', '0', '0')).toBeNull();
    expect(parseTimeParts('abc', '0', '0')).toBeNull();
    expect(parseTimeParts('1.5', '0', '0')).toBeNull();
    expect(parseTimeParts(null, '0', '0')).toBeNull();
    expect(parseTimeParts(true, '0', '0')).toBeNull();
  });
});

describe('stopwatch: restauración de sesiones guardadas', () => {
  it('suma el tiempo real si estaba corriendo', () => {
    const saved = {
      elapsedTime: 600,
      stopwatchIsRunning: true,
      stopwatchUpdatedAt: new Date(T0).toISOString(),
    };
    const r = resolveRestoredStopwatch(saved, T0 + 300_000);
    expect(r).toEqual({ elapsedTime: 900, isRunning: true });
  });

  it('no suma nada si estaba pausado', () => {
    const saved = {
      elapsedTime: 600,
      stopwatchIsRunning: false,
      stopwatchUpdatedAt: new Date(T0).toISOString(),
    };
    const r = resolveRestoredStopwatch(saved, T0 + 3_600_000);
    expect(r).toEqual({ elapsedTime: 600, isRunning: false });
  });

  it('mantiene el comportamiento previo en guardados antiguos', () => {
    const r = resolveRestoredStopwatch({ elapsedTime: 450, savedAt: new Date(T0).toISOString() }, T0 + 900_000);
    expect(r).toEqual({ elapsedTime: 450, isRunning: true });
  });

  it('tolera datos inválidos o ausentes', () => {
    expect(resolveRestoredStopwatch(null, T0)).toEqual({ elapsedTime: 0, isRunning: true });
    expect(
      resolveRestoredStopwatch({ elapsedTime: -50, stopwatchIsRunning: true, stopwatchUpdatedAt: 'no-fecha' }, T0)
    ).toEqual({ elapsedTime: 0, isRunning: true });
  });

  it('no trunca intervalos largos (>12 h) al restaurar', () => {
    const saved = {
      elapsedTime: 60,
      stopwatchIsRunning: true,
      stopwatchUpdatedAt: new Date(T0).toISOString(),
    };
    const gapSeconds = 5 * 24 * 3600;
    const r = resolveRestoredStopwatch(saved, T0 + gapSeconds * 1000);
    expect(r.elapsedTime).toBe(60 + gapSeconds);
    const r13h = resolveRestoredStopwatch(saved, T0 + 13 * 3600 * 1000);
    expect(r13h.elapsedTime).toBe(60 + 13 * 3600);
  });

  it('ignora marcas temporales futuras (no resta tiempo)', () => {
    const saved = {
      elapsedTime: 300,
      stopwatchIsRunning: true,
      stopwatchUpdatedAt: new Date(T0 + 60_000).toISOString(),
    };
    expect(resolveRestoredStopwatch(saved, T0)).toEqual({ elapsedTime: 300, isRunning: true });
  });

  it('produce el mismo snapshot para el mismo guardado y momento (estable ante rerenders)', () => {
    const saved = {
      elapsedTime: 300,
      stopwatchIsRunning: false,
      stopwatchUpdatedAt: new Date(T0).toISOString(),
    };
    const first = resolveRestoredStopwatch(saved, T0 + 10_000);
    const rerender = resolveRestoredStopwatch(saved, T0 + 900_000);
    expect(first).toEqual({ elapsedTime: 300, isRunning: false });
    // Pausado: aunque se recalculara, nunca avanza
    expect(rerender).toEqual(first);
  });

  it('mantiene continuidad al cambiar de pantalla (mismo snapshot)', () => {
    const sw = createStopwatch(120, true, T0);
    const afterScreenChange = computeElapsed(sw, T0 + 45_000);
    expect(afterScreenChange).toBe(165);
    const restored = resolveRestoredStopwatch(
      { elapsedTime: afterScreenChange, stopwatchIsRunning: true, stopwatchUpdatedAt: new Date(T0 + 45_000).toISOString() },
      T0 + 45_000
    );
    expect(restored).toEqual({ elapsedTime: 165, isRunning: true });
  });
});
