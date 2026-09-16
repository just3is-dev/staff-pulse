import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { setViewportWidth } from '@/test/match-media';
import { scrollIntoViewSpy } from '@/test/scroll-into-view';
import {
  nameOf,
  queryTableRegion,
  queryTreeRegion,
  rowNamed,
  rowsOf,
  tableRegion,
  toggleButton,
  treeRegion,
} from '@/test/screen-regions';
import { renderOrgScreen } from '@/test/render-org-screen';
import { revalidateWith } from '@/test/revalidate';

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
  await renderOrgScreen({ width: 1440, fetchMock, wrapper });
  return fetchMock;
}

const selectRow = (user: User, name: string) => user.click(rowNamed(name));

describe('OrgTreeScreen: выделение узла по клику на строку', () => {
  it('AC-002-10: клик по строке выделяет её, отмечает узел в дереве, раскрывает свёрнутых предков и прокручивает к узлу', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    await user.click(
      within(treeRegion()).getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    expect(within(treeRegion()).queryByText('Отдел 1')).not.toBeInTheDocument();

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

  it('AC-002-10: повторный клик по той же строке снова прокручивает дерево к узлу', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();

    await selectRow(user, 'Команда 1');
    await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1));
    await selectRow(user, 'Команда 1');

    await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2));
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
    await user.click(toggleButton('Таблица'));
    expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
    await user.click(toggleButton('Дерево'));
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
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('AC-002-13: тот же узел остаётся выделенным в таблице и дереве', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const fetchMock = await renderLoadedScreen(
        vi.fn().mockResolvedValueOnce(jsonResponse(nodes)),
      );
      await selectRow(user, 'Команда 1');
      await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1));

      await revalidateWith(
        fetchMock,
        jsonResponse(
          nodes.map((node) =>
            node.id === 'team-1' ? { ...node, headcount: 7 } : node,
          ),
        ),
      );

      await waitFor(() =>
        expect(
          within(rowNamed('Команда 1')).getAllByRole('cell')[2],
        ).toHaveTextContent('7'),
      );
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(selectedRows().map(nameOf)).toEqual(['Команда 1']);
      expect(currentTreeNodes()).toEqual(['org-node-team-1']);
    });

    it('не раскрывает ветку, которую пользователь свернул после выделения', async () => {
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
        jsonResponse(
          nodes.map((node) =>
            node.id === 'team-1' ? { ...node, headcount: 7 } : node,
          ),
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
    });
  });

  describe('на узком экране', () => {
    it('AC-002-11: клик по строке при виде «Таблица» переключает на «Дерево», отмечает узел, раскрывает предков; в момент вызова scrollIntoView узел уже видим', async () => {
      const user = userEvent.setup();
      await renderOrgScreen({
        width: 1024,
        fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
        wrapper,
      });
      await user.click(toggleButton('Таблица'));
      expect(tableRegion()).toBeVisible();
      expect(queryTreeRegion()).not.toBeInTheDocument();

      let treeSectionHiddenAtCallTime: boolean | undefined;
      scrollIntoViewSpy.mockImplementationOnce(function (this: HTMLElement) {
        treeSectionHiddenAtCallTime =
          this.closest('section')?.hasAttribute('hidden');
      });

      await selectRow(user, 'Команда 1');

      expect(toggleButton('Дерево')).toHaveAttribute('aria-pressed', 'true');
      expect(treeRegion()).toBeVisible();
      expect(queryTableRegion()).not.toBeInTheDocument();
      const treeNode = treeNodeNamed('Команда 1');
      expect(treeNode).toHaveAttribute('aria-current', 'true');
      await waitFor(() => expect(scrollIntoViewSpy).toHaveBeenCalled());
      expect(scrollIntoViewSpy.mock.contexts.at(-1)).toBe(treeNode);
      expect(treeSectionHiddenAtCallTime).toBe(false);
    });

    it('на широком экране клик по строке не меняет вид — выбор «Таблица» переживает переход через 1280px обратно на узкий', async () => {
      const user = userEvent.setup();
      await renderOrgScreen({
        width: 1024,
        fetchMock: vi.fn().mockResolvedValue(jsonResponse(nodes)),
        wrapper,
      });
      await user.click(toggleButton('Таблица'));

      act(() => setViewportWidth(1440));
      await selectRow(user, 'Отдел 2');

      act(() => setViewportWidth(1024));
      expect(toggleButton('Таблица')).toHaveAttribute('aria-pressed', 'true');
      expect(tableRegion()).toBeVisible();
    });
  });
});
