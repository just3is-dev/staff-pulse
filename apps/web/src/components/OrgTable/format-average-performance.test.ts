import { describe, expect, it } from 'vitest';
import { formatAveragePerformance } from './format-average-performance';

describe('formatAveragePerformance', () => {
  it('AC-002-5: округляет до одного знака после запятой через запятую', () => {
    expect(formatAveragePerformance(72.44)).toBe('72,4');
  });

  it('AC-002-5: при отсутствии значения возвращает «—»', () => {
    expect(formatAveragePerformance(undefined)).toBe('—');
  });
});
