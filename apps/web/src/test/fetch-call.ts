import type { vi } from 'vitest';

export function fetchCallOf(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex = 0,
): [url: string, init: RequestInit] {
  return fetchMock.mock.calls[callIndex] as unknown as [string, RequestInit];
}
