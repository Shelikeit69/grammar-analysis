// Optional check: npm install --no-save --package-lock=false playwright
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

async function main() {
  const { createServer } = await import('../server.mjs');
  const { demoAnalysis, demoText } = await import('../public/demo.js');
  const server = createServer({ apiKey: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  let checks = 0;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const originalText = () => page.locator('.english').allTextContents().then(parts => parts.join(''));
    assert.equal(await originalText(), demoText);
    checks++;

    async function checkLayout() {
      assert.equal(await page.locator('#results').isVisible(), true);
      const outcome = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('.annotated')].map(node => ({
          box: node.querySelector('.english').getBoundingClientRect(),
          label: node.querySelector('.label').getBoundingClientRect(),
          line: node.querySelector('.connector').getBoundingClientRect(),
        }));
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          aligned: rects.length > 0 && rects.every(({ box, line }) => Math.abs(box.x + box.width / 2 - line.x - line.width / 2) < 1),
          overlap: rects.some((a, index) => rects.slice(index + 1).some(b =>
            a.label.left < b.label.right && a.label.right > b.label.left &&
            a.label.top < b.label.bottom && a.label.bottom > b.label.top)),
        };
      });
      assert.deepEqual(outcome, { overflow: false, aligned: true, overlap: false });
      checks++;
    }

    await checkLayout();
    await page.locator('.role-linking .english').click();
    assert.match(await page.locator('.phrase-detail').innerText(), /过去式/);
    checks++;
    await page.locator('#detail-toggle').check();
    assert.equal(await page.locator('.annotated').count(), 4);
    assert.equal(await originalText(), demoText);
    checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await checkLayout();
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#english-input').inputValue(), '');
    assert.equal(await page.locator('#results').isVisible(), false);
    checks++;
    await page.locator('#analyze-button').click();
    assert.match(await page.locator('#status').innerText(), /先输入/);
    checks++;
    await page.locator('#english-input').fill(demoText);
    await page.locator('#analyze-button').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('尚未配置'));
    checks++;

    let routeCalls = 0;
    await page.route('**/api/analyze', async route => {
      routeCalls++;
      await route.fulfill({ json: { ...demoAnalysis, sentences: [...demoAnalysis.sentences, ...demoAnalysis.sentences] } });
    });
    await page.evaluate(text => {
      const input = document.querySelector('#english-input');
      input.value = text;
      input.dispatchEvent(new Event('paste'));
      input.dispatchEvent(new Event('input'));
    }, `${demoText} ${demoText}`);
    await page.waitForFunction(() => document.querySelectorAll('.sentence-card').length === 2);
    assert.equal(routeCalls, 1);
    assert.equal(await page.locator('#paragraph-translation').isVisible(), true);
    checks++;
    await page.unroute('**/api/analyze');

    let release;
    let markStarted;
    let markFinished;
    const started = new Promise(resolve => { markStarted = resolve; });
    const finished = new Promise(resolve => { markFinished = resolve; });
    await page.route('**/api/analyze', async route => {
      await new Promise(resolve => { release = resolve; markStarted(); });
      await route.fulfill({ json: demoAnalysis }).catch(() => {});
      markFinished();
    });
    await page.locator('#analyze-button').click();
    await started;
    await page.locator('#clear-button').click();
    release();
    await finished;
    assert.equal(await page.locator('#results').isVisible(), false);
    checks++;
    await page.unroute('**/api/analyze');

    const longText = 'The extraordinarily enthusiastic people who had travelled across the entire country';
    const longResult = {
      sentences: [{
        text: `${longText} felt nervous.`, translation: '人们感到紧张。', note: '长短语排版测试',
        segments: [
          { text: longText, role: 'subject', translation: '从全国各地远道而来的特别热情的人们', lemma: '', detail: '测试', level: 'core' },
          ...demoAnalysis.sentences[0].segments.slice(3),
        ],
      }],
      translation: '人们感到紧张。',
    };
    await page.route('**/api/analyze', route => route.fulfill({ json: longResult }));
    await page.locator('#english-input').fill(longResult.sentences[0].text);
    await page.locator('#analyze-button').click();
    await page.waitForFunction(() => !document.querySelector('#results').hidden &&
      document.querySelector('.role-subject .english')?.textContent.startsWith('The extraordinarily'));
    await checkLayout();

    // A wrapped phrase next to a short word must keep the same first-line baseline.
    const baseline = await page.evaluate(() => {
      const line = document.querySelector('.annotation-line');
      line.style.width = '310px';
      const items = [...line.querySelectorAll('.phrase')];
      items.slice(2).forEach(node => node.remove());
      items[0].style.width = '140px';
      items[0].querySelector('.english').textContent = 'All the very nervous people';
      items[1].classList.remove('whitespace');
      items[1].querySelector('.english').textContent = 'felt';
      return items.slice(0, 2).map(node => node.querySelector('.english').getBoundingClientRect().top);
    });
    assert.ok(Math.abs(baseline[0] - baseline[1]) < 1);
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(`${checks} browser checks passed; no live DeepSeek calls.`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
