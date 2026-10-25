export function separated(turnOff = false) {
  const span = (text, role, translation = '', lemma = '') => ({text, role, translation, lemma, detail: '', level: role === 'other' ? 'detail' : 'core'});
  const lemma = turnOff ? 'turn off' : 'give up';
  const segments = [span(turnOff ? 'She' : 'You', 'subject', turnOff ? '她' : '你'), span(' ', 'other'),
    span(turnOff ? 'turned' : 'should give', 'predicate', turnOff ? '关掉' : '放弃', lemma), span(' ', 'other'),
    span(turnOff ? 'the light' : 'it', 'object', turnOff ? '灯' : '它'), span(' ', 'other'),
    {...span(turnOff ? 'off' : 'up', 'predicate', turnOff ? '关掉' : '放弃', lemma), predicateOf: 2}, span('.', 'other')];
  segments[2].detail = turnOff ? 'turned 是 turn 的过去式。' : 'should 表示应该。';
  const text = segments.map(s => s.text).join('');
  const translation = turnOff ? '她关掉了灯。' : '你应该放弃它。';
  return {sentences: [{text, segments, translation, note: ''}], translation};
}
