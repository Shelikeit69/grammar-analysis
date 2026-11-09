import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM} from '../public/deepseek.js';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  findInternalTerms,
  TERMS_INPUTS,
  extractSystem,
  buildVariantC,
  hasUnsplitBlock,
  countCorrections,
  VARIANT_C_CORRECTIONS,
  ISSUE27_INPUT,
} from '../scripts/ab-clauses.mjs';

const fakeSource = 'const x = 1;\nexport const SYSTEM = `第一段。corrections is REQUIRED: 旧的纠错规则整段。下一句还在规则里。 A separable phrasal verb 之后的规则。`;\nexport const OTHER = 2;\n';

test('extractSystem 从源码取出 SYSTEM 字符串', () => {
  const system = extractSystem(fakeSource);
  assert.ok(system.startsWith('第一段。'));
  assert.ok(system.endsWith('之后的规则。'));
  assert.ok(system.includes('corrections is REQUIRED:'));
  assert.ok(system.includes('A separable phrasal verb'));
});

test('extractSystem 处理转义的反引号并拒绝未闭合字面量', () => {
  assert.equal(extractSystem('export const SYSTEM = `a\\`b`;'), 'a`b');
  assert.throws(() => extractSystem('export const SYSTEM = `没有结尾'), /未闭合/);
  assert.throws(() => extractSystem('export const OTHER = 1;'), /未找到/);
});

test('buildVariantC 替换 corrections 整段', () => {
  const systemB = extractSystem(fakeSource);
  const systemC = buildVariantC(systemB);
  assert.ok(systemC.includes(VARIANT_C_CORRECTIONS));
  assert.ok(!systemC.includes('旧的纠错规则整段'));
  // 替换点之后的规则原样保留，且替换处只有一个空格分隔。
  assert.ok(systemC.includes(`${VARIANT_C_CORRECTIONS} A separable phrasal verb 之后的规则。`));
  // 前后其他内容不变。
  assert.ok(systemC.startsWith('第一段。'));
});

test('buildVariantC 找不到目标段落时报错', () => {
  assert.throws(() => buildVariantC('没有纠错规则的提示词'), /未找到/);
  assert.throws(
    () => buildVariantC('A separable phrasal verb 在前，corrections is REQUIRED: 在后'),
    /未找到/,
  );
});

test('hasUnsplitBlock 识别以 who argured/argued 开头的长片段', () => {
  const long = `who argured that criminals were born not made and could be identified by certain physical features that were throwbacks to a primitive sub human state`;
  assert.ok(long.length > 40);
  assert.equal(hasUnsplitBlock({ sentences: [{ segments: [{ text: long }] }] }), true);
  assert.equal(hasUnsplitBlock({ sentences: [{ segments: [{ text: long.replace('argured', 'argued') }] }] }), true);
  // 短片段不算。
  assert.equal(hasUnsplitBlock({ sentences: [{ segments: [{ text: 'who argured that x' }] }] }), false);
  // 不是以 who 开头的片段不算。
  assert.equal(hasUnsplitBlock({ sentences: [{ segments: [{ text: ` ${long}` }] }] }), false);
  // 多个句子、缺字段、非对象都不抛错。
  assert.equal(hasUnsplitBlock({ sentences: [{}, { segments: [{ text: long }] }] }), true);
  assert.equal(hasUnsplitBlock({ sentences: [{}] }), false);
  assert.equal(hasUnsplitBlock({}), false);
  assert.equal(hasUnsplitBlock(null), false);
});

test('countCorrections 统计原始返回里的 corrections 条数', () => {
  assert.equal(countCorrections({ sentences: [{ corrections: [{}, {}] }] }), 2);
  assert.equal(countCorrections({ sentences: [{ corrections: [] }, { corrections: [{}] }] }), 1);
  assert.equal(countCorrections({ sentences: [{}] }), '无');
  assert.equal(countCorrections({}), '无');
});

test('Issue #27 原句逐字且 D 组输入只改 argured', () => {
  assert.ok(ISSUE27_INPUT.includes('who argured that'));
  assert.ok(ISSUE27_INPUT.endsWith('sub human state.'));
  const inputD = ISSUE27_INPUT.replace('argured', 'argued');
  assert.ok(inputD.includes('who argued that'));
  assert.equal(inputD.length, ISSUE27_INPUT.length - 1);
  assert.equal(inputD.replace('argued', 'argured'), ISSUE27_INPUT);
});

const termsIn = sentence => findInternalTerms({sentences:[{text:'She left.', ...sentence}]});

test('internal terms scanner covers learner fields and excludes ordinary grammar descriptions', () => {
  assert.deepEqual(termsIn({note:'按规则全部为 detail'}), [
    {sentence:1, field:'note', term:'detail'}, {sentence:1, field:'note', term:'按规则'},
  ]);
  assert.deepEqual(termsIn({tenseReason:'按长从句规则拆开'}), [
    {sentence:1, field:'tenseReason', term:'长从句规则'},
  ]);
  assert.deepEqual(termsIn({segments:[{detail:'argue 是规则动词'}]}), []);
  assert.deepEqual(termsIn({corrections:[{reason:'采用例外规则，标为 CORE'}]}), [
    {sentence:1, field:'corrections[0].reason', term:'core'},
    {sentence:1, field:'corrections[0].reason', term:'例外规则'},
  ]);
});

test('whole English words are case-insensitive and quoting the sentence word is allowed', () => {
  assert.deepEqual(termsIn({text:'Keep the LEVEL steady.', note:'这里的 level 表示水平'}), []);
  assert.deepEqual(termsIn({note:'CORE 和 core 都表示主干'}), [{sentence:1,field:'note',term:'core'}]);
  assert.deepEqual(termsIn({note:'hardcore detailed levels'}), []);
  assert.deepEqual(findInternalTerms({sentences:[
    {text:'A core detail.', note:'CORE 和 Detail'},
    {text:'A different sentence.', note:'core'},
  ]}), [{sentence:2,field:'note',term:'core'}]);
});

test('phrases are scanned separately and malformed or unrelated fields are ignored', () => {
  assert.deepEqual(termsIn({segments:[{detail:'Level rule、long-clause rule、层级规则、默认规则'}]}).map(hit => hit.term),
    ['level', '默认规则', '层级规则', 'level rule', 'long-clause rule']);
  assert.deepEqual(termsIn({translation:'core', segments:[null,{detail:5,lemma:'level'}], corrections:[null]}), []);
  for (const data of [null, {}, {sentences:null}]) assert.deepEqual(findInternalTerms(data), []);
});

test('terms inputs are the four owner-selected sentences', () => {
  assert.deepEqual(TERMS_INPUTS, [
    'She thanked the nurse who said that the results were good.',
    'The book that the teacher who lives next door recommended is useful.',
    'I know that she was working when you called.',
    ISSUE27_INPUT,
  ]);
});

test('terms CLI uses the working tree or a git ref, defaults to five runs and makes one request per run', t => {
  const folder = mkdtempSync(path.join(tmpdir(), 'grammar-terms-'));
  t.after(() => rmSync(folder, {recursive:true,force:true}));
  const mock = path.join(folder, 'mock-fetch.mjs');
  writeFileSync(mock, [
    "import assert from 'node:assert/strict';",
    "import {writeFileSync} from 'node:fs';",
    "let calls = 0;",
    "process.on('exit', () => writeFileSync('calls.json', JSON.stringify(calls)));",
    "globalThis.fetch = async (url, options) => {",
    "  calls++;",
    "  const body = JSON.parse(options.body);",
    "  assert.equal(body.messages.length, 2);",
    "  assert.equal(body.messages[0].content, Buffer.from(process.env.EXPECTED_SYSTEM, 'base64').toString('utf8'));",
    "  assert.equal(body.model, 'deepseek-flash');",
    "  assert.equal(body.temperature, 0);",
    "  assert.equal(body.max_tokens, 16000);",
    "  const text = body.messages[1].content;",
    "  const data = {translation:'测试', sentences:[{text, translation:'测试', note:'按规则全部为 detail',",
    "    segments:[{text,role:'other',level:'detail',translation:'',detail:'',lemma:''}]}]};",
    "  const content = process.env.BROKEN_JSON ? '{broken' : JSON.stringify(data);",
    "  return Response.json({choices:[{finish_reason:'stop',message:{content}}]});",
    "};",
  ].join('\n'));
  const script = fileURLToPath(new URL('../scripts/ab-clauses.mjs', import.meta.url));
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const [args, expected, runs, broken] of [
    [['--runs','1'], SYSTEM, 1, false],
    [['--ref','HEAD'], extractSystem(execFileSync('git',['show','HEAD:public/deepseek.js'],{cwd:root,encoding:'utf8'})), 5, false],
    [['--runs','1'], SYSTEM, 1, true],
  ]) {
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(mock).href, script, '--terms', ...args], {
      cwd:folder, encoding:'utf8', timeout:10000,
      env:{...process.env, DEEPSEEK_API_KEY:'fake-terms-test',
        EXPECTED_SYSTEM:Buffer.from(expected).toString('base64'), BROKEN_JSON:broken ? '1' : ''},
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(path.join(folder, 'calls.json'),'utf8')), 4 * runs);
    const records = result.stdout.split('\n').filter(line => line.startsWith('{')).map(JSON.parse);
    assert.equal(records.length, 4 * runs);
    assert.ok(records.every(record => record.valid === !broken && record.hits.length === (broken ? 0 : 2)));
    assert.ok(!result.stdout.includes('fake-terms-test'));
  }
  const directories = readdirSync(path.join(folder,'ab-results'));
  assert.equal(directories.length, 3);
  const summaries = directories.map(dir => JSON.parse(readFileSync(path.join(folder,'ab-results',dir,'summary.json'),'utf8')));
  assert.ok(summaries.some(data => data.ref === 'HEAD' && data.summary.every(row => row.runs === 5 && row.hits === 5 && row.valid === 5)));
});

test('terms CLI without a credential exits before creating results or fetching', t => {
  const folder = mkdtempSync(path.join(tmpdir(), 'grammar-terms-no-key-'));
  t.after(() => rmSync(folder, {recursive:true,force:true}));
  const env = {...process.env};
  delete env.DEEPSEEK_API_KEY;
  const script = fileURLToPath(new URL('../scripts/ab-clauses.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script,'--terms'], {cwd:folder,env,encoding:'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未发送任何请求/);
  assert.deepEqual(readdirSync(folder), []);
});
