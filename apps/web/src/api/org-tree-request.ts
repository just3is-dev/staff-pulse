import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';
import {
  aggregateSubtrees,
  type SubtreeAggregate,
} from '@/org-model/aggregate-subtrees';

const ORG_TREE_URL = '/api/org-tree';

export class OrgTreeLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgTreeLoadError';
  }
}

export type OrgTreeSnapshot = {
  nodes: OrgNode[];
  aggregates: Map<string, SubtreeAggregate>;
  etag: string | null;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export async function fetchOrgTree(
  signal?: AbortSignal,
  previous?: OrgTreeSnapshot,
): Promise<OrgTreeSnapshot> {
  const headers = new Headers();
  if (previous?.etag) headers.set('If-None-Match', previous.etag);

  let response: Response;
  try {
    response = await fetch(ORG_TREE_URL, {
      signal,
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OrgTreeLoadError('Сервер недоступен');
  }

  if (response.status === 304 && previous) {
    // Без чтения пустого тела браузер помечает 304 в DevTools как прерванный запрос.
    await response.text();
    return previous;
  }

  if (!response.ok) {
    throw new OrgTreeLoadError(`Сервер ответил ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OrgTreeLoadError('Ответ сервера не JSON');
  }

  const parsed = parseOrgTree(body);
  if (!parsed.ok) {
    throw new OrgTreeLoadError(parsed.error.message);
  }
  return {
    nodes: parsed.nodes,
    aggregates: aggregateSubtrees(parsed.nodes),
    etag: response.headers.get('ETag'),
  };
}
