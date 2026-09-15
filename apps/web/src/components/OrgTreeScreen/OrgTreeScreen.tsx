import { useRef, useState } from 'react';
import styled from 'styled-components';
import { useOrgTree } from '@/api/use-org-tree';
import { OrgTree, type OrgTreeHandle } from '@/components/OrgTree/OrgTree';
import { OrgTable } from '@/components/OrgTable/OrgTable';
import { useMediaQuery } from '@/hooks/use-media-query';

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

const ViewToggle = styled.div`
  display: flex;
  gap: 0.5em;
  margin: 0 0 1em;
`;

const ViewToggleButton = styled.button`
  cursor: pointer;

  &[aria-pressed='true'] {
    font-weight: 600;
  }
`;

const Layout = styled.div<{ $sideBySide: boolean }>`
  display: grid;
  grid-template-columns: ${({ $sideBySide }) =>
    $sideBySide ? 'minmax(0, 1fr) minmax(0, 2fr)' : 'minmax(0, 1fr)'};
  gap: 2em;
  align-items: start;
`;

type View = 'tree' | 'table';

const VIEW_LABELS: Record<View, string> = { tree: 'Дерево', table: 'Таблица' };

export function OrgTreeScreen() {
  const { data, isPending, isError, refetch } = useOrgTree();
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [view, setView] = useState<View>('tree');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const treeRef = useRef<OrgTreeHandle>(null);

  function selectNode(id: string) {
    setSelectedId(id);
    treeRef.current?.reveal(id);
  }

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
      {data.nodes.length === 0 ? (
        <Message>Подразделений нет.</Message>
      ) : (
        <>
          {!isWide && (
            <ViewToggle role="group" aria-label="Вид">
              {(Object.keys(VIEW_LABELS) as View[]).map((option) => (
                <ViewToggleButton
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {VIEW_LABELS[option]}
                </ViewToggleButton>
              ))}
            </ViewToggle>
          )}
          <Layout $sideBySide={isWide}>
            <section aria-label="Дерево" hidden={!isWide && view !== 'tree'}>
              <OrgTree
                ref={treeRef}
                nodes={data.nodes}
                selectedId={selectedId}
              />
            </section>
            <section aria-label="Таблица" hidden={!isWide && view !== 'table'}>
              <OrgTable
                nodes={data.nodes}
                aggregates={data.aggregates}
                selectedId={selectedId}
                onSelectRow={selectNode}
              />
            </section>
          </Layout>
        </>
      )}
    </>
  );
}
