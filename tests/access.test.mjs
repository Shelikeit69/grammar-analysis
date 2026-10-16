import test from 'node:test';
import assert from 'node:assert/strict';
import { codespaceHost, isAllowedRequest } from '../lib/access.mjs';

const environment = {
  CODESPACES: 'true',
  CODESPACE_NAME: 'gentle-space-ab123',
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
};
const host = 'gentle-space-ab123-3000.app.github.dev';

test('Codespaces is opt-in and fails closed on invalid metadata', () => {
  assert.equal(codespaceHost(3000, {}), null);
  assert.equal(codespaceHost(3000, environment), host);
  assert.equal(codespaceHost(3000, { ...environment, CODESPACE_NAME: 'bad/name' }), null);
  assert.equal(codespaceHost(3000, { ...environment, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'evil.test' }), null);
  assert.equal(isAllowedRequest({ host, origin: `https://${host}` }, 3000, {}), false);
});

test('allow only exact Codespace HTTPS origin with local or external host', () => {
  for (const requestHost of [host, '127.0.0.1:3000', 'localhost:3000']) {
    assert.equal(isAllowedRequest({ host: requestHost, origin: `https://${host}` }, 3000, environment), true);
    for (const origin of [`http://${host}`, 'https://other-3000.app.github.dev', 'https://gentle-space-ab123-3001.app.github.dev', `https://${host}.evil.test`, 'null']) {
      assert.equal(isAllowedRequest({ host: requestHost, origin }, 3000, environment), false);
    }
  }
});

test('forged forwarding metadata cannot grant access; localhost remains supported', () => {
  assert.equal(isAllowedRequest({ host: 'evil.test', 'x-forwarded-host': host }, 3000, environment), false);
  assert.equal(isAllowedRequest({ host, origin: `https://${host}`, 'sec-fetch-site': 'cross-site' }, 3000, environment), false);
  assert.equal(isAllowedRequest({ host: 'localhost:3000', origin: 'http://localhost:3000' }, 3000, {}), true);
  assert.equal(isAllowedRequest({ host: 'localhost:3000', origin: `https://${host}`, 'x-forwarded-host': host }, 3000, {}), false);
});
