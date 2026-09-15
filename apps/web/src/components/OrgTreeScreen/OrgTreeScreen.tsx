import styled from 'styled-components';
import { useOrgTree } from '@/api/use-org-tree';
import { OrgTree } from '@/components/OrgTree/OrgTree';

const Message = styled.p`
  color: var(--text);
  text-align: center;
  padding: 2em;
`;

const RefreshErrorNotice = styled.p`
  color: var(--text);
  font-size: 0.9em;
  margin: 0 0 1em;
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

  if (isError && data === undefined) {
    return (
      <div>
        <Message role="alert">Не удалось загрузить орг-структуру.</Message>
        <RetryButton type="button" onClick={() => refetch()}>
          Повторить
        </RetryButton>
      </div>
    );
  }

  return (
    <>
      {isError && (
        <RefreshErrorNotice role="status">
          Не удалось обновить данные
        </RefreshErrorNotice>
      )}
      {data.length === 0 ? (
        <Message>Подразделений нет.</Message>
      ) : (
        <OrgTree nodes={data} />
      )}
    </>
  );
}
