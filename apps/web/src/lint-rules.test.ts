import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');

function runOxlint(fixtureRelativePath: string) {
  const result = spawnSync(
    'npx',
    [
      'oxlint',
      '--config',
      '.oxlintrc.json',
      '--format',
      'json',
      fixtureRelativePath,
    ],
    { cwd: projectRoot, encoding: 'utf-8' },
  );
  const diagnostics = (JSON.parse(result.stdout).diagnostics ?? []) as Array<{
    code: string;
  }>;
  return { exitCode: result.status, diagnostics };
}

describe('AC-001-16: статическая проверка клиента ловит ../ и inline-стили', () => {
  it('падает на импорте через ../', () => {
    const { exitCode, diagnostics } = runOxlint(
      'test-fixtures/lint/relative-import.tsx',
    );

    expect(exitCode).not.toBe(0);
    expect(
      diagnostics.some((d) => d.code === 'eslint(no-restricted-imports)'),
    ).toBe(true);
  });

  it('падает на атрибуте style у DOM-элемента', () => {
    const { exitCode, diagnostics } = runOxlint(
      'test-fixtures/lint/dom-style-attr.tsx',
    );

    expect(exitCode).not.toBe(0);
    expect(diagnostics.some((d) => d.code === 'react(forbid-dom-props)')).toBe(
      true,
    );
  });

  it('падает на пропе style у компонента', () => {
    const { exitCode, diagnostics } = runOxlint(
      'test-fixtures/lint/component-style-prop.tsx',
    );

    expect(exitCode).not.toBe(0);
    expect(
      diagnostics.some((d) => d.code === 'react(forbid-component-props)'),
    ).toBe(true);
  });

  it('пропускает чистый файл с импортом через алиас', () => {
    const { exitCode, diagnostics } = runOxlint('test-fixtures/lint/clean.tsx');

    expect(exitCode).toBe(0);
    expect(diagnostics).toHaveLength(0);
  });
});
