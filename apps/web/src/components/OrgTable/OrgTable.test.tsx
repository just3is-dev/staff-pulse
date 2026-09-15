import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { makeOrgNode } from '@/test/make-org-node';
import { aggregateSubtrees } from '@/org-model/aggregate-subtrees';
import { OrgTable } from './OrgTable';

describe('OrgTable', () => {
  it('AC-002-4: столбцы, строка на узел в порядке дерева с уровнями — потомок во входе раньше родителя', () => {
    const nodes = [
      makeOrgNode({
        id: 'team-1',
        parentId: 'dept-1',
        name: 'Команда',
        headcount: 4,
        budget: 1_000,
        performance: 25,
      }),
      makeOrgNode({
        id: 'dept-1',
        parentId: 'root-1',
        name: 'Отдел',
        headcount: 6,
        budget: 2_000,
        performance: 50,
      }),
      makeOrgNode({
        id: 'root-1',
        parentId: null,
        name: 'Дивизион 1',
        headcount: 10,
        budget: 5_000,
        performance: 70,
      }),
      makeOrgNode({
        id: 'root-2',
        parentId: null,
        name: 'Дивизион 2',
        headcount: 3,
        budget: 50_000,
        performance: 60,
      }),
    ];
    const aggregates = aggregateSubtrees(nodes);

    render(<OrgTable nodes={nodes} aggregates={aggregates} />);

    const columnHeaders = screen
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(columnHeaders).toEqual([
      'Подразделение',
      'Уровень',
      'Всего сотрудников',
      'Бюджет суммарный',
      'Средняя эффективность',
    ]);

    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((row) => within(row).getAllByRole('cell')[0].textContent),
    ).toEqual(['Дивизион 1', 'Отдел', 'Команда', 'Дивизион 2']);

    const divisionRow = rows[0];
    expect(within(divisionRow).getAllByRole('cell')[1].textContent).toBe('1');
    const deptRow = rows[1];
    expect(within(deptRow).getAllByRole('cell')[1].textContent).toBe('2');
    const teamRow = rows[2];
    expect(within(teamRow).getAllByRole('cell')[1].textContent).toBe('3');
  });

  it('AC-002-5: форматирует бюджет и среднюю эффективность в ячейках строки, «—» при нулевой численности', () => {
    const nodes = [
      makeOrgNode({
        id: 'root-1',
        name: 'Дивизион',
        parentId: null,
        headcount: 10,
        budget: 12_345_678,
        performance: 72.44,
      }),
      makeOrgNode({
        id: 'root-2',
        name: 'Пустое подразделение',
        parentId: null,
        headcount: 0,
        budget: 0,
      }),
    ];
    const aggregates = aggregateSubtrees(nodes);

    render(<OrgTable nodes={nodes} aggregates={aggregates} />);

    const rows = screen.getAllByRole('row').slice(1);
    const [budgetCell, performanceCell] = within(rows[0])
      .getAllByRole('cell')
      .slice(3);
    expect(budgetCell.textContent).toMatch(/^12[  ]345[  ]678 руб\.$/);
    expect(performanceCell.textContent).toBe('72,4');

    const emptyPerformanceCell = within(rows[1]).getAllByRole('cell')[4];
    expect(emptyPerformanceCell.textContent).toBe('—');
  });
});
