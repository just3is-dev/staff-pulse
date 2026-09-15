import { describe, expect, it } from 'vitest';
import { formatBudget } from './format-budget';

describe('formatBudget', () => {
  it('AC-002-5: группирует разряды по три цифры и добавляет суффикс «руб.»', () => {
    expect(formatBudget(12_345_678)).toMatch(/^12[  ]345[  ]678 руб\.$/);
  });

  it('AC-002-5: числа меньше тысячи выводит без группировки', () => {
    expect(formatBudget(0)).toBe('0 руб.');
    expect(formatBudget(999)).toBe('999 руб.');
  });
});
