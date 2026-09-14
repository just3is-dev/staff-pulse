import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';

export const ORG_TREE_URL = '/api/org-tree';

export type OrgTreeLoadErrorKind = 'network' | 'http' | 'invalid-response';

/** Ошибка загрузки орг-структуры; `kind` различает причину для UI. */
export class OrgTreeLoadError extends Error {
  readonly kind: OrgTreeLoadErrorKind;

  constructor(kind: OrgTreeLoadErrorKind, message: string) {
    super(message);
    this.name = 'OrgTreeLoadError';
    this.kind = kind;
  }
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

/**
 * Загружает и проверяет орг-структуру. Отмена через `signal` пробрасывается
 * как `AbortError` без обёртки — её обрабатывает слой кэша, а не UI.
 */
export async function fetchOrgTree(signal?: AbortSignal): Promise<OrgNode[]> {
  let response: Response;
  try {
    response = await fetch(ORG_TREE_URL, { signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OrgTreeLoadError('network', 'Сервер недоступен');
  }

  if (!response.ok) {
    throw new OrgTreeLoadError('http', `Сервер ответил ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new OrgTreeLoadError('invalid-response', 'Ответ сервера не JSON');
  }

  const parsed = parseOrgTree(body);
  if (!parsed.ok) {
    throw new OrgTreeLoadError('invalid-response', parsed.error.message);
  }
  return parsed.nodes;
}
