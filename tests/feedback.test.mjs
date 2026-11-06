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
 assert.ok(!body.includes('从句：'));
});

test('clause list in the report rebuilds text from segments and names types and subtypes', () => {
 const segments=[{text:'If',role:'other'},{text:' ',role:'other'},{text:'it',role:'subject',translation:'它'},{text:' ',role:'other'},{text:'rains',role:'predicate',translation:'下雨',lemma:'rain'},{text:', ',role:'other'},{text:'we',role:'subject',translation:'我们'},{text:' ',role:'other'},{text:'will stay',role:'predicate',translation:'待',lemma:'stay'},{text:' ',role:'other'},{text:'at home',role:'adverbial',translation:'在家'},{text:'.',role:'other'}];
 const sentence={text:'If it rains, we will stay at home.',segments,clauses:[
  {start:0,end:5,type:'adverbial',subtype:'condition'},
  {start:6,end:11,type:'object',id:'model-id',copiedText:'secret-copied',depth:9,parent:1},
  {start:10,end:11,type:'adverbial',subtype:'manner'},
 ]};
 const body=createFeedback({sentence,version:'v'}).body;
 assert.match(body,/从句：\n- 条件状语从句：If it rains\n- 宾语从句：we will stay at home\n- 方式状语从句：at home/);
 assert.ok(!body.includes('secret')); assert.ok(!body.includes('model-id')); assert.ok(!body.includes('depth'));
 const plain=createFeedback({sentence:{...sentence,clauses:undefined},version:'v'}).body;
 assert.ok(!plain.includes('从句：'));
 assert.ok(!serializeSentence({...sentence,clauses:undefined}).clauses);
});

test('clause text in the report stays literal when it contains markup', () => {
 const sentence={text:'<script>alert(1)</script>',segments:[{text:'<script>alert(1)</script>',role:'other'}],clauses:[{start:0,end:1,type:'relative'}]};
 const body=createFeedback({sentence,version:'v'}).body;
 assert.match(body,/- 定语从句：<script>alert\(1\)<\/script>/);
 assert.ok(!body.includes('&lt;script'));
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
test('component line shows form type for attribute and adverbial', () => {
 const segments=[
  {text:'The',role:'attribute',translation:'那',form:'prep',modifies:2},
  {text:' ',role:'other'},
  {text:'book',role:'subject',translation:'书'},
  {text:' ',role:'other'},
  {text:'on the shelf',role:'attribute',translation:'架子上的',form:'prep',modifies:2},
  {text:' ',role:'other'},
  {text:'is',role:'linking',translation:'是',lemma:'be'},
  {text:' ',role:'other'},
  {text:'mine',role:'predicative',translation:'我的'},
  {text:'.',role:'other'},
 ];
 const sentence={text:'The book on the shelf is mine.',segments};
 const body=createFeedback({sentence,version:'v'}).body;
 // 'The' at index 0, modifies 2 → 2 < 0 is false → no （后置）
 assert.match(body,/- The｜定语 · 介词短语（修饰 book）｜那/);
 assert.ok(!body.includes('- The｜定语 · 介词短语（后置）'));
 // 'on the shelf' at index 4, modifies 2 → 2 < 4 is true → （后置）
 assert.match(body,/- on the shelf｜定语 · 介词短语（后置）（修饰 book）/);
});
test('form type without post-position marker when modifies is before current index', () => {
 const segments=[
  {text:'She',role:'subject',translation:'她'},
  {text:' ',role:'other'},
  {text:'has',role:'predicate',translation:'有',lemma:'have'},
  {text:' ',role:'other'},
  {text:'a',role:'attribute',translation:'一个',form:'prep',modifies:6},
  {text:' ',role:'other'},
  {text:'plan',role:'object',translation:'计划'},
  {text:' ',role:'other'},
  {text:'to finish',role:'attribute',translation:'完成…的',form:'to-inf',modifies:6},
  {text:' ',role:'other'},
  {text:'the work',role:'object',translation:'工作'},
  {text:'.',role:'other'},
 ];
 const sentence={text:'She has a plan to finish the work.',segments};
 const body=createFeedback({sentence,version:'v'}).body;
 // 'a' at index 4, modifies 6 (plan) → 4 < 6, so NO （后置）
 assert.match(body,/- a｜定语 · 介词短语（修饰 plan）/);
 assert.ok(!body.includes('- a｜定语 · 介词短语（后置）'));
 // 'to finish' at index 8, modifies 6 (plan) → 8 > 6, so （后置）
 assert.match(body,/- to finish｜定语 · 不定式（后置）（修饰 plan）/);
});
test('adverbial with form shows type but never post-position marker', () => {
 const segments=[
  {text:'He',role:'subject',translation:'他'},
  {text:' ',role:'other'},
  {text:'left',role:'predicate',translation:'离开',lemma:'leave'},
  {text:' ',role:'other'},
  {text:'early',role:'adverbial',translation:'早早地',form:'ing'},
  {text:' ',role:'other'},
  {text:'to catch the bus',role:'adverbial',translation:'为了赶公交',form:'to-inf',modifies:2},
  {text:'.',role:'other'},
 ];
 const sentence={text:'He left early to catch the bus.',segments};
 const body=createFeedback({sentence,version:'v'}).body;
 assert.match(body,/- early｜状语 · 现在分词/);
 assert.match(body,/- to catch the bus｜状语 · 不定式（修饰 left）/);
 assert.ok(!body.includes('（后置）'));
});
test('segment without form shows role only, unchanged from before', () => {
 const segments=[
  {text:'Tired',role:'attribute',translation:'疲惫的',modifies:2},
  {text:' ',role:'other'},
  {text:'learners',role:'subject',translation:'学习者'},
  {text:'.',role:'other'},
 ];
 const sentence={text:'Tired learners.',segments};
 const body=createFeedback({sentence,version:'v'}).body;
 assert.match(body,/- Tired｜定语（修饰 learners）｜疲惫的/);
 assert.ok(!body.includes('· '));
});
test('serializeSentence includes form when present', () => {
 const value = serializeSentence({text:'Go.',segments:[{text:'Go',role:'predicate',form:'prep'}]});
 assert.equal(value.segments[0].form, 'prep');
 const noForm = serializeSentence({text:'Go.',segments:[{text:'Go',role:'predicate'}]});
 assert.equal(noForm.segments[0].form, undefined);
});
