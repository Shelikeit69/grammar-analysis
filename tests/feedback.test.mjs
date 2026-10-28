import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeSentence, createFeedback, issueLink} from '../public/feedback.js';
import {demoAnalysis} from '../public/demo.js';

test('demo report is readable Markdown and fits the prefilled URL', () => {
 const draft = createFeedback({sentence:demoAnalysis.sentences[0],model:'内置示例（未调用模型）',version:'2026-10-28'});
 const link = issueLink(draft.title,draft.body);
 assert.equal(link.long,false); assert.ok(link.url.length<=6000);
 assert.ok(!draft.body.includes('{'));
 assert.ok(draft.title.startsWith('分析问题：')); assert.ok(draft.title.endsWith('…'));
 assert.match(draft.body,/## 问题类型\n未选择/);
 assert.match(draft.body,/## 具体说明\n未填写/);
 assert.match(draft.body,/## 用户认为正确的\n未填写/);
});

test('form fields appear in their sections and unknown types are excluded', () => {
 const draft=createFeedback({sentence:{text:'Go.',segments:[]},types:['其他','成分标错了','secret'],description:'  错了 &?#  ',expected:'  改成这样  ',version:'v'});
 assert.equal(draft.title,'分析问题：Go.');
 assert.match(draft.body,/## 问题类型\n成分标错了、其他\n\n## 具体说明\n错了 &\?#\n\n## 用户认为正确的\n改成这样\n\n## 原句\nGo\./);
 assert.ok(!draft.body.includes('secret'));
});

test('readable references, whitelist, empty fields and punctuation filtering', () => {
 const sentence={text:'She turned the light off.',apiKey:'secret-key',settings:'secret-settings',headers:'secret-headers',storage:'secret-storage',segments:[
  {text:'turned',role:'predicate',lemma:'turn off',translation:'关掉',detail:'过去式',raw:'secret-raw'},
  {text:' ',role:'other'}, {text:'.!?',role:'other'},
  {text:'off',role:'predicate',predicateOf:0,translation:'关掉'},
  {text:'bright',role:'attribute',translation:'明亮的',modifies:5},
  {text:'light',role:'object',translation:'灯'}, {text:'123',role:'other'},
 ]};
 const body=createFeedback({sentence,version:'v'}).body;
 assert.match(body,/- turned｜谓语｜turn off－关掉｜过去式/);
 assert.match(body,/- off｜谓语组成部分（与 turned）｜关掉/);
 assert.match(body,/- bright｜定语（修饰 light）｜明亮的/);
 assert.match(body,/- 123｜其他/);
 assert.ok(!body.includes('- .!?')); assert.ok(!body.includes('-  ｜'));
 assert.ok(!body.includes('secret')); assert.ok(!body.includes('undefined'));
 assert.ok(!body.includes('翻译：')); assert.ok(!body.includes('时态：')); assert.ok(!body.includes('说明：'));
});

test('failure reports ignore chip values and keep the safe hint', () => {
 const draft=createFeedback({text:'Wait.',types:['其他'],description:'连接失败',error:'安全提示',model:null,version:'v'});
 assert.equal(draft.title,'请求失败：Wait.');
 assert.match(draft.body,/## 问题类型\n未选择/); assert.ok(!draft.body.includes('其他'));
 assert.match(draft.body,/提示：安全提示/);
});
test('feedback serializes only explicit sentence fields, including references', () => {
 const value = serializeSentence({text:'Go.',apiKey:'secret',segments:[{text:'Go',role:'predicate',modifies:0,predicateOf:1,headers:'secret'}]});
 assert.deepEqual(value,{text:'Go.',segments:[{text:'Go',role:'predicate',modifies:0,predicateOf:1}]});
 assert.ok(!JSON.stringify(value).includes('secret'));
});
test('edited preview is encoded exactly and oversized content remains intact', () => {
 const body = '<script> 中文 &?#';
 const short = issueLink('edited',body);
 assert.equal(new URL(short.url).searchParams.get('body'),body);
 const title = '分析问题：She turned the light off.';
 const long = issueLink(title,body.repeat(2000));
 assert.equal(long.long,true);
 assert.equal(new URL(long.url).searchParams.get('title'),title);
 assert.ok(long.url.length < 1000);
 assert.match(new URL(long.url).searchParams.get('body'),/Create/);
 assert.match(new URL(long.url).searchParams.get('body'),/粘贴/);
});
test('report contains one sentence only and no raw errors', () => {
 const draft = createFeedback({sentence:{text:'Go.',segments:[]},model:'old',version:'v1'});
 assert.match(draft.body,/Go\./); assert.match(draft.body,/old/);
 const failed = createFeedback({text:'Wait.',model:null,version:'v1'});
 assert.match(failed.body,/未知/); assert.match(failed.body,/未获得/);
});
