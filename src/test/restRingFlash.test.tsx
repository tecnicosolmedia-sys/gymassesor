import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FullscreenTimer } from '@/components/FullscreenTimer';

const props = {
  initialTime: 2,
  label: 'Descanso',
  onComplete: () => {},
  onContinue: () => {},
  onClose: () => {},
};

describe('Flash estroboscópico del descanso: solo el aro', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('al llegar a cero el flash blanco está dentro del aro y no cubre la pantalla', () => {
    render(<FullscreenTimer {...props} />);
    act(() => { vi.advanceTimersByTime(2000); });

    const flash = screen.getByTestId('rest-end-flash');
    expect(flash.tagName.toLowerCase()).toBe('circle');
    expect(flash.getAttribute('class')).toContain('rest-ring-flash');
    expect(screen.getByTestId('rest-ring').contains(flash)).toBe(true);

    // No hay capa blanca a pantalla completa
    expect(document.querySelector('div.animate-strobe-flash')).toBeNull();
    expect(document.querySelector('[data-testid="rest-end-flash"].fixed')).toBeNull();
  });

  it('el flash se apaga cuando el descanso pasa a la siguiente serie', () => {
    const onComplete = vi.fn();
    render(<FullscreenTimer {...props} onComplete={onComplete} />);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('rest-end-flash')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(2000); });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('rest-end-flash')).toBeNull();
  });
});
