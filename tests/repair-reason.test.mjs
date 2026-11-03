import test from 'node:test';
import assert from 'node:assert/strict';
import {AnalysisValidationError, validateAnalysis} from '../public/analysis.js';
import {repairAnalysis, repairText} from './fixtures/repair.mjs';

function reasonOf(data, input = repairText) {
  let reason;
  assert.throws(() => validateAnalysis(data, input), error => {
    assert.ok(error instanceof AnalysisValidationError);
    reason = error.reason;
    assert.ok(reason.length <= 280);
    assert.ok(reason.endsWith('Copy every original character including spaces and punctuation, and add nothing.'));
    return true;
  });
  return reason;
}

function snippets(reason) {
  const match = reason.match(/original (.*); actual (.*)\. sentences/);
  assert.ok(match, reason);
  return [JSON.parse(match[1]), JSON.parse(match[2])];
}

test('missing space reports the first character, quoted context and adjacent segment indexes', () => {
  const data = repairAnalysis();
  data.sentences[0].segments.splice(1, 1);
  const reason = reasonOf(data);
  assert.ok(reason.startsWith('char 16 (0-based), around segments 0-1;'));
  assert.ok(reason.includes('must concatenate exactly to sentence text'));
  const [original, actual] = snippets(reason);
  assert.ok(original.includes('garden grows'));
  assert.ok(actual.includes('gardengrows'));
});

test('an extra comma reports its location and the original and joined text', () => {
  const data = repairAnalysis();
  data.sentences[0].segments.splice(1, 0, {...data.sentences[0].segments[1], text: ','});
  const reason = reasonOf(data);
  assert.ok(reason.startsWith('char 16 (0-based), around segments 0-1;'));
  const [original, actual] = snippets(reason);
  assert.ok(original.includes('garden grows'));
  assert.ok(actual.includes('garden, grows'));
});

test('early end on either side reports the original character position without other exceptions', () => {
  for (const extra of [false, true]) {
    const data = repairAnalysis();
    if (extra) data.sentences[0].segments.push({...data.sentences[0].segments.at(-1), text: '!'});
    else data.sentences[0].segments.pop();
    const reason = reasonOf(data);
    assert.ok(reason.startsWith('char ' + (extra ? repairText.length : repairText.length - 1) + ' (0-based)'));
    const [original, actual] = snippets(reason);
    assert.equal(original.endsWith('.'), true);
    assert.equal(actual.endsWith(extra ? '.!' : 'summer'), true);
  }
});

test('a mismatch near the end of a long sentence survives the reason cap completely', () => {
  const text = 'Our small garden ' + 'grows fresh herbs '.repeat(22) + 'every summer.';
  assert.ok(text.length > 280);
  const data = repairAnalysis();
  const sentence = data.sentences[0];
  sentence.text = text;
  sentence.segments = [{...sentence.segments[0], text: text.slice(0, -1)}];
  const reason = reasonOf(data, text);
  assert.ok(reason.startsWith('char ' + (text.length - 1) + ' (0-based), around segments 0-0;'));
  assert.ok(reason.includes('must concatenate exactly to sentence text'));
  assert.equal(snippets(reason)[0].endsWith('.'), true);
});

test('sentence text mismatch uses a sentence-local position and quoted input context', () => {
  const data = repairAnalysis();
  data.sentences[0].text = repairText.replace('garden', 'Garden');
  const reason = reasonOf(data);
  assert.ok(reason.startsWith('char 10 (0-based);'));
  assert.ok(reason.includes('must match the next original input characters exactly'));
  const [original, actual] = snippets(reason);
  assert.ok(original.includes('garden'));
  assert.ok(actual.includes('Garden'));
  const first = repairAnalysis();
  first.sentences.push(data.sentences[0]);
  assert.ok(reasonOf(first, repairText + '\n' + repairText).startsWith('char 10 (0-based);'));
});

test('JSON-escaped context is shortened before the cap and remains valid JSON', () => {
  const text = 'Our garden ' + '\u0001'.repeat(30) + ' grows.';
  const data = repairAnalysis();
  const sentence = data.sentences[0];
  sentence.text = text;
  sentence.segments = [{...sentence.segments[0], text: text.replace(' grows', ', grows')}];
  const reason = reasonOf(data, text);
  assert.ok(reason.startsWith('char 41 (0-based), around segments 0-0;'));
  const [original, actual] = snippets(reason);
  assert.ok(original.includes('\u0001'));
  assert.ok(actual.includes(','));
  // The first differing character can be the end of the original input too.
  const longer = repairAnalysis();
  longer.sentences[0].text += '!';
  assert.ok(reasonOf(longer).startsWith('char ' + repairText.length + ' (0-based);'));
});
