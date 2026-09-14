import * as z from 'zod/mini';

/**
 * Узел орг-структуры в ответе `GET /api/org-tree`.
 * `headcount` и `budget` — собственные значения узла, без потомков.
 * `updatedAt` — ISO 8601 в UTC (`Date#toISOString`); смещения часового пояса не принимаются.
 */
export const orgNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.nullable(z.string()),
  headcount: z.int().check(z.nonnegative()),
  budget: z.int().check(z.nonnegative()),
  performance: z.number().check(z.gte(0), z.lte(100)),
  updatedAt: z.iso.datetime(),
});

export const orgTreeResponseSchema = z.array(orgNodeSchema);

export type OrgNode = z.infer<typeof orgNodeSchema>;
