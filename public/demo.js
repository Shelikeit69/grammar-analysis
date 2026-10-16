export const demoText = 'Everyone in the stadium felt nervous.';
const part = (text, role, translation = '', lemma = '', detail = '', level = 'core') => ({text, role, translation, lemma, detail, level});
export const demoAnalysis = {
  sentences: [{
    text: demoText,
    translation: '体育场里的每个人都感到紧张。',
    tense: '一般过去时 · 主动语态',
    note: 'Everyone in the stadium 整体构成主语。Everyone 是主语中心词，in the stadium 是修饰 Everyone 的后置定语。felt 是系动词，nervous 是表语。',
    segments: [
      part('Everyone', 'subject', '每个人', '', '不定代词 Everyone 是主语中心词。'),
      part(' ', 'other'),
      part('in the stadium', 'attribute', '在体育场里的', '', '介词短语作后置定语，修饰 Everyone；它属于整个主语短语。', 'detail'),
      part(' ', 'other'),
      part('felt', 'linking', '感到', 'feel', 'felt 是 feel 的过去式。这里是系动词，连接主语与描述状态的表语 nervous。'),
      part(' ', 'other'),
      part('nervous', 'predicative', '紧张的', '', '形容词 nervous 作表语，说明主语的状态。'),
      part('.', 'other'),
    ],
  }],
  translation: '体育场里的每个人都感到紧张。',
};
