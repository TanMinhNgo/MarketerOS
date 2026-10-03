import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForApi } from './wait-for-api.mjs';

async function serve(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}/api/health`;
}

test('chờ DB up thay vì mở gate khi HTTP đã lắng nghe', async (t) => {
  let calls = 0;
  const url = await serve(t, (_req, res) => {
    calls++;
    res.writeHead(calls < 3 ? 503 : 200, {
      'Content-Type': 'application/json',
    });
    res.end(
      JSON.stringify(
        calls < 3 ? { status: 'ok', db: 'down' } : { status: 'ok', db: 'up' },
      ),
    );
  });
  await waitForApi(url, { intervalMs: 10, timeoutMs: 1000 });
  assert.equal(calls, 3);
});

test('không coi HTTP 200 sai health contract là ready', async (t) => {
  const url = await serve(t, (_req, res) =>
    res.end(JSON.stringify({ status: 'ok', db: 'down' })),
  );
  await assert.rejects(
    waitForApi(url, { intervalMs: 10, timeoutMs: 100 }),
    /chưa sẵn sàng/,
  );
});

test('request bị treo vẫn hết thời gian chờ', async (t) => {
  const url = await serve(t, () => {});
  await assert.rejects(
    waitForApi(url, { intervalMs: 10, timeoutMs: 100, requestTimeoutMs: 20 }),
    /chưa sẵn sàng/,
  );
});
