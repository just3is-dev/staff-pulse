import { vi } from 'vitest';
import { aggregateSubtrees } from '@/org-model/aggregate-subtrees';

export const aggregationSpy = vi.mocked(aggregateSubtrees);
