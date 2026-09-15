export function formatAveragePerformance(value: number | undefined): string {
  if (value === undefined) return '—';
  return value.toFixed(1).replace('.', ',');
}
