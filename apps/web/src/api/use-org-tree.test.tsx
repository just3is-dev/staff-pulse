import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor, renderHook } from '@testing-library/react';
import type { OrgNode } from '@staff-pulse/shared';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { orgTreeQueryKey, useOrgTree } from './use-org-tree';

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

type PendingRequest = {
  signal: AbortSignal | undefined;
  respond: (body: unknown) => Promise<void>;
};

function mockNetwork() {
  const requests: PendingRequest[] = [];
  const fetchMock = vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        requests.push({
          signal: init?.signal ?? undefined,
          respond: (body) =>
            new Promise<void>((bodyRead) => {
              const response = jsonResponse(body);
              const readJson = response.json.bind(response);
              response.json = async () => {
                const parsed: unknown = await readJson();
                bodyRead();
                return parsed;
              };
              resolve(response);
            }),
        });
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

const { client, wrapper } = setupQueryClient();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOrgTree', () => {
  it('AC-001-6: 5 секунд данные свежие и не перезапрашиваются, затем отдаются из кэша с одним фоновым запросом', async () => {
    const { fetchMock, requests } = mockNetwork();

    const first = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].respond(nodes);
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    await vi.advanceTimersByTimeAsync(4_800);
    const fresh = renderHook(() => useOrgTree(), { wrapper });
    expect(fresh.result.current.data?.nodes).toEqual(nodes);
    expect(fresh.result.current.isFetching).toBe(false);
    fresh.unmount();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    const stale = renderHook(() => useOrgTree(), { wrapper });
    expect(stale.result.current.data?.nodes).toEqual(nodes);
    expect(stale.result.current.isLoading).toBe(false);
    await waitFor(() => expect(stale.result.current.isFetching).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await requests[1].respond(nodes);
    await waitFor(() => expect(stale.result.current.isFetching).toBe(false));
    expect(stale.result.current.data?.nodes).toEqual(nodes);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('AC-001-7: два одновременных обращения порождают один сетевой запрос', async () => {
    const { fetchMock, requests } = mockNetwork();

    const a = renderHook(() => useOrgTree(), { wrapper });
    const b = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(requests).toHaveLength(1));

    await requests[0].respond(nodes);
    await waitFor(() => {
      expect(a.result.current.data?.nodes).toEqual(nodes);
      expect(b.result.current.data?.nodes).toEqual(nodes);
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

    await request.respond(nodes);
    await vi.advanceTimersByTimeAsync(0);
    expect(client().getQueryData(orgTreeQueryKey)).toBeUndefined();
  });

  it('AC-002-12: агрегаты считаются один раз на версию данных — ответ 304 не пересчитывает, новые данные пересчитывают', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(nodes, { etag: '"v1"' }));
    vi.stubGlobal('fetch', fetchMock);

    const view = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    expect(aggregationSpy).toHaveBeenCalledTimes(1);
    const firstData = view.result.current.data;
    expect(firstData?.aggregates.get('div-1')?.headcount).toBe(10);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    await view.result.current.refetch();
    await waitFor(() => expect(view.result.current.isFetching).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(aggregationSpy).toHaveBeenCalledTimes(1);
    expect(view.result.current.data).toBe(firstData);
    expect(view.result.current.data?.aggregates).toBe(firstData?.aggregates);

    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ ...nodes[0], headcount: 15 }], { etag: '"v2"' }),
    );
    await view.result.current.refetch();
    await waitFor(() =>
      expect(view.result.current.data?.aggregates.get('div-1')?.headcount).toBe(
        15,
      ),
    );
    expect(aggregationSpy).toHaveBeenCalledTimes(2);
  });

  it('значение хука остаётся тем же объектом между рендерами без новых данных', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(nodes)));

    const view = renderHook(() => useOrgTree(), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    const data = view.result.current.data;
    view.rerender();
    expect(view.result.current.data).toBe(data);
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
