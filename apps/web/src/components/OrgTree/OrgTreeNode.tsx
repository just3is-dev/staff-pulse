import styled from 'styled-components';
import type { OrgNode } from '@staff-pulse/shared';
import { PerformanceIndicator } from '@/components/PerformanceIndicator';

const Toggle = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
  margin-right: 0.4em;
`;

type OrgTreeNodeProps = {
  node: OrgNode;
  childrenByParentId: ReadonlyMap<string | null, OrgNode[]>;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
};

export function OrgTreeNode({
  node,
  childrenByParentId,
  expandedIds,
  onToggle,
}: OrgTreeNodeProps) {
  const children = childrenByParentId.get(node.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li>
      <span data-testid={`org-node-${node.id}`}>
        {hasChildren && (
          <Toggle
            type="button"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? `Свернуть ${node.name}` : `Развернуть ${node.name}`
            }
            onClick={() => onToggle(node.id)}
          >
            {isExpanded ? '▾' : '▸'}
          </Toggle>
        )}
        <span>{node.name}</span>{' '}
        <span data-testid="node-headcount">{node.headcount}</span>{' '}
        <PerformanceIndicator value={node.performance} />
      </span>
      {hasChildren && isExpanded && (
        <ul>
          {children.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              childrenByParentId={childrenByParentId}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
