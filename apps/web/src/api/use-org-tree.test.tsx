import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { OrgNode } from '@staff-pulse/shared';
import { createQueryClient } from './query-client';
import { orgTreeQueryKey, useOrgTree } from './use-org-tree';

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

const T0 = new Date('2026-09-14T12:00:00.000Z');

type PendingRequest = {
  signal: AbortSignal | undefined;
  respond: (body: unknown) => void;
};

/** Мок сети: каждый вызов fetch ждёт, пока тест явно не ответит на него. */
function mockNetwork() {
  const requests: PendingRequest[] = [];
  const fetchMock = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        requests.push({
          signal: init?.signal ?? undefined,
          respond: (body) =>
            resolve(
              new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            ),
        });
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  // Управляемые часы: свежесть данных TanStack Query считает по Date.now().
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useOrgTree', () => {
  it('AC-001-6: 5 секунд данные свежие и не перезапрашиваются, затем отдаются из кэша с одним фоновым запросом', async () => {
    const { fetchMock, requests } = mockNetwork();

    const first = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].respond(nodes);
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    vi.setSystemTime(T0.getTime() + 4_900);
    const fresh = renderHook(() => useOrgTree(), { wrapper });
    expect(fresh.result.current.data).toEqual(nodes);
    expect(fresh.result.current.isFetching).toBe(false);
    fresh.unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0.getTime() + 5_100);
    const stale = renderHook(() => useOrgTree(), { wrapper });
    expect(stale.result.current.data).toEqual(nodes);
    expect(stale.result.current.isLoading).toBe(false);
    await waitFor(() => expect(stale.result.current.isFetching).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    requests[1].respond(nodes);
    await waitFor(() => expect(stale.result.current.isFetching).toBe(false));
    expect(stale.result.current.data).toEqual(nodes);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('AC-001-7: два одновременных обращения порождают один сетевой запрос', async () => {
    const { fetchMock, requests } = mockNetwork();

    const a = renderHook(() => useOrgTree(), { wrapper });
    const b = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));

    requests[0].respond(nodes);
    await waitFor(() => {
      expect(a.result.current.data).toEqual(nodes);
      expect(b.result.current.data).toEqual(nodes);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('AC-001-8: размонтирование до ответа отменяет запрос, пришедший позже ответ не попадает в кэш', async () => {
    const { requests } = mockNetwork();

    const view = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    const [request] = requests;
    expect(request.signal?.aborted).toBe(false);

    view.unmount();
    await waitFor(() => expect(request.signal?.aborted).toBe(true));

    request.respond(nodes);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryClient.getQueryData(orgTreeQueryKey)).toBeUndefined();
  });

  it('ошибка запроса не повторяется автоматически', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fail', { status: 500 })),
    );

    const view = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
