import { describe, expect, it } from 'vitest';
import { aggregateSubtrees } from '@/org-model/aggregate-subtrees';
import type { OrgNode } from '@staff-pulse/shared';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { fetchCallOf } from '@/test/fetch-call';
import { stubFetch } from '@/test/stub-fetch';
import {
  fetchOrgTree,
  OrgTreeLoadError,
  type OrgTreeSnapshot,
} from './org-tree-request';

const validNodes: OrgNode[] = [
  makeOrgNode({
    id: 'div-1',
    name: 'Дивизион',
    parentId: null,
    headcount: 10,
    budget: 1_000_000,
    performance: 80,
    updatedAt: '2026-09-01T10:00:00.000Z',
  }),
  makeOrgNode({
    id: 'dep-1',
    name: 'Отдел',
    parentId: 'div-1',
    headcount: 5,
    budget: 500_000,
    performance: 60,
    updatedAt: '2026-09-01T10:00:00.000Z',
  }),
];

const expectLoadError = async () => {
  await expect(fetchOrgTree()).rejects.toBeInstanceOf(OrgTreeLoadError);
};

describe('fetchOrgTree', () => {
  it('запрашивает GET /api/org-tree и передаёт сигнал отмены в сетевой вызов', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(validNodes));
    const controller = new AbortController();

    await fetchOrgTree(controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchCallOf(fetchMock);
    expect(url).toBe('/api/org-tree');
    expect(init.signal).toBe(controller.signal);
  });

  it('возвращает проверенные узлы и ETag при валидном ответе', async () => {
    stubFetch(async () => jsonResponse(validNodes, { etag: 'W/"v1"' }));
    await expect(fetchOrgTree()).resolves.toEqual({
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: 'W/"v1"',
    });
  });

  it('без ETag в ответе запоминает etag как null', async () => {
    stubFetch(async () => jsonResponse(validNodes));
    await expect(fetchOrgTree()).resolves.toEqual({
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: null,
    });
  });

  it('с прежним снимком отправляет условный запрос мимо HTTP-кэша браузера', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse(validNodes, { etag: 'W/"v2"' }),
    );
    const previous: OrgTreeSnapshot = {
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: 'W/"v1"',
    };

    await fetchOrgTree(undefined, previous);

    const [, init] = fetchCallOf(fetchMock);
    expect(new Headers(init.headers).get('If-None-Match')).toBe('W/"v1"');
    expect(init.cache).toBe('no-store');
  });

  it('200 на условный запрос заменяет ETag снимка новым', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse(validNodes, { etag: 'W/"v2"' }),
    );
    const previous: OrgTreeSnapshot = {
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: 'W/"v1"',
    };

    const next = await fetchOrgTree(undefined, previous);
    expect(next.etag).toBe('W/"v2"');

    await fetchOrgTree(undefined, next);
    const [, init] = fetchCallOf(fetchMock, 1);
    expect(new Headers(init.headers).get('If-None-Match')).toBe('W/"v2"');
  });

  it('без прежнего ETag не отправляет If-None-Match', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(validNodes));

    await fetchOrgTree(undefined, {
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: null,
    });

    const [, init] = fetchCallOf(fetchMock);
    expect(new Headers(init.headers).has('If-None-Match')).toBe(false);
  });

  it('ответ 304 возвращает прежний снимок тем же объектом', async () => {
    stubFetch(async () => new Response(null, { status: 304 }));
    const previous: OrgTreeSnapshot = {
      nodes: validNodes,
      aggregates: aggregateSubtrees(validNodes),
      etag: 'W/"v1"',
    };

    await expect(fetchOrgTree(undefined, previous)).resolves.toBe(previous);
  });

  it('ответ 304 без прежнего снимка — ошибка загрузки', async () => {
    stubFetch(async () => new Response(null, { status: 304 }));
    await expectLoadError();
  });

  it.each([404, 500, 503])('ответ %s — ошибка загрузки', async (status) => {
    stubFetch(async () => jsonResponse({ message: 'fail' }, { status }));
    await expectLoadError();
  });

  it('сетевой сбой — ошибка загрузки', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expectLoadError();
  });

  it('тело не JSON — ошибка загрузки', async () => {
    stubFetch(async () => new Response('<html>oops</html>', { status: 200 }));
    await expectLoadError();
  });

  it('тело с нарушением формы — ошибка загрузки', async () => {
    stubFetch(async () =>
      jsonResponse([{ ...validNodes[0], performance: 101 }]),
    );
    await expectLoadError();
  });

  it('тело с нарушением структуры — ошибка загрузки', async () => {
    stubFetch(async () =>
      jsonResponse([validNodes[0], { ...validNodes[1], parentId: 'ghost' }]),
    );
    await expectLoadError();
  });

  it('отмена запроса пробрасывается как AbortError, а не как ошибка загрузки', async () => {
    const controller = new AbortController();
    stubFetch(
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
