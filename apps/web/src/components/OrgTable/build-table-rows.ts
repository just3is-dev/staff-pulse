import type { OrgNode } from '@staff-pulse/shared';
import type { SubtreeAggregate } from '@/org-model/aggregate-subtrees';
import { groupByParent } from '@/org-model/org-tree-hierarchy';

export type OrgTableRow = {
  id: string;
  name: string;
  level: number;
  headcount: number;
  budget: number;
  averagePerformance: number | undefined;
};

export function buildTableRows(
  nodes: OrgNode[],
  aggregates: ReadonlyMap<string, SubtreeAggregate>,
): OrgTableRow[] {
  const childrenByParentId = groupByParent(nodes);
  const rows: OrgTableRow[] = [];

  function visit(node: OrgNode, level: number) {
    // aggregateSubtrees обходит те же узлы от тех же корней, поэтому агрегат
    // для node.id всегда есть — недостижимых от корня узлов parseOrgTree не
    // пропускает.
    const aggregate = aggregates.get(node.id)!;
    rows.push({
      id: node.id,
      name: node.name,
      level,
      headcount: aggregate.headcount,
      budget: aggregate.budget,
      averagePerformance: aggregate.averagePerformance,
    });
    for (const child of childrenByParentId.get(node.id) ?? []) {
      visit(child, level + 1);
    }
  }

  for (const root of childrenByParentId.get(null) ?? []) {
    visit(root, 1);
  }

  return rows;
}
