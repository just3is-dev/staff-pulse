import { describe, expect, it } from 'vitest';
import { makeTableRow } from '@/test/make-table-row';
import { sortTableRows } from './sort-table-rows';

describe('sortTableRows', () => {
  it('без сортировки (sort: null) возвращает порядок дерева как есть', () => {
    const rows = [makeTableRow({ id: 'a' }), makeTableRow({ id: 'b' })];

    expect(sortTableRows(rows, null)).toEqual(rows);
  });

  it('AC-002-7: при равных значениях сортируемого столбца сохраняет порядок дерева в обоих направлениях', () => {
    const rows = [
      makeTableRow({ id: 'a', headcount: 5 }),
      makeTableRow({ id: 'b', headcount: 5 }),
      makeTableRow({ id: 'c', headcount: 5 }),
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
      makeTableRow({ id: 'a', averagePerformance: 60 }),
      makeTableRow({ id: 'b', averagePerformance: undefined }),
      makeTableRow({ id: 'c', averagePerformance: 80 }),
      makeTableRow({ id: 'd', averagePerformance: undefined }),
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
      makeTableRow({ id: 'a', budget: 300 }),
      makeTableRow({ id: 'b', budget: 100 }),
      makeTableRow({ id: 'c', budget: 200 }),
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
      makeTableRow({ id: 'a', name: 'ёлки' }),
      makeTableRow({ id: 'b', name: 'Айсберг' }),
      makeTableRow({ id: 'c', name: 'берёза' }),
    ];

    expect(
      sortTableRows(rows, { column: 'name', direction: 'asc' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'c', 'a']);
  });

  it('названия, различающиеся только регистром, считаются равными и сохраняют порядок дерева', () => {
    const rows = [
      makeTableRow({ id: 'a', name: 'Альфа' }),
      makeTableRow({ id: 'b', name: 'альфа' }),
    ];

    expect(
      sortTableRows(rows, { column: 'name', direction: 'asc' }).map(
        (r) => r.id,
      ),
    ).toEqual(['a', 'b']);
  });
});
