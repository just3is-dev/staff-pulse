import { useQuery } from '@tanstack/react-query';
import { fetchOrgTree } from './org-tree-request';

export const orgTreeQueryKey = ['org-tree'] as const;

export function useOrgTree() {
  return useQuery({
    queryKey: orgTreeQueryKey,
    queryFn: ({ signal }) => fetchOrgTree(signal),
  });
}
