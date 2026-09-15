import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrgNode } from '@staff-pulse/shared';
import {
  fetchOrgTree,
  OrgTreeLoadError,
  type OrgTreeSnapshot,
} from './org-tree-request';

const validNodes: OrgNode[] = [
  {
    id: 'div-1',
    name: 'Дивизион',
    parentId: null,
    headcount: 10,
    budget: 1_000_000,
    performance: 80,
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'dep-1',
    name: 'Отдел',
    parentId: 'div-1',
    headcount: 5,
    budget: 500_000,
    performance: 60,
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

const mockFetch = (impl: () => Promise<Response>) => {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const json = (body: unknown, status = 200, etag?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { ETag: etag } : {}),
    },
  });

const expectLoadError = async () => {
  await expect(fetchOrgTree()).rejects.toBeInstanceOf(OrgTreeLoadError);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOrgTree', () => {
  it('запрашивает GET /api/org-tree и передаёт сигнал отмены в сетевой вызов', async () => {
    const fetchMock = mockFetch(async () => json(validNodes));
    const controller = new AbortController();

    await fetchOrgTree(controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/org-tree');
    expect(init.signal).toBe(controller.signal);
  });

  it('возвращает проверенные узлы и ETag при валидном ответе', async () => {
    mockFetch(async () => json(validNodes, 200, 'W/"v1"'));
    await expect(fetchOrgTree()).resolves.toEqual({
      nodes: validNodes,
      etag: 'W/"v1"',
    });
  });

  it('без ETag в ответе запоминает etag как null', async () => {
    mockFetch(async () => json(validNodes));
    await expect(fetchOrgTree()).resolves.toEqual({
      nodes: validNodes,
      etag: null,
    });
  });

  it('с прежним снимком отправляет условный запрос мимо HTTP-кэша браузера', async () => {
    const fetchMock = mockFetch(async () => json(validNodes, 200, 'W/"v2"'));
    const previous: OrgTreeSnapshot = { nodes: validNodes, etag: 'W/"v1"' };

    await fetchOrgTree(undefined, previous);

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new Headers(init.headers).get('If-None-Match')).toBe('W/"v1"');
    expect(init.cache).toBe('no-store');
  });

  it('200 на условный запрос заменяет ETag снимка новым', async () => {
    const fetchMock = mockFetch(async () => json(validNodes, 200, 'W/"v2"'));
    const previous: OrgTreeSnapshot = { nodes: validNodes, etag: 'W/"v1"' };

    const next = await fetchOrgTree(undefined, previous);
    expect(next.etag).toBe('W/"v2"');

    await fetchOrgTree(undefined, next);
    const [, init] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(new Headers(init.headers).get('If-None-Match')).toBe('W/"v2"');
  });

  it('без прежнего ETag не отправляет If-None-Match', async () => {
    const fetchMock = mockFetch(async () => json(validNodes));

    await fetchOrgTree(undefined, { nodes: validNodes, etag: null });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(new Headers(init.headers).has('If-None-Match')).toBe(false);
  });

  it('ответ 304 возвращает прежний снимок тем же объектом', async () => {
    mockFetch(async () => new Response(null, { status: 304 }));
    const previous: OrgTreeSnapshot = { nodes: validNodes, etag: 'W/"v1"' };

    await expect(fetchOrgTree(undefined, previous)).resolves.toBe(previous);
  });

  it('ответ 304 без прежнего снимка — ошибка загрузки', async () => {
    mockFetch(async () => new Response(null, { status: 304 }));
    await expectLoadError();
  });

  it.each([404, 500, 503])('ответ %s — ошибка загрузки', async (status) => {
    mockFetch(async () => json({ message: 'fail' }, status));
    await expectLoadError();
  });

  it('сетевой сбой — ошибка загрузки', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expectLoadError();
  });

  it('тело не JSON — ошибка загрузки', async () => {
    mockFetch(async () => new Response('<html>oops</html>', { status: 200 }));
    await expectLoadError();
  });

  it('тело с нарушением формы — ошибка загрузки', async () => {
    mockFetch(async () => json([{ ...validNodes[0], performance: 101 }]));
    await expectLoadError();
  });

  it('тело с нарушением структуры — ошибка загрузки', async () => {
    mockFetch(async () =>
      json([validNodes[0], { ...validNodes[1], parentId: 'ghost' }]),
    );
    await expectLoadError();
  });

  it('отмена запроса пробрасывается как AbortError, а не как ошибка загрузки', async () => {
    const controller = new AbortController();
    mockFetch(
      () =>
        new Promise<Response>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    const pending = fetchOrgTree(controller.signal);
    controller.abort();

    const error = await pending.catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(OrgTreeLoadError);
    expect((error as DOMException).name).toBe('AbortError');
  });
});
