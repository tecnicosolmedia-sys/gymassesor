import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtualCoach } from '@/components/VirtualCoach';

/**
 * Pruebas de ciclo de vida con getUserMedia simulado:
 * - se detienen todos los tracks al cerrar/desmontar y también si falla la carga,
 * - fallback de GPU a CPU,
 * - una inicialización obsoleta no deja stream ni detector vivos,
 * - no hay persistencia en localStorage ni peticiones de red.
 */

const vision = vi.hoisted(() => ({
  forVisionTasks: vi.fn(async () => ({})),
  createFromOptions: vi.fn(async (_f: unknown, _o: unknown) => ({
    detectForVideo: vi.fn(() => ({ landmarks: [] })),
    close: vi.fn(),
  })),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: (...a: unknown[]) => vision.forVisionTasks(...(a as [])) },
  PoseLandmarker: {
    createFromOptions: (...a: unknown[]) =>
      vision.createFromOptions(...(a as unknown as [unknown, unknown])),
  },
}));

const makeStream = () => {
  const stop = vi.fn();
  const track = { stop, kind: 'video' } as unknown as MediaStreamTrack;
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, stop };
};

let fetchSpy: ReturnType<typeof vi.spyOn>;
let setItemSpy: ReturnType<typeof vi.spyOn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;
let closeMock: ReturnType<typeof vi.fn>;

const setMediaDevices = (impl: unknown) =>
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: impl });

beforeEach(() => {
  closeMock = vi.fn();
  vision.forVisionTasks.mockReset().mockImplementation(async () => ({}));
  vision.createFromOptions.mockReset().mockImplementation(async () => ({
    detectForVideo: vi.fn(() => ({ landmarks: [] })),
    close: closeMock,
  }));

  const { stream, stop } = makeStream();
  stopTrack = stop;
  getUserMedia = vi.fn(async () => stream);
  setMediaDevices({ getUserMedia });

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: vi.fn(), cancel: vi.fn() },
  });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    class { constructor(public text: string) {} lang = ''; };
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockImplementation(
    (() => Promise.reject(new Error('no debe haber red'))) as never,
  );
  setItemSpy = vi.spyOn(window.localStorage, 'setItem');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VirtualCoach', () => {
  it('no pide cámara hasta pulsar "Iniciar cámara"', async () => {
    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={() => {}} />);
    expect(screen.getByText(/Privacidad/i)).toBeTruthy();
    expect(getUserMedia).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  });

  it('detiene los tracks al cerrar y no persiste ni usa red', async () => {
    const onClose = vi.fn();
    render(<VirtualCoach exerciseName="PULL DOWN TECHNOGYM" onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(vision.createFromOptions).toHaveBeenCalled());

    await userEvent.click(screen.getByLabelText('Cerrar entrenador virtual'));
    expect(stopTrack).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('detiene los tracks al desmontar', async () => {
    const { unmount } = render(<VirtualCoach exerciseName="Low Row Agarre ancho" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    act(() => unmount());
    expect(stopTrack).toHaveBeenCalled();
  });

  it('indica que no está disponible para calentamientos', () => {
    render(<VirtualCoach exerciseName="Calentamiento cinta" onClose={() => {}} />);
    expect(screen.getByText(/no está disponible/i)).toBeTruthy();
    expect(screen.queryByLabelText('Iniciar cámara')).toBeNull();
  });

  it('informa si el navegador no admite cámara', async () => {
    setMediaDevices({});
    render(<VirtualCoach exerciseName="SHOULDER PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no admite/i));
  });

  it('si falla la carga del modelo detiene las pistas y muestra error', async () => {
    vision.forVisionTasks.mockRejectedValue(new Error('wasm KO'));
    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No se pudo iniciar/i));
    expect(stopTrack).toHaveBeenCalled();
  });

  it('si falla el landmarker parcial lo cierra y libera la cámara', async () => {
    vision.createFromOptions.mockRejectedValue(new Error('modelo KO'));
    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No se pudo iniciar/i));
    expect(stopTrack).toHaveBeenCalled();
    // Se intentó GPU y luego CPU antes de rendirse.
    expect(vision.createFromOptions).toHaveBeenCalledTimes(2);
  });

  it('si falla la GPU reintenta en CPU', async () => {
    vision.createFromOptions.mockImplementation(async (_f: unknown, opts: any) => {
      if (opts.baseOptions.delegate === 'GPU') throw new Error('sin WebGL');
      return { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: closeMock };
    });
    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));

    await waitFor(() => expect(vision.createFromOptions).toHaveBeenCalledTimes(2));
    expect((vision.createFromOptions.mock.calls[1][1] as any).baseOptions.delegate).toBe('CPU');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una inicialización obsoleta detiene su propio stream y detector', async () => {
    const first = makeStream();
    let release: (() => void) | null = null;
    getUserMedia = vi.fn(async () => {
      await new Promise<void>(res => {
        release = res;
      });
      return first.stream;
    });
    setMediaDevices({ getUserMedia });

    const onClose = vi.fn();
    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={onClose} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    // Cierre inmediato: el arranque en vuelo queda obsoleto.
    await userEvent.click(screen.getByLabelText('Cerrar entrenador virtual'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      release?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(first.stop).toHaveBeenCalled());
    // No se creó ningún detector para la sesión obsoleta.
    expect(vision.createFromOptions).not.toHaveBeenCalled();
  });

  it('cambiar de cámara libera el stream y el detector anteriores', async () => {
    const a = makeStream();
    const b = makeStream();
    let call = 0;
    getUserMedia = vi.fn(async () => (call++ === 0 ? a.stream : b.stream));
    setMediaDevices({ getUserMedia });

    render(<VirtualCoach exerciseName="CHEST PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(vision.createFromOptions).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByLabelText('Cambiar entre cámara frontal y trasera'));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(a.stop).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(b.stop).not.toHaveBeenCalled();
  });
});
