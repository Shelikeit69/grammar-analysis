import {repairAnalysis, repairText} from './fixtures/repair.mjs';
import {longTextAnchors, withTextAnchors} from './fixtures/clauses.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithDeepSeek } from '../lib/deepseek.mjs';
import { SYSTEM } from '../public/deepseek.js';

const valid = {
  sentences: [{
    text: 'Go.', translation: '走。', note: '', tense: '祈使句', tenseReason: '因为句子以动词原形 Go 开头且省略主语，所以是祈使句。',
    segments: [
      { text: 'Go', role: 'predicate', translation: '走', lemma: 'go', detail: '', level: 'core' },
      { text: '.', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
    ],
  }],
  translation: '走。',
};

test('provider request and valid structured response', async () => {
  const result = await analyzeWithDeepSeek('Go.', {
    apiKey: 'test',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'deepseek-flash');
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.temperature, 0);
      assert.deepEqual(body.thinking, { type: 'disabled' });
      assert.equal(body.max_tokens, 16000);
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
    },
  });
  assert.deepEqual(result, valid);
});

test('reject malformed, truncated, missing and HTTP failure responses', async () => {
  const responses = [
    new Response('secret', { status: 401 }),
    Response.json({}),
    Response.json({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(valid) } }] }),
  ];
  for (const response of responses) {
    await assert.rejects(analyzeWithDeepSeek('Go.', { apiKey: 'test', fetchImpl: async () => response }));
  }
});

test('provider fetch receives cancellation and timeout signals', async () => {
  const abortingFetch = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  const controller = new AbortController();
  const pending = analyzeWithDeepSeek('Go.', {
    apiKey: 'test', fetchImpl: abortingFetch, signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  // AbortSignal.timeout uses an unreferenced timer; keep this test's event loop alive.
  const keepAlive = setTimeout(() => {}, 2000);
  try {
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', fetchImpl: abortingFetch, timeoutMs: 10,
    }), { name: 'TimeoutError' });
  } finally {
    clearTimeout(keepAlive);
  }
  let called = false;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    fetchImpl: async () => { called = true; },
  }), { name: 'AbortError' });
  assert.equal(called, false);
});

test('provider HTTP status is exposed for user-facing error messages', async () => {
  const { ProviderError } = await import('../public/deepseek.js');
  await assert.rejects(
    analyzeWithDeepSeek('Go.', { apiKey: 'test', fetchImpl: async () => new Response('no', { status: 402 }) }),
    error => error instanceof ProviderError && error.status === 402,
  );
});

test('custom model name is sent and empty model falls back to default', async () => {
  const seen = [];
  const fetchImpl = async (url, options) => {
    seen.push(JSON.parse(options.body).model);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(valid) } }] });
  };
  await analyzeWithDeepSeek('Go.', { apiKey: 'test', model: 'my-model', fetchImpl });
  await analyzeWithDeepSeek('Go.', { apiKey: 'test', model: '', fetchImpl });
  assert.deepEqual(seen, ['my-model', 'deepseek-flash']);
});

test('system prompt keeps the multi-word predicate rules', () => {
  for (const phrase of [
    'When its words are adjacent, the predicate is ONE contiguous span covering the whole verb phrase',
    'Never label a modal or auxiliary as a separate predicate',
    'Prepositions are never predicate or linking',
    'lemma is the base form of the verb phrase without modal/auxiliary',
    'You can shop for items.',
    'can shop for is ONE predicate/core span, lemma shop for',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt asks for a per-sentence tense', () => {
  for (const phrase of ['"tense":"Chinese tense and voice of the main clause"', 'tense is the Chinese name of the main clause', '一般将来时 · 被动语态', 'Judge the whole predicate span', '"tenseReason":"Chinese evidence for the tense"', 'Never cite a time word that is not in the sentence'])
    assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt keeps the round-2 consistency rules', () => {
  for (const phrase of [
    'A contracted negation stays inside the predicate',
    '"Don\'t worry" is ONE predicate span',
    'Outside the long-clause rule below, one constituent is one span',
    '"about 5% less" is ONE adverbial',
    'Do not leave modifiers unlabeled',
    'never role other',
    'coordinated main clauses',
    'never swallows a predicative, object or complement',
    'MANDATORY in the tense field itself',
    'share the same tense and voice, write it ONCE',
    'add it after the main clause(s) in tense',
    'do not repeat it',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

function contentResponse(content) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content } }] });
}

test('one repair corrects model JSON syntax or core validation with original context', async () => {
  const broken = structuredClone(valid);
  broken.sentences[0].segments[0].lemma = '';
  for (const failedContent of ['{broken', JSON.stringify(broken)]) {
    const requests = [];
    const repairs = [];
    const result = await analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: event => repairs.push(event),
      fetchImpl: async (url, options) => {
        requests.push(JSON.parse(options.body));
        return contentResponse(requests.length === 1 ? failedContent : JSON.stringify(valid));
      },
    });
    assert.deepEqual(result, valid);
    assert.equal(requests.length, 2);
    assert.equal(repairs.length, 1);
    assert.ok(repairs[0].reason.length < 300);
    assert.equal(requests[1].messages[1].content, 'Go.');
    assert.equal(requests[1].messages[2].content, failedContent);
    assert.ok(requests[1].messages[3].content.includes(repairs[0].reason));
  }
});

test('invalid optional tense fields are discarded without repair', async () => {
  const data = structuredClone(valid);
  data.sentences[0].tense = { invalid: true };
  data.sentences[0].tenseReason = 'x'.repeat(601);
  let calls = 0;
  const out = await analyzeWithDeepSeek('Go.', {
    apiKey: 'test', onRepair: () => assert.fail('optional fields must not retry'),
    fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(data)); },
  });
  assert.equal(calls, 1);
  assert.equal(out.sentences[0].tense, '');
  assert.equal(out.sentences[0].tenseReason, '');
});


test('two invalid model responses stop after one repair', async () => {
  for (const content of ['{invalid', JSON.stringify({ sentences: [] })]) {
    let calls = 0;
    let repairs = 0;
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => { repairs++; },
      fetchImpl: async () => { calls++; return contentResponse(content); },
    }), { name: 'AnalysisValidationError' });
    assert.equal(calls, 2);
    assert.equal(repairs, 1);
  }
});

test('transport, envelope, oversized and incomplete responses never retry', async () => {
  const responses = [
    () => new Response('denied', { status: 429 }),
    () => new Response('invalid envelope'),
    () => Response.json(null),
    () => Response.json({}),
    () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }),
    () => contentResponse(''),
    () => new Response('x'.repeat(1_500_001)),
    () => { throw new TypeError('network failed'); },
  ];
  for (const response of responses) {
    let calls = 0;
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => assert.fail('must not repair'),
      fetchImpl: async () => { calls++; return response(); },
    }));
    assert.equal(calls, 1);
  }
});

test('cancelling from repair callback prevents the second fetch', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    onRepair: () => controller.abort(),
    fetchImpl: async () => { calls++; return contentResponse('{bad'); },
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('cancellation during repair stays AbortError without a third call', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    fetchImpl: async (url, { signal }) => {
      calls++;
      if (calls === 1) return contentResponse('{bad');
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        controller.abort();
      });
    },
  }), { name: 'AbortError' });
  assert.equal(calls, 2);
});

test('one overall deadline and same signal span both calls', async () => {
  let calls = 0;
  let firstSignal;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(analyzeWithDeepSeek('Go.', {
      apiKey: 'test', timeoutMs: 1000,
      fetchImpl: async (url, { signal }) => {
        calls++;
        if (calls === 1) {
          firstSignal = signal;
          await new Promise(resolve => setTimeout(resolve, 50));
          return contentResponse('{bad');
        }
        assert.equal(signal, firstSignal);
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      },
    }), { name: 'TimeoutError' });
    assert.equal(calls, 2);
    assert.equal(firstSignal.aborted, true);
  } finally {
    clearTimeout(keepAlive);
  }
});


test('all malformed optional metadata types avoid paid repair and unknown metadata is ignored', async () => {
  for (const invalid of [null, 7, true, [], {}, 'x'.repeat(601)]) {
    const data = structuredClone(valid);
    data.sentences[0].tense = invalid;
    data.sentences[0].tenseReason = invalid;
    data.sentences[0].clauses = { invalid: true };
    data.sentences[0].corrections = invalid;
    data.sentences[0].segments[0].modifies = 999;
    let calls = 0;
    const out = await analyzeWithDeepSeek('Go.', {
      apiKey: 'test', onRepair: () => assert.fail('must not repair optional metadata'),
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(data)); },
    });
    assert.equal(calls, 1);
    assert.equal(out.sentences[0].tense, '');
    assert.equal(out.sentences[0].tenseReason, '');
    assert.equal(out.sentences[0].clauses, undefined);
    assert.equal(out.sentences[0].corrections, undefined);
    assert.equal(out.sentences[0].segments[0].modifies, undefined);
  }
});

test('abort after reading model content is not treated as a format failure', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(analyzeWithDeepSeek('Go.', {
    apiKey: 'test', signal: controller.signal,
    onRepair: () => assert.fail('cancellation must not trigger repair'),
    fetchImpl: async () => {
      calls++;
      const bytes = new TextEncoder().encode(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{bad' } }] }));
      return new Response(new ReadableStream({
        start(stream) { stream.enqueue(bytes); stream.close(); controller.abort(); },
      }));
    },
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('prompt keeps the modifies rules and the worked example', () => {
  for (const phrase of [
    'modifies is OPTIONAL',
    'Fill it only for attribute, adverbial and complement segments',
    'Never point a segment at itself or at a role other segment',
    'omit modifies entirely; never guess',
    'an adverbial that modifies the whole action points to the predicate',
    'in the end has modifies 6 (will see)',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('modifies survives the provider path, and an invalid one is dropped without a repair call', async () => {
  const text = 'Big dogs bark.';
  const seg = (t, role, translation, lemma = '', level = 'core') => ({ text: t, role, translation, lemma, detail: '', level });
  const gap = seg(' ', 'other', '', '', 'detail');
  const make = (modifies) => ({
    sentences: [{
      text, translation: '大狗叫。', note: '',
      segments: [{ ...seg('Big', 'attribute', '大的', '', 'detail'), modifies }, gap, seg('dogs', 'subject', '狗'), gap, seg('bark', 'predicate', '叫', 'bark'), seg('.', 'other', '', '', 'detail')],
    }],
    translation: '大狗叫。',
  });
  for (const [modifies, expected] of [[2, 2], [99, undefined], [0, undefined]]) {
    let calls = 0;
    const result = await analyzeWithDeepSeek(text, {
      apiKey: 'test',
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(make(modifies))); },
    });
    assert.equal(calls, 1, `modifies ${modifies} must not trigger a repair`);
    assert.equal(result.sentences[0].segments[0].modifies, expected);
  }
});

test('system prompt documents required clause ranges with text anchors, types and tolerance', () => {
  for (const phrase of [
    'clauses is REQUIRED',
    'Do not output start/end indexes for clauses',
    'Use only relative (定语从句), object (宾语从句) and adverbial (状语从句)',
    'Do not output id, depth, numbering or parent references',
    'Nesting is allowed up to three levels',
    'output an empty array []',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt puts the main clause first in tense, then clauses in original order', () => {
  for (const phrase of [
    'listing the main clause first and then subordinate clauses in the order they appear in the sentence',
    'identical tense and voice combinations appear only once',
    '"If it rains, we will stay at home." is "一般将来时 · 主动语态；一般现在时 · 主动语态", not the reverse',
    'make clear which combination belongs to the main clause and which to a subordinate clause',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt splits long or nested clauses and keeps short ones whole', () => {
  for (const phrase of [
    'a clause is long when it contains MORE THAN 6 English words',
    'or when it contains a nested clause',
    'A clause with 6 or fewer English words and no nested clause MAY stay as ONE span',
    'a prepositional phrase alone is never a reason to split a clause',
    'never split a clause word by word',
    '"who lives next door to me" has 6 words and may stay one span',
    '"who lives next door to my parents" has 7 words and must be split into who (subject/detail)',
    'split the outer relative clause that the teacher who lives next door recommended AND its inner clause who lives next door',
    'give both text anchors in clauses',
    'Outside the long-clause rule below, one constituent is one span',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt uses core for the main clause and detail for split clause internals', () => {
  for (const phrase of [
    'The main-clause backbone (subject head, predicate or linking verb, object, predicative, complement) is level core',
    'Default: every span inside any subordinate clause is level detail, including its subject and predicate.',
    'coordinated main clauses keep their core spans',
    'When a long clause is split open, its clause text still covers all of its split spans',
    'The clause who keep going every day has 5 words and no nested clause, so it MAY stay one span',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt keeps predicateOf for the main clause and forbids it inside split clauses', () => {
  for (const phrase of [
    'predicateOf is only for a separated phrasal verb in the main clause: both ends must be predicate/core',
    'Do NOT output predicateOf for a predicate inside a clause that the long-clause rule split open',
    'even when its predicate is core under the object-clause exception',
    'Main-clause separated predicates keep predicateOf as described here',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt still requires clause predicates as tense evidence after deduplication', () => {
  for (const phrase of [
    "tenseReason must still quote that clause's key predicate (for example lives or rains) as evidence",
    'The judgement must cover the key predicate of every clause you relied on',
    'even when its tense and voice combination was deduplicated',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('clauses survive the provider path; invalid ranges are dropped without a repair call', async () => {
  const text = 'Big dogs bark loudly.';
  const seg = (t, role, translation, lemma = '', level = 'core') => ({ text: t, role, translation, lemma, detail: '', level });
  const gap = seg(' ', 'other', '', '', 'detail');
  const segments = [seg('Big', 'attribute', '大的', '', 'detail'), gap, seg('dogs', 'subject', '狗'), gap,
    seg('bark', 'predicate', '叫', 'bark'), gap, seg('loudly', 'adverbial', '大声地', '', 'detail'), seg('.', 'other', '', '', 'detail')];
  const make = clauses => ({
    sentences: [{ text, translation: '大狗大声叫。', note: '', clauses, segments }],
    translation: '大狗大声叫。',
  });
  const cases = [
    [[{ text: 'Big', type: 'relative' }, { text: 'bark loudly', type: 'adverbial', subtype: 'manner' }],
      [{ start: 0, end: 1, type: 'relative' }, { start: 4, end: 7, type: 'adverbial', subtype: 'manner' }]],
    [[{ start: 0, end: 99, type: 'relative' }], undefined],
    [[{ text: 'missing', type: 'relative' }], undefined],
    [[{ text: 'ig', type: 'relative' }], undefined],
    [[{ start: 0, end: 2, type: 'unknown' }], undefined],
    ['not-an-array', undefined],
  ];
  for (const [clauses, expected] of cases) {
    let calls = 0;
    const result = await analyzeWithDeepSeek(text, {
      apiKey: 'test', onRepair: () => assert.fail('clauses must not trigger a paid repair'),
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(make(clauses))); },
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.sentences[0].clauses, expected, JSON.stringify(clauses));
    assert.equal(result.sentences[0].segments.map(part => part.text).join(''), text);
  }
});

test("system prompt preserves the direct main-clause object exception", () => {
  assert.ok(SYSTEM.includes("One exception: when a long object clause whose governing verb is the main-clause predicate itself is split open, its own subject head, predicate or linking verb, and its own object or predicative are level core."));
  for (const phrase of ["Example: in \"I know that she was working when you called.\", that is other/detail, she is subject/core, was working is predicate/core (lemma work), and when you called is an adverbial clause span with level detail; clauses are [{\"type\":\"object\",\"text\":\"that she was working when you called\"},{\"type\":\"adverbial\",\"subtype\":\"time\",\"text\":\"when you called\"}].","Before applying the exception, ask which predicate takes this object clause.","the whole object clause is level detail","kept as one span stays object/core"]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('system prompt distinguishes tense and voice combinations with predicate evidence', () => {
  for (const phrase of [
    "Compare tense + voice combinations, not tense alone: subordinate clauses with the same tense but different voices are different combinations and MUST be listed separately; only identical tense and voice combinations appear only once.",
    "tenseReason must quote the corresponding predicate for every listed tense + voice combination.",
    "The plan has strong support thanks mainly to Mara Quinn, a young city planner who argued that parks were needed not wanted and could be funded by small local taxes that were common in older towns.",
    "tense is \"一般现在时 · 主动语态；一般过去时 · 主动语态；一般过去时 · 被动语态\"",
    "argued for past active",
    "were needed / could be funded for past passive",
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
  assert.ok(!SYSTEM.includes('has a different tense'));
  assert.ok(!SYSTEM.includes('if its tense is the same as the main clause'));
});

test('system prompt keeps coordinated passive participles together without swallowing predicatives', () => {
  for (const phrase of [
    "When two passive past participles share one be auxiliary in a be + past participle + not + past participle structure, keep the whole sequence as ONE predicate span: \"were needed not wanted\" is ONE predicate span, not a predicative or complement.",
    "not wanted is coordinated with needed and shares were",
    "Do not split not from wanted",
    "could be funded as a separate coordinated predicate span (lemma fund)",
    "This rule concerns coordinated verbal passive participles, not genuine adjective or noun predicatives",
    "never swallows a predicative, object or complement",
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});


test('clause anchors copy original text and restrict core to direct main-clause objects', () => {
  for (const phrase of [
    'clauses is REQUIRED: a per-sentence array of exact original-text anchors',
    '{"type":"relative|object|adverbial","subtype":"optional string","text":"exact original clause text"}',
    'Copy text character for character from the sentence',
    '[{"type":"relative","text":"who keep going every day"}]',
    '[{"type":"relative","text":"that the teacher who lives next door recommended"},{"type":"relative","text":"who lives next door"}]',
    '[{"type":"object","text":"that she was working when you called"},{"type":"adverbial","subtype":"time","text":"when you called"}]',
    'She thanked the nurse who said that the results were good.',
    'One exception: when a long object clause whose governing verb is the main-clause predicate itself is split open, its own subject head, predicate or linking verb, and its own object or predicative are level core.',
    'If that predicate is itself inside a relative, adverbial or other subordinate clause, the exception does not apply and the whole object clause is level detail.',
    'the results, were and good are all level detail',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
  assert.ok(!SYSTEM.slice(SYSTEM.indexOf('clauses is REQUIRED:')).includes('index AFTER the last segment'));
});


test('long text anchors survive the provider path while bad siblings never cause paid repair', async () => {
  const expected=longTextAnchors();
  const raw=withTextAnchors(expected);
  raw.sentences[0].clauses.push({type:'relative',text:'missing'}, {type:'relative',start:12,end:39});
  let calls=0;
  const out=await analyzeWithDeepSeek(raw.sentences[0].text, {
    apiKey:'test', onRepair:()=>assert.fail('optional anchors must not trigger repair'),
    fetchImpl:async()=>{calls++;return contentResponse(JSON.stringify(raw));},
  });
  assert.equal(calls,1);
  assert.deepEqual(out.sentences[0].clauses,expected.sentences[0].clauses);
});


test('the ordered level section preserves every decision and the existing examples', () => {
  const start=SYSTEM.indexOf('Level rule (apply in this order):');
  const end=SYSTEM.indexOf('End of level rule.',start);
  assert.ok(start >= 0 && end > start);
  const section=SYSTEM.slice(start,end);
  const decisions=[
    '1. Decide level only after identifying every clause and which clause contains it.',
    '2. The main-clause backbone (subject head, predicate or linking verb, object, predicative, complement) is level core; coordinated main clauses keep their core spans.',
    '3. Default: every span inside any subordinate clause is level detail, including its subject and predicate.',
    "4. One exception: when a long object clause whose governing verb is the main-clause predicate itself is split open, its own subject head, predicate or linking verb, and its own object or predicative are level core.",
    'Its introducing word, modifiers and any clause nested inside it stay level detail.',
    '5. Before applying the exception, ask which predicate takes this object clause.',
    'If that predicate is itself inside a relative, adverbial or other subordinate clause, the exception does not apply and the whole object clause is level detail.',
    '6. A short object clause of the main clause (6 words or fewer, no nested clause) kept as one span stays object/core.',
    "Example: in \"I know that she was working when you called.\", that is other/detail, she is subject/core, was working is predicate/core (lemma work), and when you called is an adverbial clause span with level detail; clauses are [{\"type\":\"object\",\"text\":\"that she was working when you called\"},{\"type\":\"adverbial\",\"subtype\":\"time\",\"text\":\"when you called\"}].",
    "Counterexample: in \"She thanked the nurse who said that the results were good.\", that the results were good is the object clause inside the relative clause who said that the results were good, not an object clause of the main clause; the results, were and good are all level detail, and the default view shows only She thanked the nurse.",
  ];
  let previous=-1;
  for (const phrase of decisions) {
    const index=section.indexOf(phrase);
    assert.ok(index > previous, phrase);
    previous=index;
  }
  assert.ok(SYSTEM.includes('Do NOT output predicateOf for a predicate inside a clause that the long-clause rule split open, even when its predicate is core under the object-clause exception'));
});

test('SYSTEM has one level section and no superseded scattered exception wording', () => {
  assert.equal(SYSTEM.split('Level rule (apply in this order):').length-1,1);
  for (const old of [
    'Exception for object clauses:',
    'except for the main-clause object-clause backbone (see the long-clause rule)',
    'Except for the main-clause object-clause backbone described below',
    'The object-clause exception applies only when',
    'This exception applies only to object clauses of the main clause;',
    'A short object clause with 6 or fewer English words and no nested clause that stays as ONE span remains object/core.',
  ]) assert.ok(!SYSTEM.includes(old), old);
});


test('one repair receives the missing-space location and succeeds on corrected content', async () => {
  const correct=repairAnalysis();
  const broken=structuredClone(correct);
  broken.sentences[0].segments.splice(1,1);
  const requests=[];
  const out=await analyzeWithDeepSeek(repairText, {
    apiKey:'test',
    fetchImpl:async (url, options)=>{
      requests.push(JSON.parse(options.body));
      return contentResponse(JSON.stringify(requests.length===1 ? broken : correct));
    },
  });
  assert.equal(requests.length,2);
  const message=requests[1].messages.at(-1).content;
  assert.ok(message.includes('char 16 (0-based), around segments 0-1;'));
  assert.ok(message.includes('garden grows'));
  assert.ok(message.includes('gardengrows'));
  assert.ok(message.includes('must concatenate exactly to sentence text'));
  assert.deepEqual(out,correct);
});

test('SYSTEM documents optional form field with all five values and attribute/adverbial restriction', () => {
  assert.ok(SYSTEM.includes('form is OPTIONAL'));
  assert.ok(SYSTEM.includes('"form":"optional string"'));
  for (const value of ['prep', 'to-inf', 'ing', 'ed', 'clause']) {
    assert.ok(SYSTEM.includes(`"${value}"`), `missing form value: ${value}`);
  }
  assert.ok(SYSTEM.includes('attribute and adverbial'));
  assert.ok(SYSTEM.includes('Do not fill form for single-word adjectives, adverbs or nouns used as modifiers'));
  assert.ok(SYSTEM.includes('If you are unsure of the form, omit it entirely; never guess'));
});

test('SYSTEM JSON template has clauses after segments', () => {
  // The template must include clauses in the sentence object, positioned after segments.
  const templateMatch = SYSTEM.match(/"segments":\[[^\]]*\],"clauses":\[/);
  assert.ok(templateMatch, 'clauses must appear after segments in the JSON template');
  // The template must show the clause object structure.
  assert.ok(SYSTEM.includes('"clauses":[{"type":"relative|object|adverbial","subtype":"optional string","text":"exact original clause text"}]'));
});

test('SYSTEM requires empty array when no clauses', () => {
  assert.ok(SYSTEM.includes('When the sentence has no relative, object or adverbial clause, output an empty array []'));
  // Old wording must not appear.
  assert.ok(!SYSTEM.includes('Omit clauses entirely when the sentence has none'));
  assert.ok(!SYSTEM.includes('clauses is OPTIONAL'));
});

test('SYSTEM JSON template has corrections after clauses', () => {
  const templateMatch = SYSTEM.match(/"clauses":\[[^\]]*\],"corrections":\[/);
  assert.ok(templateMatch, 'corrections must appear after clauses in the JSON template');
  assert.ok(SYSTEM.includes('"corrections":[{"text":"exact original fragment","fix":"corrected fragment","reason":"Chinese reason"}]'));
});

test('SYSTEM states correction scope, unique anchors and verbatim segments', () => {
  for (const phrase of [
    'corrections is REQUIRED',
    'Only correct grammar, spelling, punctuation and obvious collocation errors',
    'Do not change usage habits or style',
    'very unique stays unchanged',
    'occurs exactly once',
    'When the sentence has no grammar, spelling or punctuation error, output an empty array []',
    'segments still cover the original text character for character, including the incorrect parts',
    'analyze the original sentence, not the corrected one',
  ]) assert.ok(SYSTEM.includes(phrase), phrase);
});

test('valid corrections survive the provider path and invalid ones never trigger repair', async () => {
  const text = 'Big dogs bark.';
  const seg = (t, role, translation, lemma = '', level = 'core') => ({ text: t, role, translation, lemma, detail: '', level });
  const gap = seg(' ', 'other', '', '', 'detail');
  const segments = [seg('Big', 'attribute', '大的', '', 'detail'), gap, seg('dogs', 'subject', '狗'), gap,
    seg('bark', 'predicate', '叫', 'bark'), seg('.', 'other', '', '', 'detail')];
  const make = corrections => ({
    sentences: [{ text, translation: '大狗叫。', note: '', corrections, segments }],
    translation: '大狗叫。',
  });
  const cases = [
    [[{ text: 'dogs', fix: 'dog', reason: '主谓一致' }],
      [{ start: 4, end: 8, text: 'dogs', fix: 'dog', reason: '主谓一致' }]],
    [[{ text: 'dogs', fix: 'dogs', reason: '主谓一致' }], undefined],
    ['not-an-array', undefined],
  ];
  for (const [corrections, expected] of cases) {
    let calls = 0;
    const out = await analyzeWithDeepSeek(text, {
      apiKey: 'test', onRepair: () => assert.fail('corrections must not trigger a paid repair'),
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(make(corrections))); },
    });
    assert.equal(calls, 1);
    assert.deepEqual(out.sentences[0].corrections, expected, JSON.stringify(corrections));
  }
});

test('empty clauses array and missing clauses both pass without paid repair', async () => {
  const text = 'The cat sat on the mat.';
  const seg = (t, role, translation, lemma = '', level = 'core') => ({ text: t, role, translation, lemma, detail: '', level });
  const gap = seg(' ', 'other', '', '', 'detail');
  const segments = [seg('The', 'attribute', '这', '', 'detail'), gap, seg('cat', 'subject', '猫'), gap,
    seg('sat', 'predicate', '坐', 'sit'), gap, seg('on the mat', 'adverbial', '在垫子上', '', 'detail'), seg('.', 'other', '', '', 'detail')];
  // Case 1: model returns clauses: [] (no clauses in sentence).
  const withEmpty = { sentences: [{ text, translation: '猫坐在垫子上。', note: '', clauses: [], segments }], translation: '猫坐在垫子上。' };
  // Case 2: model omits clauses entirely.
  const withoutClauses = { sentences: [{ text, translation: '猫坐在垫子上。', note: '', segments }], translation: '猫坐在垫子上。' };
  for (const data of [withEmpty, withoutClauses]) {
    let calls = 0;
    const result = await analyzeWithDeepSeek(text, {
      apiKey: 'test', onRepair: () => assert.fail('missing or empty clauses must not trigger paid repair'),
      fetchImpl: async () => { calls++; return contentResponse(JSON.stringify(data)); },
    });
    assert.equal(calls, 1);
    // normalizeClauses returns null for empty/missing, so result has no clauses field.
    assert.equal(result.sentences[0].clauses, undefined);
  }
});


test('corrections require the smallest error fragment', () => {
  assert.ok(SYSTEM.includes('Correction text must be the smallest fragment containing the error'));
});

test('learner explanations exclude internal labels through the exact rule after the level rule', () => {
  const rule = "Internal-terms rule: note, tenseReason, every segment detail and every correction reason are read by learners. Never write the instruction labels core, detail or level, rule names such as long-clause rule, level rule, default or exception, or Chinese equivalents such as 默认规则、长从句规则、例外规则、按规则 in these fields. Describe the grammar itself instead: say which clause contains a constituent and what it does (for example 宾语从句 that the results were good 位于定语从句内部，作 said 的宾语), not how the app labels or displays it. Words that appear in the user's sentence may still be quoted.";
  assert.ok(SYSTEM.includes('End of level rule.\n' + rule));
  assert.equal(SYSTEM.split(rule).length - 1, 1);
});


test('the surrounding-sentence frequency rule has been withdrawn', () => {
  assert.ok(!SYSTEM.includes('Frequency words such as every morning'));
});

test('the verb-form experiment rule has been withdrawn', () => {
  assert.ok(!SYSTEM.includes('For a verb-form error'));
});
