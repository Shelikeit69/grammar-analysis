import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
