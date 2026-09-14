import { describe, expect, it } from 'vitest';
import { parseOrgTree, type OrgNode } from './index.ts';

const node = (overrides: Partial<OrgNode> = {}): OrgNode => ({
  id: 'div-1',
  name: 'Дивизион',
  parentId: null,
  headcount: 10,
  budget: 1_000_000,
  performance: 80,
  updatedAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
});

const forest: OrgNode[] = [
  node({ id: 'div-1' }),
  node({ id: 'dep-1', parentId: 'div-1' }),
  node({ id: 'team-1', parentId: 'dep-1' }),
  node({ id: 'div-2' }),
  node({ id: 'dep-2', parentId: 'div-2' }),
];

const expectRejected = (input: unknown, kind: string) => {
  const result = parseOrgTree(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.kind).toBe(kind);
};

describe('parseOrgTree: форма ответа', () => {
  it('принимает валидный лес из нескольких корней и возвращает узлы', () => {
    const result = parseOrgTree(forest);
    expect(result).toEqual({ ok: true, nodes: forest });
  });

  it('принимает пустой массив', () => {
    expect(parseOrgTree([])).toEqual({ ok: true, nodes: [] });
  });

  it.each([
    ['объект', { nodes: forest }],
    ['строка', 'not an array'],
    ['null', null],
  ])('отклоняет ответ, который не массив: %s', (_, input) => {
    expectRejected(input, 'shape');
  });

  it.each([
    'id',
    'name',
    'parentId',
    'headcount',
    'budget',
    'performance',
    'updatedAt',
  ] as const)('отклоняет узел без обязательного поля %s', (field) => {
    const broken: Record<string, unknown> = { ...node() };
    delete broken[field];
    expectRejected([broken], 'shape');
  });

  it.each([
    ['id', 42],
    ['name', null],
    ['parentId', 7],
    ['headcount', '10'],
    ['budget', '1000'],
    ['performance', '80'],
    ['updatedAt', 1_725_000_000],
  ])('отклоняет поле %s неверного типа', (field, value) => {
    expectRejected([{ ...node(), [field]: value }], 'shape');
  });

  it.each([-1, 100.5, 101])('отклоняет performance вне 0–100: %s', (value) => {
    expectRejected([node({ performance: value })], 'shape');
  });

  it('принимает граничные значения performance 0 и 100', () => {
    expect(
      parseOrgTree([
        node({ id: 'a', performance: 0 }),
        node({ id: 'b', performance: 100 }),
      ]).ok,
    ).toBe(true);
  });

  it('отклоняет отрицательный headcount', () => {
    expectRejected([node({ headcount: -1 })], 'shape');
  });

  it('отклоняет отрицательный budget', () => {
    expectRejected([node({ budget: -1 })], 'shape');
  });

  it('отклоняет нецелые headcount и budget', () => {
    expectRejected([node({ headcount: 1.5 })], 'shape');
    expectRejected([node({ budget: 100.25 })], 'shape');
  });

  it.each([
    'вчера',
    '2026-13-01T00:00:00.000Z',
    '2026-02-30T00:00:00.000Z',
    '',
  ])('отклоняет невалидный updatedAt: %s', (value) => {
    expectRejected([node({ updatedAt: value })], 'shape');
  });
});

describe('parseOrgTree: структура дерева', () => {
  it('отклоняет повтор id', () => {
    expectRejected(
      [node({ id: 'div-1' }), node({ id: 'div-1' })],
      'duplicate-id',
    );
  });

  it('отклоняет parentId, ссылающийся на несуществующий узел', () => {
    expectRejected(
      [node({ id: 'div-1' }), node({ id: 'dep-1', parentId: 'ghost' })],
      'unknown-parent',
    );
  });

  it('отклоняет узел, который сам себе родитель', () => {
    expectRejected([node({ id: 'loop', parentId: 'loop' })], 'cycle');
  });

  it('отклоняет цикл из двух узлов', () => {
    expectRejected(
      [node({ id: 'a', parentId: 'b' }), node({ id: 'b', parentId: 'a' })],
      'cycle',
    );
  });

  it('отклоняет цикл из трёх узлов, даже если рядом есть корректные ветви', () => {
    expectRejected(
      [
        ...forest,
        node({ id: 'x', parentId: 'z' }),
        node({ id: 'y', parentId: 'x' }),
        node({ id: 'z', parentId: 'y' }),
      ],
      'cycle',
    );
  });

  it('называет узел, на котором найдено нарушение', () => {
    const result = parseOrgTree([
      node({ id: 'div-1' }),
      node({ id: 'dep-1', parentId: 'ghost' }),
    ]);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unknown-parent', nodeId: 'dep-1' },
    });
  });
});
