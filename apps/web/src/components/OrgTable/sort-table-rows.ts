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

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = compareColumn(a.row, b.row, sort.column, sort.direction);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map(({ row }) => row);
}
