import { screen, within } from '@testing-library/react';

export const treeRegion = () => screen.getByRole('region', { name: 'Дерево' });
export const tableRegion = () =>
  screen.getByRole('region', { name: 'Таблица' });

export const rowsOf = () => within(tableRegion()).getAllByRole('row').slice(1);

export const nameOf = (row: HTMLElement) =>
  within(row).getAllByRole('cell')[0].textContent;
