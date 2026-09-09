import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtualCoach } from '@/components/VirtualCoach';

/**
 * Pruebas de montaje/cierre con getUserMedia simulado:
 * - se detienen todos los tracks al cerrar/desmontar,
 * - no hay persistencia en localStorage ni peticiones de red.
 */

const closeMock = vi.fn();

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: vi.fn(() => ({ landmarks: [] })),
      close: closeMock,
    })),
  },
}));

const makeStream = () => {
  const stop = vi.fn();
  const track = { stop, kind: 'video' } as unknown as MediaStreamTrack;
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    stop,
  };
};

let fetchSpy: ReturnType<typeof vi.spyOn>;
let setItemSpy: ReturnType<typeof vi.spyOn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;

beforeEach(() => {
  closeMock.mockClear();
  const { stream, stop } = makeStream();
  stopTrack = stop;
  getUserMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
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
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

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
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    render(<VirtualCoach exerciseName="SHOULDER PRESS TECHNOGYM" onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText('Iniciar cámara'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no admite/i));
  });
});
