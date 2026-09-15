import { useQuery } from '@tanstack/react-query';
import { fetchOrgTree, type OrgTreeSnapshot } from './org-tree-request';

export const orgTreeQueryKey = ['org-tree'] as const;

export function useOrgTree() {
  return useQuery({
    queryKey: orgTreeQueryKey,
    queryFn: ({ signal, client }) =>
      fetchOrgTree(
        signal,
        client.getQueryData<OrgTreeSnapshot>(orgTreeQueryKey),
      ),
    select: (snapshot) => snapshot.nodes,
  });
}
