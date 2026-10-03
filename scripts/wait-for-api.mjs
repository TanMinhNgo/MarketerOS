import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

async function readEnv(path) {
  try {
    return parseEnv(await readFile(new URL(path, import.meta.url), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function waitForApi(
  url,
  { timeoutMs = 300_000, intervalMs = 500, requestTimeoutMs = 2_000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(
          Math.min(requestTimeoutMs, deadline - Date.now()),
        ),
        redirect: 'error',
      });
      const health = await response.json();
      if (response.ok && health.status === 'ok' && health.db === 'up') return;
    } catch {
      // Connection refused, startup errors and DB outages are retried until the deadline.
    }
    await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now()))); // NOSONAR: polling interval precedes the next health probe.
  }
  throw new Error(
    `API chưa sẵn sàng sau ${timeoutMs / 1000}s. Kiểm tra log api:dev, cấu hình env và PostgreSQL.`,
  );
}

async function main() {
  const webEnv = await readEnv('../apps/web/.env.local');
  const base = process.env.API_URL ?? webEnv.API_URL ?? 'http://localhost:3001';
  const url = new URL(`${base.replace(/\/$/, '')}/api/health`);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('API_URL phải là URL HTTP(S) không chứa credentials.');
  }
  console.log('Đang chờ NestJS và PostgreSQL sẵn sàng...');
  await waitForApi(url);
  console.log('NestJS sẵn sàng. Turbo có thể khởi động Next.js.');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
