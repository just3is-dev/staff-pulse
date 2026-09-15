const GROUP_SEPARATOR = ' ';

export function formatBudget(budget: number): string {
  const grouped = budget
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  return `${grouped} руб.`;
}
