import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { setViewportWidth } from '@/test/match-media';
import { nameOf, rowsOf, tableRegion, treeRegion } from '@/test/screen-regions';
import { renderOrgScreen } from '@/test/render-org-screen';
import { revalidateWith } from '@/test/revalidate';

const nodes = [
  makeOrgNode({ id: 'div-1', name: 'Дивизион продаж', parentId: null }),
  makeOrgNode({ id: 'div-2', name: 'Отдел разработки', parentId: null }),
  makeOrgNode({ id: 'div-3', name: 'Команда поддержки', parentId: null }),
];

const { wrapper } = setupQueryClient();

const filterInput = () =>
  within(tableRegion()).getByLabelText('Фильтр по названию');

describe('OrgTreeScreen: фильтр таблицы', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC-002-2: текст фильтра сохраняется после смены вида и перехода ширины через 1280px', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderOrgScreen({
      width: 1024,
      fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
      wrapper,
    });
    const viewToggle = () => screen.getByRole('group', { name: 'Вид' });

    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    await user.type(filterInput(), 'Дивизион');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']),
    );

    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Дерево' }),
    );
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    expect(filterInput()).toHaveValue('Дивизион');
    expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']);

    act(() => setViewportWidth(1440));
    expect(filterInput()).toHaveValue('Дивизион');
    expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']);
  });

  it('AC-002-9: применённый фильтр не меняет дерево', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
      wrapper,
    });

    await user.type(filterInput(), 'Дивизион');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']),
    );

    expect(
      within(treeRegion()).getByText('Дивизион продаж'),
    ).toBeInTheDocument();
    expect(
      within(treeRegion()).getByText('Отдел разработки'),
    ).toBeInTheDocument();
    expect(
      within(treeRegion()).getByText('Команда поддержки'),
    ).toBeInTheDocument();
  });

  it('AC-002-12: фильтрация не пересчитывает агрегаты', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
      wrapper,
    });
    expect(aggregationSpy).toHaveBeenCalledTimes(1);

    await user.type(filterInput(), 'Дивизион');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']),
    );

    expect(aggregationSpy).toHaveBeenCalledTimes(1);
  });

  it('AC-002-13: после обновления данных фильтр остаётся активным и применяется к новым данным', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn().mockResolvedValueOnce(jsonResponse(nodes)),
      wrapper,
    });

    await user.type(filterInput(), 'Дивизион');
    await vi.advanceTimersByTimeAsync(300);
    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']),
    );

    // div-2 переименован так, что теперь тоже совпадает с фильтром —
    // список строк должен пересчитаться по новым данным, а не остаться прежним.
    const updatedNodes = nodes.map((node) =>
      node.id === 'div-2' ? { ...node, name: 'Дивизион ИТ' } : node,
    );
    await revalidateWith(fetchMock, jsonResponse(updatedNodes));

    expect(filterInput()).toHaveValue('Дивизион');
    await waitFor(() =>
      expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж', 'Дивизион ИТ']),
    );
  });
});
