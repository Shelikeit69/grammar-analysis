// 评测集：虚构句 + 参考检查点，供 scripts/ab-clauses.mjs --eval 自动打分。
// 参考答案是草稿，按 SYSTEM 现有约定起草，尚未经负责人或老师逐条确认；
// needsReview 标出没有唯一答案或现有标签体系无法表达的地方，这些地方不设检查。
// inPrompt: true 表示句子已出现在 SYSTEM 例句或内置例句里，通过只说明没有倒退。
// 说明见 docs/eval-cases.md。

const PAST = '一般过去时 · 主动语态';
const PRESENT = '一般现在时 · 主动语态';
const PAST_PASSIVE = '一般过去时 · 被动语态';

export const EVAL_CASES = [
  // 01–10 与 docs/regression-cases.md 的样例一一对应。
  {id:'r01', input:'everyone in the stadium felt nervous;', inPrompt:true, checks:[
    {type:'role', text:'felt', role:'linking'}, {type:'lemma', text:'felt', lemma:'feel'},
    {type:'role', text:'nervous', role:'predicative'}, {type:'role', text:'in the stadium', role:'attribute'},
    {type:'modifies', text:'in the stadium', target:'everyone'}, {type:'level', text:'everyone', level:'core'},
    {type:'clauseCount', count:0}, {type:'tense', value:PAST}]},
  {id:'r02', input:'She told him that she trusted him.', checks:[
    {type:'role', text:'told', role:'predicate'}, {type:'lemma', text:'told', lemma:'tell'},
    {type:'clause', text:'that she trusted him', clauseType:'object'}, {type:'clauseCount', count:1},
    {type:'tense', value:PAST}]},
  {id:'r03', input:'You should give it up.', inPrompt:true, checks:[
    {type:'role', text:'it', role:'object'}, {type:'lemma', text:'give', lemma:'give up'},
    {type:'separated', verb:'give', particle:'up'}, {type:'tense', value:PRESENT}]},
  {id:'r04', input:'Did you see him yesterday?', checks:[
    {type:'role', text:'you', role:'subject'}, {type:'role', text:'him', role:'object'},
    {type:'role', text:'yesterday', role:'adverbial'}, {type:'lemma', text:'see', lemma:'see'},
    {type:'clauseCount', count:0}, {type:'tense', value:PAST}]},
  {id:'r05', input:'She has never seen it.', checks:[
    {type:'role', text:'it', role:'object'}, {type:'lemma', text:'seen', lemma:'see'},
    {type:'tense', value:'现在完成时 · 主动语态'}]},
  {id:'r06', input:'The book that you lent me is interesting.', checks:[
    {type:'role', text:'is', role:'linking'}, {type:'role', text:'interesting', role:'predicative'},
    {type:'level', text:'is', level:'core'}, {type:'clause', text:'that you lent me', clauseType:'relative'},
    {type:'clauseCount', count:1}, {type:'tense', value:PRESENT + '；' + PAST}]},
  {id:'r07', input:'If it rains, we will stay at home.', inPrompt:true, checks:[
    {type:'role', text:'we', role:'subject'}, {type:'lemma', text:'will stay', lemma:'stay'},
    {type:'level', text:'will stay', level:'core'},
    {type:'clause', text:'If it rains', clauseType:'adverbial', subtype:'condition'},
    {type:'tense', value:'一般将来时 · 主动语态；' + PRESENT}]},
  {id:'r08', input:'The book that the teacher who lives next door recommended is useful.', inPrompt:true, checks:[
    {type:'role', text:'is', role:'linking'}, {type:'role', text:'useful', role:'predicative'},
    {type:'clause', text:'that the teacher who lives next door recommended', clauseType:'relative'},
    {type:'clause', text:'who lives next door', clauseType:'relative'},
    {type:'split', text:'that the teacher who lives next door recommended'},
    {type:'clauseCount', count:2}, {type:'tense', value:PRESENT + '；' + PAST}]},
  {id:'r09', input:'I know that she was working when you called.', inPrompt:true, checks:[
    {type:'level', text:'she', level:'core'}, {type:'level', text:'was working', level:'core'},
    {type:'lemma', text:'was working', lemma:'work'},
    {type:'clause', text:'that she was working when you called', clauseType:'object'},
    {type:'clause', text:'when you called', clauseType:'adverbial', subtype:'time'},
    {type:'tense', value:PRESENT + '；过去进行时 · 主动语态；' + PAST}]},
  {id:'r10', input:'Tom opened the door and Mary walked in.', checks:[
    {type:'role', text:'Tom', role:'subject'}, {type:'role', text:'Mary', role:'subject'},
    {type:'level', text:'Mary', level:'core'}, {type:'lemma', text:'opened', lemma:'open'},
    {type:'clauseCount', count:0}, {type:'tense', value:PAST}]},

  // SYSTEM 里出现过的例句。
  {id:'p01', input:'She thanked the nurse who said that the results were good.', inPrompt:true, checks:[
    {type:'level', text:'thanked', level:'core'}, {type:'level', text:'were', level:'detail'},
    {type:'level', text:'good', level:'detail'},
    {type:'clause', text:'who said that the results were good', clauseType:'relative'},
    {type:'clause', text:'that the results were good', clauseType:'object'}, {type:'clauseCount', count:2}]},
  {id:'p02', input:'The meeting was called off because the manager had fallen ill.', inPrompt:true, checks:[
    {type:'lemma', text:'was called off', lemma:'call off'}, {type:'lemma', text:'had fallen', lemma:'fall'},
    {type:'role', text:'ill', role:'predicative'},
    {type:'clause', text:'because the manager had fallen ill', clauseType:'adverbial', subtype:'reason'},
    {type:'tense', value:PAST_PASSIVE + '；过去完成时 · 主动语态'}]},

  // 新写的虚构句，SYSTEM 里没有。
  {id:'n01', input:'The children who live across the river walk to school every day.', checks:[
    {type:'role', text:'children', role:'subject'}, {type:'role', text:'walk', role:'predicate'},
    {type:'role', text:'to school', role:'adverbial'}, {type:'modifies', text:'every day', target:'walk'},
    {type:'clause', text:'who live across the river', clauseType:'relative'}, {type:'tense', value:PRESENT}]},
  {id:'n02', input:'My uncle bought a house that was built in 1920.', checks:[
    {type:'role', text:'house', role:'object'}, {type:'lemma', text:'bought', lemma:'buy'},
    {type:'clause', text:'that was built in 1920', clauseType:'relative'},
    {type:'tense', value:PAST + '；' + PAST_PASSIVE}]},
  {id:'n03', input:'Although the rain had stopped, the streets were still wet.', checks:[
    {type:'role', text:'were', role:'linking'}, {type:'role', text:'wet', role:'predicative'},
    {type:'role', text:'still', role:'adverbial'},
    {type:'clause', text:'Although the rain had stopped', clauseType:'adverbial', subtype:'concession'},
    {type:'tense', value:PAST + '；过去完成时 · 主动语态'}]},
  {id:'n04', input:'The engineer explained that the old bridge could carry heavy trucks.', checks:[
    {type:'lemma', text:'explained', lemma:'explain'}, {type:'lemma', text:'could carry', lemma:'carry'},
    {type:'clause', text:'that the old bridge could carry heavy trucks', clauseType:'object'},
    {type:'split', text:'that the old bridge could carry heavy trucks'},
    {type:'level', text:'could carry', level:'core'}, {type:'level', text:'bridge', level:'core'}],
    needsReview:'could carry 的时态名称（一般过去时，还是按情态动词另写）未定，不检查 tense。'},
  {id:'n05', input:'She gave her brother a book about birds.', checks:[
    {type:'lemma', text:'gave', lemma:'give'}, {type:'role', text:'brother', role:'object'},
    {type:'role', text:'book', role:'object'}, {type:'role', text:'about birds', role:'attribute'},
    {type:'form', text:'about birds', form:'prep'}, {type:'modifies', text:'about birds', target:'book'},
    {type:'tense', value:PAST}]},
  {id:'n06', input:'The windows were cleaned by the students yesterday.', checks:[
    {type:'role', text:'windows', role:'subject'}, {type:'lemma', text:'were cleaned', lemma:'clean'},
    {type:'role', text:'by the students', role:'adverbial'}, {type:'role', text:'yesterday', role:'adverbial'},
    {type:'tense', value:PAST_PASSIVE}]},
  {id:'n07', input:'He turned the radio off before he left.', checks:[
    {type:'role', text:'radio', role:'object'}, {type:'lemma', text:'turned', lemma:'turn off'},
    {type:'separated', verb:'turned', particle:'off'},
    {type:'clause', text:'before he left', clauseType:'adverbial', subtype:'time'}, {type:'tense', value:PAST}]},
  {id:'n08', input:'The teacher asked us to write a diary.', checks:[
    {type:'lemma', text:'asked', lemma:'ask'}, {type:'role', text:'us', role:'object'},
    {type:'role', text:'to write a diary', role:'complement'}, {type:'clauseCount', count:0},
    {type:'tense', value:PAST}]},
  {id:'n09', input:"They have been waiting for the bus since seven o'clock.", checks:[
    {type:'lemma', text:'waiting', lemma:['wait for', 'wait']},
    {type:'role', text:"since seven o'clock", role:'adverbial'},
    {type:'tense', value:'现在完成进行时 · 主动语态'}],
    needsReview:'wait for 算短语动词（for 归谓语）还是 wait + 介词短语，两种 lemma 都接受。'},
  {id:'n10', input:'The trip was very unique, and I hope we can visit there again next year.', checks:[
    {type:'role', text:'unique', role:'predicative'}, {type:'lemma', text:'can visit', lemma:'visit'},
    {type:'gloss-excludes', text:'can visit', words:['能', '可以', '会']},
    {type:'clause', text:'we can visit there again next year', clauseType:'object'},
    {type:'split', text:'we can visit there again next year'}]},
  {id:'n11', input:'My father, an engineer who loves history, explained the plan.', checks:[
    {type:'role', text:'father', role:'subject'}, {type:'lemma', text:'explained', lemma:'explain'},
    {type:'role', text:'plan', role:'object'},
    {type:'clause', text:'who loves history', clauseType:'relative'}, {type:'tense', value:PAST + '；' + PRESENT}],
    needsReview:'同位语 an engineer：现有 9 个 role 里没有同位语，应标 attribute、complement 还是别的未定，不检查它的 role。'},
  {id:'n12', input:'When I saw a strange word, I wrote it down and looked it up.', checks:[
    {type:'lemma', text:'wrote', lemma:'write down'}, {type:'lemma', text:'looked', lemma:'look up'},
    {type:'separated', verb:'wrote', particle:'down'}, {type:'separated', verb:'looked', particle:'up'},
    {type:'clause', text:'When I saw a strange word', clauseType:'adverbial', subtype:'time'},
    {type:'tense', value:PAST}]},
  {id:'n13', input:'Running every morning keeps her healthy.', checks:[
    {type:'role', text:'Running', role:'subject'}, {type:'lemma', text:'keeps', lemma:'keep'},
    {type:'role', text:'her', role:'object'}, {type:'role', text:'healthy', role:'complement'},
    {type:'tense', value:PRESENT}]},
  {id:'n14', input:'There are three apples on the table.', checks:[
    {type:'lemma', text:'are', lemma:'be'}, {type:'role', text:'on the table', role:'adverbial'},
    {type:'tense', value:PRESENT}],
    needsReview:'There be 句型：There 和 three apples 各标什么 role 未定，不检查。'},
  {id:'n15', input:'The man standing by the door is my uncle.', checks:[
    {type:'role', text:'man', role:'subject'}, {type:'role', text:'standing by the door', role:'attribute'},
    {type:'form', text:'standing by the door', form:'ing'}, {type:'modifies', text:'standing by the door', target:'man'},
    {type:'role', text:'is', role:'linking'}, {type:'role', text:'uncle', role:'predicative'},
    {type:'clauseCount', count:0}, {type:'tense', value:PRESENT}]},
  {id:'n16', input:'The letters written by her grandfather were found in the attic.', checks:[
    {type:'role', text:'written by her grandfather', role:'attribute'},
    {type:'form', text:'written by her grandfather', form:'ed'},
    {type:'modifies', text:'written by her grandfather', target:'letters'},
    {type:'lemma', text:'were found', lemma:'find'}, {type:'role', text:'in the attic', role:'adverbial'},
    {type:'clauseCount', count:0}, {type:'tense', value:PAST_PASSIVE}]},
  {id:'n17', input:'She has a plan to visit her parents next month.', checks:[
    {type:'lemma', text:'has', lemma:'have'}, {type:'role', text:'plan', role:'object'},
    {type:'role', text:'to visit her parents', role:'attribute'},
    {type:'form', text:'to visit her parents', form:'to-inf'},
    {type:'modifies', text:'to visit her parents', target:'plan'}, {type:'tense', value:PRESENT}]},
  {id:'n18', input:'The museum that we visited last summer has a room where children can touch the exhibits.', checks:[
    {type:'role', text:'museum', role:'subject'}, {type:'role', text:'has', role:'predicate'},
    {type:'role', text:'room', role:'object'},
    {type:'clause', text:'that we visited last summer', clauseType:'relative'},
    {type:'clause', text:'where children can touch the exhibits', clauseType:'relative'},
    {type:'clauseCount', count:2}, {type:'tense', value:PRESENT + '；' + PAST}]},
  {id:'n19', input:'If you had told me earlier, I would have helped you.', checks:[
    {type:'lemma', text:'had told', lemma:'tell'}, {type:'lemma', text:'would have helped', lemma:'help'},
    {type:'level', text:'would have helped', level:'core'},
    {type:'clause', text:'If you had told me earlier', clauseType:'adverbial', subtype:'condition'}],
    needsReview:'虚拟语气：would have helped 的时态名称（过去将来完成时，还是写虚拟语气）未定，不检查 tense。'},
  {id:'n20', input:'The report must be finished before the manager returns.', checks:[
    {type:'role', text:'report', role:'subject'}, {type:'lemma', text:'must be finished', lemma:'finish'},
    {type:'clause', text:'before the manager returns', clauseType:'adverbial', subtype:'time'},
    {type:'tense', value:'一般现在时 · 被动语态；' + PRESENT}]},
  {id:'n21', input:'Please close the window.', checks:[
    {type:'lemma', text:'close', lemma:'close'}, {type:'role', text:'window', role:'object'},
    {type:'clauseCount', count:0}, {type:'tense', value:'祈使句'}]},
  {id:'n22', input:'What a beautiful day!', checks:[
    {type:'clauseCount', count:0}, {type:'tense', value:''}]},
  {id:'n23', input:'The manager said that the team that won the prize would get a bonus.', checks:[
    {type:'lemma', text:'said', lemma:'say'}, {type:'lemma', text:'won', lemma:'win'},
    {type:'clause', text:'that the team that won the prize would get a bonus', clauseType:'object'},
    {type:'clause', text:'that won the prize', clauseType:'relative'},
    {type:'split', text:'that the team that won the prize would get a bonus'},
    {type:'level', text:'would get', level:'core'}, {type:'level', text:'won', level:'detail'},
    {type:'clauseCount', count:2}]},
  {id:'n24', input:'He was so tired that he fell asleep on the sofa.', checks:[
    {type:'role', text:'was', role:'linking'}, {type:'role', text:'tired', role:'predicative'},
    {type:'lemma', text:'fell', lemma:['fall', 'fall asleep']},
    {type:'clause', text:'that he fell asleep on the sofa', clauseType:'adverbial', subtype:'result'},
    {type:'split', text:'that he fell asleep on the sofa'}, {type:'tense', value:PAST}],
    needsReview:'fell asleep：按系动词 fall + 表语 asleep，还是整体作谓语 fall asleep，两种 lemma 都接受。'},
  {id:'n25', input:'Neither the students nor the teacher knows the answer.', checks:[
    {type:'role', text:'knows', role:'predicate'}, {type:'lemma', text:'knows', lemma:'know'},
    {type:'role', text:'answer', role:'object'}, {type:'clauseCount', count:0}, {type:'tense', value:PRESENT}]},
  {id:'n26', input:'I saw him cross the street.', checks:[
    {type:'lemma', text:'saw', lemma:'see'}, {type:'role', text:'him', role:'object'},
    {type:'role', text:'cross the street', role:'complement'}, {type:'clauseCount', count:0},
    {type:'tense', value:PAST}]},
  {id:'n27', input:'The cake smells delicious.', checks:[
    {type:'role', text:'cake', role:'subject'}, {type:'role', text:'smells', role:'linking'},
    {type:'lemma', text:'smells', lemma:'smell'}, {type:'role', text:'delicious', role:'predicative'},
    {type:'tense', value:PRESENT}]},
  {id:'n28', input:'We painted the fence green.', checks:[
    {type:'lemma', text:'painted', lemma:'paint'}, {type:'role', text:'fence', role:'object'},
    {type:'role', text:'green', role:'complement'}, {type:'modifies', text:'green', target:'fence'},
    {type:'tense', value:PAST}]},
];

const words = text => (typeof text === 'string' ? text.toLowerCase().match(/[a-z0-9']+/g) : null) || [];

// 片段是否包含整个词组（按完整单词、连续出现）。
function hasPhrase(text, phrase) {
  const haystack = words(text);
  const needle = words(phrase);
  if (!needle.length) return false;
  return haystack.some((_, at) => needle.every((word, offset) => haystack[at + offset] === word));
}

const sameWords = (a, b) => words(a).join(' ') === words(b).join(' ');
const normalizeTense = value => String(value ?? '').replace(/\s*([·；])\s*/g, '$1').trim();

// data 必须是 validateAnalysis 的返回值（从句已是片段范围）。
// 返回每个检查项的结果；data 为空（格式未通过）时全部记为未通过。
export function evaluateEvalCase(caseItem, data) {
  const sentences = Array.isArray(data?.sentences) ? data.sentences : [];
  const clauses = sentences.flatMap(sentence => (sentence.clauses || []).map(clause => {
    const parts = sentence.segments.slice(clause.start, clause.end);
    return {...clause, text: parts.map(part => part.text).join(''), spans: parts.filter(part => words(part.text).length).length};
  }));
  return caseItem.checks.map(check => {
    let pass = false;
    if (sentences.length) {
      for (const sentence of sentences) {
        const found = sentence.segments.filter(part => part.role !== 'other' && hasPhrase(part.text, check.text));
        if (check.type === 'role') pass ||= found.some(part => part.role === check.role);
        else if (check.type === 'level') pass ||= found.length > 0 && found.every(part => part.level === check.level);
        else if (check.type === 'lemma') {
          const verbs = found.filter(part => part.role === 'predicate' || part.role === 'linking');
          pass ||= verbs.length > 0 && verbs.every(part => [].concat(check.lemma).includes(part.lemma));
        } else if (check.type === 'form') pass ||= found.some(part => part.form === check.form);
        else if (check.type === 'modifies') {
          pass ||= found.some(part => Number.isInteger(part.modifies) &&
            hasPhrase(sentence.segments[part.modifies].text, check.target));
        } else if (check.type === 'gloss-excludes') {
          const verbs = found.filter(part => part.role === 'predicate' || part.role === 'linking');
          pass ||= verbs.length > 0 && verbs.every(part => !check.words.some(word => part.translation.includes(word)));
        } else if (check.type === 'separated') {
          pass ||= sentence.segments.some(part => sameWords(part.text, check.particle) &&
            Number.isInteger(part.predicateOf) && hasPhrase(sentence.segments[part.predicateOf].text, check.verb));
        }
      }
      if (check.type === 'clause') {
        pass = clauses.some(clause => sameWords(clause.text, check.text) && clause.type === check.clauseType &&
          (!check.subtype || clause.subtype === check.subtype));
      } else if (check.type === 'split') {
        pass = clauses.some(clause => sameWords(clause.text, check.text) && clause.spans >= 2);
      } else if (check.type === 'clauseCount') pass = clauses.length === check.count;
      else if (check.type === 'tense') {
        pass = sentences.length === 1 && normalizeTense(sentences[0].tense) === normalizeTense(check.value);
      }
    }
    return {type: check.type, pass, check};
  });
}
