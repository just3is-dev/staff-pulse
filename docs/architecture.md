# Архитектура

Состояние после этапа 02 (SPEC-002, тег `step/2`): дерево орг-структуры,
аналитическая таблица с агрегатами, кэш с условной ревалидацией. Live-патчи
(этап 03) и продакшен-раскладка (этап 04) здесь не описаны.

## Слои и поток данных

Монорепа на npm workspaces, три пакета:

```
packages/shared        — схема узла и проверка ответа (общая для сервера и клиента)
apps/server/src/org-tree — данные, ETag, условный ответ
apps/web/src/api         — запрос, условная ревалидация, снимок кэша
apps/web/src/org-model   — иерархия из плоского списка, агрегаты по поддеревьям
apps/web/src/components  — экран, дерево, таблица
```

Путь одного запроса `GET /api/org-tree` от сервера до ячейки таблицы:

1. **`packages/shared`** (`org-node.ts`, `org-tree.ts`) — `orgNodeSchema` и
   `orgTreeResponseSchema` описывают форму узла; `parseOrgTree` проверяет
   форму и структуру леса (уникальность `id`, существование `parentId`,
   отсутствие циклов). Пакет отдаётся исходником TypeScript без сборки —
   почему и как обе стороны его загружают, см. ADR-001. Модель самих данных
   (поля узла, что значит `headcount`/`budget` узла против агрегата) — в
   `docs/data-model.md`.
2. **`apps/server/src/org-tree`** — `OrgTreeService` отдаёт список узлов
   (`org-tree.data.ts`, статичный набор), `OrgTreeController` считает ETag
   от тела ответа (`etag.ts`) и либо отвечает `304` без тела на совпадающий
   `If-None-Match`, либо `200` со списком и новым ETag. Почему условный
   запрос обрабатывается вручную, а не встроенной проверкой Express — ADR-004.
3. **`apps/web/src/api`** — `fetchOrgTree` (`org-tree-request.ts`) шлёт
   условный запрос (`If-None-Match` от прежнего снимка, `cache: 'no-store'`),
   на `304` возвращает прежний снимок тем же объектом, на `200` проверяет
   тело через `parseOrgTree` и считает агрегаты. Результат — снимок
   `{ nodes, aggregates, etag }`. `useOrgTree` (`use-org-tree.ts`) оборачивает
   это в `useQuery` (TanStack Query, ADR-003) и отдаёт компонентам только
   `{ nodes, aggregates }`.
4. **`apps/web/src/org-model`** — `groupByParent`
   (`org-tree-hierarchy.ts`) строит `Map<parentId, OrgNode[]>` из плоского
   списка; `aggregateSubtrees` (`aggregate-subtrees.ts`) обходит это дерево
   постфиксно и считает по каждому узлу и его поддереву `headcount`,
   `budget`, `averagePerformance`. Оба модуля используются и деревом, и
   таблицей — единая иерархия и единые агрегаты на оба представления.
   Подробности алгоритма и граничные случаи (нулевая численность,
   `performanceWeightedSum` про запас для этапа 03) — `docs/data-model.md`;
   где именно и почему считаются агрегаты (при 200, не при 304) — ADR-005.
5. **`apps/web/src/components`** — `OrgTreeScreen` держит данные из
   `useOrgTree` и решает, что показывать; `OrgTree`/`OrgTreeNode` рендерят
   иерархию по `groupByParent`; `OrgTable` строит строки в порядке дерева
   через `build-table-rows.ts` (тот же `groupByParent`, плюс уровень
   вложенности и агрегаты из шага 4), затем `sort-table-rows.ts` и
   `filter-table-rows.ts` — в этом порядке (фильтр применяется к уже
   отсортированному списку).

## Где живёт состояние

- **Кэш данных** — TanStack Query, ключ `orgTreeQueryKey` в `use-org-tree.ts`.
  Хранит снимок `{ nodes, aggregates, etag }` (ADR-005), свежесть 5 секунд
  (`STALE_TIME_MS`, `apps/web/src/api/query-client.ts`). Это единственное
  место, где живут узлы и агрегаты; компоненты их не копируют и не считают
  заново.
- **Состояние экрана** (`OrgTreeScreen.tsx`) — какой вид показан на узком
  экране (`view: 'tree' | 'table'`, `useState`) и какой узел выделен
  (`selectedId`, `useState`); ширина экрана — `useMediaQuery('(min-width:
  1280px)')` (`apps/web/src/hooks/use-media-query.ts`), не стейт компонента.
  Выделение узла (`selectNode`) на узком экране переключает вид на «Дерево»
  и просит `OrgTree` раскрыть путь до узла и прокрутить к нему
  (`treeRef.current?.reveal(id)`).
- **Состояние таблицы** (`OrgTable.tsx`) — активная сортировка (`sort:
  SortState`) и фильтр по названию: `filterInput` (значение поля на каждый
  ввод) и `appliedFilter` (применяется к строкам, обновляется с задержкой
  `FILTER_DEBOUNCE_MS`). Оба стейта — только у `OrgTable`, экран и дерево их
  не видят.
- **Состояние дерева** (`OrgTree.tsx`) — какие узлы раскрыты (`expandedIds:
  ReadonlySet<string>`, изначально раскрыты только корни) и запрос на
  прокрутку к узлу (`scrollRequest`). Раскрытие меняется по клику
  (`toggle`) и через `reveal` из `OrgTreeHandle`, который `OrgTreeScreen`
  вызывает при выделении узла.

## Смежные документы

- `docs/data-model.md` — форма узла, построение иерархии, алгоритм и
  граничные случаи агрегации.
- ADR-001 — почему `packages/shared` отдаётся исходником без сборки.
- ADR-003 — почему кэш клиента — TanStack Query, а не свой слой.
- ADR-004 — почему ревалидация неизменённых данных — явный условный запрос
  с ETag, а не прозрачный HTTP-кэш браузера.
- ADR-005 — почему агрегаты хранятся в снимке кэша вместе с узлами, а не
  пересчитываются в компоненте.
