import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrgNode } from '@staff-pulse/shared';
import { STALE_TIME_MS } from '@/api/query-client';
import { orgTreeQueryKey } from '@/api/use-org-tree';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { fetchCallOf } from '@/test/request-init';
import { OrgTreeScreen } from './OrgTreeScreen';

const nodes: OrgNode[] = [
  makeOrgNode({
    id: 'div-1',
    name: 'Дивизион',
    parentId: null,
    headcount: 10,
    budget: 1_000_000,
    performance: 80,
    updatedAt: '2026-09-01T10:00:00.000Z',
  }),
];

function neverSettles(): Promise<Response> {
  return new Promise(() => {});
}

const { client, wrapper } = setupQueryClient();

function renderScreen() {
  return render(<OrgTreeScreen />, { wrapper });
}

// Таблица агрегатов (issue #33) показывает те же имена узлов, что и дерево,
// поэтому запросы по тексту узла нужно сузить до области дерева.
const tree = () => within(screen.getByRole('region', { name: 'Дерево' }));

describe('OrgTreeScreen', () => {
  it('AC-001-9: до первого ответа сервера показывает «Загрузка»', () => {
    vi.stubGlobal('fetch', vi.fn(neverSettles));

    renderScreen();

    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-9: при сетевой ошибке показывает «Ошибка» с кнопкой «Повторить»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    renderScreen();

    expect(
      await screen.findByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-9: при ответе 500 показывает «Ошибка» с кнопкой «Повторить»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse('fail', { status: 500 })),
    );

    renderScreen();

    expect(
      await screen.findByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-9: «Повторить» отправляет новый запрос и после успешного ответа показывает дерево', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse('fail', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse(nodes));
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();

    const retryButton = await screen.findByRole('button', {
      name: 'Повторить',
    });
    await user.click(retryButton);

    const treeRegion = await screen.findByRole('region', { name: 'Дерево' });
    expect(within(treeRegion).getByText('Дивизион')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('AC-001-10: пустой массив приводит к состоянию «Пусто», элементов дерева нет', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    );

    renderScreen();

    expect(await screen.findByText('Подразделений нет.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-4: ответ, нарушающий форму, приводит к «Ошибке» без имён узлов на экране', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ ...nodes[0], performance: 101 }])),
    );

    renderScreen();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Дивизион')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-5: ответ, нарушающий структуру дерева, приводит к «Ошибке» без данных ответа на экране', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ ...nodes[0], parentId: 'ghost' }])),
    );

    renderScreen();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Дивизион')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('OrgTreeScreen: фоновая ревалидация', () => {
  const treeNodes: OrgNode[] = [
    makeOrgNode({
      id: 'div-1',
      name: 'Дивизион 1',
      parentId: null,
      headcount: 10,
    }),
    makeOrgNode({
      id: 'dep-1',
      name: 'Отдел 1',
      parentId: 'div-1',
      headcount: 20,
    }),
    makeOrgNode({
      id: 'team-1',
      name: 'Команда 1',
      parentId: 'dep-1',
      headcount: 5,
    }),
    makeOrgNode({
      id: 'div-2',
      name: 'Дивизион 2',
      parentId: null,
      headcount: 30,
    }),
    makeOrgNode({
      id: 'dep-2',
      name: 'Отдел 2',
      parentId: 'div-2',
      headcount: 40,
    }),
    makeOrgNode({
      id: 'team-2',
      name: 'Команда 2',
      parentId: 'dep-2',
      headcount: 7,
    }),
  ];

  const refreshErrorText = 'Не удалось обновить данные';

  const headcountOf = (id: string) =>
    within(screen.getByTestId(`org-node-${id}`)).getByTestId('node-headcount');

  function tableRowFor(name: string) {
    const tableRegion = within(screen.getByRole('region', { name: 'Таблица' }));
    const row = tableRegion
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByText(name));
    if (!row) throw new Error(`Строка таблицы для «${name}» не найдена`);
    return within(row).getAllByRole('cell');
  }

  const tableHeadcountOf = (name: string) => tableRowFor(name)[2];

  function setupUser() {
    return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  }

  async function loadTree(
    fetchMock: ReturnType<typeof vi.fn>,
    {
      response = jsonResponse(treeNodes),
      expectText = 'Дивизион 1',
    }: { response?: Response; expectText?: string } = {},
  ) {
    fetchMock.mockResolvedValueOnce(response);
    renderScreen();
    // Таблица показывает те же имена узлов, что и дерево — findAllByText
    // ждёт появления текста, не требуя единственного совпадения.
    await screen.findAllByText(expectText);
  }

  async function revalidateAfterStaleness(fetchMock: ReturnType<typeof vi.fn>) {
    await vi.advanceTimersByTimeAsync(STALE_TIME_MS + 100);
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['сетевая ошибка', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['ответ 500', () => Promise.resolve(jsonResponse('fail', { status: 500 }))],
    [
      'невалидное тело',
      () =>
        Promise.resolve(jsonResponse([{ ...treeNodes[0], performance: 101 }])),
    ],
  ])(
    'AC-001-11: %s при фоновом обновлении оставляет дерево с прежними данными и раскрытием и показывает уведомление',
    async (_, failingResponse) => {
      const user = setupUser();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await loadTree(fetchMock);
      await user.click(
        screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
      );

      fetchMock.mockImplementationOnce(failingResponse);
      await revalidateAfterStaleness(fetchMock);

      expect(await screen.findByText(refreshErrorText)).toBeInTheDocument();
      expect(headcountOf('div-1')).toHaveTextContent('10');
      expect(
        screen.getByRole('button', { name: 'Развернуть Дивизион 1' }),
      ).toBeInTheDocument();
      expect(tree().queryByText('Отдел 1')).not.toBeInTheDocument();
      expect(tree().getByText('Отдел 2')).toBeInTheDocument();
      expect(
        screen.queryByText('Не удалось загрузить орг-структуру.'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Повторить' }),
      ).not.toBeInTheDocument();
    },
  );

  it('AC-001-11: ошибка фонового обновления при пустом списке оставляет «Пусто» и показывает уведомление', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadTree(fetchMock, {
      response: jsonResponse([]),
      expectText: 'Подразделений нет.',
    });

    fetchMock.mockResolvedValueOnce(jsonResponse('fail', { status: 500 }));
    await revalidateAfterStaleness(fetchMock);

    expect(await screen.findByText(refreshErrorText)).toBeInTheDocument();
    expect(screen.getByText('Подразделений нет.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Повторить' }),
    ).not.toBeInTheDocument();
  });

  it('AC-001-3: ревалидация неизменённых данных — условный запрос, 304, прежние данные и раскрытие', async () => {
    const user = setupUser();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadTree(fetchMock, {
      response: jsonResponse(treeNodes, { etag: 'W/"tree-v1"' }),
    });
    await user.click(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    const cachedBefore = client().getQueryData(orgTreeQueryKey);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    await revalidateAfterStaleness(fetchMock);

    const [, init] = fetchCallOf(fetchMock, 1);
    expect(new Headers(init.headers).get('If-None-Match')).toBe('W/"tree-v1"');
    await waitFor(() =>
      expect(client().getQueryState(orgTreeQueryKey)?.fetchStatus).toBe('idle'),
    );
    expect(client().getQueryData(orgTreeQueryKey)).toBe(cachedBefore);
    expect(headcountOf('div-1')).toHaveTextContent('10');
    expect(
      screen.getByRole('button', { name: 'Развернуть Дивизион 1' }),
    ).toBeInTheDocument();
    expect(tree().queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(screen.queryByText(refreshErrorText)).not.toBeInTheDocument();
  });

  it('AC-001-15: раскрытие и сворачивание, сделанные пользователем, переживают обновление данных', async () => {
    const user = setupUser();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadTree(fetchMock);

    await user.click(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Развернуть Отдел 2' }),
    );
    expect(tree().queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(tree().getByText('Команда 2')).toBeInTheDocument();

    const updatedNodes = treeNodes.map((item) =>
      item.id === 'div-1' || item.id === 'team-2'
        ? { ...item, headcount: item.headcount + 100 }
        : item,
    );
    let respond: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (respond = resolve)),
    );
    await revalidateAfterStaleness(fetchMock);

    await vi.advanceTimersByTimeAsync(50);
    expect(screen.queryByText('Загрузка…')).not.toBeInTheDocument();
    expect(screen.queryByText(refreshErrorText)).not.toBeInTheDocument();
    expect(headcountOf('team-2')).toHaveTextContent('7');

    act(() => respond(jsonResponse(updatedNodes)));
    await waitFor(() => expect(headcountOf('team-2')).toHaveTextContent('107'));
    expect(headcountOf('div-1')).toHaveTextContent('110');
    expect(
      screen.getByRole('button', { name: 'Развернуть Дивизион 1' }),
    ).toBeInTheDocument();
    expect(tree().queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Свернуть Отдел 2' }),
    ).toBeInTheDocument();
    expect(tree().getByText('Команда 2')).toBeInTheDocument();
    expect(screen.queryByText(refreshErrorText)).not.toBeInTheDocument();
  });

  it('AC-002-13: после ревалидации с новыми значениями листа таблица показывает пересчитанные агрегаты в строке листа и всех его предков', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadTree(fetchMock);

    expect(tableHeadcountOf('Команда 1')).toHaveTextContent('5');
    expect(tableHeadcountOf('Отдел 1')).toHaveTextContent('25');
    expect(tableHeadcountOf('Дивизион 1')).toHaveTextContent('35');

    const updatedNodes = treeNodes.map((item) =>
      item.id === 'team-1' ? { ...item, headcount: item.headcount + 50 } : item,
    );
    fetchMock.mockResolvedValueOnce(jsonResponse(updatedNodes));
    await revalidateAfterStaleness(fetchMock);

    await waitFor(() =>
      expect(tableHeadcountOf('Команда 1')).toHaveTextContent('55'),
    );
    expect(tableHeadcountOf('Отдел 1')).toHaveTextContent('75');
    expect(tableHeadcountOf('Дивизион 1')).toHaveTextContent('85');
    expect(tableHeadcountOf('Команда 2')).toHaveTextContent('7');
    expect(tableHeadcountOf('Отдел 2')).toHaveTextContent('47');
    expect(tableHeadcountOf('Дивизион 2')).toHaveTextContent('77');
  });
});
