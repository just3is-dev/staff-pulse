import { describe, expect, it } from 'vitest';
import { makeOrgNode } from '@/test/make-org-node';
import { groupByParent } from './org-tree-hierarchy';

describe('groupByParent', () => {
  it('группирует узлы по parentId, сохраняя порядок соседей как во входном массиве', () => {
    const nodes = [
      makeOrgNode({ id: 'root-1', parentId: null }),
      makeOrgNode({ id: 'child-b', parentId: 'root-1' }),
      makeOrgNode({ id: 'root-2', parentId: null }),
      makeOrgNode({ id: 'child-a', parentId: 'root-1' }),
    ];

    const grouped = groupByParent(nodes);

    expect(grouped.get(null)?.map((n) => n.id)).toEqual(['root-1', 'root-2']);
    expect(grouped.get('root-1')?.map((n) => n.id)).toEqual([
      'child-b',
      'child-a',
    ]);
  });

  it('сохраняет порядок соседей, даже если потомок идёт во входном массиве раньше родителя', () => {
    const nodes = [
      makeOrgNode({ id: 'child', parentId: 'root' }),
      makeOrgNode({ id: 'root', parentId: null }),
    ];

    const grouped = groupByParent(nodes);

    expect(grouped.get(null)?.map((n) => n.id)).toEqual(['root']);
    expect(grouped.get('root')?.map((n) => n.id)).toEqual(['child']);
  });
});
