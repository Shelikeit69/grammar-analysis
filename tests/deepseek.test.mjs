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
  const keepAlive = setTimeout(() => {}, 2000);
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
    'share the same tense and voice, write it ONCE',
    'add it after the main clause(s) in tense',
    'do not repeat it',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

function contentResponse(content) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });
}

test('one repair corrects model JSON syntax or core validation with original context', async () => {
  const broken = structuredClone(valid);
  broken.sentences[0].segments[0].lemma = '';
  for (const failedContent of ['{broken', JSON.stringify(broken)]) {
    const requests = [];
    const repairs = [];
    const result = await analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: event => repairs.push(event),
      fetchImpl: async (url, options) => {
        requests.push(JSON.parse(options.body));
        return contentResponse(requests.length === 1 ? failedContent : JSON.stringify(valid));
      },
    });
    assert.deepEqual(result, valid);
    assert.equal(requests.length, 2);
    assert.equal(repairs.length, 1);
    assert.ok(repairs[0].reason.length < 300);
    assert.equal(requests[1].messages[1].content, 'Go.');
    assert.equal(requests[1].messages[2].content, failedContent);
    assert.ok(requests[1].messages[3].content.includes(repairs[0].reason));
  }
});

test('invalid optional tense fields are discarded without repair', async () => {
  const data = structuredClone(valid);
  data.sentences[0].tense = { invalid: true };
  data.sentences[0].tenseReason = 'x'.repeat(601);
  let calls = 0;
  const out = await analyzeWithDeepSeek('Go.', {
    apiKey: 'test', onRepair: () => assert.fail('optional fields must not retry'),
    fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(data)); },
  });
  assert.equal(calls, 1);
  assert.equal(out.sentences[0].tense, '');
  assert.equal(out.sentences[0].tenseReason, '');
});


test('two invalid model responses stop after one repair', async () => {
  for (const content of ['{invalid', JSON.stringify({ sentences: [] })]) {
    let calls = 0;
    let repairs = 0;
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => { repairs++; },
      fetchImpl: async () => { calls++; return contentResponse(content); },
    }), { name: 'AnalysisValidationError' });
    assert.equal(calls, 2);
    assert.equal(repairs, 1);
  }
});

test('transport, envelope, oversized and incomplete responses never retry', async () => {
  const responses = [
    () => new Response('denied', { status: 429 }),
    () => new Response('invalid envelope'),
    () => Response.json(null),
    () => Response.json({}),
    () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    () => contentResponse(''),
    () => new Response('x'.repeat(1_500_001)),
    () => { throw new TypeError('network failed'); },
  ];
  for (const response of responses) {
    let calls = 0;
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => assert.fail('must not repair'),
      fetchImpl: async () => { calls++; return response(); },
    }));
    assert.equal(calls, 1);
  }
});

test('cancelling from repair callback prevents the second fetch', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    onRepair: () => controller.abort(),
    fetchImpl: async () => { calls++; return contentResponse('{bad'); },
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('cancellation during repair stays AbortError without a third call', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    fetchImpl: async (url, { signal }) => {
      calls++;
      if (calls === 1) return contentResponse('{bad');
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        controller.abort();
      });
    },
  }), { name: 'AbortError' });
  assert.equal(calls, 2);
});

test('one overall deadline and same signal span both calls', async () => {
  let calls = 0;
  let firstSignal;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', timeoutMs: 1000,
      fetchImpl: async (url, { signal }) => {
        calls++;
        if (calls === 1) {
          firstSignal = signal;
          await new Promise(resolve => setTimeout(resolve, 50));
          return contentResponse('{bad');
        }
        assert.equal(signal, firstSignal);
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      },
    }), { name: 'TimeoutError' });
    assert.equal(calls, 2);
    assert.equal(firstSignal.aborted, true);
  } finally {
    clearTimeout(keepAlive);
  }
});


test('all malformed optional metadata types avoid paid repair and unknown metadata is ignored', async () => {
  for (const invalid of [null, 7, true, [], {}, 'x'.repeat(601)]) {
    const data = structuredClone(valid);
    data.sentences[0].tense = invalid;
    data.sentences[0].tenseReason = invalid;
    data.sentences[0].clauses = { invalid: true };
    data.sentences[0].segments[0].modifies = 999;
    let calls = 0;
    const out = await analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => assert.fail('must not repair optional metadata'),
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(data)); },
    });
    assert.equal(calls, 1);
    assert.equal(out.sentences[0].tense, '');
    assert.equal(out.sentences[0].tenseReason, '');
    assert.equal(out.sentences[0].clauses, undefined);
    assert.equal(out.sentences[0].segments[0].modifies, undefined);
  }
});

test('abort after reading model content is not treated as a format failure', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    onRepair: () => assert.fail('cancellation must not trigger repair'),
    fetchImpl: async () => {
      calls++;
      const bytes = new TextEncoder().encode(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{bad' } }] }));
      return new Response(new ReadableStream({
        start(stream) { stream.enqueue(bytes); stream.close(); controller.abort(); },
      }));
    },
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
