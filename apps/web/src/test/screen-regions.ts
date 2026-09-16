import { screen, within } from '@testing-library/react';

export const treeRegion = () => screen.getByRole('region', { name: 'Дерево' });
export const tableRegion = () =>
  screen.getByRole('region', { name: 'Таблица' });
export const queryTreeRegion = () =>
  screen.queryByRole('region', { name: 'Дерево' });
export const queryTableRegion = () =>
  screen.queryByRole('region', { name: 'Таблица' });

export const viewToggle = () => screen.getByRole('group', { name: 'Вид' });
export const queryViewToggle = () =>
  screen.queryByRole('group', { name: 'Вид' });
export const toggleButton = (name: 'Дерево' | 'Таблица') =>
  within(viewToggle()).getByRole('button', { name });

export const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell');

export const rowsOf = (container: HTMLElement = tableRegion()) =>
  within(container).getAllByRole('row').slice(1);

export const nameOf = (row: HTMLElement) => cellsOf(row)[0].textContent;

export const rowNamed = (name: string, container?: HTMLElement) => {
  const row = rowsOf(container).find((candidate) => nameOf(candidate) === name);
  if (!row) throw new Error(`Нет строки «${name}»`);
  return row;
};
