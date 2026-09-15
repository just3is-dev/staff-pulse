import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('AC-002-6: клик по текстовому столбцу сортирует по алфавиту без учёта регистра, двойной клик — по убыванию', async () => {
    const user = userEvent.setup();
    const nodes = [
      makeOrgNode({ id: 'a', name: 'Яблоко', parentId: null }),
      makeOrgNode({ id: 'b', name: 'айсберг', parentId: null }),
      makeOrgNode({ id: 'c', name: 'Берёза', parentId: null }),
    ];
    const aggregates = aggregateSubtrees(nodes);
    render(<OrgTable nodes={nodes} aggregates={aggregates} />);
    const nameOf = (row: HTMLElement) =>
      within(row).getAllByRole('cell')[0].textContent;

    await user.click(screen.getByRole('button', { name: 'Подразделение' }));

    expect(screen.getAllByRole('row').slice(1).map(nameOf)).toEqual([
      'айсберг',
      'Берёза',
      'Яблоко',
    ]);

    await user.dblClick(screen.getByRole('button', { name: /Подразделение/ }));

    expect(screen.getAllByRole('row').slice(1).map(nameOf)).toEqual([
      'Яблоко',
      'Берёза',
      'айсберг',
    ]);
  });

  it('AC-002-6: клик по числовому столбцу сортирует по значению, двойной клик — по убыванию', async () => {
    const user = userEvent.setup();
    const nodes = [
      makeOrgNode({ id: 'a', name: 'a', parentId: null, headcount: 20 }),
      makeOrgNode({ id: 'b', name: 'b', parentId: null, headcount: 5 }),
      makeOrgNode({ id: 'c', name: 'c', parentId: null, headcount: 10 }),
    ];
    const aggregates = aggregateSubtrees(nodes);
    render(<OrgTable nodes={nodes} aggregates={aggregates} />);
    const nameOf = (row: HTMLElement) =>
      within(row).getAllByRole('cell')[0].textContent;

    await user.click(screen.getByRole('button', { name: 'Всего сотрудников' }));

    expect(screen.getAllByRole('row').slice(1).map(nameOf)).toEqual([
      'b',
      'c',
      'a',
    ]);

    await user.dblClick(
      screen.getByRole('button', { name: /Всего сотрудников/ }),
    );

    expect(screen.getAllByRole('row').slice(1).map(nameOf)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });

  it('AC-002-6: признак направления сортировки виден только у активного столбца', async () => {
    const user = userEvent.setup();
    const nodes = [
      makeOrgNode({ id: 'a', name: 'a', parentId: null, headcount: 1 }),
      makeOrgNode({ id: 'b', name: 'b', parentId: null, headcount: 2 }),
    ];
    const aggregates = aggregateSubtrees(nodes);
    render(<OrgTable nodes={nodes} aggregates={aggregates} />);

    await user.click(screen.getByRole('button', { name: 'Всего сотрудников' }));

    const headers = screen.getAllByRole('columnheader');
    const activeHeader = headers.find(
      (header) => header.textContent === 'Всего сотрудников ▲',
    );
    expect(activeHeader).toHaveAttribute('aria-sort', 'ascending');
    for (const header of headers) {
      if (header === activeHeader) continue;
      expect(header).not.toHaveAttribute('aria-sort');
    }

    await user.dblClick(
      screen.getByRole('button', { name: /Всего сотрудников/ }),
    );
    expect(activeHeader).toHaveAttribute('aria-sort', 'descending');
  });
});
