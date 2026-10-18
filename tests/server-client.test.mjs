import test from 'node:test';
import assert from 'node:assert/strict';
import {readAnalysisResponse} from '../public/server-client.js';

const result = {sentences:[{text:'Hello.'}], translation:'你好。'};
function streamResponse(lines) {
  const bytes = new TextEncoder().encode(lines);
  const chunkSize = bytes.length > 10000 ? 65536 : 7;
  // Split UTF-8 characters and JSON lines across arbitrary chunk boundaries.
  return new Response(new ReadableStream({start(controller) {
    for (let index = 0; index < bytes.length; index += chunkSize) controller.enqueue(bytes.slice(index, index + chunkSize));
    controller.close();
  }}), {headers:{'Content-Type':'application/x-ndjson'}});
}

test('repair progress precedes the decoded result, with JSON compatibility', async () => {
  let repairs = 0;
  const lines = JSON.stringify({type:'progress',stage:'repairing'}) + '\n' + JSON.stringify({type:'result',data:result}) + '\n';
  assert.deepEqual(await readAnalysisResponse(streamResponse(lines), {onRepair:()=>repairs++}), result);
  assert.equal(repairs, 1);
  assert.deepEqual(await readAnalysisResponse(Response.json(result)), result);
  await assert.rejects(readAnalysisResponse(Response.json({error:'尚未配置'}, {status:503})), /尚未配置/);
});

test('reject incomplete, duplicate-terminal, oversized and error streams', async () => {
  for (const lines of [
    '{"type":"progress","stage":"repairing"}\n',
    JSON.stringify({type:'result',data:result}) + '\n' + JSON.stringify({type:'result',data:result}),
    '{"type":"error","error":"格式修正失败"}\n',
    ' '.repeat(1_500_001),
  ]) await assert.rejects(readAnalysisResponse(streamResponse(lines)));
});

test('cancellation during repair notification rejects a stale result', async () => {
  const controller = new AbortController();
  const lines = JSON.stringify({type:'progress',stage:'repairing'}) + '\n' + JSON.stringify({type:'result',data:result});
  await assert.rejects(readAnalysisResponse(streamResponse(lines), {
    signal:controller.signal, onRepair:()=>controller.abort(),
  }), {name:'AbortError'});
});
