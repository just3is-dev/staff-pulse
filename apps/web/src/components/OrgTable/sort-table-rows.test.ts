import { describe, expect, it } from 'vitest';
import type { OrgTableRow } from './build-table-rows';
import { sortTableRows } from './sort-table-rows';

function row(
  overrides: Partial<OrgTableRow> & Pick<OrgTableRow, 'id'>,
): OrgTableRow {
  return {
    name: overrides.id,
    level: 1,
    headcount: 0,
    budget: 0,
    averagePerformance: undefined,
    ...overrides,
  };
}

describe('sortTableRows', () => {
  it('без сортировки (sort: null) возвращает порядок дерева как есть', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })];

    expect(sortTableRows(rows, null)).toEqual(rows);
  });

  it('AC-002-7: при равных значениях сортируемого столбца сохраняет порядок дерева в обоих направлениях', () => {
    const rows = [
      row({ id: 'a', headcount: 5 }),
      row({ id: 'b', headcount: 5 }),
      row({ id: 'c', headcount: 5 }),
    ];

    const asc = sortTableRows(rows, { column: 'headcount', direction: 'asc' });
    const desc = sortTableRows(rows, {
      column: 'headcount',
      direction: 'desc',
    });

    expect(asc.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(desc.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('AC-002-7: строки без средней эффективности всегда внизу — и по возрастанию, и по убыванию', () => {
    const rows = [
      row({ id: 'a', averagePerformance: 60 }),
      row({ id: 'b', averagePerformance: undefined }),
      row({ id: 'c', averagePerformance: 80 }),
      row({ id: 'd', averagePerformance: undefined }),
    ];

    const asc = sortTableRows(rows, {
      column: 'averagePerformance',
      direction: 'asc',
    });
    const desc = sortTableRows(rows, {
      column: 'averagePerformance',
      direction: 'desc',
    });

    expect(asc.map((r) => r.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(desc.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('сортирует числовой столбец по значению', () => {
    const rows = [
      row({ id: 'a', budget: 300 }),
      row({ id: 'b', budget: 100 }),
      row({ id: 'c', budget: 200 }),
    ];

    expect(
      sortTableRows(rows, { column: 'budget', direction: 'asc' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'c', 'a']);
    expect(
      sortTableRows(rows, { column: 'budget', direction: 'desc' }).map(
        (r) => r.id,
      ),
    ).toEqual(['a', 'c', 'b']);
  });

  it('сортирует «Подразделение» по алфавиту без учёта регистра', () => {
    const rows = [
      row({ id: 'a', name: 'ёлки' }),
      row({ id: 'b', name: 'Айсберг' }),
      row({ id: 'c', name: 'берёза' }),
    ];

    expect(
      sortTableRows(rows, { column: 'name', direction: 'asc' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'c', 'a']);
  });
});
