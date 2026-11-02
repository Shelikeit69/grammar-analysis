import {longTextAnchors, withTextAnchors} from './fixtures/clauses.mjs';
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

// Anchors are model input; assertions use the unchanged internal range format.
const clausesOf = clauses => {
  const data = modifierResult();
  data.sentences[0].clauses = clauses;
  return validateAnalysis(data, modifierText).sentences[0].clauses;
};

test('clauses are optional and malformed metadata never rejects valid core analysis', () => {
  for (const value of [undefined, null, '', {}, 5, true]) {
    assert.equal(clausesOf(value), undefined);
  }
  for (const item of [null, 'x', 5, true, [], {}, {type:'relative', text:5},
    {type:'relative', text:''}, {type:'relative', text:' '}, {type:'relative', text:'.'},
    {type:'unknown', text:'Big'}, {text:'Big'}, {type:'relative', text:'x'.repeat(100)},
    {type:'relative', start:0, end:1}, {type:'relative', text:'no match'},
    {type:'relative', text:'ig'}, {type:'relative', text:'Big dog'},
  ]) {
    assert.doesNotThrow(() => clausesOf([item]));
    assert.equal(clausesOf([item]), undefined, JSON.stringify(item));
  }
});

test('unique exact anchors match at segment boundaries and model indexes are ignored', () => {
  assert.deepEqual(clausesOf([{type:'relative', text:'Big dogs', start:99, end:-1}]),
    [{start:0, end:3, type:'relative'}]);
  // An interior substring is not a match, even if it occurs only once.
  for (const text of ['ig dogs', 'Big dog', 'ark loud']) assert.equal(clausesOf([{type:'relative', text}]), undefined);
});

test('anchor whitespace is trimmed and punctuation-only edge segments are removed', () => {
  assert.deepEqual(clausesOf([{type:'adverbial', text:'  bark loudly.  ', subtype:'manner'}]),
    [{start:4, end:7, type:'adverbial', subtype:'manner'}]);
  const data = modifierResult();
  data.sentences[0].segments.unshift({text:',',role:'other',translation:'',lemma:'',detail:'',level:'detail'});
  data.sentences[0].text = ',' + modifierText;
  data.sentences[0].clauses = [{type:'relative',text:',' + modifierText}];
  assert.deepEqual(validateAnalysis(data, ',' + modifierText).sentences[0].clauses,
    [{start:1,end:8,type:'relative'}]);
});

test('repeated exact boundary matches are ambiguous and dropped without affecting siblings', () => {
  const data = result(); // I see I. Both I occurrences must have segment boundaries.
  data.sentences[0].segments.splice(3, 1,
    {text:' ',role:'other',translation:'',lemma:'',detail:'',level:'detail'},
    {text:'I',role:'object',translation:'我',lemma:'',detail:'',level:'core'},
    {text:'.',role:'other',translation:'',lemma:'',detail:'',level:'detail'});
  data.sentences[0].clauses = [{type:'object',text:'I'}, {type:'relative',text:'see'}];
  assert.deepEqual(validateAnalysis(data, 'I see I.').sentences[0].clauses,
    [{start:2,end:3,type:'relative'}]);
});

test('clause types and all adverbial subtypes survive; misplaced subtypes are omitted', () => {
  for (const type of ['relative','object','adverbial']) {
    for (const subtype of ['time','condition','reason','concession','purpose','result','comparison','manner','unknown']) {
      assert.deepEqual(clausesOf([{type,subtype,text:'Big'}]), [{start:0,end:1,type,
        ...(type === 'adverbial' && subtype !== 'unknown' ? {subtype} : {})}]);
    }
  }
});

test('duplicate ranges are deterministic after punctuation trimming and copy only internal fields', () => {
  const items = [{type:'relative',text:'bark loudly.', id:'x',depth:9,parent:1},
    {type:'adverbial',subtype:'time',text:'bark loudly'}];
  for (const clauses of [items,[...items].reverse()]) {
    assert.deepEqual(clausesOf(clauses),[{start:4,end:7,type:'adverbial',subtype:'time'}]);
  }
});

test('partially crossing anchors are both dropped and independent anchors survive', () => {
  const items = [{type:'relative',text:'Big dogs'}, {type:'object',text:'dogs bark'},
    {type:'adverbial',text:'loudly'}, {type:'relative',text:'missing'}];
  for (const clauses of [items,[...items].reverse()]) {
    assert.deepEqual(clausesOf(clauses),[{start:6,end:7,type:'adverbial'}]);
  }
});

test('anchor ordering, adjacency and three-level nesting retain the original contracts', () => {
  const adjacent=[{type:'relative',text:'Big'},{type:'object',text:'dogs'},{type:'adverbial',text:'bark loudly'}];
  assert.deepEqual(clausesOf(adjacent),clausesOf([...adjacent].reverse()));
  for (const texts of [['Big dogs bark loudly','Big dogs bark','Big dogs','Big'],
    ['Big dogs bark loudly','dogs bark loudly','bark loudly','loudly']]) {
    const out=clausesOf(texts.map(text=>({type:'relative',text})));
    assert.equal(out.length,3);
    assert.deepEqual(out.map(c=>[c.start,c.end]), texts[3] === 'Big'
      ? [[0,7],[0,5],[0,3]] : [[0,7],[2,7],[4,7]]);
  }
});

test('candidate cap is applied before matching and no malformed clause triggers a core error', () => {
  const items=Array.from({length:200},()=>({type:'relative',text:'Big'}));
  assert.deepEqual(clausesOf(items),[{start:0,end:1,type:'relative'}]);
  assert.equal(clausesOf([...items,{type:'relative',text:'dogs'}]),undefined);
});

test('fictional long sentence resolves three text anchors over more than 30 segments', () => {
  const normalized=longTextAnchors();
  const data=withTextAnchors(normalized);
  const sentence=data.sentences[0];
  assert.equal(sentence.text,'Our town has a new library thanks partly to Leo Grant, a retired teacher who claimed that books were bought not borrowed and could be shared by many local families that were short of money.');
  assert.ok(sentence.segments.length > 30);
  assert.deepEqual(normalized.sentences[0].clauses, [
    {start:13,end:40,type:'relative'},
    {start:17,end:40,type:'object'},
    {start:35,end:40,type:'relative'},
  ]);
  assert.deepEqual(sentence.clauses.map(c=>c.text),[
    'who claimed that books were bought not borrowed and could be shared by many local families that were short of money',
    'that books were bought not borrowed and could be shared by many local families that were short of money',
    'that were short of money',
  ]);
  assert.deepEqual(validateAnalysis(data,sentence.text).sentences[0].clauses,normalized.sentences[0].clauses);
  assert.deepEqual(sentence.segments.filter(p=>p.level==='core').map(p=>p.text),['Our town','has','a new library']);
});
