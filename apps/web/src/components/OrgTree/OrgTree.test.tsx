import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrgNode } from '@staff-pulse/shared';
import { OrgTree } from './OrgTree';

const node = (overrides: Partial<OrgNode> & Pick<OrgNode, 'id'>): OrgNode => ({
  name: overrides.id,
  parentId: null,
  headcount: 1,
  budget: 1,
  performance: 50,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const threeLevelFixture: OrgNode[] = [
  node({
    id: 'div-1',
    name: 'Дивизион 1',
    parentId: null,
    headcount: 10,
    performance: 80,
  }),
  node({
    id: 'dep-1',
    name: 'Отдел 1',
    parentId: 'div-1',
    headcount: 20,
    performance: 40,
  }),
  node({
    id: 'team-1',
    name: 'Команда 1',
    parentId: 'dep-1',
    headcount: 5,
    performance: 60,
  }),
];

describe('OrgTree', () => {
  it('AC-001-12: при первом показе первый уровень раскрыт, второй виден и свёрнут, третий не виден', () => {
    render(<OrgTree nodes={threeLevelFixture} />);

    expect(screen.getByText('Дивизион 1')).toBeInTheDocument();
    expect(screen.getByText('Отдел 1')).toBeInTheDocument();
    expect(screen.queryByText('Команда 1')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: 'Развернуть Отдел 1' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-001-13: клик по переключателю раскрывает и сворачивает ветвь; у листа переключателя нет', async () => {
    const user = userEvent.setup();
    render(<OrgTree nodes={threeLevelFixture} />);

    const departmentToggle = screen.getByRole('button', {
      name: 'Развернуть Отдел 1',
    });
    await user.click(departmentToggle);

    expect(screen.getByText('Команда 1')).toBeInTheDocument();
    expect(departmentToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.queryByRole('button', { name: /Команда 1/ }),
    ).not.toBeInTheDocument();

    await user.click(departmentToggle);

    expect(screen.queryByText('Команда 1')).not.toBeInTheDocument();
    expect(departmentToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('AC-001-13: Enter и Space на переключателе раскрывают и сворачивают ветвь', async () => {
    const user = userEvent.setup();
    render(<OrgTree nodes={threeLevelFixture} />);

    const departmentToggle = screen.getByRole('button', {
      name: 'Развернуть Отдел 1',
    });
    departmentToggle.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Команда 1')).toBeInTheDocument();

    await user.keyboard(' ');
    expect(screen.queryByText('Команда 1')).not.toBeInTheDocument();
  });

  it('AC-001-14: каждый видимый узел показывает name, headcount и индикатор performance с числовой альтернативой', () => {
    render(<OrgTree nodes={threeLevelFixture} />);

    const division = within(screen.getByTestId('org-node-div-1'));
    expect(division.getByText('Дивизион 1')).toBeInTheDocument();
    expect(division.getByTestId('node-headcount')).toHaveTextContent('10');
    expect(division.getByTestId('performance-dot')).toBeInTheDocument();
    expect(division.getByTestId('performance-value')).toHaveTextContent('80');

    const department = within(screen.getByTestId('org-node-dep-1'));
    expect(department.getByText('Отдел 1')).toBeInTheDocument();
    expect(department.getByTestId('node-headcount')).toHaveTextContent('20');
    expect(department.getByTestId('performance-dot')).toBeInTheDocument();
    expect(department.getByTestId('performance-value')).toHaveTextContent(
      '40',
    );
  });
});
