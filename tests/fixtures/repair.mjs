export const repairText = 'Our small garden grows fresh herbs every summer.';

export function repairAnalysis() {
  const segment = (text, role, level = 'core', lemma = '') =>
    ({text, role, level, lemma, translation: role === 'other' ? '' : '测试', detail: ''});
  return {
    sentences: [{text: repairText, translation: '小花园每年夏天种出新鲜香草。', note: '', tense: '', tenseReason: '', segments: [
      segment('Our small garden', 'subject'), segment(' ', 'other', 'detail'),
      segment('grows', 'predicate', 'core', 'grow'), segment(' ', 'other', 'detail'),
      segment('fresh herbs', 'object'), segment(' ', 'other', 'detail'),
      segment('every summer', 'adverbial', 'detail'), segment('.', 'other', 'detail'),
    ]}],
    translation: '小花园每年夏天种出新鲜香草。',
  };
}
