import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

async function withServer(fn, options = {}) {
  const server = createServer({ apiKey: '', ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function post(base, body, headers = { 'Content-Type': 'application/json' }) {
  return fetch(base + '/api/analyze', { method: 'POST', headers, body });
}

test('status, missing key, malformed input and origin protections', () => withServer(async base => {
  assert.deepEqual(await (await fetch(base + '/api/status')).json(), { configured: false });
  for (const [headers, status] of [
    [{ Origin: 'https://evil.test' }, 403],
    [{ 'Content-Type': 'text/plain' }, 415],
  ]) {
    assert.equal((await post(base, '{}', headers)).status, status);
  }
  assert.equal((await post(base, JSON.stringify({ text: 'Hello.' }))).status, 503);
  assert.equal((await post(base, '{')).status, 400);
  for (const path of ['/.env', '/server.mjs', '/lib/analysis.mjs', '/%2e%2e/.env']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
}));

test('provider errors never leak secrets', () => withServer(async base => {
  const response = await post(base, JSON.stringify({ text: 'Hello.' }));
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('SECRET'));
}, {
  apiKey: 'SECRET',
  analyze: async () => { throw Error('SECRET'); },
}));

test('reject forged Host with raw HTTP', () => withServer(async base => {
  const status = await new Promise((resolve, reject) => {
    http.get(base + '/api/status', { headers: { Host: 'evil.test' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(status, 403);
}));

test('bounded payload and default concurrent request limit', async () => {
  let release;
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  await withServer(async base => {
    assert.equal((await post(base, JSON.stringify({ text: 'x'.repeat(33000) }))).status, 413);
    const first = post(base, JSON.stringify({ text: 'Hello.' }));
    await started;
    try {
      assert.equal((await post(base, JSON.stringify({ text: 'Hello.' }))).status, 429);
    } finally {
      release();
    }
    assert.equal((await first).status, 200);
  }, {
    apiKey: 'test',
    analyze: async () => {
      entered();
      await pending;
      return { sentences: [], translation: '' };
    },
  });
});

test('client cancellation releases the active slot for a replacement request', async () => {
  let entered;
  let cancelled;
  const started = new Promise(resolve => { entered = resolve; });
  const stopped = new Promise(resolve => { cancelled = resolve; });
  let calls = 0;
  await withServer(async base => {
    const controller = new AbortController();
    const first = fetch(base + '/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Original.' }), signal: controller.signal,
    });
    const rejected = assert.rejects(first, { name: 'AbortError' });
    await started;
    controller.abort();
    await rejected;
    await stopped;
    const replacement = await post(base, JSON.stringify({ text: 'Replacement.' }));
    assert.equal(replacement.status, 200);
    assert.equal(calls, 2);
  }, {
    apiKey: 'test',
    analyze: async (text, { signal }) => {
      calls++;
      if (calls === 1) {
        entered();
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            cancelled();
            reject(signal.reason);
          }, { once: true });
        });
      }
      return { sentences: [], translation: text };
    },
  });
});

test('Codespaces forwarded HTTPS requests reach the API but other origins do not', () => withServer(async base => {
  const port = new URL(base).port;
  const host = `test-space-123-${port}.app.github.dev`;
  const request = headers => new Promise((resolve, reject) => {
    const req = http.request(base + '/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.end(JSON.stringify({ text: 'Hello.' }));
  });
  assert.equal(await request({ Host: host, Origin: `https://${host}` }), 503);
  assert.equal(await request({ Origin: `https://${host}` }), 503);
  assert.equal(await request({ Host: host, Origin: 'https://other-space-3000.app.github.dev' }), 403);
}, { environment: { CODESPACES: 'true', CODESPACE_NAME: 'test-space-123' } }));
