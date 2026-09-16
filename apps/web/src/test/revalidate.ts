import { expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { STALE_TIME_MS } from '@/api/query-client';

export async function revalidateWith(
  fetchMock: ReturnType<typeof vi.fn>,
  next: Response | (() => Promise<Response>),
) {
  if (typeof next === 'function') {
    fetchMock.mockImplementationOnce(next);
  } else {
    fetchMock.mockResolvedValueOnce(next);
  }

  await vi.advanceTimersByTimeAsync(STALE_TIME_MS + 100);
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
}
