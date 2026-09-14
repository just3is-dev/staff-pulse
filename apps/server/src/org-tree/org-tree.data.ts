import { parseOrgTree, type OrgNode } from '@staff-pulse/shared';

// Дивизион -> отдел -> команда, ровно 3 уровня. Числа полей — чистые функции
// индекса узла (без Math.random и без Date.now), поэтому дерево одинаково
// от процесса к процессу и от запроса к запросу.
const DIVISIONS = 4;
const DEPARTMENTS_PER_DIVISION = 3;
const TEAMS_PER_DEPARTMENT = 3;
const UPDATED_AT = '2026-01-01T00:00:00.000Z';

const headcountFor = (index: number) => 3 + (index % 25);
const budgetFor = (index: number) => 400_000 + index * 53_000;
const performanceFor = (index: number) => (index * 11) % 101;

function buildNode(
  index: number,
  id: string,
  name: string,
  parentId: string | null,
): OrgNode {
  return {
    id,
    name,
    parentId,
    headcount: headcountFor(index),
    budget: budgetFor(index),
    performance: performanceFor(index),
    updatedAt: UPDATED_AT,
  };
}

function generateOrgTree(): OrgNode[] {
  const nodes: OrgNode[] = [];
  let index = 0;

  for (let d = 1; d <= DIVISIONS; d++) {
    const divisionId = `div-${d}`;
    nodes.push(buildNode(index++, divisionId, `Дивизион ${d}`, null));

    for (let p = 1; p <= DEPARTMENTS_PER_DIVISION; p++) {
      const departmentId = `dep-${d}-${p}`;
      nodes.push(
        buildNode(index++, departmentId, `Отдел ${d}.${p}`, divisionId),
      );

      for (let t = 1; t <= TEAMS_PER_DEPARTMENT; t++) {
        const teamId = `team-${d}-${p}-${t}`;
        nodes.push(
          buildNode(index++, teamId, `Команда ${d}.${p}.${t}`, departmentId),
        );
      }
    }
  }

  return nodes;
}

const generated = generateOrgTree();
const validation = parseOrgTree(generated);
if (!validation.ok) {
  throw new Error(
    `Сгенерированное дерево орг-структуры не прошло собственную схему: ${validation.error.message}`,
  );
}

/** Детерминированные данные `GET /api/org-tree`: не меняются во время работы. */
export const ORG_TREE: OrgNode[] = generated;
