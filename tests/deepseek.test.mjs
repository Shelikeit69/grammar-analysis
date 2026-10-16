import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithDeepSeek } from '../lib/deepseek.mjs';
import { SYSTEM } from '../public/deepseek.js';

const valid = {
  sentences: [{
    text: 'Go.', translation: '走。', note: '', tense: '祈使句', tenseReason: '因为句子以动词原形 Go 开头且省略主语，所以是祈使句。',
    segments: [
      { text: 'Go', role: 'predicate', translation: '走', lemma: 'go', detail: '', level: 'core' },
      { text: '.', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
    ],
  }],
  translation: '走。',
};

test('provider request and valid structured response', async () => {
  const result = await analyzeWithDeepSeek('Go.', {
    apiKey: 'test',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'deepseek-flash');
      assert.equal(body.response_format.type, 'json_object');
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
    },
  });
  assert.deepEqual(result, valid);
});

test('reject malformed, truncated, missing and HTTP failure responses', async () => {
  const responses = [
    new Response('secret', { status: 401 }),
    Response.json({}),
    Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(valid) } }] }),
    Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'invalid' } }] }),
  ];
  for (const response of responses) {
    await assert.rejects(analyzeWithDeepSeek('Go.', { apiKey: 'test', fetchImpl: async () => response }));
  }
});

test('provider fetch receives cancellation and timeout signals', async () => {
  const abortingFetch = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const controller = new AbortController();
  const pending = analyzeWithDeepSeek('Go.', {
    apiKey: 'test', fetchImpl: abortingFetch, signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  // AbortSignal.timeout uses an unreferenced timer; keep this test's event loop alive.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', fetchImpl: abortingFetch, timeoutMs: 10,
    }), { name: 'TimeoutError' });
  } finally {
    clearTimeout(keepAlive);
  }
  let called = false;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    fetchImpl: async () => { called = true; },
  }), { name: 'AbortError' });
  assert.equal(called, false);
});

test('provider HTTP status is exposed for user-facing error messages', async () => {
  const { ProviderError } = await import('../public/deepseek.js');
  await assert.rejects(
    analyzeWithDeepSeek('Go.', { apiKey: 'test', fetchImpl: async () => new Response('no', { status: 402 }) }),
    error => error instanceof ProviderError && error.status === 402,
  );
});

test('custom model name is sent and empty model falls back to default', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push(JSON.parse(options.body).model);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
  };
  await analyzeWithDeepSeek('Go.', { apiKey: 'test', model: 'my-model', fetchImpl });
  await analyzeWithDeepSeek('Go.', { apiKey: 'test', model: '', fetchImpl });
  assert.deepEqual(seen, ['my-model', 'deepseek-flash']);
});

test('system prompt keeps the multi-word predicate rules', () => {
  for (const phrase of [
    'The predicate is ONE contiguous span covering the whole verb phrase',
    'Never label a modal or auxiliary as a separate predicate',
    'Prepositions are never predicate or linking',
    'lemma is the base form of the verb phrase without modal/auxiliary',
    'You can shop for items.',
    'can shop for is ONE predicate/core span, lemma shop for',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt asks for a per-sentence tense', () => {
  for (const phrase of ['"tense":"Chinese tense and voice of the main clause"', 'tense is the Chinese name of the main clause', '一般将来时 · 被动语态', 'Judge the whole predicate span', '"tenseReason":"Chinese evidence for the tense"', 'Never cite a time word that is not in the sentence'])
    assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt keeps the round-2 consistency rules', () => {
  for (const phrase of [
    'A contracted negation stays inside the predicate',
    '"Don\'t worry" is ONE predicate span',
    'One constituent is one span',
    '"about 5% less" is ONE adverbial',
    'Do not leave modifiers unlabeled',
    'never role other',
    'coordinated main clauses',
    'never swallows a predicative, object or complement',
    'MANDATORY in the tense field itself',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});
