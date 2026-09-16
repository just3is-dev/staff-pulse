import type { OrgTableRow } from '@/components/OrgTable/build-table-rows';

export function makeTableRow(
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
