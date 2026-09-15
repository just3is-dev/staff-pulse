import { describe, expect, it } from 'vitest';
import type { OrgTableRow } from './build-table-rows';
import { filterTableRows } from './filter-table-rows';

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

describe('filterTableRows', () => {
  it('пустой (в т.ч. из пробелов) запрос возвращает все строки как есть', () => {
    const rows = [
      row({ id: 'a', name: 'Дивизион' }),
      row({ id: 'b', name: 'Отдел' }),
    ];

    expect(filterTableRows(rows, '')).toEqual(rows);
    expect(filterTableRows(rows, '   ')).toEqual(rows);
  });

  it('AC-002-9: оставляет строки с подстрокой без учёта регистра и окружающих пробелов запроса', () => {
    const rows = [
      row({ id: 'a', name: 'Дивизион продаж' }),
      row({ id: 'b', name: 'Отдел маркетинга' }),
      row({ id: 'c', name: 'Дивизион разработки' }),
    ];

    expect(filterTableRows(rows, '  ДИВИЗИОН  ').map((r) => r.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('AC-002-9: нет совпадений — пустой список', () => {
    const rows = [row({ id: 'a', name: 'Дивизион' })];

    expect(filterTableRows(rows, 'команда')).toEqual([]);
  });

  it('сохраняет относительный порядок отфильтрованных строк', () => {
    const rows = [
      row({ id: 'a', name: 'Команда альфа' }),
      row({ id: 'b', name: 'Отдел' }),
      row({ id: 'c', name: 'Команда бета' }),
    ];

    expect(filterTableRows(rows, 'команда').map((r) => r.id)).toEqual([
      'a',
      'c',
    ]);
  });
});
