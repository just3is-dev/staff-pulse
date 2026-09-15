import styled from 'styled-components';
import type { OrgNode } from '@staff-pulse/shared';
import { PerformanceIndicator } from '@/components/PerformanceIndicator/PerformanceIndicator';

const Toggle = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
  margin-right: 0.4em;
`;

const NodeLabel = styled.span`
  border-radius: 4px;
  padding: 0 0.25em;

  &[aria-current='true'] {
    outline: 2px solid var(--accent, #6b8afd);
  }
`;

type OrgTreeNodeProps = {
  node: OrgNode;
  childrenByParentId: ReadonlyMap<string | null, OrgNode[]>;
  expandedIds: ReadonlySet<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  registerNodeElement: (id: string, element: HTMLElement | null) => void;
};

export function OrgTreeNode({
  node,
  childrenByParentId,
  expandedIds,
  selectedId,
  onToggle,
  registerNodeElement,
}: OrgTreeNodeProps) {
  const children = childrenByParentId.get(node.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);

  return (
    <li>
      <NodeLabel
        data-testid={`org-node-${node.id}`}
        aria-current={node.id === selectedId ? 'true' : undefined}
        ref={(element) => registerNodeElement(node.id, element)}
      >
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
      </NodeLabel>
      {hasChildren && isExpanded && (
        <ul>
          {children.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              childrenByParentId={childrenByParentId}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              registerNodeElement={registerNodeElement}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
