// A/B 对照实验：比较不同提示词版本对 Issue #27 原句长从句拆分的影响。
// 背景：PR #47（内联纠错，合并提交 72cdc87）上线后 #27 原句的长定语从句不再拆分，
// 撤回后恢复。本脚本只做真实调用与记录，不改任何产品代码。
// 运行：DEEPSEEK_API_KEY=… npm run ab:clauses（密钥只从环境变量读取）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEEPSEEK_URL, DEFAULT_MODEL, SYSTEM } from '../public/deepseek.js';
import { validateAnalysis } from '../public/analysis.js';

// Issue #27 原句，逐字使用（含原文拼写错误 argured、sub human）。
export const ISSUE27_INPUT =
  'the word has ugly connotations thanks largely to Cesare Lombroso, a 19th-century Italian medic who argured that criminals were born not made and could be identified by certain physical features that were throwbacks to a primitive sub human state.';

export const PR47_COMMIT = '72cdc87';
export const CORRECTIONS_START = 'corrections is REQUIRED:';
export const CORRECTIONS_END = 'A separable phrasal verb';
// C 组：把 B 组 SYSTEM 中的纠错规则整段替换为下面这一句话版本。
export const VARIANT_C_CORRECTIONS =
  'corrections is REQUIRED: a per-sentence array of {"text":"exact original fragment","fix":"corrected fragment","reason":"Chinese reason"} for grammar, spelling and punctuation errors only; copy text exactly from the sentence; output [] when there is none.';

const SYSTEM_MARKER = 'export const SYSTEM = `';

// 从 public/deepseek.js 源码中取出 SYSTEM 字符串（模板字面量，无插值、无转义）。
export function extractSystem(source) {
  const start = source.indexOf(SYSTEM_MARKER);
  if (start < 0) throw new Error('源码中未找到 export const SYSTEM = ` 标记。');
  let out = '';
  for (let i = start + SYSTEM_MARKER.length; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\' && i + 1 < source.length) {
      const next = source[i + 1];
      if (next === '`' || next === '\\') {
        out += next;
        i++;
        continue;
      }
    }
    if (ch === '`') return out;
    out += ch;
  }
  throw new Error('SYSTEM 模板字符串未闭合。');
}

// 从 git 仓库读取 PR #47 合并提交里的 public/deepseek.js 并取出 SYSTEM。
export function loadPr47System(cwd = path.dirname(fileURLToPath(import.meta.url))) {
  const source = execFileSync('git', ['show', `${PR47_COMMIT}:public/deepseek.js`], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return extractSystem(source);
}

// C 组 SYSTEM：替换纠错规则整段。替换前后都断言目标段落存在，找不到就抛错。
export function buildVariantC(systemB) {
  const start = systemB.indexOf(CORRECTIONS_START);
  const end = systemB.indexOf(CORRECTIONS_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`未找到 ${CORRECTIONS_START} 到 ${CORRECTIONS_END} 之间的整段，无法构建 C 组提示词。`);
  }
  const removed = systemB.slice(start, end);
  const systemC = `${systemB.slice(0, start)}${VARIANT_C_CORRECTIONS} ${systemB.slice(end)}`;
  if (!systemC.includes(VARIANT_C_CORRECTIONS) || systemC.includes(removed.slice(0, 80))) {
    throw new Error('C 组提示词替换后校验失败。');
  }
  return systemC;
}

// 「整块未拆」：原始返回里是否有 segment 的 text 以 "who argured"/"who argued" 开头且超过 40 字符。
export function hasUnsplitBlock(data) {
  if (!data || !Array.isArray(data.sentences)) return false;
  return data.sentences.some(sentence =>
    Array.isArray(sentence?.segments) &&
    sentence.segments.some(segment =>
      typeof segment?.text === 'string' &&
      (segment.text.startsWith('who argured') || segment.text.startsWith('who argued')) &&
      segment.text.length > 40));
}

// 原始返回里 corrections 的总条数；任何句子都没有该数组字段时返回「无」。
export function countCorrections(data) {
  if (!data || !Array.isArray(data.sentences)) return '无';
  let total = 0;
  let seen = false;
  for (const sentence of data.sentences) {
    if (Array.isArray(sentence?.corrections)) {
      seen = true;
      total += sentence.corrections.length;
    }
  }
  return seen ? total : '无';
}

function buildGroups() {
  const systemB = loadPr47System();
  const systemC = buildVariantC(systemB);
  return [
    { name: 'A', label: 'main SYSTEM', system: SYSTEM, input: ISSUE27_INPUT },
    { name: 'B', label: 'PR #47 SYSTEM', system: systemB, input: ISSUE27_INPUT },
    { name: 'C', label: 'PR #47 SYSTEM + 一句话纠错规则', system: systemC, input: ISSUE27_INPUT },
    { name: 'D', label: 'PR #47 SYSTEM + 改正拼写', system: systemB, input: ISSUE27_INPUT.replace('argured', 'argued') },
  ];
}

// 与 public/deepseek.js 第一次分析请求完全一致的参数：
// POST https://api.deepseek.com/chat/completions
// { model: 'deepseek-flash', messages: [{role:'system'},{role:'user'}],
//   response_format: {type:'json_object'}, thinking: {type:'disabled'},
//   max_tokens: 16000, temperature: 0 }
async function callOnce(group, apiKey) {
  const started = performance.now();
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: group.system },
        { role: 'user', content: group.input },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      max_tokens: 16000,
      temperature: 0,
    }),
  });
  const envelope = await response.json();
  const seconds = (performance.now() - started) / 1000;

  const record = {
    group: group.name,
    label: group.label,
    seconds: Number(seconds.toFixed(2)),
    httpStatus: response.status,
    finishReason: envelope?.choices?.[0]?.finish_reason ?? null,
    promptTokens: envelope?.usage?.prompt_tokens ?? null,
    completionTokens: envelope?.usage?.completion_tokens ?? null,
    jsonOk: false,
    validOk: false,
    validationError: null,
    clauses: 0,
    unsplitBlock: false,
    corrections: '无',
  };

  const content = envelope?.choices?.[0]?.message?.content;
  let parsed = null;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
      record.jsonOk = true;
    } catch {
      record.jsonOk = false;
    }
  }
  if (parsed) {
    record.unsplitBlock = hasUnsplitBlock(parsed);
    record.corrections = countCorrections(parsed);
    try {
      const validated = validateAnalysis(parsed, group.input);
      record.validOk = true;
      record.clauses = validated.sentences.reduce((sum, s) => sum + (s.clauses?.length ?? 0), 0);
    } catch (error) {
      record.validationError = error.message;
    }
  }
  return { record, envelope };
}

function printSummary(records, groups) {
  console.log('\n===== 汇总 =====');
  console.log('组 | clauses 条数（3 次） | 整块未拆次数 | 校验通过次数 | 平均耗时(s)');
  for (const group of groups) {
    const runs = records.filter(r => r.group === group.name);
    const clauses = runs.map(r => r.clauses).join(', ');
    const unsplit = runs.filter(r => r.unsplitBlock).length;
    const valid = runs.filter(r => r.validOk).length;
    const avg = runs.length ? (runs.reduce((s, r) => s + r.seconds, 0) / runs.length).toFixed(2) : '-';
    console.log(`${group.name}（${group.label}） | ${clauses} | ${unsplit} | ${valid}/3 | ${avg}`);
  }
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('错误：未设置环境变量 DEEPSEEK_API_KEY，已退出，未发送任何请求。');
    process.exit(1);
  }

  const groups = buildGroups();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('ab-results', timestamp);
  mkdirSync(outDir, { recursive: true });

  const records = [];
  // 按 A1 B1 C1 D1 A2 B2 … 交替顺序调用，避免同一组连续。
  for (let round = 1; round <= 3; round++) {
    for (const group of groups) {
      let result;
      try {
        result = await callOnce(group, apiKey);
      } catch (error) {
        result = {
          record: {
            group: group.name, label: group.label, seconds: 0, httpStatus: 0,
            finishReason: null, promptTokens: null, completionTokens: null,
            jsonOk: false, validOk: false, validationError: `请求失败：${error.message}`,
            clauses: 0, unsplitBlock: false, corrections: '无',
          },
          envelope: { error: error.message },
        };
      }
      const { record, envelope } = result;
      record.round = round;
      records.push(record);
      writeFileSync(
        path.join(outDir, `${group.name}-${round}.json`),
        JSON.stringify(envelope, null, 2),
      );
      console.log(
        `${group.name}${round} | ${record.seconds}s | finish=${record.finishReason} | ` +
        `tokens=${record.promptTokens}/${record.completionTokens} | json=${record.jsonOk ? 'ok' : 'fail'} | ` +
        `valid=${record.validOk ? 'ok' : `fail: ${record.validationError}`} | ` +
        `clauses=${record.clauses} | 整块未拆=${record.unsplitBlock ? '是' : '否'} | corrections=${record.corrections}`,
      );
    }
  }
  printSummary(records, groups);
  console.log(`\n原始返回已保存到 ${outDir}/`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch(error => {
    console.error(`执行失败：${error.message}`);
    process.exit(1);
  });
}
