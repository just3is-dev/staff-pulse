import styled from 'styled-components';
import { useOrgTree } from '@/api/use-org-tree';
import { OrgTree } from '@/components/OrgTree/OrgTree';

const Message = styled.p`
  color: var(--text);
  text-align: center;
  padding: 2em;
`;

const RetryButton = styled.button`
  display: block;
  margin: 0 auto;
  cursor: pointer;
`;

export function OrgTreeScreen() {
  const { data, isPending, isError, refetch } = useOrgTree();

  if (isPending) {
    return <Message role="status">Загрузка…</Message>;
  }

  if (isError) {
    return (
      <div>
        <Message role="alert">Не удалось загрузить орг-структуру.</Message>
        <RetryButton type="button" onClick={() => refetch()}>
          Повторить
        </RetryButton>
      </div>
    );
  }

  if (data.length === 0) {
    return <Message>Подразделений нет.</Message>;
  }

  return <OrgTree nodes={data} />;
}
