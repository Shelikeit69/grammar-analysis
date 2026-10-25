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

export function validateInput(text) {
  if (
    typeof text !== 'string' || !text.trim() || text.length > 6000 ||
    (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length > 300
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
      throw new AnalysisValidationError(`${field}.text must match the next original input characters exactly, preserving order and internal whitespace.`);
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
    if (segments.map(segment => segment.text).join('') !== text) {
      throw new AnalysisValidationError(`${field}.segments text must concatenate exactly to sentence text, including whitespace and punctuation.`);
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
    });
    return {
      text,
      translation: string(sentence.translation, 12000, `${field}.translation`, true),
      note: string(sentence.note, 6000, `${field}.note`),
      // Optional explanatory metadata must not invalidate otherwise usable analysis.
      tense: optionalString(sentence.tense, 100),
      tenseReason: optionalString(sentence.tenseReason, 600),
      segments,
    };
  });
  if (input.slice(offset).trim()) {
    throw new AnalysisValidationError('sentences must cover all original input in order; trailing non-whitespace text is missing.');
  }
  return { sentences, translation: string(data.translation, 24000, 'translation', true) };
}
