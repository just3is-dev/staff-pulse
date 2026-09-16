import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrgNode } from '@staff-pulse/shared';
import { orgTreeQueryKey } from '@/api/use-org-tree';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { fetchCallOf } from '@/test/request-init';
import { renderOrgScreen } from '@/test/render-org-screen';
import { revalidateWith } from '@/test/revalidate';

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

const tree = () => within(screen.getByRole('region', { name: 'Дерево' }));

describe('OrgTreeScreen', () => {
  it('AC-001-9: до первого ответа сервера показывает «Загрузка»', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(neverSettles),
      wrapper,
      awaitReady: false,
    });

    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-9: при сетевой ошибке показывает «Ошибка» с кнопкой «Повторить»', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
      wrapper,
      awaitReady: false,
    });

    expect(
      await screen.findByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-9: при ответе 500 показывает «Ошибка» с кнопкой «Повторить»', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(async () => jsonResponse('fail', { status: 500 })),
      wrapper,
      awaitReady: false,
    });

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

    await renderOrgScreen({
      width: 1440,
      fetchMock,
      wrapper,
      awaitReady: false,
    });

    const retryButton = await screen.findByRole('button', {
      name: 'Повторить',
    });
    await user.click(retryButton);

    const treeRegion = await screen.findByRole('region', { name: 'Дерево' });
    expect(within(treeRegion).getByText('Дивизион')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('AC-001-10: пустой массив приводит к состоянию «Пусто», элементов дерева нет', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(async () => jsonResponse([])),
      wrapper,
      awaitReady: false,
    });

    expect(await screen.findByText('Подразделений нет.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-4: ответ, нарушающий форму, приводит к «Ошибке» без имён узлов на экране', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(async () =>
        jsonResponse([{ ...nodes[0], performance: 101 }]),
      ),
      wrapper,
      awaitReady: false,
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Дивизион')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('AC-001-5: ответ, нарушающий структуру дерева, приводит к «Ошибке» без данных ответа на экране', async () => {
    await renderOrgScreen({
      width: 1440,
      fetchMock: vi.fn(async () =>
        jsonResponse([{ ...nodes[0], parentId: 'ghost' }]),
      ),
      wrapper,
      awaitReady: false,
    });

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
    await renderOrgScreen({
      width: 1440,
      fetchMock,
      wrapper,
      awaitReady: false,
    });
    await screen.findAllByText(expectText);
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
      await loadTree(fetchMock);
      await user.click(
        screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
      );

      await revalidateWith(fetchMock, failingResponse);

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
    await loadTree(fetchMock, {
      response: jsonResponse([]),
      expectText: 'Подразделений нет.',
    });

    await revalidateWith(fetchMock, jsonResponse('fail', { status: 500 }));

    expect(await screen.findByText(refreshErrorText)).toBeInTheDocument();
    expect(screen.getByText('Подразделений нет.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Повторить' }),
    ).not.toBeInTheDocument();
  });

  it('AC-001-3: ревалидация неизменённых данных — условный запрос, 304, прежние данные и раскрытие', async () => {
    const user = setupUser();
    const fetchMock = vi.fn();
    await loadTree(fetchMock, {
      response: jsonResponse(treeNodes, { etag: 'W/"tree-v1"' }),
    });
    await user.click(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    const cachedBefore = client().getQueryData(orgTreeQueryKey);

    await revalidateWith(fetchMock, new Response(null, { status: 304 }));

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
    await revalidateWith(
      fetchMock,
      () => new Promise<Response>((resolve) => (respond = resolve)),
    );

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
    await loadTree(fetchMock);

    expect(tableHeadcountOf('Команда 1').textContent).toBe('5');
    expect(tableHeadcountOf('Отдел 1').textContent).toBe('25');
    expect(tableHeadcountOf('Дивизион 1').textContent).toBe('35');

    const updatedNodes = treeNodes.map((item) =>
      item.id === 'team-1' ? { ...item, headcount: item.headcount + 50 } : item,
    );
    await revalidateWith(fetchMock, jsonResponse(updatedNodes));

    await waitFor(() =>
      expect(tableHeadcountOf('Команда 1').textContent).toBe('55'),
    );
    expect(tableHeadcountOf('Отдел 1').textContent).toBe('75');
    expect(tableHeadcountOf('Дивизион 1').textContent).toBe('85');
    expect(tableHeadcountOf('Команда 2').textContent).toBe('7');
    expect(tableHeadcountOf('Отдел 2').textContent).toBe('47');
    expect(tableHeadcountOf('Дивизион 2').textContent).toBe('77');
  });
});
