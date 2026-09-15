import type { OrgNode } from '@staff-pulse/shared';
import { groupByParent } from './org-tree-hierarchy';

export type SubtreeAggregate = {
  headcount: number;
  budget: number;
  performanceWeightedSum: number;
  averagePerformance: number | undefined;
};

export function aggregateSubtrees(
  nodes: OrgNode[],
): Map<string, SubtreeAggregate> {
  const childrenByParentId = groupByParent(nodes);
  const aggregates = new Map<string, SubtreeAggregate>();

  function aggregate(node: OrgNode): SubtreeAggregate {
    let headcount = node.headcount;
    let budget = node.budget;
    let performanceWeightedSum = node.performance * node.headcount;

    for (const child of childrenByParentId.get(node.id) ?? []) {
      const childAggregate = aggregate(child);
      headcount += childAggregate.headcount;
      budget += childAggregate.budget;
      performanceWeightedSum += childAggregate.performanceWeightedSum;
    }

    const result: SubtreeAggregate = {
      headcount,
      budget,
      performanceWeightedSum,
      averagePerformance:
        headcount === 0 ? undefined : performanceWeightedSum / headcount,
    };
    aggregates.set(node.id, result);
    return result;
  }

  for (const root of childrenByParentId.get(null) ?? []) {
    aggregate(root);
  }

  return aggregates;
}
