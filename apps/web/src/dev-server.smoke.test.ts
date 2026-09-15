import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { parseOrgTree } from '@staff-pulse/shared';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const CLIENT_URL = 'http://localhost:5173';
const CLIENT_PORT = 5173;
const SERVER_PORT = 3000;
const READY_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 300;
const TEST_TIMEOUT_MS = 100_000;

let devProcess: ChildProcess | undefined;
let output = '';
let earlyExit: string | undefined;

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: 'localhost' });
    const settle = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    socket.setTimeout(500, () => settle(false));
  });
}

async function assertPortsFree(ports: number[]): Promise<void> {
  const busy: number[] = [];
  for (const port of ports) {
    if (await isPortOpen(port)) busy.push(port);
  }
  if (busy.length > 0) {
    throw new Error(
      `Порт(ы) ${busy.join(', ')} уже заняты — похоже, npm run dev (или что-то ещё) уже запущен. ` +
        'Тест проверяет команду от старта, а не бьёт в чужой процесс: остановите его перед прогоном.',
    );
  }
}

// detached: true делает npm run dev лидером своей группы процессов (concurrently
// + nest start --watch + vite — все с тем же pgid), поэтому сигнал по -pid
// доходит до всего дерева, а не только до прямого потомка. Ждём настоящего
// 'exit', а не считаем дерево мёртвым сразу после отправки SIGKILL.
function killProcessTree(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.pid === undefined || proc.exitCode !== null) {
      resolve();
      return;
    }
    const pid = proc.pid;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(giveUpTimer);
      resolve();
    };
    proc.once('exit', finish);

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      finish();
      return;
    }

    const killTimer = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        finish();
      }
    }, 5_000);
    const giveUpTimer = setTimeout(finish, 10_000);
  });
}

afterAll(async () => {
  if (devProcess) await killProcessTree(devProcess);
});

async function waitForOk(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (earlyExit) {
      throw new Error(
        `${earlyExit}\n--- вывод npm run dev ---\n${output.slice(-4000)}`,
      );
    }
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
      await assertPortsFree([CLIENT_PORT, SERVER_PORT]);

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
      devProcess.once('error', (error) => {
        earlyExit = `npm run dev не удалось запустить: ${error.message}`;
      });
      devProcess.once('exit', (code, signal) => {
        earlyExit ??= `npm run dev неожиданно завершился раньше готовности (code=${code}, signal=${signal})`;
      });

      const pageResponse = await waitForOk(CLIENT_URL, READY_TIMEOUT_MS);
      expect(pageResponse.headers.get('content-type')).toContain('text/html');
      const html = await pageResponse.text();
      expect(html).toContain('<div id="root">');

      const apiResponse = await waitForOk(
        `${CLIENT_URL}/api/org-tree`,
        READY_TIMEOUT_MS,
      );
      let body: unknown;
      try {
        body = await apiResponse.json();
      } catch (error) {
        throw new Error(
          `Ответ /api/org-tree — не JSON: ${error instanceof Error ? error.message : String(error)}\n--- вывод npm run dev ---\n${output.slice(-4000)}`,
        );
      }
      const parsed = parseOrgTree(body);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.nodes.length).toBeGreaterThan(0);
      }
    },
    TEST_TIMEOUT_MS,
  );
});
