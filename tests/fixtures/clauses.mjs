// Mocked analysis results for clause rendering checks. These are fixtures, not
// evidence that the live model follows the prompt; the owner runs the live
// acceptance separately.

const span = (text, role, translation = '', lemma = '', level = 'core', modifies) =>
  ({text, role, translation, lemma, detail: '测试', level, ...(modifies === undefined ? {} : {modifies})});
const gap = () => span(' ', 'other', '', '', 'detail');

function analysis(segments, clauses, translation = '测试翻译。') {
  return {
    sentences: [{
      text: segments.map(part => part.text).join(''),
      translation,
      note: '',
      tense: '一般现在时 · 主动语态',
      tenseReason: '因为谓语是一般现在时形式，所以是一般现在时。',
      clauses,
      segments,
    }],
    translation,
  };
}

export function conditional() {
  return analysis([
    span('If', 'other', '', '', 'detail'), gap(),
    span('it', 'subject', '它', '', 'detail'), gap(),
    span('rains', 'predicate', '下雨', 'rain', 'detail'),
    span(', ', 'other', '', '', 'detail'),
    span('we', 'subject', '我们'), gap(),
    span('will stay', 'predicate', '待', 'stay'), gap(),
    span('at home', 'adverbial', '在家', '', 'detail'),
    span('.', 'other', '', '', 'detail'),
  ], [{start: 0, end: 5, type: 'adverbial', subtype: 'condition'}], '如果下雨，我们就待在家里。');
}

export function objectClause() {
  return analysis([
    span('I', 'subject', '我'), gap(),
    span('know', 'predicate', '知道', 'know'), gap(),
    span('that', 'other', '', '', 'detail'), gap(),
    span('she', 'subject', '她', '', 'detail'), gap(),
    span('was working', 'predicate', '在工作', 'work', 'detail'),
    span('.', 'other', '', '', 'detail'),
  ], [{start: 4, end: 9, type: 'object'}], '我知道她当时在工作。');
}

// Fictional sentence with the same structure as the reported case, not the
// user's original wording (see AGENTS.md).
function relativeSegments(third = false) {
  const segments = [
    span('The guide', 'subject', '这份指南'), gap(),
    span('that', 'object', '引导定语从句，作 recommended 的宾语', '', 'detail'), gap(),
    span('the caretaker', 'subject', '管理员', '', 'detail'), gap(),
    span('who', 'subject', '指管理员', '', 'detail'), gap(),
    span('works', 'predicate', '工作', 'work', 'detail'), gap(),
  ];
  if (third) {
    segments.push(
      span('in the office', 'adverbial', '在办公室里', '', 'detail', 8), gap(),
      span('that', 'subject', '指办公室', '', 'detail'), gap(),
      span('stands', 'predicate', '位于', 'stand', 'detail'), gap(),
      span('upstairs', 'adverbial', '楼上', '', 'detail', 14), gap(),
      span('recommended', 'predicate', '推荐', 'recommend', 'detail'), gap(),
      span('is', 'linking', '是', 'be'), gap(),
      span('helpful', 'predicative', '有帮助的'),
      span('.', 'other', '', '', 'detail'),
    );
    return {
      segments,
      clauses: [
        {start: 2, end: 19, type: 'relative'},
        {start: 6, end: 17, type: 'relative'},
        {start: 12, end: 17, type: 'relative'},
      ],
    };
  }
  segments.push(
    span('upstairs', 'adverbial', '楼上', '', 'detail', 8), gap(),
    span('recommended', 'predicate', '推荐', 'recommend', 'detail'), gap(),
    span('is', 'linking', '是', 'be'), gap(),
    span('helpful', 'predicative', '有帮助的'),
    span('.', 'other', '', '', 'detail'),
  );
  return {
    segments,
    clauses: [
      {start: 2, end: 13, type: 'relative'},
      {start: 6, end: 11, type: 'relative'},
    ],
  };
}

export function nestedRelative() {
  const {segments, clauses} = relativeSegments(false);
  return analysis(segments, clauses, '管理员推荐的那份指南很有帮助。');
}

export function nestedThree() {
  const {segments, clauses} = relativeSegments(true);
  return analysis(segments, clauses, '在楼上办公室工作的管理员推荐的那份指南很有帮助。');
}

export function sameEnd() {
  return analysis([
    span('I', 'subject', '我'), gap(),
    span('know', 'predicate', '知道', 'know'), gap(),
    span('that', 'other', '', '', 'detail'), gap(),
    span('she', 'subject', '她', '', 'detail'), gap(),
    span('left', 'predicate', '离开', 'leave', 'detail'), gap(),
    span('because', 'other', '', '', 'detail'), gap(),
    span('he', 'subject', '他', '', 'detail'), gap(),
    span('called', 'predicate', '打电话', 'call', 'detail'),
    span('.', 'other', '', '', 'detail'),
  ], [
    {start: 4, end: 15, type: 'object'},
    {start: 10, end: 15, type: 'adverbial', subtype: 'reason'},
  ], '我知道她离开是因为他打了电话。');
}

export function adjacentObjects() {
  return analysis([
    span('I', 'subject', '我'), gap(),
    span('know', 'predicate', '知道', 'know'), gap(),
    span('that', 'other', '', '', 'detail'), gap(),
    span('she', 'subject', '她', '', 'detail'), gap(),
    span('was working', 'predicate', '在工作', 'work', 'detail'), gap(),
    span('and', 'other', '', '', 'detail'), gap(),
    span('that', 'other', '', '', 'detail'), gap(),
    span('he', 'subject', '他', '', 'detail'), gap(),
    span('was resting', 'predicate', '在休息', 'rest', 'detail'),
    span('.', 'other', '', '', 'detail'),
  ], [
    {start: 4, end: 9, type: 'object'},
    {start: 12, end: 17, type: 'object'},
  ], '我知道她在工作，而他在休息。');
}
