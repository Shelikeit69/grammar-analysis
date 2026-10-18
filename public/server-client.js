// The API keeps JSON compatibility and optionally streams a repair notification.
export async function readAnalysisResponse(response, {onRepair, signal} = {}) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '分析失败，请稍后重试。');
    return data;
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('分析结果不完整，请重试。');
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  let repaired = false;
  let result;
  let terminal = false;
  function consume(line) {
    if (!line.trim()) return;
    if (terminal) throw new Error('分析结果格式不正确，请重试。');
    const event = JSON.parse(line);
    if (event.type === 'progress' && event.stage === 'repairing' && !repaired) {
      repaired = true;
      onRepair?.();
    } else if (event.type === 'result' && event.data) {
      result = event.data;
      terminal = true;
    } else if (event.type === 'error') {
      throw new Error(typeof event.error === 'string' ? event.error : '分析失败，请稍后重试。');
    } else {
      throw new Error('分析结果格式不正确，请重试。');
    }
  }
  try {
    for (;;) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_500_000) throw new Error('分析结果过长，请缩短原文后重试。');
      buffer += decoder.decode(value, {stream:true});
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    consume(buffer + decoder.decode());
    signal?.throwIfAborted();
    if (!terminal) throw new Error('分析结果不完整，请重试。');
    return result;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
