import styled from 'styled-components';
import type { OrgNode } from '@staff-pulse/shared';
import type { SubtreeAggregate } from '@/org-model/aggregate-subtrees';
import { buildTableRows } from './build-table-rows';
import { formatBudget } from './format-budget';
import { formatAveragePerformance } from './format-average-performance';

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: var(--text);
`;

type OrgTableProps = {
  nodes: OrgNode[];
  aggregates: ReadonlyMap<string, SubtreeAggregate>;
};

export function OrgTable({ nodes, aggregates }: OrgTableProps) {
  const rows = buildTableRows(nodes, aggregates);

  return (
    <Table>
      <thead>
        <tr>
          <th>Подразделение</th>
          <th>Уровень</th>
          <th>Всего сотрудников</th>
          <th>Бюджет суммарный</th>
          <th>Средняя эффективность</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.level}</td>
            <td>{row.headcount}</td>
            <td>{formatBudget(row.budget)}</td>
            <td>{formatAveragePerformance(row.averagePerformance)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
