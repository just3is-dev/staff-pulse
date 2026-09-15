import { useQuery } from '@tanstack/react-query';
import { fetchOrgTree, type OrgTreeSnapshot } from './org-tree-request';

export const orgTreeQueryKey = ['org-tree'] as const;

const selectOrgTreeData = ({ nodes, aggregates }: OrgTreeSnapshot) => ({
  nodes,
  aggregates,
});

export function useOrgTree() {
  return useQuery({
    queryKey: orgTreeQueryKey,
    queryFn: ({ signal, client }) =>
      fetchOrgTree(
        signal,
        client.getQueryData<OrgTreeSnapshot>(orgTreeQueryKey),
      ),
    select: selectOrgTreeData,
  });
}
