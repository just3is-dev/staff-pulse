import { describe, expect, it } from 'vitest';
import { makeOrgNode } from '@/test/make-org-node';
import { aggregateSubtrees } from './aggregate-subtrees';

describe('aggregateSubtrees', () => {
  it('AC-002-3: сумма headcount/budget и средневзвешенная эффективность по узлу и потомкам; нулевая численность — без значения эффективности', () => {
    const nodes = [
      makeOrgNode({
        id: 'team-1a',
        parentId: 'dept-1a',
        headcount: 0,
        budget: 0,
      }),
      makeOrgNode({
        id: 'dept-1a',
        parentId: 'root-1',
        headcount: 0,
        budget: 0,
      }),
      makeOrgNode({
        id: 'root-1',
        parentId: null,
        headcount: 5,
        budget: 100_000,
        performance: 80,
      }),
      makeOrgNode({
        id: 'dept-2',
        parentId: 'root-2',
        headcount: 2,
        budget: 20_000,
        performance: 90,
      }),
      makeOrgNode({
        id: 'root-2',
        parentId: null,
        headcount: 3,
        budget: 50_000,
        performance: 60,
      }),
    ];

    const aggregates = aggregateSubtrees(nodes);

    expect(aggregates.get('team-1a')).toEqual({
      headcount: 0,
      budget: 0,
      performanceWeightedSum: 0,
      averagePerformance: undefined,
    });
    expect(aggregates.get('dept-1a')).toEqual({
      headcount: 0,
      budget: 0,
      performanceWeightedSum: 0,
      averagePerformance: undefined,
    });
    expect(aggregates.get('root-1')).toEqual({
      headcount: 5,
      budget: 100_000,
      performanceWeightedSum: 400,
      averagePerformance: 80,
    });
    expect(aggregates.get('dept-2')).toEqual({
      headcount: 2,
      budget: 20_000,
      performanceWeightedSum: 180,
      averagePerformance: 90,
    });
    expect(aggregates.get('root-2')).toEqual({
      headcount: 5,
      budget: 70_000,
      performanceWeightedSum: 360,
      averagePerformance: 72,
    });
  });
});
