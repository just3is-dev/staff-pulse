import { orgTreeResponseSchema, type OrgNode } from './org-node.ts';

export type OrgTreeErrorKind =
  'shape' | 'duplicate-id' | 'unknown-parent' | 'cycle';

export type OrgTreeError = {
  kind: OrgTreeErrorKind;
  message: string;
  /** Узел, на котором найдено структурное нарушение; для ошибок формы не задан. */
  nodeId?: string;
};

export type ParseOrgTreeResult =
  { ok: true; nodes: OrgNode[] } | { ok: false; error: OrgTreeError };

/** Проверяет ответ `GET /api/org-tree`: сначала форму узлов, затем структуру леса. */
export function parseOrgTree(input: unknown): ParseOrgTreeResult {
  const parsed = orgTreeResponseSchema.safeParse(input);
  if (!parsed.success) {
    // zod/mini не подключает локаль с текстами ошибок, поэтому в сообщение идёт код нарушения.
    const [issue] = parsed.error.issues;
    const path = issue.path.join('.') || '(корень)';
    return {
      ok: false,
      error: {
        kind: 'shape',
        message: `Неверная форма ответа в ${path}: ${issue.code}`,
      },
    };
  }

  const error = findStructureError(parsed.data);
  return error ? { ok: false, error } : { ok: true, nodes: parsed.data };
}

function findStructureError(nodes: OrgNode[]): OrgTreeError | undefined {
  const parentById = new Map<string, string | null>();
  for (const { id, parentId } of nodes) {
    if (parentById.has(id)) {
      return {
        kind: 'duplicate-id',
        nodeId: id,
        message: `Повторяется id узла «${id}»`,
      };
    }
    parentById.set(id, parentId);
  }

  for (const { id, parentId } of nodes) {
    if (parentId !== null && !parentById.has(parentId)) {
      return {
        kind: 'unknown-parent',
        nodeId: id,
        message: `Узел «${id}» ссылается на несуществующего родителя «${parentId}»`,
      };
    }
  }

  // Узлы, от которых цепочка родителей гарантированно доходит до корня.
  const reachesRoot = new Set<string>();
  for (const { id } of nodes) {
    const chain = new Set<string>();
    let current: string | null = id;
    while (current !== null && !reachesRoot.has(current)) {
      if (chain.has(current)) {
        return {
          kind: 'cycle',
          nodeId: current,
          message: `Цикл в иерархии через узел «${current}»`,
        };
      }
      chain.add(current);
      current = parentById.get(current) ?? null;
    }
    for (const visited of chain) reachesRoot.add(visited);
  }

  return undefined;
}
