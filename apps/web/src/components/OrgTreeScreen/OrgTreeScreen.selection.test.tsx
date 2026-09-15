import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STALE_TIME_MS } from '@/api/query-client';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { setViewportWidth } from '@/test/match-media';
import { scrollIntoViewSpy } from '@/test/scroll-into-view';
import { nameOf, rowsOf, treeRegion } from '@/test/screen-regions';
import { OrgTreeScreen } from './OrgTreeScreen';

const nodes = [
  makeOrgNode({
    id: 'div-1',
    name: 'Дивизион 1',
    parentId: null,
    headcount: 3,
  }),
  makeOrgNode({
    id: 'dep-1',
    name: 'Отдел 1',
    parentId: 'div-1',
    headcount: 2,
  }),
  makeOrgNode({
    id: 'team-1',
    name: 'Команда 1',
    parentId: 'dep-1',
    headcount: 1,
  }),
  makeOrgNode({
    id: 'div-2',
    name: 'Дивизион 2',
    parentId: null,
    headcount: 5,
  }),
  makeOrgNode({
    id: 'dep-2',
    name: 'Отдел 2',
    parentId: 'div-2',
    headcount: 4,
  }),
];

const { wrapper } = setupQueryClient();

type User = ReturnType<typeof userEvent.setup>;

const rowNamed = (name: string) => {
  const row = rowsOf().find((candidate) => nameOf(candidate) === name);
  if (!row) throw new Error(`Нет строки «${name}»`);
  return row;
};
const treeNodeNamed = (name: string) =>
  within(treeRegion())
    .getByText(name)
    .closest<HTMLElement>('[data-testid^="org-node-"]');
const selectedRows = () =>
  rowsOf().filter((row) => row.getAttribute('aria-selected') === 'true');
const currentTreeNodes = () =>
  [...treeRegion().querySelectorAll('[aria-current="true"]')].map((element) =>
    element.getAttribute('data-testid'),
  );

async function renderLoadedScreen(
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(nodes)),
) {
  vi.stubGlobal('fetch', fetchMock);
  render(<OrgTreeScreen />, { wrapper });
  await screen.findByRole('region', { name: 'Таблица' });
  return fetchMock;
}

const selectRow = (user: User, name: string) => user.click(rowNamed(name));

describe('OrgTreeScreen: выделение узла по клику на строку', () => {
  it('AC-002-10: клик по строке выделяет её, отмечает узел в дереве, раскрывает свёрнутых предков и прокручивает к узлу', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    expect(
      within(treeRegion()).queryByText('Команда 1'),
    ).not.toBeInTheDocument();

    await selectRow(user, 'Команда 1');

    expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
    const treeNode = treeNodeNamed('Команда 1');
    expect(treeNode).toBeVisible();
    expect(treeNode).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalled());
    expect(scrollIntoViewSpy.mock.contexts.at(-1)).toBe(treeNode);
  });

  it('AC-002-10: клик по другой строке переносит выделение — выделены только новые строка и узел', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();

    await selectRow(user, 'Команда 1');
    await selectRow(user, 'Отдел 2');

    expect(selectedRows().map(nameOf)).toEqual(['Отдел 2']);
    expect(currentTreeNodes()).toEqual(['org-node-dep-2']);
    expect(treeNodeNamed('Команда 1')).not.toHaveAttribute('aria-current');
  });

  it('AC-002-10: раскрытие предков не сворачивает другие ветви', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();

    await selectRow(user, 'Команда 1');

    expect(within(treeRegion()).getByText('Отдел 2')).toBeVisible();
    expect(
      within(treeRegion()).getByRole('button', { name: 'Свернуть Дивизион 2' }),
    ).toBeInTheDocument();
  });

  it('AC-002-2: выделенный узел сохраняется после смены вида и перехода ширины через 1280px', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    await selectRow(user, 'Команда 1');

    act(() => setViewportWidth(1024));
    const viewToggle = () => screen.getByRole('group', { name: 'Вид' });
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Таблица' }),
    );
    expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
    await user.click(
      within(viewToggle()).getByRole('button', { name: 'Дерево' }),
    );
    expect(currentTreeNodes()).toEqual(['org-node-team-1']);

    act(() => setViewportWidth(1440));
    expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
    expect(currentTreeNodes()).toEqual(['org-node-team-1']);
  });

  it('AC-002-12: выделение не пересчитывает агрегаты', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    expect(aggregationSpy).toHaveBeenCalledTimes(1);

    await selectRow(user, 'Команда 1');
    await selectRow(user, 'Отдел 2');

    expect(aggregationSpy).toHaveBeenCalledTimes(1);
  });

  describe('после обновления данных', () => {
    async function revalidateWith(
      fetchMock: ReturnType<typeof vi.fn>,
      nextNodes: typeof nodes,
    ) {
      fetchMock.mockResolvedValueOnce(jsonResponse(nextNodes));
      await vi.advanceTimersByTimeAsync(STALE_TIME_MS + 100);
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    }

    it('AC-002-13: тот же узел остаётся выделенным в таблице и дереве', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const fetchMock = await renderLoadedScreen(
          vi.fn().mockResolvedValueOnce(jsonResponse(nodes)),
        );
        await selectRow(user, 'Команда 1');

        await revalidateWith(
          fetchMock,
          nodes.map((node) =>
            node.id === 'team-1' ? { ...node, headcount: 7 } : node,
          ),
        );

        await waitFor(() =>
          expect(
            within(rowNamed('Команда 1')).getAllByRole('cell')[2],
          ).toHaveTextContent('7'),
        );
        expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
        expect(currentTreeNodes()).toEqual(['org-node-team-1']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('не раскрывает ветку, которую пользователь свернул после выделения', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const fetchMock = await renderLoadedScreen(
          vi.fn().mockResolvedValueOnce(jsonResponse(nodes)),
        );
        await selectRow(user, 'Команда 1');
        await user.click(
          within(treeRegion()).getByRole('button', {
            name: 'Свернуть Отдел 1',
          }),
        );
        expect(
          within(treeRegion()).queryByText('Команда 1'),
        ).not.toBeInTheDocument();

        await revalidateWith(
          fetchMock,
          nodes.map((node) =>
            node.id === 'team-1' ? { ...node, headcount: 7 } : node,
          ),
        );

        await waitFor(() =>
          expect(
            within(rowNamed('Команда 1')).getAllByRole('cell')[2],
          ).toHaveTextContent('7'),
        );
        expect(
          within(treeRegion()).queryByText('Команда 1'),
        ).not.toBeInTheDocument();
        expect(
          within(treeRegion()).getByRole('button', {
            name: 'Развернуть Отдел 1',
          }),
        ).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
