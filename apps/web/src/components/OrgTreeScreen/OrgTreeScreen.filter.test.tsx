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
  makeOrgNode({ id: 'div-1', name: 'Дивизион продаж', parentId: null }),
  makeOrgNode({ id: 'div-2', name: 'Отдел разработки', parentId: null }),
  makeOrgNode({ id: 'div-3', name: 'Команда поддержки', parentId: null }),
];

const { wrapper } = setupQueryClient();

const tableRegion = () => screen.getByRole('region', { name: 'Таблица' });
const treeRegion = () => screen.getByRole('region', { name: 'Дерево' });
const nameOf = (row: HTMLElement) =>
  within(row).getAllByRole('cell')[0].textContent;
const rowsOf = () => within(tableRegion()).getAllByRole('row').slice(1);
const filterInput = () =>
  within(tableRegion()).getByLabelText('Фильтр по названию');

describe('OrgTreeScreen: фильтр таблицы', () => {
  it('AC-002-2: текст фильтра сохраняется после смены вида и перехода ширины через 1280px', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      installMatchMedia(1024);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
      render(<OrgTreeScreen />, { wrapper });
      await screen.findByRole('group', { name: 'Вид' });
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
    } finally {
      vi.useRealTimers();
    }
  });

  it('AC-002-9: применённый фильтр не меняет дерево', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      installMatchMedia(1440);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
      render(<OrgTreeScreen />, { wrapper });
      await screen.findByRole('region', { name: 'Таблица' });

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
    } finally {
      vi.useRealTimers();
    }
  });

  it('AC-002-12: фильтрация не пересчитывает агрегаты', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      installMatchMedia(1440);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
      render(<OrgTreeScreen />, { wrapper });
      await screen.findByRole('region', { name: 'Таблица' });
      expect(aggregationSpy).toHaveBeenCalledTimes(1);

      await user.type(filterInput(), 'Дивизион');
      await vi.advanceTimersByTimeAsync(300);
      await waitFor(() =>
        expect(rowsOf().map(nameOf)).toEqual(['Дивизион продаж']),
      );

      expect(aggregationSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('AC-002-13: после обновления данных фильтр остаётся активным и применяется к новым данным', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      installMatchMedia(1440);
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(nodes));
      vi.stubGlobal('fetch', fetchMock);
      render(<OrgTreeScreen />, { wrapper });
      await screen.findByRole('region', { name: 'Таблица' });

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
      fetchMock.mockResolvedValueOnce(jsonResponse(updatedNodes));
      await vi.advanceTimersByTimeAsync(STALE_TIME_MS + 100);
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      expect(filterInput()).toHaveValue('Дивизион');
      await waitFor(() =>
        expect(rowsOf().map(nameOf)).toEqual([
          'Дивизион продаж',
          'Дивизион ИТ',
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
