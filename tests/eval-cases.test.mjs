import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnalysis, validateInput} from '../public/analysis.js';
import {demoAnalysis, demoText} from '../public/demo.js';
import {EVAL_CASES, evaluateEvalCase} from '../scripts/eval-cases.mjs';

const TYPES = new Set(['role', 'level', 'lemma', 'form', 'modifies', 'gloss-excludes', 'separated', 'clause', 'split', 'clauseCount', 'tense']);
const part = (text, role, extra = {}) => ({text, role, translation: role === 'other' ? '' : '译', lemma: '', detail: '', level: 'core', ...extra});
const gap = () => part(' ', 'other', {level: 'detail'});
const analyze = (text, segments, extra = {}) => validateAnalysis({
  sentences: [{text, translation: '译', note: '', tense: '', tenseReason: '', segments, ...extra}],
  translation: '译',
}, text);
const run = (checks, data) => evaluateEvalCase({checks}, data).map(item => item.pass);

test('评测集用例结构完整', () => {
  assert.equal(EVAL_CASES.length, 40);
  assert.equal(new Set(EVAL_CASES.map(item => item.id)).size, EVAL_CASES.length);
  for (const item of EVAL_CASES) {
    validateInput(item.input);
    assert.ok(item.checks.length, item.id);
    for (const check of item.checks) {
      assert.ok(TYPES.has(check.type), item.id + ' ' + check.type);
      // 检查项引用的原文必须逐字出现在句子里。
      for (const quoted of [check.text, check.target, check.verb, check.particle]) {
        if (quoted !== undefined) assert.ok(item.input.includes(quoted), item.id + ' 缺少原文：' + quoted);
      }
    }
  }
});

test('内置例句的分析通过对应检查', () => {
  const data = validateAnalysis(structuredClone(demoAnalysis), demoText);
  // demo 用内部 start/end 表示从句，validateAnalysis 只接受原文锚点，这里补回范围。
  data.sentences[0].clauses = demoAnalysis.sentences[0].clauses;
  assert.deepEqual(run([
    {type: 'role', text: 'learners', role: 'subject'},
    {type: 'lemma', text: 'will see', lemma: 'see'},
    {type: 'level', text: 'will see', level: 'core'},
    {type: 'modifies', text: 'of English grammar', target: 'beauty'},
    {type: 'modifies', text: 'in the end', target: 'see'},
    {type: 'clause', text: 'who keep going every day', clauseType: 'relative'},
    {type: 'clauseCount', count: 1},
    {type: 'tense', value: '一般将来时·主动语态；一般现在时 · 主动语态'},
    {type: 'split', text: 'who keep going every day'},
    {type: 'role', text: 'learners', role: 'object'},
    {type: 'modifies', text: 'in the end', target: 'beauty'},
    {type: 'clause', text: 'who keep going every day', clauseType: 'object'},
  ], data), [true, true, true, true, true, true, true, true, false, false, false, false]);
});

test('按完整单词匹配，不匹配单词的一部分', () => {
  const data = analyze('He is his.', [part('He', 'subject'), gap(), part('is', 'linking', {lemma: 'be'}), gap(), part('his', 'predicative'), part('.', 'other', {level: 'detail'})]);
  assert.deepEqual(run([
    {type: 'role', text: 'is', role: 'linking'},
    {type: 'role', text: 'is', role: 'predicative'},
    {type: 'lemma', text: 'is', lemma: ['am', 'be']},
  ], data), [true, false, true]);
});

test('分离短语动词、结构类型和释义检查', () => {
  const data = analyze('You can give it up now.', [
    part('You', 'subject'), gap(),
    part('can give', 'predicate', {lemma: 'give up', translation: '能放弃'}), gap(),
    part('it', 'object'), gap(),
    part('up', 'predicate', {lemma: 'give up', predicateOf: 2}), gap(),
    part('now', 'adverbial', {level: 'detail', form: 'prep', modifies: 2}),
    part('.', 'other', {level: 'detail'}),
  ]);
  assert.deepEqual(run([
    {type: 'separated', verb: 'give', particle: 'up'},
    {type: 'separated', verb: 'give', particle: 'now'},
    {type: 'form', text: 'now', form: 'prep'},
    {type: 'form', text: 'now', form: 'ing'},
    {type: 'gloss-excludes', text: 'can give', words: ['能', '可以']},
    {type: 'gloss-excludes', text: 'can give', words: ['将']},
    {type: 'level', text: 'now', level: 'detail'},
  ], data), [true, false, true, false, false, true, true]);
});

test('从句拆分与状语小类', () => {
  const text = 'I left because he was late.';
  const data = analyze(text, [
    part('I', 'subject'), gap(), part('left', 'predicate', {lemma: 'leave'}), gap(),
    part('because', 'other', {level: 'detail'}), gap(), part('he', 'subject', {level: 'detail'}), gap(),
    part('was', 'linking', {lemma: 'be', level: 'detail'}), gap(), part('late', 'predicative', {level: 'detail'}),
    part('.', 'other', {level: 'detail'}),
  ], {clauses: [{type: 'adverbial', subtype: 'reason', text: 'because he was late'}]});
  assert.deepEqual(run([
    {type: 'clause', text: 'because he was late', clauseType: 'adverbial', subtype: 'reason'},
    {type: 'clause', text: 'because he was late', clauseType: 'adverbial', subtype: 'time'},
    {type: 'split', text: 'because he was late'},
    {type: 'clauseCount', count: 0},
  ], data), [true, false, true, false]);
});

test('格式未通过时所有检查项都算未通过', () => {
  const caseItem = EVAL_CASES[0];
  const results = evaluateEvalCase(caseItem, null);
  assert.equal(results.length, caseItem.checks.length);
  assert.ok(results.every(item => item.pass === false));
});
