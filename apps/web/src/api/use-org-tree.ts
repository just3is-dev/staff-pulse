import { useQuery } from '@tanstack/react-query';
import { fetchOrgTree } from './org-tree-request';

export const orgTreeQueryKey = ['org-tree'] as const;

/**
 * Данные орг-структуры через кэш. `signal` передаётся в запрос: когда
 * последний компонент с этим хуком размонтируется до ответа, TanStack Query
 * отменяет запрос и не записывает результат.
 */
export function useOrgTree() {
  return useQuery({
    queryKey: orgTreeQueryKey,
    queryFn: ({ signal }) => fetchOrgTree(signal),
  });
}
