import { vi } from 'vitest';
import { render, screen, type RenderOptions } from '@testing-library/react';
import { installMatchMedia } from './match-media';
import { OrgTreeScreen } from '@/components/OrgTreeScreen/OrgTreeScreen';

type RenderOrgScreenOptions = {
  width: number;
  fetchMock: ReturnType<typeof vi.fn>;
  wrapper: RenderOptions['wrapper'];
  awaitReady?: boolean;
};

export async function renderOrgScreen({
  width,
  fetchMock,
  wrapper,
  awaitReady = true,
}: RenderOrgScreenOptions): Promise<void> {
  installMatchMedia(width);
  vi.stubGlobal('fetch', fetchMock);
  render(<OrgTreeScreen />, { wrapper });

  if (awaitReady) {
    await (width < 1280
      ? screen.findByRole('group', { name: 'Вид' })
      : screen.findByRole('region', { name: 'Дерево' }));
  }
}
