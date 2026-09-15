import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import type { OrgNode } from '@staff-pulse/shared';
import { OrgTreeNode } from './OrgTreeNode';
import { groupByParent } from '@/org-model/org-tree-hierarchy';

export type OrgTreeHandle = {
  reveal: (id: string) => void;
};

type OrgTreeProps = {
  nodes: OrgNode[];
  selectedId?: string | null;
  ref?: Ref<OrgTreeHandle>;
};

export function OrgTree({ nodes, selectedId = null, ref }: OrgTreeProps) {
  const childrenByParentId = groupByParent(nodes);
  const roots = childrenByParentId.get(null) ?? [];
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(roots.map((node) => node.id)),
  );
  const [scrollRequest, setScrollRequest] = useState<{ id: string } | null>(
    null,
  );
  const nodeElements = useRef(new Map<string, HTMLElement>());

  const registerNodeElement = useCallback(
    (id: string, element: HTMLElement | null) => {
      if (element) {
        nodeElements.current.set(id, element);
      } else {
        nodeElements.current.delete(id);
      }
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      reveal(id) {
        const parentById = new Map(
          nodes.map((node) => [node.id, node.parentId]),
        );
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (
            let parentId = parentById.get(id) ?? null;
            parentId !== null;
            parentId = parentById.get(parentId) ?? null
          ) {
            next.add(parentId);
          }
          return next;
        });
        setScrollRequest({ id });
      },
    }),
    [nodes],
  );

  useEffect(() => {
    if (scrollRequest) {
      nodeElements.current
        .get(scrollRequest.id)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [scrollRequest]);

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
          selectedId={selectedId}
          onToggle={toggle}
          registerNodeElement={registerNodeElement}
        />
      ))}
    </ul>
  );
}
