import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Vitest загружает модули через Vite и сам снимает типы, поэтому проверку
// «пакет работает в Node без сборки» (ADR-001) делаем отдельным процессом
// того же Node, которым запускается скомпилированный сервер.
const serverRoot = fileURLToPath(new URL('..', import.meta.url));

describe('общий пакет @staff-pulse/shared в рантайме Node', () => {
  it('импортируется из сервера без шага сборки и проверяет ответ', () => {
    const script = `
      const { parseOrgTree } = await import('@staff-pulse/shared');
      console.log(JSON.stringify([parseOrgTree([]).ok, parseOrgTree({}).ok]));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', script],
      { cwd: serverRoot, encoding: 'utf8' },
    );
    expect(JSON.parse(output.trim())).toEqual([true, false]);
  });
});
