import { describe, expect, it } from 'vitest';
import { parseOrgTree } from '@staff-pulse/shared';

describe('общий пакет @staff-pulse/shared в клиенте', () => {
  it('подключается и проверяет ответ орг-структуры', () => {
    expect(parseOrgTree([]).ok).toBe(true);
    expect(parseOrgTree({}).ok).toBe(false);
  });
});
