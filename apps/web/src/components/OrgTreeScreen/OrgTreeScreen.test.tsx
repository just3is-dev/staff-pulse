import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { OrgNode } from '@staff-pulse/shared';
import { createQueryClient } from '@/api/query-client';
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
