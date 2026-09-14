import { describe, expect, it } from 'vitest';
import type { OrgNode } from '@staff-pulse/shared';
import { groupByParent } from './org-tree-hierarchy';

const node = (id: string, parentId: string | null): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount: 1,
  budget: 1,
  performance: 50,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('groupByParent', () => {
  it('группирует узлы по parentId, сохраняя порядок соседей как во входном массиве', () => {
    const nodes = [
      node('root-1', null),
      node('child-b', 'root-1'),
      node('root-2', null),
      node('child-a', 'root-1'),
    ];

    const grouped = groupByParent(nodes);

    expect(grouped.get(null)?.map((n) => n.id)).toEqual(['root-1', 'root-2']);
    expect(grouped.get('root-1')?.map((n) => n.id)).toEqual([
      'child-b',
      'child-a',
    ]);
  });

  it('сохраняет порядок соседей, даже если потомок идёт во входном массиве раньше родителя', () => {
    const nodes = [node('child', 'root'), node('root', null)];

    const grouped = groupByParent(nodes);

    expect(grouped.get(null)?.map((n) => n.id)).toEqual(['root']);
    expect(grouped.get('root')?.map((n) => n.id)).toEqual(['child']);
  });
});
