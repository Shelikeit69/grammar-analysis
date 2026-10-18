// Real browser execution against static hosting; every DeepSeek request is mocked.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const {demoAnalysis, demoText} = await import('../public/demo.js');
  const allowed = new Set(['index.html','styles.css','app.js','demo.js','analysis.js','deepseek.js','server-client.js']);
  const server = http.createServer(async (req, res) => {
    const name = req.url === '/grammar-analysis/' ? 'index.html' : req.url.replace('/grammar-analysis/', '');
    if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
    const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
    res.setHeader('Content-Type', `${type}; charset=utf-8`);
    res.end(await readFile(path.join(__dirname, '../public', name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  let checks = 0;
  try {
    browser = await chromium.launch({headless:true, channel:process.env.BROWSER_CHANNEL || undefined});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/grammar-analysis/`;
    const provider = 'https://api.deepseek.com/chat/completions';
    // Fail closed: a missing route handler can never make a paid request.
    await context.route('https://**/*', route => route.abort());
    await page.goto(url);
    await page.locator('#key-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#steps').isVisible(), true);
    checks++;
    const openSettings = async () => {
      if (!await page.locator('#key-panel').evaluate(node => node.open)) await page.locator('#key-panel summary').click();
    };
    await openSettings();
    await page.locator('#key-input').fill('sk-fake-browser-test');
    await page.locator('#remember-key').check();
    await page.locator('#save-key').click();
    await openSettings();
    await page.locator('#model-input').fill('test-model');
    await page.locator('#save-key').click();
    assert.equal(await page.locator('#key-state').innerText(), '已设置');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('grammar-analysis.deepseek')).apiKey), 'sk-fake-browser-test');
    await page.reload();
    await page.locator('#key-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#key-state').innerText(), '已设置');
    checks++;

    const envelope = data => ({choices:[{finish_reason:'stop',message:{content:typeof data === 'string' ? data : JSON.stringify(data)}}]});
    let calls = 0;
    let release;
    let entered;
    let secondStarted = new Promise(resolve => {entered = resolve;});
    await page.route(provider, async route => {
      calls++;
      const request = route.request();
      assert.equal(request.headers().authorization, 'Bearer sk-fake-browser-test');
      assert.equal(request.postDataJSON().model, 'test-model');
      if (calls === 1) await route.fulfill({json:envelope('{not json')});
      else {
        assert.ok(request.postDataJSON().messages.length > 2);
        await new Promise(resolve => { release = resolve; entered(); });
        await route.fulfill({json:envelope(demoAnalysis)}).catch(() => {});
      }
    });
    await page.locator('#english-input').fill(demoText);
    await page.locator('#analyze-button').click();
    await secondStarted;
    assert.match(await page.locator('#status').innerText(), /正在修正格式.*额外/);
    release();
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('已分析'));
    assert.equal(calls, 2);
    assert.equal(await page.locator('.english').allTextContents().then(parts => parts.join('')), demoText);
    checks++;
    await page.unroute(provider);

    calls = 0;
    await page.route(provider, route => {calls++; return route.fulfill({json:envelope('{}')});});
    await page.locator('#analyze-button').click();
    await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
    assert.equal(calls, 2);
    assert.equal(await page.locator('#results').isVisible(), false);
    checks++;
    await page.unroute(provider);

    for (const status of [401,402,429]) {
      calls = 0;
      await page.route(provider, route => {calls++; return route.fulfill({status, body:'{}'});});
      await page.locator('#analyze-button').click();
      await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
      assert.equal(calls, 1);
      await page.unroute(provider);
      checks++;
    }

    calls = 0;
    let finished;
    const secondFinished = new Promise(resolve => {finished = resolve;});
    secondStarted = new Promise(resolve => {entered = resolve;});
    await page.route(provider, async route => {
      calls++;
      if (calls === 1) await route.fulfill({json:envelope('{}')});
      else {
        await new Promise(resolve => {release = resolve; entered();});
        await route.fulfill({json:envelope(demoAnalysis)}).catch(() => {});
        finished();
      }
    });
    await page.locator('#analyze-button').click();
    await secondStarted;
    await page.locator('#clear-button').click();
    release();
    await secondFinished;
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('#status').innerText(), '');
    assert.equal(calls, 2);
    checks++;
    await page.unroute(provider);

    await openSettings();
    await page.evaluate(() => {
      window.originalSet = Storage.prototype.setItem;
      window.originalRemove = Storage.prototype.removeItem;
      Storage.prototype.setItem = () => {throw new DOMException('blocked', 'SecurityError');};
    });
    await page.locator('#save-key').click();
    assert.match(await page.locator('#status').innerText(), /无法更新浏览器/);
    checks++;
    await openSettings();
    await page.evaluate(() => {Storage.prototype.removeItem = () => {throw new DOMException('blocked', 'SecurityError');};});
    await page.locator('#forget-key').click();
    assert.match(await page.locator('#status').innerText(), /无法删除浏览器/);
    assert.equal(await page.locator('#key-state').innerText(), '未设置');
    checks++;
    await page.evaluate(() => {Storage.prototype.setItem = window.originalSet; Storage.prototype.removeItem = window.originalRemove;});
    await page.locator('#forget-key').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('grammar-analysis.deepseek')), null);
    await page.locator('#key-input').fill('sk-fake-session-only');
    await page.locator('#remember-key').uncheck();
    await page.locator('#save-key').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('grammar-analysis.deepseek')), null);
    await page.reload();
    await page.locator('#key-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#key-state').innerText(), '未设置');
    checks++;
    assert.deepEqual(errors, []);
    console.log(`${checks} static Pages browser checks passed; all API keys and provider responses were fake.`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error);process.exitCode = 1;});
