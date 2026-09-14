import { useState } from 'react';
import type { OrgNode } from '@staff-pulse/shared';
import { OrgTreeNode } from './OrgTreeNode';
import { groupByParent } from './org-tree-hierarchy';

type OrgTreeProps = {
  nodes: OrgNode[];
};

export function OrgTree({ nodes }: OrgTreeProps) {
  const childrenByParentId = groupByParent(nodes);
  const roots = childrenByParentId.get(null) ?? [];
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(roots.map((node) => node.id)),
  );

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ul>
      {roots.map((node) => (
        <OrgTreeNode
          key={node.id}
          node={node}
          childrenByParentId={childrenByParentId}
          expandedIds={expandedIds}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}
