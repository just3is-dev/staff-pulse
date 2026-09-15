import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const CLIENT_URL = 'http://localhost:5173';
const READY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 300;
const TEST_TIMEOUT_MS = 100_000;

let devProcess: ChildProcess | undefined;
let output = '';

// detached: true делает npm run dev лидером своей группы процессов (concurrently
// + nest start --watch + vite — все с тем же pgid), поэтому сигнал по -pid
// гарантированно доходит до всего дерева, а не только до прямого потомка.
function killProcessTree(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.pid === undefined || proc.exitCode !== null) {
      resolve();
      return;
    }
    proc.once('exit', () => resolve());
    try {
      process.kill(-proc.pid, 'SIGTERM');
    } catch {
      resolve();
      return;
    }
    setTimeout(() => {
      try {
        if (proc.pid !== undefined) process.kill(-proc.pid, 'SIGKILL');
      } catch {
        // процесс уже завершён
      }
      resolve();
    }, 5_000);
  });
}

afterAll(async () => {
  if (devProcess) await killProcessTree(devProcess);
});

async function waitForOk(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`Неожиданный статус ${response.status} от ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `${url} не ответил за ${timeoutMs}мс: ${reason}\n--- вывод npm run dev ---\n${output.slice(-4000)}`,
  );
}

describe('npm run dev из корня репозитория', () => {
  it(
    'AC-001-17: одна команда поднимает клиент и сервер; клиент отдаёт HTML и проксирует /api/org-tree',
    async () => {
      devProcess = spawn('npm', ['run', 'dev'], {
        cwd: repoRoot,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      devProcess.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      devProcess.stderr?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      const pageResponse = await waitForOk(CLIENT_URL, READY_TIMEOUT_MS);
      expect(pageResponse.headers.get('content-type')).toContain('text/html');
      const html = await pageResponse.text();
      expect(html).toContain('<div id="root">');

      const apiResponse = await waitForOk(
        `${CLIENT_URL}/api/org-tree`,
        READY_TIMEOUT_MS,
      );
      const nodes: unknown = await apiResponse.json();
      expect(Array.isArray(nodes)).toBe(true);
      expect((nodes as unknown[]).length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS,
  );
});
