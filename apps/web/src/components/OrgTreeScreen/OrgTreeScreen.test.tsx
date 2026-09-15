import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { OrgNode } from '@staff-pulse/shared';
import { createQueryClient, STALE_TIME_MS } from '@/api/query-client';
import { OrgTreeScreen } from './OrgTreeScreen';

const nodes: OrgNode[] = [
  {
    id: 'div-1',
    name: 'Дивизион',
    parentId: null,
    headcount: 10,
    budget: 1_000_000,
    performance: 80,
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function neverSettles(): Promise<Response> {
  return new Promise(() => {});
}

let queryClient: QueryClient;

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrgTreeScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe('OrgTreeScreen', () => {
  it('AC-001-9: до первого ответа сервера показывает «Загрузка»', () => {
    vi.stubGlobal('fetch', vi.fn(neverSettles));

    renderScreen();

    expect(screen.getByRole('status')).toHaveTextContent('Загрузка');
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
  });

  it('AC-001-9: при ответе 500 показывает «Ошибка» с кнопкой «Повторить»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse('fail', 500)),
    );

    renderScreen();

    expect(
      await screen.findByRole('button', { name: 'Повторить' }),
    ).toBeInTheDocument();
  });

  it('AC-001-9: «Повторить» отправляет новый запрос и после успешного ответа показывает дерево', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse('fail', 500))
      .mockResolvedValueOnce(jsonResponse(nodes));
    vi.stubGlobal('fetch', fetchMock);

    renderScreen();

    const retryButton = await screen.findByRole('button', {
      name: 'Повторить',
    });
    await user.click(retryButton);

    expect(await screen.findByText('Дивизион')).toBeInTheDocument();
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
  });

  it('AC-001-4: ответ, нарушающий форму, приводит к «Ошибке» без имён узлов на экране', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ ...nodes[0], performance: 101 }])),
    );

    renderScreen();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Дивизион')).not.toBeInTheDocument();
  });

  it('AC-001-5: ответ, нарушающий структуру дерева, приводит к «Ошибке» без данных ответа на экране', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([{ ...nodes[0], parentId: 'ghost' }])),
    );

    renderScreen();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Дивизион')).not.toBeInTheDocument();
  });
});

describe('OrgTreeScreen: фоновая ревалидация', () => {
  const node = (
    overrides: Partial<OrgNode> & Pick<OrgNode, 'id' | 'parentId'>,
  ): OrgNode => ({
    name: overrides.id,
    headcount: 1,
    budget: 1_000,
    performance: 50,
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  });

  const treeNodes: OrgNode[] = [
    node({ id: 'div-1', name: 'Дивизион 1', parentId: null, headcount: 10 }),
    node({ id: 'dep-1', name: 'Отдел 1', parentId: 'div-1', headcount: 20 }),
    node({ id: 'team-1', name: 'Команда 1', parentId: 'dep-1', headcount: 5 }),
    node({ id: 'div-2', name: 'Дивизион 2', parentId: null, headcount: 30 }),
    node({ id: 'dep-2', name: 'Отдел 2', parentId: 'div-2', headcount: 40 }),
    node({ id: 'team-2', name: 'Команда 2', parentId: 'dep-2', headcount: 7 }),
  ];

  const refreshErrorText = 'Не удалось обновить данные';

  const headcountOf = (id: string) =>
    within(screen.getByTestId(`org-node-${id}`)).getByTestId('node-headcount');

  async function loadTree(fetchMock: ReturnType<typeof vi.fn>) {
    fetchMock.mockResolvedValueOnce(jsonResponse(treeNodes));
    renderScreen();
    await screen.findByText('Дивизион 1');
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
    ['ответ 500', () => Promise.resolve(jsonResponse('fail', 500))],
    [
      'невалидное тело',
      () =>
        Promise.resolve(jsonResponse([{ ...treeNodes[0], performance: 101 }])),
    ],
  ])(
    'AC-001-11: %s при фоновом обновлении оставляет дерево с прежними данными и раскрытием и показывает уведомление',
    async (_, failingResponse) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
      expect(screen.queryByText('Отдел 1')).not.toBeInTheDocument();
      expect(screen.getByText('Отдел 2')).toBeInTheDocument();
      expect(
        screen.queryByText('Не удалось загрузить орг-структуру.'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Повторить' }),
      ).not.toBeInTheDocument();
    },
  );

  it('AC-001-15: раскрытие и сворачивание, сделанные пользователем, переживают обновление данных', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await loadTree(fetchMock);

    await user.click(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Развернуть Отдел 2' }),
    );
    expect(screen.queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(screen.getByText('Команда 2')).toBeInTheDocument();

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
    expect(headcountOf('team-2')).toHaveTextContent('7');

    act(() => respond(jsonResponse(updatedNodes)));
    await waitFor(() => expect(headcountOf('team-2')).toHaveTextContent('107'));
    expect(headcountOf('div-1')).toHaveTextContent('110');
    expect(
      screen.getByRole('button', { name: 'Развернуть Дивизион 1' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Свернуть Отдел 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Команда 2')).toBeInTheDocument();
    expect(screen.queryByText(refreshErrorText)).not.toBeInTheDocument();
  });
});
