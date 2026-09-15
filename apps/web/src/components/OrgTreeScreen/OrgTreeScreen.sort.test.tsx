import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STALE_TIME_MS } from '@/api/query-client';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { installMatchMedia, setViewportWidth } from '@/test/match-media';
import { OrgTreeScreen } from './OrgTreeScreen';

const nodes = [
  makeOrgNode({
    id: 'div-1',
    name: 'Дивизион 1',
    parentId: null,
    headcount: 10,
  }),
  makeOrgNode({
    id: 'div-2',
    name: 'Дивизион 2',
    parentId: null,
    headcount: 20,
  }),
  makeOrgNode({
    id: 'div-3',
    name: 'Дивизион 3',
    parentId: null,
    headcount: 30,
  }),
];

const { wrapper } = setupQueryClient();

const tableRegion = () => screen.getByRole('region', { name: 'Таблица' });
const nameOf = (row: HTMLElement) =>
  within(row).getAllByRole('cell')[0].textContent;
const rowsOf = () => within(tableRegion()).getAllByRole('row').slice(1);
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
    installMatchMedia(1024);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
    render(<OrgTreeScreen />, { wrapper });
    await screen.findByRole('group', { name: 'Вид' });

    const viewToggle = () => screen.getByRole('group', { name: 'Вид' });
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    await sortByHeadcount(user);
    expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');

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
      'Дивизион 1',
      'Дивизион 2',
      'Дивизион 3',
    ]);
  });

  it('AC-002-12: сортировка не пересчитывает агрегаты', async () => {
    const user = userEvent.setup();
    installMatchMedia(1440);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
    render(<OrgTreeScreen />, { wrapper });
    await screen.findByRole('region', { name: 'Таблица' });
    expect(aggregationSpy).toHaveBeenCalledTimes(1);

    await sortByHeadcount(user);
    await user.dblClick(
      within(tableRegion()).getByRole('button', { name: /Всего сотрудников/ }),
    );

    expect(aggregationSpy).toHaveBeenCalledTimes(1);
  });

  it('AC-002-13: после обновления данных с теми же id сортировка остаётся активной и учитывает новые агрегаты', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    installMatchMedia(1440);
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(nodes));
    vi.stubGlobal('fetch', fetchMock);
    render(<OrgTreeScreen />, { wrapper });
    await screen.findByRole('region', { name: 'Таблица' });

    await sortByHeadcount(user);
    expect(rowsOf().map(nameOf)).toEqual([
      'Дивизион 1',
      'Дивизион 2',
      'Дивизион 3',
    ]);

    const updatedNodes = nodes.map((node) =>
      node.id === 'div-1' ? { ...node, headcount: 25 } : node,
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(updatedNodes));
    await vi.advanceTimersByTimeAsync(STALE_TIME_MS + 100);
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual([
        'Дивизион 2',
        'Дивизион 1',
        'Дивизион 3',
      ]),
    );
    expect(activeHeaderOf()).toHaveAttribute('aria-sort', 'ascending');

    vi.useRealTimers();
  });
});
