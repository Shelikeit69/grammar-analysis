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

// One legal segment that is long enough to wrap inside itself at phone widths.
// The plain nested three-level case keeps short spans; this fixture only proves
// that the layout survives line breaks inside a single span. It does not claim
// the live model produces this split.
export function longAdverbialSpan() {
  const {segments, clauses} = relativeSegments(true);
  segments[16].text = 'near the very old and unusually spacious reception room on the far eastern side of the building';
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

// Regression case 09: the object clause contributes to the main backbone.
export function objectBackbone() {
  return analysis([
    span('I', 'subject', '我'), gap(),
    span('know', 'predicate', '知道', 'know'), gap(),
    span('that', 'other', '', '', 'detail'), gap(),
    span('she', 'subject', '她'), gap(),
    span('was working', 'predicate', '工作', 'work'), gap(),
    span('when', 'other', '', '', 'detail'), gap(),
    span('you', 'subject', '你', '', 'detail'), gap(),
    span('called', 'predicate', '打电话', 'call', 'detail'),
    span('.', 'other', '', '', 'detail'),
  ], [
    {start: 4, end: 15, type: 'object'},
    {start: 10, end: 15, type: 'adverbial', subtype: 'time'},
  ], '我知道你打电话时她正在工作。');
}

// Fictional long sentence: normalized ranges remain the rendering contract.
export function longTextAnchors() {
  const parts = [
    ['Our town', 'subject', 'core'], ['has', 'predicate', 'core', 'have'],
    ['a new library', 'object', 'core'], ['thanks partly to', 'adverbial'],
    ['Leo Grant', 'attribute'], [',', 'other'], ['a retired teacher', 'attribute'],
    ['who', 'subject'], ['claimed', 'predicate', 'detail', 'claim'],
    ['that', 'other'], ['books', 'subject'], ['were bought not borrowed', 'predicate', 'detail', 'buy'],
    ['and', 'other'], ['could be shared', 'predicate', 'detail', 'share'],
    ['by', 'other'], ['many', 'attribute'], ['local', 'attribute'], ['families', 'object'],
    ['that', 'subject'], ['were', 'linking', 'detail', 'be'], ['short of money', 'predicative'],
  ];
  const segments = [];
  parts.forEach(([text, role, level = 'detail', lemma = '']) => {
    if (segments.length && text !== ',') segments.push(gap());
    segments.push(span(text, role, role === 'other' ? '' : '测试', lemma, level));
  });
  segments.push(span('.', 'other', '', '', 'detail'));
  const start = text => segments.findIndex(part => part.text === text);
  return analysis(segments, [
    {start: start('who'), end: segments.length - 1, type: 'relative'},
    {start: start('that'), end: segments.length - 1, type: 'object'},
    {start: segments.findLastIndex(part => part.text === 'that'), end: segments.length - 1, type: 'relative'},
  ]);
}

// Model-wire form for provider/normalization tests, never used by rendering.
export function withTextAnchors(result) {
  const data = structuredClone(result);
  for (const sentence of data.sentences) {
    if (Array.isArray(sentence.clauses)) sentence.clauses = sentence.clauses.map(({start, end, type, subtype}) => ({
      type, ...(subtype ? {subtype} : {}),
      text: sentence.segments.slice(start, end).map(part => part.text).join(''),
    }));
  }
  return data;
}

// Fixture with form field on attribute/adverbial segments to test label display.
// "In the morning, a plan to finish the work surprised everyone."
// 0 In the morning, 1 ,, 2 ' ', 3 a, 4 ' ', 5 plan, 6 ' ', 7 to finish the work, 8 ' ', 9 surprised, 10 ' ', 11 everyone, 12 .
export function withForm() {
  const segments = [
    {...span('In the morning', 'adverbial', '在早上', '', 'detail', 9), form: 'prep'},
    span(',', 'other', '', '', 'detail'),
    gap(),
    span('a', 'attribute', '一个', '', 'detail'),
    gap(),
    span('plan', 'subject', '计划'),
    gap(),
    {...span('to finish the work', 'attribute', '完成工作的', '', 'detail', 5), form: 'to-inf'},
    gap(),
    span('surprised', 'predicate', '使惊讶', 'surprise'),
    gap(),
    span('everyone', 'object', '每个人'),
    span('.', 'other', '', '', 'detail'),
  ];
  return analysis(segments, [], '在早上，一个完成工作的计划让所有人惊讶。');
}

// Fixture with attribute + form but NO modifies, to test that no （后置） marker appears.
// "The book on the shelf is mine."
// 0 The, 1 ' ', 2 book, 3 ' ', 4 on the shelf, 5 ' ', 6 is, 7 ' ', 8 mine, 9 .
export function withFormNoModifies() {
  const segments = [
    span('The', 'attribute', '那本', '', 'detail'),
    gap(),
    span('book', 'subject', '书'),
    gap(),
    {...span('on the shelf', 'attribute', '架子上的', '', 'detail'), form: 'prep'},
    gap(),
    span('is', 'linking', '是', 'be'),
    gap(),
    span('mine', 'predicative', '我的'),
    span('.', 'other', '', '', 'detail'),
  ];
  return analysis(segments, [], '架子上的那本书是我的。');
}

export function unsplitLongClause() {
  const fixture = longTextAnchors();
  const sentence = fixture.sentences[0];
  const {start, end} = sentence.clauses[0];
  const text = sentence.segments.slice(start, end).map(s => s.text).join('');
  sentence.segments.splice(start, end - start, span(text, 'attribute', '测试', '', 'detail'));
  sentence.clauses = [{type: 'relative', text}];
  return fixture;
}
