import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceIndicator } from './PerformanceIndicator';

function dotColor(value: number): string {
  const { unmount } = render(<PerformanceIndicator value={value} />);
  const color = getComputedStyle(
    screen.getByTestId('performance-dot'),
  ).backgroundColor;
  unmount();
  return color;
}

describe('PerformanceIndicator', () => {
  it.each([0, 49, 50, 74, 75, 100])(
    'AC-001-14: текстовая альтернатива значения %i содержит число и доступна вспомогательным технологиям',
    (value) => {
      render(<PerformanceIndicator value={value} />);

      const alternative = screen.getByText(String(value));
      expect(alternative).toBeInTheDocument();
      expect(alternative).not.toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('AC-001-14: значения одного диапазона (0 и 49, 50 и 74, 75 и 100) получают одинаковый цвет', () => {
    expect(dotColor(0)).toBe(dotColor(49));
    expect(dotColor(50)).toBe(dotColor(74));
    expect(dotColor(75)).toBe(dotColor(100));
  });

  it('AC-001-14: разные диапазоны (низкая, средняя, высокая) получают разные цвета', () => {
    const low = dotColor(0);
    const medium = dotColor(50);
    const high = dotColor(75);

    expect(low).not.toBe(medium);
    expect(medium).not.toBe(high);
    expect(low).not.toBe(high);
  });
});
