import { useEffect, useState } from 'react';
import styled from 'styled-components';
import type { OrgNode } from '@staff-pulse/shared';
import type { SubtreeAggregate } from '@/org-model/aggregate-subtrees';
import { buildTableRows } from './build-table-rows';
import { formatBudget } from './format-budget';
import { formatAveragePerformance } from './format-average-performance';
import {
  sortTableRows,
  type SortColumn,
  type SortDirection,
  type SortState,
} from './sort-table-rows';
import { filterTableRows } from './filter-table-rows';

const FILTER_DEBOUNCE_MS = 250;

const FilterField = styled.div`
  margin: 0 0 1em;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: var(--text);
`;

const SortButton = styled.button`
  cursor: pointer;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
`;

const Row = styled.tr`
  cursor: pointer;

  &[aria-selected='true'] {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
`;

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Подразделение' },
  { key: 'level', label: 'Уровень' },
  { key: 'headcount', label: 'Всего сотрудников' },
  { key: 'budget', label: 'Бюджет суммарный' },
  { key: 'averagePerformance', label: 'Средняя эффективность' },
];

const DIRECTION_SIGN: Record<SortDirection, string> = { asc: '▲', desc: '▼' };
const ARIA_SORT: Record<SortDirection, 'ascending' | 'descending'> = {
  asc: 'ascending',
  desc: 'descending',
};

type OrgTableProps = {
  nodes: OrgNode[];
  aggregates: ReadonlyMap<string, SubtreeAggregate>;
  selectedId?: string | null;
  onSelectRow?: (id: string) => void;
};

export function OrgTable({
  nodes,
  aggregates,
  selectedId = null,
  onSelectRow,
}: OrgTableProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [filterInput, setFilterInput] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(
      () => setAppliedFilter(filterInput),
      FILTER_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [filterInput]);

  const rows = filterTableRows(
    sortTableRows(buildTableRows(nodes, aggregates), sort),
    appliedFilter,
  );

  return (
    <>
      <FilterField>
        <label htmlFor="org-table-filter">Фильтр по названию</label>{' '}
        <input
          id="org-table-filter"
          type="text"
          value={filterInput}
          onChange={(event) => setFilterInput(event.target.value)}
        />
      </FilterField>
      <Table>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const isActive = sort?.column === column.key;
              return (
                <th
                  key={column.key}
                  aria-sort={isActive ? ARIA_SORT[sort.direction] : undefined}
                >
                  <SortButton
                    type="button"
                    onClick={() =>
                      setSort({ column: column.key, direction: 'asc' })
                    }
                    onDoubleClick={() =>
                      setSort({ column: column.key, direction: 'desc' })
                    }
                  >
                    {column.label}
                    {isActive && (
                      <span aria-hidden="true">
                        {' '}
                        {DIRECTION_SIGN[sort.direction]}
                      </span>
                    )}
                  </SortButton>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length}>Ничего не найдено</td>
            </tr>
          ) : (
            rows.map((row) => (
              <Row
                key={row.id}
                aria-selected={row.id === selectedId}
                onClick={() => onSelectRow?.(row.id)}
              >
                <td>{row.name}</td>
                <td>{row.level}</td>
                <td>{row.headcount}</td>
                <td>{formatBudget(row.budget)}</td>
                <td>{formatAveragePerformance(row.averagePerformance)}</td>
              </Row>
            ))
          )}
        </tbody>
      </Table>
    </>
  );
}
