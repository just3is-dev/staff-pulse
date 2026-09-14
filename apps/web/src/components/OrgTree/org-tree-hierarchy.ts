import type { OrgNode } from '@staff-pulse/shared';

export function groupByParent(
  nodes: OrgNode[],
): Map<string | null, OrgNode[]> {
  const childrenByParentId = new Map<string | null, OrgNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParentId.get(node.parentId);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenByParentId.set(node.parentId, [node]);
    }
  }

  return childrenByParentId;
}
