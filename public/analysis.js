const roles = new Set([
  'subject', 'predicate', 'linking', 'object', 'predicative',
  'complement', 'adverbial', 'attribute', 'other',
]);

export function validateInput(text) {
  if (
    typeof text !== 'string' || !text.trim() || text.length > 6000 ||
    (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length > 300
  ) {
    throw new Error('请输入不超过 300 个英文单词、6000 个字符的文本。');
  }
  return text;
}

function string(value, max, nonempty = false) {
  if (typeof value !== 'string' || value.length > max || (nonempty && !value.trim())) {
    throw new Error('Invalid analysis');
  }
  return value;
}

export function validateAnalysis(data, input) {
  if (!data || !Array.isArray(data.sentences) || !data.sentences.length || data.sentences.length > 300) {
    throw new Error('Invalid analysis');
  }
  let offset = 0;
  const sentences = data.sentences.map(sentence => {
    if (!sentence || !Array.isArray(sentence.segments) || !sentence.segments.length || sentence.segments.length > 1200) {
      throw new Error('Invalid analysis');
    }
    const text = string(sentence.text, 6000, true);
    // Ignore only whitespace between sentences, never whitespace within a sentence.
    while (offset < input.length && /\s/u.test(input[offset]) && !input.startsWith(text, offset)) {
      offset++;
    }
    if (!input.startsWith(text, offset)) throw new Error('Invalid coverage');
    offset += text.length;

    const segments = sentence.segments.map(segment => {
      if (!segment || segment.text === '' || !roles.has(segment.role) || !['core', 'detail'].includes(segment.level)) {
        throw new Error('Invalid analysis');
      }
      return {
        text: string(segment.text, 6000),
        role: segment.role,
        translation: string(segment.translation, 6000, segment.role !== 'other'),
        lemma: string(segment.lemma, 200, ['predicate', 'linking'].includes(segment.role)),
        detail: string(segment.detail, 6000),
        level: segment.level,
      };
    });
    if (segments.map(segment => segment.text).join('') !== text) throw new Error('Invalid coverage');
    return {
      text,
      translation: string(sentence.translation, 12000, true),
      note: string(sentence.note, 6000),
      // Optional: older/partial responses without a tense still render.
      tense: sentence.tense === undefined ? '' : string(sentence.tense, 100),
      segments,
    };
  });
  if (input.slice(offset).trim()) throw new Error('Invalid coverage');
  return { sentences, translation: string(data.translation, 24000, true) };
}
