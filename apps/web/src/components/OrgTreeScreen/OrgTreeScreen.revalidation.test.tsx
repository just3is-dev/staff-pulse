import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { OrgNode } from '@staff-pulse/shared';
import { createQueryClient } from '@/api/query-client';
import { OrgTreeScreen } from './OrgTreeScreen';

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

const initialNodes: OrgNode[] = [
  node({ id: 'div-1', name: 'Дивизион 1', parentId: null, headcount: 10 }),
  node({ id: 'dep-1', name: 'Отдел 1', parentId: 'div-1', headcount: 20 }),
  node({ id: 'team-1', name: 'Команда 1', parentId: 'dep-1', headcount: 5 }),
  node({ id: 'div-2', name: 'Дивизион 2', parentId: null, headcount: 30 }),
  node({ id: 'dep-2', name: 'Отдел 2', parentId: 'div-2', headcount: 40 }),
  node({ id: 'team-2', name: 'Команда 2', parentId: 'dep-2', headcount: 7 }),
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let queryClient: QueryClient;

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrgTreeScreen />
    </QueryClientProvider>,
  );
}

async function loadInitialTree(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockResolvedValueOnce(jsonResponse(initialNodes));
  renderScreen();
  await screen.findByText('Дивизион 1');
}

async function revalidateAfterStaleness(fetchMock: ReturnType<typeof vi.fn>) {
  await vi.advanceTimersByTimeAsync(5_100);
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
}

const headcountOf = (id: string) =>
  within(screen.getByTestId(`org-node-${id}`)).getByTestId('node-headcount');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('OrgTreeScreen: фоновая ревалидация', () => {
  it.each([
    ['сетевая ошибка', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['ответ 500', () => Promise.resolve(jsonResponse('fail', 500))],
    [
      'невалидное тело',
      () =>
        Promise.resolve(
          jsonResponse([{ ...initialNodes[0], performance: 101 }]),
        ),
    ],
  ])(
    'AC-001-11: %s при фоновом обновлении оставляет дерево с прежними данными и показывает уведомление',
    async (_, failingResponse) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await loadInitialTree(fetchMock);

      fetchMock.mockImplementationOnce(failingResponse);
      await revalidateAfterStaleness(fetchMock);

      expect(
        await screen.findByText('Не удалось обновить данные'),
      ).toBeInTheDocument();
      expect(screen.getByText('Дивизион 1')).toBeInTheDocument();
      expect(screen.getByText('Отдел 1')).toBeInTheDocument();
      expect(headcountOf('div-1')).toHaveTextContent('10');
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
    await loadInitialTree(fetchMock);

    await user.click(
      screen.getByRole('button', { name: 'Свернуть Дивизион 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Развернуть Отдел 2' }),
    );
    expect(screen.queryByText('Отдел 1')).not.toBeInTheDocument();
    expect(screen.getByText('Команда 2')).toBeInTheDocument();

    const updatedNodes = initialNodes.map((item) =>
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
  });
});
