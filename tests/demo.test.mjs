import test from 'node:test';
import assert from 'node:assert/strict';
import {demoAnalysis, demoText} from '../public/demo.js';
import {validateAnalysis} from '../lib/analysis.mjs';

test('example keeps the original text, marks the core and modifiers, and meets the live contract', () => {
  const result = validateAnalysis(demoAnalysis, demoText);
  const sentence = result.sentences[0];
  const byText = text => sentence.segments.find(part => part.text === text);
  assert.equal(sentence.segments.map(part => part.text).join(''), demoText);
  assert.equal(byText('learners').role, 'subject');
  assert.equal(byText('will see').role, 'predicate');
  assert.equal(byText('will see').lemma, 'see');
  assert.equal(byText('the beauty').role, 'object');
  for (const text of ['Tired', 'who keep going every day', 'of English grammar', 'in the end']) {
    assert.equal(byText(text).level, 'detail', text);
  }
  assert.equal(byText('in the end').role, 'adverbial');
  assert.match(sentence.tense, /一般将来时/);
});

test('example modifier relations: each modifier points to the word it modifies', () => {
  const sentence = validateAnalysis(demoAnalysis, demoText).sentences[0];
  const target = text => {
    const segment = sentence.segments.find(part => part.text === text);
    return sentence.segments[segment.modifies]?.text;
  };
  assert.equal(target('Tired'), 'learners');
  assert.equal(target('who keep going every day'), 'learners');
  assert.equal(target('of English grammar'), 'the beauty');
  assert.equal(target('in the end'), 'will see');
  // only attribute/adverbial/complement carry modifies in the example
  for (const part of sentence.segments) {
    if (part.modifies !== undefined) assert.ok(['attribute', 'adverbial', 'complement'].includes(part.role), part.text);
  }
});
