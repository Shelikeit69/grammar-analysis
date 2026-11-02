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
  assert.match(SYSTEM, /Main-clause separated predicates keep predicateOf/);
  assert.doesNotMatch(SYSTEM, /The predicate is ONE contiguous span/);
});

// "The book that she gave the note back is useful." -> the clause internal
// predicate is split open, so both ends are level detail and predicateOf is
// not applicable; the validator drops only that link.
test('a predicateOf inside a split clause is dropped because clause internals are detail', () => {
  const segment = (text, role, translation = '', lemma = '', level = 'core') =>
    ({text, role, translation, lemma, detail: '测试', level});
  const gap = () => segment(' ', 'other', '', '', 'detail');
  const text = 'The book that she gave the note back is useful.';
  const segments = [
    segment('The book', 'subject', '这本书'), gap(),
    segment('that', 'object', '引导定语从句', '', 'detail'), gap(),
    segment('she', 'subject', '她', '', 'detail'), gap(),
    segment('gave', 'predicate', '还', 'give back', 'detail'), gap(),
    segment('the note', 'object', '笔记', '', 'detail'), gap(),
    segment('back', 'predicate', '还', 'give back', 'detail'), gap(),
    segment('is', 'linking', '是', 'be'), gap(),
    segment('useful', 'predicative', '有用的'),
    segment('.', 'other', '', '', 'detail'),
  ];
  segments[10].predicateOf = 6;
  const out = validateAnalysis({
    sentences: [{text, translation: '她把笔记还了的那本书很有用。', note: '', clauses: [{start: 2, end: 11, type: 'relative'}], segments}],
    translation: '她把笔记还了的那本书很有用。',
  }, text);
  assert.equal('predicateOf' in out.sentences[0].segments[10], false);
  assert.equal(out.sentences[0].segments[6].role, 'predicate');
  assert.equal(out.sentences[0].segments[6].level, 'detail');
  assert.deepEqual(out.sentences[0].clauses, [{start: 2, end: 11, type: 'relative'}]);
  assert.equal(out.sentences[0].segments.map(part => part.text).join(''), text);
});

test('a main-clause separated predicate keeps predicateOf even when the sentence has a clause', () => {
  const segment = (text, role, translation = '', lemma = '', level = 'core') =>
    ({text, role, translation, lemma, detail: '测试', level});
  const gap = () => segment(' ', 'other', '', '', 'detail');
  const text = 'You should give the note that she picked up back.';
  const segments = [
    segment('You', 'subject', '你'), gap(),
    segment('should give', 'predicate', '还', 'give back'), gap(),
    segment('the note', 'object', '笔记'), gap(),
    segment('that', 'object', '引导定语从句', '', 'detail'), gap(),
    segment('she', 'subject', '她', '', 'detail'), gap(),
    segment('picked up', 'predicate', '捡起', 'pick up', 'detail'), gap(),
    segment('back', 'predicate', '还', 'give back'),
    segment('.', 'other', '', '', 'detail'),
  ];
  segments[12].predicateOf = 2;
  const out = validateAnalysis({
    sentences: [{text, translation: '你应该把她捡到的笔记还回去。', note: '', clauses: [{start: 6, end: 11, type: 'relative'}], segments}],
    translation: '你应该把她捡到的笔记还回去。',
  }, text);
  assert.equal(out.sentences[0].segments[12].predicateOf, 2);
  assert.equal(out.sentences[0].segments[10].level, 'detail');
  assert.deepEqual(out.sentences[0].clauses, [{start: 6, end: 11, type: 'relative'}]);
});
