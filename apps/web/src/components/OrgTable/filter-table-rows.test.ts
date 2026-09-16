import { describe, expect, it } from 'vitest';
import { makeTableRow } from '@/test/make-table-row';
import { filterTableRows } from './filter-table-rows';

describe('filterTableRows', () => {
  it('пустой (в т.ч. из пробелов) запрос возвращает все строки как есть', () => {
    const rows = [
      makeTableRow({ id: 'a', name: 'Дивизион' }),
      makeTableRow({ id: 'b', name: 'Отдел' }),
    ];

    expect(filterTableRows(rows, '')).toEqual(rows);
    expect(filterTableRows(rows, '   ')).toEqual(rows);
  });

  it('AC-002-8: оставляет строки с подстрокой без учёта регистра и окружающих пробелов запроса', () => {
    const rows = [
      makeTableRow({ id: 'a', name: 'Дивизион продаж' }),
      makeTableRow({ id: 'b', name: 'Отдел маркетинга' }),
      makeTableRow({ id: 'c', name: 'Дивизион разработки' }),
    ];

    expect(filterTableRows(rows, '  ДИВИЗИОН  ').map((r) => r.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('AC-002-9: нет совпадений — пустой список', () => {
    const rows = [makeTableRow({ id: 'a', name: 'Дивизион' })];

    expect(filterTableRows(rows, 'команда')).toEqual([]);
  });

  it('сохраняет относительный порядок отфильтрованных строк', () => {
    const rows = [
      makeTableRow({ id: 'a', name: 'Команда альфа' }),
      makeTableRow({ id: 'b', name: 'Отдел' }),
      makeTableRow({ id: 'c', name: 'Команда бета' }),
    ];

    expect(filterTableRows(rows, 'команда').map((r) => r.id)).toEqual([
      'a',
      'c',
    ]);
  });
});
