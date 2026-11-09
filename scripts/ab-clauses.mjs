// A/B 对照实验：比较不同提示词版本对 Issue #27 原句长从句拆分的影响。
// 背景：PR #47（内联纠错，合并提交 72cdc87）上线后 #27 原句的长定语从句不再拆分，
// 对照结果见 docs/verification.md 2026-11-07；main 本身也会整块未拆。
// 运行：DEEPSEEK_API_KEY=… npm run ab:clauses（密钥只从环境变量读取）。
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzeWithDeepSeek, DEEPSEEK_URL, DEFAULT_MODEL, SYSTEM } from '../public/deepseek.js';
import { findUnsplitClauses, validateAnalysis } from '../public/analysis.js';

// Issue #27 原句，逐字使用（含原文拼写错误 argured、sub human）。
export const ISSUE27_INPUT =
  'the word has ugly connotations thanks largely to Cesare Lombroso, a 19th-century Italian medic who argured that criminals were born not made and could be identified by certain physical features that were throwbacks to a primitive sub human state.';

export const TERMS_INPUTS = [
  'She thanked the nurse who said that the results were good.',
  'The book that the teacher who lives next door recommended is useful.',
  'I know that she was working when you called.',
  ISSUE27_INPUT,
];

export const CORRECTION_CASES = [
  {id:'essay1', input:'Last summer, my family and I goes to a small town that is famous for its old bridges.',
    checks:[{type:'correction',text:'goes',fix:'went'}]},
  {id:'essay3', input:'Every morning, my brother wake up early and took many photo of the bridges.',
    checks:[{type:'consistent-tense',text:'wake'}, {type:'correction',text:'photo',fix:'photos'}]},
  {id:'essay6', input:'I also made my homework in the hotel because the teacher had asked us to write a diary.',
    checks:[{type:'correction',text:'made',fix:'did'}, {type:'lemma',text:'made',lemma:'make'}]},
  {id:'unseen', input:'Yesterday my sister buy a new bike and rode it to the park.',
    checks:[{type:'correction',text:'buy',fix:'bought'}, {type:'lemma',text:'buy',lemma:'buy'}]},
  {id:'control', input:'My brother usually wake up at six.',
    checks:[{type:'correction',text:'wake',fix:'wakes',notFix:'woke'}]},
  {id:'box', input:'The contents of the box is very unique, so please handles them with care.',
    checks:[{type:'correction',text:'is',fix:'are'}, {type:'correction',text:'handles',fix:'handle'},
      {type:'no-correction',text:'unique'}]},
  {id:'essayPara', multiSentence:true, input:"Last summer, my family and I goes to a small town that is famous for its old bridges. The hotel where we stayed was run by a woman who told us that the river had been cleaned only two years ago. Every morning, my brother wake up early and took many photo of the bridges. My father, a engineer who loves history, explained that most of the bridges were built not bought and could still be used today. When I saw a strange word on a sign, I wrote it down and looked it up in the evening. I also made my homework in the hotel because the teacher had asked us to write a diary. The trip was very unique, and I hope we can visit there again next year.",
    checks:[{type:'correction',text:'goes',fix:'went'}, {type:'correction',text:'wake',fix:'woke'},
      {type:'no-correction',text:'took'}, {type:'correction',text:'photo',fix:'photos'},
      {type:'correction',text:'a',fix:'an'}, {type:'correction',text:'made',fix:'did'},
      {type:'lemma',text:'made',lemma:'make'}, {type:'no-correction',text:'unique'}]},
  {id:'unseenPara', multiSentence:true, input:'Last week we visited a farm. Every morning my cousin feed the goats and cleaned the barn.',
    checks:[{type:'correction',text:'feed',fix:'fed'}, {type:'no-correction',text:'cleaned'}]},
  {id:'shiftControl', multiSentence:true, input:'Last summer we visited Kyoto. I still think it is the most beautiful city I know.',
    checks:[{type:'no-correction',text:'think'}, {type:'no-correction',text:'is'}, {type:'no-correction',text:'know'}]},

];

export function evaluateCorrectionCase(caseItem, data) {
  const failures = [];
  if (!Array.isArray(caseItem?.checks) || !caseItem.checks.length || !Array.isArray(data?.sentences)) {
    return {pass:false, failures:['用例或返回格式不正确']};
  }
  const sentence = data.sentences.find(item => item?.text === caseItem.input);
  const sentences = caseItem.multiSentence ? data.sentences : (sentence ? [sentence] : []);
  if (!sentences.length || sentences.some(item => !Array.isArray(item?.corrections) || !Array.isArray(item?.segments))) {
    return {pass:false, failures:['缺少原句、corrections 或 segments']};
  }
  const corrections = sentences.flatMap(item => item.corrections);
  const segments = sentences.flatMap(item => item.segments);
  const hasWord = (text, word) => typeof text === 'string' &&
    text.toLowerCase().split(/[^a-z]+/).includes(word.toLowerCase());
  for (const check of caseItem.checks) {
    const matching = corrections.filter(item => hasWord(item?.text, check.text));
    if (check.type === 'correction') {
      if (!matching.length) failures.push('缺少纠错：' + check.text + ' → ' + check.fix);
      else if (!matching.some(item => hasWord(item.fix, check.fix))) {
        failures.push('纠错不符合预期：' + check.text + ' → ' + check.fix);
      }
      if (check.notFix && matching.some(item => hasWord(item.fix, check.notFix))) {
        failures.push('纠错不应包含：' + check.notFix);
      }
    } else if (check.type === 'consistent-tense') {
      const took = corrections.filter(item => hasWord(item?.text, 'took'));
      const woke = matching.some(item => hasWord(item.fix, 'woke'));
      const wakes = matching.some(item => hasWord(item.fix, 'wakes'));
      const past = woke && !wakes && !took.length;
      const present = wakes && !woke && took.length > 0 && took.every(item => hasWord(item.fix, 'takes'));
      if (!past && !present) {
        if (!matching.length) failures.push('D 类：缺少 wake 的纠错');
        else if (wakes && !woke && !took.length) failures.push('C 类：wake → wakes，但 took 未改（时态不一致）');
        else if (woke && took.length) failures.push('D 类：wake → woke，但 took 也被纠正');
        else failures.push('D 类：wake / took 的纠错不属于两种一致时态');
      }
    } else if (check.type === 'lemma') {
      const predicates = segments.filter(item => item?.role === 'predicate' && hasWord(item.text, check.text));
      if (!predicates.length || !predicates.every(item => item.lemma === check.lemma)) {
        failures.push('原文谓语 ' + check.text + ' 的 lemma 应为 ' + check.lemma);
      }
    } else if (check.type === 'no-correction') {
      if (matching.length) failures.push('不应纠正：' + check.text);
    } else failures.push('未知检查类型');
  }
  return {pass:failures.length === 0, failures};
}

export function findInternalTerms(data) {
  const hits = [];
  if (!Array.isArray(data?.sentences)) return hits;
  data.sentences.forEach((sentence, index) => {
    const text = typeof sentence?.text === 'string' ? sentence.text : '';
    const quoted = new Set((text.match(/\b(?:core|detail|level)\b/gi) || []).map(word => word.toLowerCase()));
    const fields = [['note', sentence?.note], ['tenseReason', sentence?.tenseReason]];
    for (const [array, field] of [['segments', 'detail'], ['corrections', 'reason']]) {
      if (Array.isArray(sentence?.[array])) sentence[array].forEach((item, position) =>
        fields.push([array + '[' + position + '].' + field, item?.[field]]));
    }
    for (const [field, value] of fields) {
      if (typeof value !== 'string') continue;
      for (const term of ['core', 'detail', 'level']) {
        if (!quoted.has(term) && new RegExp('\\b' + term + '\\b', 'i').test(value)) {
          hits.push({sentence: index + 1, field, term});
        }
      }
      for (const term of ['默认规则', '长从句规则', '例外规则', '按规则', '层级规则']) {
        if (value.includes(term)) hits.push({sentence: index + 1, field, term});
      }
      for (const [term, pattern] of [
        ['level rule', /\blevel\s+rule\b/i],
        ['long-clause rule', /\blong-clause\s+rule\b/i],
      ]) {
        if (pattern.test(value)) hits.push({sentence: index + 1, field, term});
      }
    }
  });
  return hits;
}

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

export function loadSystemAtRef(ref, cwd = path.dirname(fileURLToPath(import.meta.url))) {
  const source = execFileSync('git', ['show', ref + ':public/deepseek.js'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  return extractSystem(source);
}

// 从 git 仓库读取 PR #47 合并提交里的 SYSTEM。
export function loadPr47System(cwd = path.dirname(fileURLToPath(import.meta.url))) {
  return loadSystemAtRef(PR47_COMMIT, cwd);
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
  return { record, envelope, parsed };
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

async function runFlow(apiKey, runs) {
  let correct = 0, repairs = 0, repairedCorrect = 0, requests = 0;
  const start = performance.now();
  for (let run = 1; run <= runs; run++) {
    const before = performance.now();
    let calls = 0;
    let kind;
    let firstUnsplit = null;
    let result;
    try {
      result = await analyzeWithDeepSeek(ISSUE27_INPUT, {
        apiKey,
        fetchImpl: async (...args) => {
          calls++;
          const response = await fetch(...args);
          if (calls === 1 && response.ok) {
            try {
              const envelope = await response.clone().json();
              const choice = envelope.choices[0];
              if (choice.finish_reason === 'stop') {
                const initial = validateAnalysis(JSON.parse(choice.message.content), ISSUE27_INPUT);
                firstUnsplit = hasUnsplitBlock(initial) || findUnsplitClauses(initial).length > 0;
              }
            } catch {
              // An invalid first answer has no measurable split status.
            }
          }
          return response;
        },
        onRepair: event => { kind = event.kind; },
      });
    } catch {
      // Report a failed run without echoing provider diagnostics.
    }
    const clauses = result?.sentences.flatMap(s => s.clauses || []);
    const unsplit = result ? findUnsplitClauses(result).length > 0 || hasUnsplitBlock(result) : null;
    const adopted = result?.repair?.adopted ?? false;
    const ok = clauses?.length === 3 && !unsplit;
    correct += Number(ok);
    repairs += Number(Boolean(kind));
    repairedCorrect += Number(adopted && ok);
    requests += calls;
    console.log({run, 首次未拆: firstUnsplit,
      触发重做: Boolean(kind), 采用重做: adopted, 最终从句数: clauses?.length ?? null,
      最终未拆: unsplit, 请求数: calls, 秒: ((performance.now() - before) / 1000).toFixed(2)});
  }
  console.log({最终拆对: correct + '/' + runs, 触发重做次数: repairs, 重做后拆对次数: repairedCorrect,
    总请求次数: requests, 平均耗时秒: ((performance.now() - start) / 1000 / runs).toFixed(2)});
}

async function runTerms(apiKey, runs, ref) {
  const system = ref ? loadSystemAtRef(ref) : SYSTEM;
  const groups = TERMS_INPUTS.map((input, index) => ({
    name: String.fromCharCode(65 + index), label: input, system, input,
  }));
  const outDir = path.join('ab-results', new Date().toISOString().replace(/[:.]/g, '-') + '-terms');
  mkdirSync(outDir, {recursive: true});
  const records = [];
  for (let run = 1; run <= runs; run++) {
    for (const [index, group] of groups.entries()) {
      let result;
      try {
        result = await callOnce(group, apiKey);
      } catch {
        result = {record: {validOk:false, clauses:0}, envelope:{error:'Request failed'}};
      }
      const record = {sentence: index + 1, text: group.input, run,
        valid: result.record.validOk, clauses: result.record.clauses,
        hits: findInternalTerms(result.parsed)};
      records.push(record);
      // Provider diagnostics must never echo a credential into saved responses.
      writeFileSync(path.join(outDir, group.name + '-' + run + '.json'),
        JSON.stringify(result.envelope, null, 2).replaceAll(apiKey, '[REDACTED]'));
      console.log(JSON.stringify(record));
    }
  }
  const summary = groups.map((group, index) => {
    const own = records.filter(record => record.sentence === index + 1);
    return {sentence: index + 1, text: group.input,
      hits: own.filter(record => record.hits.length > 0).length,
      valid: own.filter(record => record.valid).length, runs};
  });
  writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ref: ref || 'working-tree', records, summary}, null, 2));
  console.log('句子 | 命中次数 / 总次数 | 校验通过次数 / 总次数');
  for (const row of summary) console.log(row.sentence + ' | ' + row.hits + '/' + runs + ' | ' + row.valid + '/' + runs);
  console.log('原始返回已保存到 ' + outDir + '/');
}

async function runCorrections(apiKey, runs, ref) {
  const system = ref ? loadSystemAtRef(ref) : SYSTEM;
  const outDir = path.join('ab-results', new Date().toISOString().replace(/[:.]/g, '-') + '-corrections');
  mkdirSync(outDir, {recursive:true});
  const records = [];
  for (let run = 1; run <= runs; run++) {
    for (const caseItem of CORRECTION_CASES) {
      let result;
      try {
        result = await callOnce({name:caseItem.id, input:caseItem.input, system}, apiKey);
      } catch {
        result = {record:{validOk:false}, envelope:{error:'Request failed'}};
      }
      const record = {id:caseItem.id, run, valid:result.record.validOk,
        ...evaluateCorrectionCase(caseItem, result.parsed)};
      records.push(record);
      writeFileSync(path.join(outDir, caseItem.id + '-' + run + '.json'),
        JSON.stringify(result.envelope, null, 2).replaceAll(apiKey, '[REDACTED]'));
      console.log(JSON.stringify(record));
    }
  }
  const summary = CORRECTION_CASES.map(caseItem => {
    const own = records.filter(record => record.id === caseItem.id);
    return {id:caseItem.id, pass:own.filter(record => record.valid && record.pass).length,
      valid:own.filter(record => record.valid).length, runs};
  });
  writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({ref:ref || 'working-tree', records, summary}, null, 2));
  console.log('用例 | 通过次数 / 总次数 | 校验通过次数 / 总次数');
  for (const row of summary) console.log(row.id + ' | ' + row.pass + '/' + runs + ' | ' + row.valid + '/' + runs);
  console.log('原始返回已保存到 ' + outDir + '/');
}

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('错误：未设置环境变量 DEEPSEEK_API_KEY，已退出，未发送任何请求。');
    process.exit(1);
  }

  if (process.argv.includes('--terms') || process.argv.includes('--corrections')) {
    const index = process.argv.indexOf('--runs');
    const runs = index < 0 ? 5 : Number(process.argv[index + 1]);
    if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('--runs 需要正整数');
    const refIndex = process.argv.indexOf('--ref');
    const ref = refIndex < 0 ? undefined : process.argv[refIndex + 1];
    if (refIndex >= 0 && (!ref || ref.startsWith('--'))) throw new Error('--ref 需要 git ref');
    return process.argv.includes('--corrections') ? runCorrections(apiKey, runs, ref) : runTerms(apiKey, runs, ref);
  }
  if (process.argv.includes('--flow')) {
    const index = process.argv.indexOf('--runs');
    const runs = index < 0 ? 10 : Number(process.argv[index + 1]);
    if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('--runs 需要正整数');
    return runFlow(apiKey, runs);
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
