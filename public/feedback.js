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
export const FEEDBACK_TYPES = ['成分标错了', '中文意思不对', '时态不对', '显示或排版有问题', '其他'];
const roles = {subject:'主语', predicate:'谓语', linking:'系动词', object:'宾语', predicative:'表语', complement:'补语', adverbial:'状语', attribute:'定语', other:'其他'};
function readableAnalysis(sentence) {
  const safe = serializeSentence(sentence);
  const lines = [['translation', '翻译'], ['tense', '时态'], ['tenseReason', '依据']]
    .filter(([key]) => safe[key]).map(([key, label]) => `${label}：${safe[key]}`);
  const parts = safe.segments.filter(part => !(part.role === 'other' && !/[\p{L}\p{N}]/u.test(part.text || ''))).map(part => {
    const head = safe.segments[part.predicateOf];
    const target = safe.segments[part.modifies];
    let role = Number.isInteger(part.predicateOf) && head ? `谓语组成部分（与 ${head.text}）` : roles[part.role] || '其他';
    if (Number.isInteger(part.modifies) && target) role += `（修饰 ${target.text}）`;
    const meaning = [part.lemma, part.translation].filter(Boolean).join('－');
    return '- ' + [part.text, role, meaning, part.detail].filter(Boolean).join('｜');
  });
  if (parts.length) lines.push('成分：', ...parts);
  if (safe.note) lines.push(`说明：${safe.note}`);
  return lines.join('\n');
}
export function createFeedback({sentence, text = '', model, version, error, types = [], description = '', expected = ''}) {
  const original = sentence ? sentence.text : text;
  const chars = Array.from(original);
  const chosen = sentence ? FEEDBACK_TYPES.filter(type => types.includes(type)) : [];
  return {
    title: `${sentence ? '分析问题' : '请求失败'}：${chars.slice(0, 40).join('')}${chars.length > 40 ? '…' : ''}`,
    body: `## 问题类型\n${chosen.join('、') || '未选择'}\n\n## 具体说明\n${description.trim() || '未填写'}\n\n## 用户认为正确的\n${expected.trim() || '未填写'}\n\n## 原句\n${original}\n\n## AI 分析结果\n${sentence ? readableAnalysis(sentence) : `未获得分析结果（请求失败）${error ? '\n提示：' + error : ''}`}\n\n## 调用模型\n${model || '未知（服务未提供模型名称）'}\n\n## 工具版本\n${version}\n`,
  };
}
export function issueLink(title, body) {
  const url = `${ISSUE_URL}?${new URLSearchParams({title, body})}`;
  if (url.length <= 6000) return {url, long:false};
  return {url:`${ISSUE_URL}?${new URLSearchParams({title:'分析问题反馈（请填写标题）', body:'请将网页中复制的完整反馈正文粘贴到这里，再检查并提交。'})}`, long:true};
}
