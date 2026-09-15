import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';
import { createApp } from '../create-app.js';

function maxDepth(nodes: OrgNode[]): number {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (id: string): number => {
    const node = byId.get(id)!;
    return node.parentId === null ? 1 : 1 + depthOf(node.parentId);
  };
  return Math.max(...nodes.map((node) => depthOf(node.id)));
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
    const response = await request(app.getHttpServer()).get('/api/org-tree');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(40);
    expect(parseOrgTree(response.body).ok).toBe(true);
  });

  it('AC-001-2: id уникальны, parentId ссылается на существующий узел, циклов нет, глубина не меньше 3, повторный запрос идентичен', async () => {
    const first = await request(app.getHttpServer()).get('/api/org-tree');
    const second = await request(app.getHttpServer()).get('/api/org-tree');

    expect(second.body).toEqual(first.body);

    const result = parseOrgTree(first.body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(maxDepth(result.nodes)).toBeGreaterThanOrEqual(3);
  });

  it('AC-001-3: повторный запрос с ETag неизменённых данных получает 304 без тела', async () => {
    const first = await request(app.getHttpServer()).get('/api/org-tree');
    const etag = first.headers.etag;
    expect(etag).toEqual(expect.any(String));

    const second = await request(app.getHttpServer()).get('/api/org-tree');
    expect(second.headers.etag).toBe(etag);

    const conditional = await request(app.getHttpServer())
      .get('/api/org-tree')
      .set('If-None-Match', etag);

    expect(conditional.status).toBe(304);
    expect(conditional.text ?? '').toBe('');
    expect(conditional.body).toEqual({});
  });

  it('устаревший ETag в If-None-Match получает 200 с полным списком', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/org-tree')
      .set('If-None-Match', 'W/"stale"');

    expect(response.status).toBe(200);
    expect(parseOrgTree(response.body).ok).toBe(true);
  });
});
