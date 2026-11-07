import test from 'node:test';
import assert from 'node:assert/strict';
import {findUnsplitClauses, validateAnalysis} from '../public/analysis.js';
import {analyzeWithDeepSeek} from '../public/deepseek.js';
import {longTextAnchors, withTextAnchors, unsplitLongClause} from './fixtures/clauses.mjs';

const first = unsplitLongClause();
const split = withTextAnchors(longTextAnchors());
const text = first.sentences[0].text;
const inspect = data => findUnsplitClauses(validateAnalysis(data, data.sentences[0].text));
test('fictional nested sentence distinguishes whole and split clauses', () => {
  assert.equal(inspect(first).length, 1);
  assert.deepEqual(inspect(split), []);
});

test('six/seven word boundary, apostrophes, hyphens and form-only detection', () => {
  for (const role of ['attribute', 'adverbial']) {
    for (const extra of ['', ' today']) {
      const text = "who don't visit well-known local parks" + extra;
      const data = structuredClone(first);
      const sentence = data.sentences[0];
      sentence.text = text;
      sentence.segments = [{...sentence.segments[0], text, role, form: 'clause'}];
      delete sentence.clauses;
      assert.deepEqual(inspect(data), extra ? [{sentence: 1, text, wordCount: 7}] : []);
    }
  }
});
const envelope = (content, finish_reason = 'stop') => Response.json({
  choices: [{message: {content}, finish_reason}],
});
const respond = data => envelope(JSON.stringify(data));
const still = {...first, translation: '第二次结果'};
for (const [name, initial, second, kind, adopted, expected] of [
  ['split', first, () => respond(split), 'unsplit', true, split],
  ['still unsplit', first, () => respond(still), 'unsplit', true, still],
  ['HTTP', first, () => new Response('', {status: 500}), 'unsplit', false, first],
  ['bad JSON', first, () => envelope('{'), 'unsplit', false, first],
  ['invalid schema', first, () => respond({}), 'unsplit', false, first],
  ['length', first, () => envelope('{}', 'length'), 'unsplit', false, first],
  ['format then unsplit', {}, () => respond(still), 'format', true, still],
]) {
  test(name, async () => {
    let calls = 0;
    const events = [];
    const out = await analyzeWithDeepSeek(text, {apiKey: 'test',
      onRepair: event => events.push(event.kind),
      fetchImpl: async (_, options) => {
        if (++calls === 1) return respond(initial);
        if (kind === 'unsplit') {
          const prompt = JSON.parse(options.body).messages.at(-1).content;
          assert.ok(prompt.includes(first.sentences[0].clauses[0].text));
        }
        return second();
      },
    });
    assert.equal(calls, 2);
    assert.deepEqual(events, [kind]);
    assert.deepEqual(out.repair, {kind, adopted});
    assert.deepEqual(out, validateAnalysis(expected, text));
  });
}

test('caller cancellation overrides fallback, deadline returns first', async () => {
  for (const cancel of [true, false]) {
    const ctrl = new AbortController();
    let calls = 0;
    const pending = analyzeWithDeepSeek(text, {
      apiKey: 'test', signal: ctrl.signal, timeoutMs: cancel ? 1000 : 30,
      fetchImpl: async (_, {signal}) => {
        if (++calls === 1) return respond(first);
        if (cancel) ctrl.abort();
        signal.throwIfAborted();
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
      },
    });
    const timer = setTimeout(() => {}, 1500);
    try {
      if (cancel) await assert.rejects(pending, {name: 'AbortError'});
      else assert.deepEqual((await pending).repair, {kind:'unsplit', adopted:false});
      assert.equal(calls, 2);
    } finally {
      clearTimeout(timer);
    }
  }
});

test('unsplit repair preserves normalized corrections', async () => {
  const corrected = structuredClone(split);
  corrected.sentences[0].corrections = [{text:'claimed', fix:'claims', reason:'测试'}];
  let calls = 0;
  const out = await analyzeWithDeepSeek(text, {apiKey:'test',
    fetchImpl: async () => respond(++calls === 1 ? first : corrected)});
  assert.equal(calls, 2);
  assert.equal(out.sentences[0].corrections[0].fix, 'claims');
});
