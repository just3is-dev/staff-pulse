import type { OrgTableRow } from './build-table-rows';

export type SortColumn =
  'name' | 'level' | 'headcount' | 'budget' | 'averagePerformance';

export type SortDirection = 'asc' | 'desc';

export type SortState = { column: SortColumn; direction: SortDirection } | null;

function compareAveragePerformance(
  a: number | undefined,
  b: number | undefined,
  direction: SortDirection,
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function compareColumn(
  a: OrgTableRow,
  b: OrgTableRow,
  column: SortColumn,
  direction: SortDirection,
): number {
  if (column === 'averagePerformance') {
    return compareAveragePerformance(
      a.averagePerformance,
      b.averagePerformance,
      direction,
    );
  }

  const cmp =
    column === 'name'
      ? a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
      : a[column] - b[column];
  return direction === 'asc' ? cmp : -cmp;
}

export function sortTableRows(
  rows: OrgTableRow[],
  sort: SortState,
): OrgTableRow[] {
  if (!sort) return rows;

  // Array#sort стабилен (ES2019) — равные по колонке строки сохраняют
  // взаимный порядок дерева без отдельного тай-брейка по индексу.
  return rows
    .slice()
    .sort((a, b) => compareColumn(a, b, sort.column, sort.direction));
}
