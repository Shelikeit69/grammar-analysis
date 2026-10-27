import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeSentence, createFeedback, issueLink} from '../public/feedback.js';
test('feedback serializes only explicit sentence fields, including references', () => {
 const value = serializeSentence({text:'Go.',apiKey:'secret',segments:[{text:'Go',role:'predicate',modifies:0,predicateOf:1,headers:'secret'}]});
 assert.deepEqual(value,{text:'Go.',segments:[{text:'Go',role:'predicate',modifies:0,predicateOf:1}]});
 assert.ok(!JSON.stringify(value).includes('secret'));
});
test('edited preview is encoded exactly and oversized content remains intact', () => {
 const body = '<script> 中文 &?#';
 const short = issueLink('edited',body);
 assert.equal(new URL(short.url).searchParams.get('body'),body);
 const long = issueLink('x',body.repeat(2000));
 assert.equal(long.long,true);
 assert.match(new URL(long.url).searchParams.get('body'),/粘贴/);
});
test('report contains one sentence only and no raw errors', () => {
 const draft = createFeedback({sentence:{text:'Go.',segments:[]},model:'old',version:'v1'});
 assert.match(draft.body,/Go\./); assert.match(draft.body,/old/);
 const failed = createFeedback({text:'Wait.',model:null,version:'v1'});
 assert.match(failed.body,/未知/); assert.match(failed.body,/未获得/);
});
