import type { OrgTableRow } from './build-table-rows';

export function filterTableRows(
  rows: OrgTableRow[],
  query: string,
): OrgTableRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(normalized));
}
