import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('алиас @/* резолвится в Vitest', () => {
  it('импортирует модуль src/App.tsx через алиас, без relative-пути', () => {
    expect(typeof App).toBe('function');
  });
});
