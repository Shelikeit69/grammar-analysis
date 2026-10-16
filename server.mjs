import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateInput } from './lib/analysis.mjs';
import { analyzeWithDeepSeek } from './lib/deepseek.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/demo.js', ['demo.js', 'text/javascript; charset=utf-8']],
]);

export function createApp({
  apiKey = process.env.DEEPSEEK_API_KEY,
  model = process.env.DEEPSEEK_MODEL || 'deepseek-flash',
  fetchImpl = globalThis.fetch,
  analyze = analyzeWithDeepSeek,
  maxConcurrent = 1,
  timeoutMs = 45000,
} = {}) {
  let active = 0;
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send = (status, value) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };

    const host = req.headers.host;
    const expected = `127.0.0.1:${req.socket.localPort}`;
    if (host !== expected && host !== `localhost:${req.socket.localPort}`) {
      send(403, { error: '不允许的访问来源。' });
      return;
    }
    if (req.headers.origin && req.headers.origin !== `http://${host}`) {
      send(403, { error: '不允许的访问来源。' });
      return;
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') {
      send(403, { error: '不允许的访问来源。' });
      return;
    }
    if (req.method === 'GET' && req.url === '/api/status') {
      send(200, { configured: !!apiKey?.trim() });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/analyze') {
      if (!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type'] || '')) {
        send(415, { error: '请求必须使用 JSON。' });
        return;
      }
      if (active >= maxConcurrent) {
        send(429, { error: '正在分析，请稍后重试。' });
        return;
      }
      active++;
      const controller = new AbortController();
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.once('close', cancel);
      try {
        let bytes = 0;
        const chunks = [];
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 32000) {
            send(413, { error: '输入过长。' });
            return;
          }
          chunks.push(chunk);
        }
        let text;
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          text = validateInput(body?.text);
        } catch {
          send(400, { error: '请输入有效文本：最多 300 个英文单词、6000 个字符。' });
          return;
        }
        if (!apiKey?.trim()) {
          send(503, { error: '尚未配置 DeepSeek API Key，请在本地 .env 中配置后重启。' });
          return;
        }
        try {
          controller.signal.throwIfAborted();
          const result = await analyze(text, { apiKey, model, fetchImpl, timeoutMs, signal: controller.signal });
          send(200, result);
        } catch {
          send(502, { error: '分析暂时失败，请稍后重试。' });
        }
      } catch {
        if (!res.headersSent) send(400, { error: '无法读取请求。' });
      } finally {
        res.off('close', cancel);
        active--;
      }
      return;
    }

    if (req.method === 'GET' && assets.has(req.url)) {
      const [file, type] = assets.get(req.url);
      try {
        const content = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        res.end(content);
      } catch {
        send(404, { error: '页面不存在。' });
      }
      return;
    }
    send(404, { error: '页面不存在。' });
  };
}

export function createServer(options) {
  const server = http.createServer(createApp(options));
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }
  createServer().listen(port, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${port}`));
}
