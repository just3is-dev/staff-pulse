import { vi } from 'vitest';

export const scrollIntoViewSpy = vi.fn<(this: Element) => void>();

export function installScrollIntoView() {
  scrollIntoViewSpy.mockReset();
  Element.prototype.scrollIntoView = scrollIntoViewSpy;
}
