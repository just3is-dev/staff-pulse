import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';

const ORG_TREE_URL = '/api/org-tree';

export class OrgTreeLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgTreeLoadError';
  }
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export async function fetchOrgTree(signal?: AbortSignal): Promise<OrgNode[]> {
  let response: Response;
  try {
    response = await fetch(ORG_TREE_URL, { signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OrgTreeLoadError('Сервер недоступен');
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
  return parsed.nodes;
}
