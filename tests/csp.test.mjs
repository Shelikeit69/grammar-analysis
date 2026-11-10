import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const meta = html.match(/<meta\b(?=[^>]*\shttp-equiv="Content-Security-Policy")[^>]*>/i)?.[0];
const policy = meta?.match(/\scontent="([^"]+)"/i)?.[1];

function checkPolicy(content) {
  assert.ok(content, 'Missing Content-Security-Policy');
  const directives = new Map();
  for (const part of content.split(';').map(value => value.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    assert.ok(!directives.has(name), `Duplicate directive: ${name}`);
    directives.set(name, sources.sort());
  }
  assert.deepEqual(directives.get('connect-src'), ["'self'", 'https://api.deepseek.com'], 'connect-src');
  for (const name of ['default-src', 'script-src', 'style-src', 'img-src']) {
    assert.deepEqual(directives.get(name), ["'self'"], name);
  }
  for (const name of ['object-src', 'base-uri', 'form-action']) {
    assert.deepEqual(directives.get(name), ["'none'"], name);
  }
}

test('page CSP restricts connections, resources and form actions', () => {
  checkPolicy(policy);
});

test('page CSP check rejects a connect-src allowing all HTTPS origins', () => {
  const permissive = policy.replace(/\bconnect-src\s+[^;]+/, "connect-src 'self' https:");
  assert.throws(() => checkPolicy(permissive), { code: 'ERR_ASSERTION', message: /connect-src/ });
});
