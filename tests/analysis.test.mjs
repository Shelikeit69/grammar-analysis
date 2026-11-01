import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisValidationError, validateInput, validateAnalysis } from '../lib/analysis.mjs';

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
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tense, '');
  data.sentences[0].tense = 'x'.repeat(101);
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tense, '');
});

test('tense reason is optional, kept when present and bounded', () => {
  const data = result();
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tenseReason, '');
  data.sentences[0].tenseReason = '因为 see 是动词原形，所以是一般现在时。';
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tenseReason, '因为 see 是动词原形，所以是一般现在时。');
  data.sentences[0].tenseReason = 'x'.repeat(601);
  assert.equal(validateAnalysis(data, 'I see I.').sentences[0].tenseReason, '');
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


test('validation errors identify fields without quoting untrusted values', () => {
  const data = result();
  data.sentences[0].segments[2].role = 'SECRET arbitrary provider content';
  assert.throws(() => validateAnalysis(data, 'I see I.'), error => {
    assert.ok(error instanceof AnalysisValidationError);
    assert.ok(error.reason.includes('sentences[0].segments[2].role'));
    assert.ok(!error.reason.includes('SECRET'));
    assert.ok(error.reason.length <= 280);
    return true;
  });
  assert.throws(() => validateAnalysis(result(), 'I see I. extra'), error => {
    assert.ok(error instanceof AnalysisValidationError);
    assert.ok(error.reason.includes('cover all original input'));
    return true;
  });
});

// "Big dogs bark loudly." -> 0 Big, 1 ' ', 2 dogs, 3 ' ', 4 bark, 5 ' ', 6 loudly, 7 '.'
const modifierText = 'Big dogs bark loudly.';
const modifierResult = (overrides = {}) => {
  const seg = (text, role, translation, lemma = '', level = 'core') => ({ text, role, translation, lemma, detail: '', level });
  const gap = () => seg(' ', 'other', '', '', 'detail');
  const segments = [
    seg('Big', 'attribute', '大的', '', 'detail'), gap(),
    seg('dogs', 'subject', '狗'), gap(),
    seg('bark', 'predicate', '叫', 'bark'), gap(),
    seg('loudly', 'adverbial', '大声地', '', 'detail'),
    seg('.', 'other', '', '', 'detail'),
  ];
  for (const [index, fields] of Object.entries(overrides)) Object.assign(segments[index], fields);
  return {
    sentences: [{ text: modifierText, translation: '大狗大声叫。', note: '', segments }],
    translation: '大狗大声叫。',
  };
};
const modifiesOf = data => data.sentences[0].segments.map(segment => segment.modifies);

test('a valid modifies index is kept (attribute, adverbial to predicate, complement)', () => {
  const out = validateAnalysis(modifierResult({ 0: { modifies: 2 }, 6: { modifies: 4 } }), modifierText);
  assert.deepEqual(modifiesOf(out), [2, undefined, undefined, undefined, undefined, undefined, 4, undefined]);
  const complement = modifierResult({ 6: { role: 'complement', modifies: 2 } });
  assert.equal(validateAnalysis(complement, modifierText).sentences[0].segments[6].modifies, 2);
});

test('an invalid modifies is dropped on its own and the result stays valid', () => {
  const bad = [
    -1, 8, 99,          // out of range
    0,                  // points to itself
    1, 7,               // points to a role other segment
    1.5, '2', null, true, [2], {}, NaN, // not an integer
  ];
  for (const value of bad) {
    const data = modifierResult({ 0: { modifies: value }, 6: { modifies: 4 } });
    const out = validateAnalysis(data, modifierText);
    assert.equal('modifies' in out.sentences[0].segments[0], false, String(value));
    // the rest of the result, including a valid sibling modifies, is untouched
    assert.equal(out.sentences[0].segments[6].modifies, 4);
    assert.equal(out.sentences[0].segments.map(segment => segment.text).join(''), modifierText);
  }
});

test('modifies on a role that cannot modify (subject, other) is dropped', () => {
  const out = validateAnalysis(modifierResult({ 2: { modifies: 4 }, 1: { modifies: 2 } }), modifierText);
  assert.equal('modifies' in out.sentences[0].segments[2], false);
  assert.equal('modifies' in out.sentences[0].segments[1], false);
});

test('legacy results without modifies still validate and carry no modifies key', () => {
  const out = validateAnalysis(modifierResult(), modifierText);
  assert.ok(out.sentences[0].segments.every(segment => !('modifies' in segment)));
  assert.doesNotThrow(() => validateAnalysis(result(), 'I see I.'));
});

test('a bad modifies does not relax other checks', () => {
  const data = modifierResult({ 0: { modifies: 2 } });
  data.sentences[0].segments[4].lemma = '';
  assert.throws(() => validateAnalysis(data, modifierText));
  const wrongText = modifierResult({ 0: { modifies: 2 } });
  assert.throws(() => validateAnalysis(wrongText, 'Big dogs bark quietly.'));
});

// "Big dogs bark loudly." -> 0 Big, 1 ' ', 2 dogs, 3 ' ', 4 bark, 5 ' ', 6 loudly, 7 '.'
const clauseResult = clauses => {
  const data = modifierResult();
  data.sentences[0].clauses = clauses;
  return data;
};
const clausesOf = clauses => validateAnalysis(clauseResult(clauses), modifierText).sentences[0].clauses;

test('clauses are optional, legacy results keep their exact shape and non-arrays are ignored', () => {
  assert.equal('clauses' in validateAnalysis(modifierResult(), modifierText).sentences[0], false);
  for (const value of ['', null, {}, 'x', 5, true, undefined]) {
    const data = modifierResult();
    data.sentences[0].clauses = value;
    const out = validateAnalysis(data, modifierText).sentences[0];
    assert.equal(out.clauses, undefined, String(value));
    assert.equal(out.segments.map(part => part.text).join(''), modifierText);
  }
  // All-invalid clauses also leave the previous output shape without an empty array.
  assert.equal(clausesOf([{ start: 1, end: 2, type: 'relative' }, { start: 7, end: 8, type: 'relative' }]), undefined);
});

test('the three clause types, adverbial subtypes, single-segment and adjacent ranges are kept', () => {
  const out = clausesOf([
    { start: 0, end: 2, type: 'relative' },
    { start: 4, end: 6, type: 'object' },
    { start: 4, end: 7, type: 'adverbial', subtype: 'condition' },
    { start: 6, end: 7, type: 'adverbial' },
  ]);
  assert.deepEqual(out.map(({ start, end, type }) => [start, end, type]), [
    [0, 2, 'relative'], [4, 7, 'adverbial'], [4, 6, 'object'], [6, 7, 'adverbial'],
  ]);
  assert.equal(out[1].subtype, 'condition');
  assert.equal('subtype' in out[0], false);
  assert.equal('subtype' in out[3], false);
  for (const subtype of ['time', 'condition', 'reason', 'concession', 'purpose', 'result', 'comparison', 'manner']) {
    assert.deepEqual(clausesOf([{ start: 0, end: 2, type: 'adverbial', subtype }]),
      [{ start: 0, end: 2, type: 'adverbial', subtype }]);
  }
});

test('only adverbial clauses keep a known subtype; unknown or misplaced subtypes are dropped alone', () => {
  const out = clausesOf([
    { start: 0, end: 2, type: 'relative', subtype: 'condition' },
    { start: 4, end: 6, type: 'object', subtype: 'time' },
    { start: 6, end: 7, type: 'adverbial', subtype: 'unknown' },
  ]);
  assert.deepEqual(out.map(clause => [clause.start, clause.type, clause.subtype]),
    [[0, 'relative', undefined], [4, 'object', undefined], [6, 'adverbial', undefined]]);
});

test('invalid clause entries are dropped without rejecting the result', () => {
  const bad = [
    null, 'x', 5, true, [], {},
    { start: 1.5, end: 3, type: 'relative' },
    { start: NaN, end: 3, type: 'relative' },
    { start: Infinity, end: 3, type: 'relative' },
    { start: '0', end: 2, type: 'relative' },
    { start: -1, end: 2, type: 'relative' },
    { start: 0, end: 9, type: 'relative' },
    { start: 4, end: 3, type: 'relative' },
    { start: 0, end: 2, type: 'unknown' },
    { start: 0, end: 2 },
    { start: 1, end: 2, type: 'relative' }, // whitespace only
    { start: 7, end: 8, type: 'adverbial' }, // punctuation only
  ];
  for (const value of bad) {
    assert.equal(validateAnalysis(clauseResult([value]), modifierText).sentences[0].clauses, undefined, JSON.stringify(value));
    assert.doesNotThrow(() => validateAnalysis(clauseResult([value]), modifierText));
  }
  // Invalid items do not take part in conflict checks and never remove independent valid ones.
  assert.deepEqual(clausesOf([
    { start: 0, end: 2, type: 'relative' },
    { start: 2, end: 5, type: 'unknown' },
    { start: 6, end: 7, type: 'adverbial' },
  ]), [{ start: 0, end: 2, type: 'relative' }, { start: 6, end: 7, type: 'adverbial' }]);
});

test('duplicate ranges keep one deterministic entry regardless of model order', () => {
  const forward = [
    { start: 0, end: 2, type: 'relative', id: 'model-id', text: 'copied clause text', depth: 9, parent: 1 },
    { start: 0, end: 2, type: 'adverbial', subtype: 'time' },
  ];
  const backward = [...forward].reverse();
  const expected = [{ start: 0, end: 2, type: 'adverbial', subtype: 'time' }];
  assert.deepEqual(clausesOf(forward), expected);
  assert.deepEqual(clausesOf(backward), expected);
  // Unknown model fields never leak into the normalized output.
  assert.equal('id' in clausesOf([forward[0]])[0], false);
});

test('partially crossing ranges are both dropped and independent ranges survive', () => {
  const ranges = [
    { start: 0, end: 4, type: 'relative' },
    { start: 2, end: 5, type: 'object' },
    { start: 6, end: 7, type: 'adverbial' },
  ];
  for (const clauses of [ranges, [...ranges].reverse(), [ranges[1], ranges[2], ranges[0]]]) {
    assert.deepEqual(clausesOf(clauses), [{ start: 6, end: 7, type: 'adverbial' }]);
  }
});

test('input order does not change conflict-free output', () => {
  const canonical = [...clausesOf([
    { start: 0, end: 2, type: 'relative' },
    { start: 2, end: 4, type: 'object' },
    { start: 4, end: 7, type: 'adverbial' },
  ])].map(clause => ({ ...clause }));
  assert.deepEqual(canonical.map(clause => clause.start), [0, 2, 4]);
  assert.deepEqual(clausesOf(canonical.slice().reverse()), canonical);
});

test('nesting with the same start or same end keeps three levels and drops the fourth', () => {
  const sameStart = clausesOf([
    { start: 0, end: 7, type: 'relative' },
    { start: 0, end: 5, type: 'object' },
    { start: 0, end: 3, type: 'adverbial' },
    { start: 0, end: 1, type: 'relative' },
  ]);
  assert.deepEqual(sameStart.map(clause => [clause.start, clause.end]), [[0, 7], [0, 5], [0, 3]]);
  const sameEnd = clausesOf([
    { start: 0, end: 7, type: 'relative' },
    { start: 2, end: 7, type: 'object' },
    { start: 4, end: 7, type: 'adverbial' },
    { start: 6, end: 7, type: 'relative' },
  ]);
  assert.deepEqual(sameEnd.map(clause => [clause.start, clause.end]), [[0, 7], [2, 7], [4, 7]]);
});

test('clause candidate count is capped and an oversized list is ignored safely', () => {
  const atLimit = Array.from({ length: 200 }, () => ({ start: 0, end: 2, type: 'relative' }));
  assert.deepEqual(clausesOf(atLimit), [{ start: 0, end: 2, type: 'relative' }]);
  const overLimit = [...atLimit, { start: 0, end: 2, type: 'relative' }];
  const out = validateAnalysis(clauseResult(overLimit), modifierText);
  assert.equal(out.sentences[0].clauses, undefined);
  assert.equal(out.sentences[0].segments.map(part => part.text).join(''), modifierText);
});
