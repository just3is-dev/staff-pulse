import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { aggregationSpy } from '@/test/aggregation-spy';
import { installMatchMedia } from '@/test/match-media';
import { installScrollIntoView } from '@/test/scroll-into-view';

vi.mock('@/org-model/aggregate-subtrees', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/org-model/aggregate-subtrees')>();
  return { ...actual, aggregateSubtrees: vi.fn(actual.aggregateSubtrees) };
});

beforeEach(() => {
  aggregationSpy.mockReset();
  installMatchMedia();
  installScrollIntoView();
});

afterEach(() => {
  cleanup();
});
