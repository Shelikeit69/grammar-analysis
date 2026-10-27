const ISSUE_URL = 'https://github.com/Shelikeit69/grammar-analysis/issues/new';
const sentenceFields = ['text', 'translation', 'tense', 'tenseReason', 'note'];
const segmentFields = ['text', 'role', 'level', 'translation', 'lemma', 'detail'];
function strings(source, fields) {
  return Object.fromEntries(fields.filter(key => typeof source?.[key] === 'string').map(key => [key, source[key]]));
}
export function serializeSentence(sentence) {
  const result = strings(sentence, sentenceFields);
  result.segments = (Array.isArray(sentence?.segments) ? sentence.segments : []).map(segment => {
    const item = strings(segment, segmentFields);
    for (const key of ['modifies', 'predicateOf']) if (Number.isInteger(segment?.[key])) item[key] = segment[key];
    return item;
  });
  return result;
}
export function createFeedback({sentence, text = '', model, version, error}) {
  const original = sentence ? sentence.text : text;
  return {
    title: '分析问题反馈',
    body: `## 原句\n${original}\n\n## AI 分析结果\n${sentence ? JSON.stringify(serializeSentence(sentence), null, 2) : `未获得分析结果（请求失败）${error ? '\n提示：' + error : ''}`}\n\n## 调用模型\n${model || '未知（服务未提供模型名称）'}\n\n## 工具版本\n${version}\n\n## 哪里不对\n（请补充；不需要知道正确答案）\n`,
  };
}
export function issueLink(title, body) {
  const url = `${ISSUE_URL}?${new URLSearchParams({title, body})}`;
  if (url.length <= 6000) return {url, long:false};
  return {url:`${ISSUE_URL}?${new URLSearchParams({title:'分析问题反馈（请填写标题）', body:'请将网页中复制的完整反馈正文粘贴到这里，再检查并提交。'})}`, long:true};
}
