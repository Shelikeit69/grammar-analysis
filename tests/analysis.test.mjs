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

test('sentence tense is kept when present and optional when absent', () => {
  const data = result();
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tense, '');
  data.sentences[0].tense = '一般现在时 · 主动语态';
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tense, '一般现在时 · 主动语态');
  data.sentences[0].tense = 5;
  assert.throws(() => validateAnalysis(data, 'I see I.'));
  data.sentences[0].tense = 'x'.repeat(101);
  assert.throws(() => validateAnalysis(data, 'I see I.'));
});

test('tense reason is optional, kept when present and bounded', () => {
  const data = result();
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tenseReason, '');
  data.sentences[0].tenseReason = '因为 see 是动词原形，所以是一般现在时。';
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tenseReason, '因为 see 是动词原形，所以是一般现在时。');
  data.sentences[0].tenseReason = 'x'.repeat(601);
  assert.throws(() => validateAnalysis(data, 'I see I.'));
});

test('contracted negation as one predicate span and a two-tense label are accepted', () => {
  const data = {
    sentences: [{
      text: "Don't worry, so it costs about 5% less.", translation: '别担心，所以便宜约5%。', note: '',
      tense: '祈使句；一般现在时 · 主动语态', tenseReason: '因为 Don\'t worry 以动词原形开头；costs 是第三人称单数。',
      segments: [
        { text: "Don't worry", role: 'predicate', translation: '不要担心', lemma: 'worry', detail: '', level: 'core' },
        { text: ', so ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
        { text: 'it', role: 'subject', translation: '它', lemma: '', detail: '', level: 'core' },
        { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
        { text: 'costs', role: 'predicate', translation: '花费', lemma: 'cost', detail: '', level: 'core' },
        { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
        { text: 'about 5% less', role: 'adverbial', translation: '大约便宜5%', lemma: '', detail: '', level: 'detail' },
        { text: '.', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
      ],
    }],
    translation: '别担心，所以便宜约5%。',
  };
  const out = validateAnalysis(data, "Don't worry, so it costs about 5% less.");
  assert.equal(out.sentences[0].segments[0].text, "Don't worry");
  assert.equal(out.sentences[0].tense, '祈使句；一般现在时 · 主动语态');
});
