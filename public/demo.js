export const demoText = 'Tired learners who keep going every day will see the beauty of English grammar in the end.';
const part = (text, role, translation = '', lemma = '', detail = '', level = 'core', modifies) => ({text, role, translation, lemma, detail, level, ...(modifies === undefined ? {} : {modifies})});
const gap = () => part(' ', 'other', '', '', '', 'detail');
export const demoAnalysis = {
  sentences: [{
    text: demoText,
    translation: '每天坚持下去的疲惫学习者，最终会看到英语语法之美。',
    tense: '一般将来时 · 主动语态；一般现在时 · 主动语态',
    tenseReason: '因为谓语是 will see（will + 动词原形），所以是一般将来时；主语 learners 是「看到」的发出者，所以是主动语态。定语从句 who keep going every day 的谓语是 keep going（动词原形，主语 who 指复数的 learners），且有时间词 every day，所以是一般现在时。',
    note: '主干是 learners will see the beauty（学习者会看到美）。Tired 和 who keep going every day 都在修饰 learners，前者放在名词前面，后者是放在名词后面的定语从句；of English grammar 修饰 the beauty；in the end 说明「什么时候」，是时间状语。先找主干，再把修饰部分一块块挂回去，长句就不难了。',
    segments: [
      part('Tired', 'attribute', '疲惫的', '', '形容词放在名词前作定语，修饰 learners。', 'detail', 2),
      gap(),
      part('learners', 'subject', '学习者', '', '名词复数，是主语中心词：谁会看到？学习者。'),
      gap(),
      part('who keep going every day', 'attribute', '每天坚持下去的', '', '由 who 引导的定语从句，放在 learners 后面修饰它。keep going 意为「坚持下去」，every day 是从句里的时间状语。', 'detail', 2),
      gap(),
      part('will see', 'predicate', '会看到', 'see', 'will + 动词原形，表示将来。will see 合起来是一个谓语。'),
      gap(),
      part('the beauty', 'object', '美', '', '名词作宾语：看到什么？美。'),
      gap(),
      part('of English grammar', 'attribute', '英语语法的', '', '介词短语作后置定语，修饰 the beauty。', 'detail', 8),
      gap(),
      part('in the end', 'adverbial', '最终', '', '固定短语，作时间状语，说明「什么时候」看到。', 'detail', 6),
      part('.', 'other', '', '', '', 'detail'),
    ],
  }],
  translation: '每天坚持下去的疲惫学习者，最终会看到英语语法之美。',
};
