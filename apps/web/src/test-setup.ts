import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/org-model/aggregate-subtrees', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/org-model/aggregate-subtrees')>();
  return { ...actual, aggregateSubtrees: vi.fn(actual.aggregateSubtrees) };
});

beforeEach(async () => {
  const { aggregationSpy } = await import('@/test/aggregation-spy');
  aggregationSpy.mockClear();
});

afterEach(() => {
  cleanup();
});
