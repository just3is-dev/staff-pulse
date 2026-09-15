import type { OrgNode } from '@staff-pulse/shared';

export function makeOrgNode(
  overrides: Partial<OrgNode> & Pick<OrgNode, 'id'>,
): OrgNode {
  return {
    name: overrides.id,
    parentId: null,
    headcount: 1,
    budget: 1_000_000,
    performance: 50,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
