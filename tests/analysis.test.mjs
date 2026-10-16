import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, validateAnalysis } from '../lib/analysis.mjs';

const result = () => ({
  sentences: [{
    text: 'I see I.', translation: '我看见我。', note: '',
    segments: [
      { text: 'I', role: 'subject', translation: '我', lemma: '', detail: '', level: 'core' },
      { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
      { text: 'see', role: 'predicate', translation: '看见', lemma: 'see', detail: '', level: 'core' },
      { text: ' I.', role: 'object', translation: '我', lemma: '', detail: '', level: 'core' },
    ],
  }],
  translation: '我看见我。',
});

test('input limits', () => {
  assert.equal(validateInput(' I see I. '), ' I see I. ');
  for (const input of ['', null, 'a '.repeat(301), 'x'.repeat(6001)]) {
    assert.throws(() => validateInput(input));
  }
});

test('exact repeated word coverage and sanitized fields', () => {
  const data = result();
  data.extra = 'discard';
  assert.equal(validateAnalysis(data, ' I see I. ').extra, undefined);
  assert.throws(() => validateAnalysis(data, 'I see  I.'));
  data.sentences[0].segments[0].text = 'You';
  assert.throws(() => validateAnalysis(data, 'I see I.'));
});

test('reject invalid roles, missing verbal lemmas and reordered sentences', () => {
  let data = result();
  data.sentences[0].segments[2].lemma = '';
  assert.throws(() => validateAnalysis(data, 'I see I.'));
  data = result();
  data.sentences[0].segments[0].role = 'unknown';
  assert.throws(() => validateAnalysis(data, 'I see I.'));
  assert.throws(() => validateAnalysis(result(), 'I. I see I.'));
});

test('whitespace spans are preserved; empty spans rejected', () => {
  const data = result();
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].segments[1].text, ' ');
  data.sentences[0].segments.splice(1, 0, {
    text: '', role: 'other', translation: '', lemma: '', detail: '', level: 'detail',
  });
  assert.throws(() => validateAnalysis(data, 'I see I.'));
});

test('require translations for paragraph, sentence and annotated spans', () => {
  for (const blank of ['', '  ']) {
    for (const target of ['paragraph', 'sentence', 'segment']) {
      const data = result();
      if (target === 'paragraph') data.translation = blank;
      if (target === 'sentence') data.sentences[0].translation = blank;
      if (target === 'segment') data.sentences[0].segments[0].translation = blank;
      assert.throws(() => validateAnalysis(data, 'I see I.'));
    }
  }
  assert.doesNotThrow(() => validateAnalysis(result(), 'I see I.'));
});

test('multi-word predicate span (modal + verb + preposition) is accepted', () => {
  const data = {
    sentences: [{
      text: 'You can shop for items.', translation: '你可以选购商品。', note: '',
      segments: [
        { text: 'You', role: 'subject', translation: '你', lemma: '', detail: '', level: 'core' },
        { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
        { text: 'can shop for', role: 'predicate', translation: '选购', lemma: 'shop for', detail: 'can 表示可以；shop for 意为选购', level: 'core' },
        { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
        { text: 'items', role: 'object', translation: '商品', lemma: '', detail: '', level: 'core' },
        { text: '.', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
      ],
    }],
    translation: '你可以选购商品。',
  };
  assert.doesNotThrow(() => validateAnalysis(data, 'You can shop for items.'));
});
