import { describe, expect, it } from 'vitest';
import { makeOrgNode } from '@/test/make-org-node';
import { aggregateSubtrees } from '@/org-model/aggregate-subtrees';
import { buildTableRows } from './build-table-rows';

describe('buildTableRows', () => {
  it('AC-002-4: строит по строке на узел в порядке дерева с уровнями, независимо от порядка узлов во входе', () => {
    const nodes = [
      makeOrgNode({ id: 'team-1', parentId: 'dept-1', headcount: 4 }),
      makeOrgNode({ id: 'dept-1', parentId: 'root-1', headcount: 6 }),
      makeOrgNode({ id: 'root-1', parentId: null, headcount: 10 }),
      makeOrgNode({ id: 'root-2', parentId: null, headcount: 3 }),
    ];
    const aggregates = aggregateSubtrees(nodes);

    const rows = buildTableRows(nodes, aggregates);

    expect(rows.map((row) => [row.id, row.level])).toEqual([
      ['root-1', 1],
      ['dept-1', 2],
      ['team-1', 3],
      ['root-2', 1],
    ]);
  });

  it('AC-002-4: строка узла содержит его агрегаты по поддереву', () => {
    const nodes = [
      makeOrgNode({
        id: 'root-1',
        parentId: null,
        name: 'Дивизион',
        headcount: 5,
        budget: 100_000,
        performance: 80,
      }),
    ];
    const aggregates = aggregateSubtrees(nodes);

    const rows = buildTableRows(nodes, aggregates);

    expect(rows).toEqual([
      {
        id: 'root-1',
        name: 'Дивизион',
        level: 1,
        headcount: 5,
        budget: 100_000,
        averagePerformance: 80,
      },
    ]);
  });
});
