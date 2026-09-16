import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { setViewportWidth } from '@/test/match-media';
import { nameOf, rowsOf, tableRegion } from '@/test/screen-regions';
import { renderOrgScreen } from '@/test/render-org-screen';
import { revalidateWith } from '@/test/revalidate';

// headcount не по порядку дерева — иначе сортировка по возрастанию
// случайно совпала бы с исходным порядком и ничего бы не доказывала.
const nodes = [
  makeOrgNode({
    id: 'div-1',
    name: 'Дивизион 1',
    parentId: null,
    headcount: 30,
  }),
  makeOrgNode({
    id: 'div-2',
    name: 'Дивизион 2',
    parentId: null,
    headcount: 10,
  }),
  makeOrgNode({
    id: 'div-3',
    name: 'Дивизион 3',
    parentId: null,
    headcount: 20,
  }),
];

const { wrapper } = setupQueryClient();

const activeHeaderOf = () =>
  within(tableRegion())
    .getAllByRole('columnheader')
    .find((header) => header.hasAttribute('aria-sort'));
const sortByHeadcount = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(tableRegion()).getByRole('button', { name: 'Всего сотрудников' }),
  );

describe('OrgTreeScreen: сортировка таблицы', () => {
  it('AC-002-2: сортировка сохраняется после смены вида и перехода ширины через 1280px', async () => {
    const user = userEvent.setup();
    await renderOrgScreen({
      width: 1024,
      fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
      wrapper,
    });

    const viewToggle = () => screen.getByRole('group', { name: 'Вид' });
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    await sortByHeadcount(user);
    expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');
    expect(rowsOf().map(nameOf)).toEqual([
      'Дивизион 2',
      'Дивизион 3',
      'Дивизион 1',
    ]);

    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Дерево' }),
    );
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');

    act(() => setViewportWidth(1440));
    expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');
    expect(rowsOf().map(nameOf)).toEqual([
      'Дивизион 2',
      'Дивизион 3',
      'Дивизион 1',
    ]);
  });

  it('AC-002-12: сортировка не пересчитывает агрегаты', async () => {
    const user = userEvent.setup();
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
      wrapper,
    });
    expect(aggregationSpy).toHaveBeenCalledTimes(1);

    await sortByHeadcount(user);
    await user.dblClick(
      within(tableRegion()).getByRole('button', { name: /Всего сотрудников/ }),
    );

    expect(aggregationSpy).toHaveBeenCalledTimes(1);
  });

  describe('после обновления данных', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('AC-002-13: после обновления данных с теми же id сортировка остаётся активной и учитывает новые агрегаты', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const fetchMock = await renderOrgScreen({
        width: 1440,
        fetchMock: vi.fn().mockResolvedValueOnce(jsonResponse(nodes)),
        wrapper,
      });

      await sortByHeadcount(user);
      expect(rowsOf().map(nameOf)).toEqual([
        'Дивизион 2',
        'Дивизион 3',
        'Дивизион 1',
      ]);

      // div-2 (10) обгоняет div-3 (20) — порядок должен реально
      // перестроиться, а не просто остаться прежним после обновления.
      const updatedNodes = nodes.map((node) =>
        node.id === 'div-2' ? { ...node, headcount: 25 } : node,
      );
      await revalidateWith(fetchMock, jsonResponse(updatedNodes));

      await waitFor(() =>
        expect(rowsOf().map(nameOf)).toEqual([
          'Дивизион 3',
          'Дивизион 2',
          'Дивизион 1',
        ]),
      );
      expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');
    });
  });
});
