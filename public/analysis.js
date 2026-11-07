const roles = new Set([
  'subject', 'predicate', 'linking', 'object', 'predicative',
  'complement', 'adverbial', 'attribute', 'other',
]);

export class AnalysisValidationError extends Error {
  constructor(reason) {
    super(reason.slice(0, 280));
    this.name = 'AnalysisValidationError';
    this.reason = this.message;
  }
}

// Keep diagnostics complete inside AnalysisValidationError's 280-character cap.
// Positions use JavaScript string offsets, matching the existing coverage checks.
function mismatchReason(original, actual, requirement, segments) {
  let position = 0;
  while (position < original.length && position < actual.length && original[position] === actual[position]) position++;
  let nearby = '';
  if (segments) {
    let index = 0;
    let offset = 0;
    while (index < segments.length && offset + segments[index].text.length <= position) {
      offset += segments[index].text.length;
      index++;
    }
    const right = Math.min(index, segments.length - 1);
    nearby = `, around segments ${Math.max(0, right - 1)}-${right}`;
  }
  let radius = 12;
  let reason;
  do {
    const start = Math.max(0, position - radius);
    const end = position + radius + 1;
    reason = `char ${position} (0-based)${nearby}; original ${JSON.stringify(original.slice(start, end))}; actual ${JSON.stringify(actual.slice(start, end))}. ${requirement} Copy every original character including spaces and punctuation, and add nothing.`;
    radius--;
  } while (reason.length > 280 && radius >= 0);
  return reason;
}

function englishWordCount(text) {
  return (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
}

export function findUnsplitClauses({sentences}) {
  const violations = [];
  sentences.forEach(({segments, clauses}, index) => {
    // normalizeClauses trimmed non-alphanumeric spans from both ends.
    const anchored = new Set((clauses || []).filter(c => c.end === c.start + 1).map(c => c.start));
    segments.forEach((segment, i) => {
      const clauseForm = segment.form === 'clause' && ['attribute', 'adverbial'].includes(segment.role);
      if (!anchored.has(i) && !clauseForm) return;
      const wordCount = englishWordCount(segment.text);
      if (wordCount > 6) violations.push({sentence: index + 1, text: segment.text, wordCount});
    });
  });
  return violations;
}

export function validateInput(text) {
  if (
    typeof text !== 'string' || !text.trim() || text.length > 6000 ||
    englishWordCount(text) > 300
  ) {
    throw new Error('请输入不超过 300 个英文单词、6000 个字符的文本。');
  }
  return text;
}

function string(value, max, field, nonempty = false) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) {
    throw new AnalysisValidationError(`${field} must be ${nonempty ? 'a nonempty' : 'a'} string of at most ${max} characters.`);
  }
  return value;
}

function optionalString(value, max) {
  return typeof value === 'string' && value.length <= max ? value : '';
}

// Only these roles can modify another segment (see `modifies` below).
const modifierRoles = new Set(['attribute', 'adverbial', 'complement']);

// Clause ranges are a visual hint over the flat segments (see `clauses` below).
const clauseTypes = new Set(['relative', 'object', 'adverbial']);
const adverbialSubtypes = new Set([
  'time', 'condition', 'reason', 'concession', 'purpose', 'result', 'comparison', 'manner',
]);
// A list longer than this is treated as untrusted: the pairwise overlap check
// stays bounded (200 items = 19,900 comparisons), and the sentence still shows
// its core analysis without any clause ranges.
const MAX_CLAUSE_CANDIDATES = 200;

// Valid structural forms for attribute and adverbial segments.
const formValues = new Set(['prep', 'to-inf', 'ing', 'ed', 'clause']);

// `clauses` is optional. Invalid entries only drop themselves, never the
// sentence: core coverage and field checks above stay strict.
function normalizeClauses(value, segments) {
  if (!Array.isArray(value) || value.length > MAX_CLAUSE_CANDIDATES) return null;
  const sentenceText = segments.map(part => part.text).join('');
  const boundaries = new Map([[0, 0]]);
  let offset = 0;
  segments.forEach((part, index) => {
    offset += part.text.length;
    boundaries.set(offset, index + 1);
  });
  let candidates = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (!clauseTypes.has(raw.type) || typeof raw.text !== 'string' || raw.text.length > sentenceText.length) continue;
    const anchor = raw.text.trim();
    if (!/[\p{L}\p{N}]/u.test(anchor)) continue;
    // Count exact matches at segment boundaries only, including overlapping
    // occurrences. Never fall back to model-supplied start/end indexes.
    let match;
    let ambiguous = false;
    for (let at = sentenceText.indexOf(anchor); at !== -1; at = sentenceText.indexOf(anchor, at + 1)) {
      const start = boundaries.get(at);
      const end = boundaries.get(at + anchor.length);
      if (start === undefined || end === undefined) continue;
      if (match) { ambiguous = true; break; }
      match = {start, end};
    }
    if (!match || ambiguous) continue;
    let {start, end} = match;
    while (start < end && !/[\p{L}\p{N}]/u.test(segments[start].text)) start++;
    while (end > start && !/[\p{L}\p{N}]/u.test(segments[end - 1].text)) end--;
    if (start === end) continue;
    const clause = {start, end, type: raw.type};
    if (raw.type === 'adverbial' && adverbialSubtypes.has(raw.subtype)) clause.subtype = raw.subtype;
    candidates.push(clause);
  }
  if (!candidates.length) return null;
  // Canonical order comes from the ranges, never from the model's array order:
  // start ascending, then end descending. Ties on the same range fall back to
  // type and subtype so one range is described exactly once.
  candidates.sort((a, b) =>
    a.start - b.start || b.end - a.end ||
    (a.type < b.type ? -1 : a.type > b.type ? 1 : 0) ||
    ((a.subtype || '') < (b.subtype || '') ? -1 : (a.subtype || '') > (b.subtype || '') ? 1 : 0));
  candidates = candidates.filter((clause, index) => {
    const previous = candidates[index - 1];
    return index === 0 || clause.start !== previous.start || clause.end !== previous.end;
  });
  // Partially overlapping ranges are ambiguous: mark every crossing pair first,
  // then drop all marked ranges, so array order cannot decide the survivor.
  const crossing = new Set();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (
        (a.start < b.start && b.start < a.end && a.end < b.end) ||
        (b.start < a.start && a.start < b.end && b.end < a.end)
      ) {
        crossing.add(i);
        crossing.add(j);
      }
    }
  }
  const kept = candidates.filter((_, index) => !crossing.has(index));
  // Remaining ranges are disjoint or nested, so the number of enclosing ranges
  // is the nesting depth (outermost = 1). Keep at most three levels; inner
  // ranges beyond level 3 are dropped and their valid outer ranges stay.
  const result = kept
    .map(clause => ({
      ...clause,
      depth: 1 + kept.filter(other =>
        other.start <= clause.start && other.end >= clause.end &&
        (other.start < clause.start || other.end > clause.end)).length,
    }))
    .filter(clause => clause.depth <= 3)
    .map(({ depth, ...clause }) => clause);
  return result.length ? result : null;
}

// Correction hints are optional like clauses: anything invalid is dropped on
// its own and never rejects the sentence or triggers a paid format repair.
// A list longer than 50 is treated as untrusted and ignored for the sentence
// (50 items keep the pairwise overlap check bounded at 1,225 comparisons).
const MAX_CORRECTION_CANDIDATES = 50;
const MAX_CORRECTION_REASON = 300;

function normalizeCorrections(value, sentenceText) {
  if (!Array.isArray(value) || value.length > MAX_CORRECTION_CANDIDATES) return null;
  const candidates = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (typeof raw.text !== 'string' || typeof raw.fix !== 'string' || typeof raw.reason !== 'string') continue;
    const text = raw.text.trim();
    if (!text || !/[\p{L}\p{N}\p{P}]/u.test(text) || text.length > sentenceText.length) continue;
    if (raw.fix === text) continue;
    const reason = raw.reason.trim();
    if (!reason || reason.length > MAX_CORRECTION_REASON) continue;
    // The anchor must occur exactly once in the sentence. Count overlapping
    // occurrences too, so repeated fragments are always rejected.
    let start = -1;
    let matches = 0;
    for (let at = sentenceText.indexOf(text); at !== -1; at = sentenceText.indexOf(text, at + 1)) {
      if (matches === 0) start = at;
      matches++;
      if (matches > 1) break;
    }
    if (matches !== 1) continue;
    candidates.push({start, end: start + text.length, text, fix: raw.fix, reason});
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.start - b.start || a.end - b.end);
  // Overlapping ranges are ambiguous, so every range in a crossing pair is
  // dropped; adjacent ranges (end === next start) both stay.
  const overlapping = new Set();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.start < b.end && b.start < a.end) {
        overlapping.add(i);
        overlapping.add(j);
      }
    }
  }
  const kept = candidates.filter((_, index) => !overlapping.has(index));
  return kept.length ? kept : null;
}

export function validateAnalysis(data, input) {
  if (!data || !Array.isArray(data.sentences) || !data.sentences.length || data.sentences.length > 300) {
    throw new AnalysisValidationError('sentences must be an array containing 1 to 300 sentences.');
  }
  let offset = 0;
  const sentences = data.sentences.map((sentence, sentenceIndex) => {
    const field = `sentences[${sentenceIndex}]`;
    if (!sentence || !Array.isArray(sentence.segments) || !sentence.segments.length || sentence.segments.length > 1200) {
      throw new AnalysisValidationError(`${field}.segments must be an array containing 1 to 1200 segments.`);
    }
    const text = string(sentence.text, 6000, `${field}.text`, true);
    // Ignore only whitespace between sentences, never whitespace within a sentence.
    while (offset < input.length && /\s/u.test(input[offset]) && !input.startsWith(text, offset)) {
      offset++;
    }
    if (!input.startsWith(text, offset)) {
      throw new AnalysisValidationError(mismatchReason(
        input.slice(offset), text, `${field}.text must match the next original input characters exactly.`,
      ));
    }
    offset += text.length;

    const segments = sentence.segments.map((segment, segmentIndex) => {
      const segmentField = `${field}.segments[${segmentIndex}]`;
      if (!segment || !roles.has(segment.role)) {
        throw new AnalysisValidationError(`${segmentField}.role must be one of the documented grammar roles.`);
      }
      if (!['core', 'detail'].includes(segment.level)) {
        throw new AnalysisValidationError(`${segmentField}.level must be core or detail.`);
      }
      if (segment.text === '') {
        throw new AnalysisValidationError(`${segmentField}.text must contain at least one original character.`);
      }
      return {
        text: string(segment.text, 6000, `${segmentField}.text`),
        role: segment.role,
        translation: string(segment.translation, 6000, `${segmentField}.translation`, segment.role !== 'other'),
        lemma: string(segment.lemma, 200, `${segmentField}.lemma`, ['predicate', 'linking'].includes(segment.role)),
        detail: string(segment.detail, 6000, `${segmentField}.detail`),
        level: segment.level,
      };
    });
    const joined = segments.map(segment => segment.text).join('');
    if (joined !== text) {
      throw new AnalysisValidationError(mismatchReason(
        text, joined, `${field}.segments must concatenate exactly to sentence text.`, segments,
      ));
    }

    // `modifies` is an optional index of the segment this one modifies. It is
    // only a visual hint on top of an analysis whose text coverage already
    // checked out, and models most often get it wrong by miscounting indexes.
    // So an invalid value is dropped on its own instead of rejecting the whole
    // result: the user still gets a correct, verbatim analysis, just without
    // that one arrow. Every other check above stays strict.
    sentence.segments.forEach((raw, index) => {
      // Optional structural metadata cannot trigger a paid format repair.
      const head = raw.predicateOf;
      if (
        segments[index].role === 'predicate' && segments[index].level === 'core' &&
        Number.isInteger(head) && head >= 0 && head < index &&
        segments[head].role === 'predicate' && segments[head].level === 'core' &&
        !Object.hasOwn(sentence.segments[head], 'predicateOf') &&
        segments[index].lemma === segments[head].lemma &&
        segments.slice(head + 1, index).some(part => part.role !== 'other' && /[\p{L}\p{N}]/u.test(part.text))
      ) {
        segments[index].predicateOf = head;
      }
      const target = raw.modifies;
      if (
        modifierRoles.has(segments[index].role) &&
        Number.isInteger(target) && target >= 0 && target < segments.length &&
        target !== index && segments[target].role !== 'other'
      ) {
        segments[index].modifies = target;
      }
      // `form` is an optional structural type label for attribute/adverbial
      // segments (e.g. prepositional phrase, infinitive, participle). Invalid
      // values are dropped on their own, same as modifies.
      const form = raw.form;
      if (
        (segments[index].role === 'attribute' || segments[index].role === 'adverbial') &&
        typeof form === 'string' && formValues.has(form)
      ) {
        segments[index].form = form;
      }
    });
    const clauses = normalizeClauses(sentence.clauses, segments);
    const corrections = normalizeCorrections(sentence.corrections, text);
    return {
      text,
      translation: string(sentence.translation, 12000, `${field}.translation`, true),
      note: string(sentence.note, 6000, `${field}.note`),
      // Optional explanatory metadata must not invalidate otherwise usable analysis.
      tense: optionalString(sentence.tense, 100),
      tenseReason: optionalString(sentence.tenseReason, 600),
      segments,
      // Only present when at least one valid range survives, so old results and
      // all-invalid clauses produce exactly the previous output shape.
      ...(clauses ? { clauses } : {}),
      ...(corrections ? { corrections } : {}),
    };
  });
  if (input.slice(offset).trim()) {
    throw new AnalysisValidationError('sentences must cover all original input in order; trailing non-whitespace text is missing.');
  }
  return { sentences, translation: string(data.translation, 24000, 'translation', true) };
}
