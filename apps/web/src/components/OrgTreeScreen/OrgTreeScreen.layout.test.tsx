import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeOrgNode } from '@/test/make-org-node';
import { jsonResponse } from '@/test/json-response';
import { setupQueryClient } from '@/test/query-client-harness';
import { aggregationSpy } from '@/test/aggregation-spy';
import { installMatchMedia, setViewportWidth } from '@/test/match-media';
import { OrgTreeScreen } from './OrgTreeScreen';

const nodes = [
  makeOrgNode({ id: 'div-1', name: 'Дивизион 1', parentId: null }),
  makeOrgNode({ id: 'dep-1', name: 'Отдел 1', parentId: 'div-1' }),
  makeOrgNode({ id: 'team-1', name: 'Команда 1', parentId: 'dep-1' }),
];

const { wrapper } = setupQueryClient();

async function renderLoadedScreen() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nodes)));
  render(<OrgTreeScreen />, { wrapper });
  await screen.findByRole('region', { name: 'Дерево' });
}

const treeRegion = () => screen.queryByRole('region', { name: 'Дерево' });
const tableRegion = () => screen.queryByRole('region', { name: 'Таблица' });
const viewToggle = () => screen.queryByRole('group', { name: 'Вид' });
const toggleButton = (name: 'Дерево' | 'Таблица') =>
  within(screen.getByRole('group', { name: 'Вид' })).getByRole('button', {
    name,
  });

describe('OrgTreeScreen: компоновка по ширине', () => {
  it('AC-002-1: от 1280px дерево и таблица видны рядом без переключателя', async () => {
    installMatchMedia(1280);
    await renderLoadedScreen();

    expect(treeRegion()).toBeInTheDocument();
    expect(tableRegion()).toBeInTheDocument();
    expect(viewToggle()).not.toBeInTheDocument();
  });

  it('AC-002-1: уже 1280px по умолчанию виден только вид «Дерево», выбор «Таблица» оставляет только таблицу', async () => {
    const user = userEvent.setup();
    installMatchMedia(1279);
    await renderLoadedScreen();

    expect(toggleButton('Дерево')).toHaveAttribute('aria-pressed', 'true');
    expect(toggleButton('Таблица')).toHaveAttribute('aria-pressed', 'false');
    expect(treeRegion()).toBeInTheDocument();
    expect(tableRegion()).not.toBeInTheDocument();

    await user.click(toggleButton('Таблица'));

    expect(toggleButton('Таблица')).toHaveAttribute('aria-pressed', 'true');
    expect(treeRegion()).not.toBeInTheDocument();
    expect(tableRegion()).toBeInTheDocument();
  });

  it('AC-002-1: при изменении ширины через 1280px переключатель появляется и исчезает', async () => {
    await renderLoadedScreen();
    expect(viewToggle()).not.toBeInTheDocument();

    act(() => setViewportWidth(1024));
    expect(viewToggle()).toBeInTheDocument();
    expect(tableRegion()).not.toBeInTheDocument();

    act(() => setViewportWidth(1440));
    expect(viewToggle()).not.toBeInTheDocument();
    expect(treeRegion()).toBeInTheDocument();
    expect(tableRegion()).toBeInTheDocument();
  });

  it('AC-002-2: раскрытие ветвей дерева сохраняется после смены вида и перехода ширины через 1280px', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    const tree = () => within(treeRegion()!);

    await user.click(
      tree().getByRole('button', { name: 'Развернуть Отдел 1' }),
    );
    expect(tree().getByText('Команда 1')).toBeInTheDocument();

    act(() => setViewportWidth(1024));
    await user.click(toggleButton('Таблица'));
    await user.click(toggleButton('Дерево'));
    expect(
      tree().getByRole('button', { name: 'Свернуть Отдел 1' }),
    ).toBeInTheDocument();
    expect(tree().getByText('Команда 1')).toBeInTheDocument();

    act(() => setViewportWidth(1440));
    expect(
      tree().getByRole('button', { name: 'Свернуть Отдел 1' }),
    ).toBeInTheDocument();
    expect(tree().getByText('Команда 1')).toBeInTheDocument();
  });

  it('AC-002-12: смена вида и ширины не пересчитывает агрегаты', async () => {
    const user = userEvent.setup();
    await renderLoadedScreen();
    expect(aggregationSpy).toHaveBeenCalledTimes(1);

    act(() => setViewportWidth(1024));
    await user.click(toggleButton('Таблица'));
    await user.click(toggleButton('Дерево'));
    act(() => setViewportWidth(1440));

    expect(aggregationSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['загрузка', () => new Promise<Response>(() => {}), 'Загрузка…'],
    ['ошибка', async () => jsonResponse('fail', { status: 500 }), 'Повторить'],
    ['пусто', async () => jsonResponse([]), 'Подразделений нет.'],
  ])(
    'в состоянии «%s» на узком экране нет переключателя вида',
    async (_, response, marker) => {
      installMatchMedia(1024);
      vi.stubGlobal('fetch', vi.fn(response));
      render(<OrgTreeScreen />, { wrapper });

      await screen.findByText(marker);
      expect(viewToggle()).not.toBeInTheDocument();
    },
  );
});
