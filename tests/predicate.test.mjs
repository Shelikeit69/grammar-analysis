import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalysis } from '../public/analysis.js';
import { analyzeWithDeepSeek, SYSTEM } from '../public/deepseek.js';

import { separated } from './fixtures/predicate.mjs';

test('separated give up and turn off retain earlier predicate relation and verbatim coverage', () => {
  for (const flag of [false, true]) {
    const data = separated(flag);
    const out = validateAnalysis(data, data.sentences[0].text);
    assert.equal(out.sentences[0].segments[6].predicateOf, 2);
    assert.equal(out.sentences[0].segments.map(s => s.text).join(''), data.sentences[0].text);
    assert.equal(out.sentences[0].segments[4].role, 'object');
  }
});

test('invalid optional predicate relations are dropped, including chains and empty separators', () => {
  const mutations = [
    ...[-1, 99, 6, 7, 4, '2', 2.5, null, true, {}, [2]].map(value => s => {s[6].predicateOf = value;}),
    s => {s[6].role = 'adverbial';}, s => {s[6].level = 'detail';},
    s => {s[2].role = 'linking';}, s => {s[2].level = 'detail';},
    s => {s[6].lemma = 'give';}, s => {s[2].predicateOf = 0;},
    s => {s[4].role = 'other';},
  ];
  for (const mutate of mutations) {
    const data = separated(); mutate(data.sentences[0].segments);
    assert.equal('predicateOf' in validateAnalysis(data, data.sentences[0].text).sentences[0].segments[6], false);
  }
});

test('old output is unchanged and predicate metadata does not relax required fields', () => {
  const data = separated(); delete data.sentences[0].segments[6].predicateOf;
  const out = validateAnalysis(data, data.sentences[0].text);
  assert.ok(out.sentences[0].segments.every(s => !('predicateOf' in s)));
  data.sentences[0].segments[6].predicateOf = 2;
  data.sentences[0].segments[6].lemma = '';
  assert.throws(() => validateAnalysis(data, data.sentences[0].text));
  assert.throws(() => validateAnalysis(separated(), 'You should give up it.'));
});

test('bad optional predicate links never cause a repair request', async () => {
  const data = separated(); data.sentences[0].segments[6].predicateOf = 999;
  let calls = 0; let repairs = 0;
  const out = await analyzeWithDeepSeek(data.sentences[0].text, {apiKey: 'fake', onRepair: () => repairs++, fetchImpl: async () => {
    calls++; return Response.json({choices: [{finish_reason: 'stop', message: {content: JSON.stringify(data)}}]});
  }});
  assert.equal(calls, 1); assert.equal(repairs, 0);
  assert.equal('predicateOf' in out.sentences[0].segments[6], false);
});

test('prompt explicitly permits separated predicates without swallowing their object', () => {
  assert.match(SYSTEM, /predicateOf/);
  assert.match(SYSTEM, /You should give it up/);
  assert.doesNotMatch(SYSTEM, /The predicate is ONE contiguous span/);
});
