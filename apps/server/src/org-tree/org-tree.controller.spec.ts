import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';
import { createApp } from '../create-app.js';
import { OrgTreeController } from './org-tree.controller.js';
import { OrgTreeService } from './org-tree.service.js';

function maxDepth(nodes: OrgNode[]): number {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (id: string): number => {
    const node = byId.get(id)!;
    return node.parentId === null ? 1 : 1 + depthOf(node.parentId);
  };
  return Math.max(...nodes.map((node) => depthOf(node.id)));
}

function getOrgTree(app: INestApplication, headers: Record<string, string> = {}) {
  return request(app.getHttpServer()).get('/api/org-tree').set(headers);
}

describe('GET /api/org-tree', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('AC-001-1: отвечает 200 и JSON-массивом не меньше 40 валидных узлов', async () => {
    const response = await getOrgTree(app);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(40);
    expect(parseOrgTree(response.body).ok).toBe(true);
  });

  it('AC-001-2: id уникальны, parentId ссылается на существующий узел, циклов нет, глубина не меньше 3, повторный запрос идентичен', async () => {
    const first = await getOrgTree(app);
    const second = await getOrgTree(app);

    expect(second.body).toEqual(first.body);

    const result = parseOrgTree(first.body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(maxDepth(result.nodes)).toBeGreaterThanOrEqual(3);
  });

  it('AC-001-3: условный запрос браузера (If-None-Match + Cache-Control: no-cache) с ETag неизменённых данных получает 304 без тела', async () => {
    const first = await getOrgTree(app);
    const etag = first.headers.etag;
    expect(etag).toEqual(expect.any(String));

    const second = await getOrgTree(app);
    expect(second.headers.etag).toBe(etag);

    const conditional = await getOrgTree(app, {
      'If-None-Match': etag,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    });

    expect(conditional.status).toBe(304);
    expect(conditional.text ?? '').toBe('');
    expect(conditional.body).toEqual({});
  });

  it('ETag из списка в If-None-Match, слабая форма того же ETag и * дают 304', async () => {
    const { etag } = (await getOrgTree(app)).headers;
    const weak = etag.startsWith('W/') ? etag : `W/${etag}`;

    for (const header of [`W/"other", ${etag}`, weak, '*']) {
      const response = await getOrgTree(app, {
        'If-None-Match': header,
        'Cache-Control': 'no-cache',
      });
      expect(response.status).toBe(304);
    }
  });

  it('устаревший ETag в If-None-Match получает 200 с полным списком', async () => {
    const response = await getOrgTree(app, { 'If-None-Match': 'W/"stale"' });

    expect(response.status).toBe(200);
    expect(parseOrgTree(response.body).ok).toBe(true);
  });
});

describe('GET /api/org-tree: ETag при изменении данных', () => {
  const node: OrgNode = {
    id: 'div-1',
    name: 'Дивизион',
    parentId: null,
    headcount: 10,
    budget: 1_000,
    performance: 50,
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
  let current: OrgNode[] = [node];
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrgTreeController],
      providers: [
        { provide: OrgTreeService, useValue: { getOrgTree: () => current } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    current = [node];
  });

  afterAll(async () => {
    await app.close();
  });

  it('после изменения данных меняется ETag, а прежний ETag получает 200 с новыми данными', async () => {
    const before = await getOrgTree(app);

    current = [{ ...node, headcount: 11 }];
    const after = await getOrgTree(app, {
      'If-None-Match': before.headers.etag,
      'Cache-Control': 'no-cache',
    });

    expect(after.status).toBe(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(after.body[0].headcount).toBe(11);
  });
});
