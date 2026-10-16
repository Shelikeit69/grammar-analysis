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
    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
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
          // a label must never sit on top of any phrase text (e.g. of the neighbouring line)
          labelOnText: rects.some(a => [...document.querySelectorAll('.english')].some(node => {
            const t = node.getBoundingClientRect();
            return a.label.left < t.right && a.label.right > t.left && a.label.top < t.bottom && a.label.bottom > t.top;
          })),
        };
      });
      assert.deepEqual(outcome, { overflow: false, aligned: true, overlap: false, labelOnText: false });
      checks++;
    }

    await checkLayout();
    assert.equal(await page.locator('.tense-name').first().innerText(), `时态：${demoAnalysis.sentences[0].tense}`);
    assert.match(await page.locator('.tense-reason').first().innerText(), /^判断依据：因为谓语是 will see/);
    checks++;
    assert.equal(await page.locator('.annotated').count(), 3);
    await page.locator('.role-predicate .english').click();
    assert.match(await page.locator('.phrase-detail').innerText(), /will \+ 动词原形/);
    // A core span has no modifies: no "修饰" note and nothing highlighted.
    assert.equal(await page.locator('.modifies-note').count(), 0);
    assert.equal(await page.locator('.modifier-target').count(), 0);
    checks++;
    await page.locator('#detail-toggle').check();
    assert.equal(await page.locator('.annotated').count(), 7);
    assert.equal(await originalText(), demoText);
    checks++;

    // Modifier highlight: click shows the target, click again or another span clears it.
    const phraseButton = text => page.locator('.annotated .english', { hasText: new RegExp(`^${text}$`) });
    const targets = () => page.locator('.modifier-target').allTextContents();
    async function checkModifier(width) {
      await page.setViewportSize({ width, height: 900 });
      assert.deepEqual(await targets(), []);
      for (const [modifier, target] of [['Tired', 'learners'], ['who keep going every day', 'learners'], ['of English grammar', 'the beauty'], ['in the end', 'will see']]) {
        await phraseButton(modifier).click();
        assert.deepEqual(await targets(), [target], `${modifier} at ${width}px`);
        assert.equal(await page.locator('.phrase-detail').isVisible(), true);
        assert.equal(await page.locator('.modifies-note').innerText(), `修饰：${target}`);
        const describedBy = await page.locator('.modifier-target').getAttribute('aria-describedby');
        assert.equal(await page.locator(`#${describedBy}`).evaluate(node => node.classList.contains('phrase-detail')), true);
        assert.equal(await phraseButton(modifier).getAttribute('aria-pressed'), 'true');
        await checkLayout();
        await phraseButton(modifier).click();
        assert.deepEqual(await targets(), [], `second click clears at ${width}px`);
        assert.equal(await page.locator('.phrase-detail').isVisible(), false);
      }
      // Switching to another span moves the highlight; a span without modifies clears it.
      await phraseButton('Tired').click();
      await phraseButton('in the end').click();
      assert.deepEqual(await targets(), ['will see']);
      await phraseButton('will see').click();
      assert.deepEqual(await targets(), []);
      assert.equal(await page.locator('.modifies-note').count(), 0);
      assert.equal(await page.locator('.phrase-detail').isVisible(), true);
      await phraseButton('will see').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await checkModifier(1280);
    checks++;
    // Keyboard: focus the span and press Enter.
    await phraseButton('Tired').focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(await targets(), ['learners']);
    await page.keyboard.press('Enter');
    assert.deepEqual(await targets(), []);
    checks++;
    // Turning detail off re-renders: no stale highlight, the target stays visible in the core view.
    await phraseButton('in the end').click();
    await page.locator('#detail-toggle').uncheck();
    assert.deepEqual(await targets(), []);
    assert.equal(await page.locator('.annotated .english', { hasText: /^will see$/ }).count(), 1);
    await page.locator('#detail-toggle').check();
    checks++;
    await checkModifier(390);
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
          { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
          { text: 'felt', role: 'linking', translation: '感到', lemma: 'feel', detail: '测试', level: 'core' },
          { text: ' ', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
          { text: 'nervous', role: 'predicative', translation: '紧张的', lemma: '', detail: '测试', level: 'core' },
          { text: '.', role: 'other', translation: '', lemma: '', detail: '', level: 'detail' },
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

    // Wrapped sentence: labels only reserve space on lines that really have them.
    const wrapSegment = (text, role, translation = '', lemma = '', level = 'core') => ({ text, role, translation, lemma, detail: '测试', level });
    const gap = () => wrapSegment(' ', 'other', '', '', 'detail');
    const wrapText = 'You can shop for items over 1,000 yen on qualifying shops with no Buyee fees.';
    const wrapResult = {
      sentences: [{
        text: wrapText, translation: '你可以选购商品。', note: '换行测试',
        segments: [
          wrapSegment('You', 'subject', '你'), gap(),
          wrapSegment('can shop for', 'predicate', '选购', 'shop for'), gap(),
          wrapSegment('items', 'object', '商品'), gap(),
          wrapSegment('over 1,000 yen', 'attribute', '超过一千日元', '', 'detail'), gap(),
          wrapSegment('on qualifying shops', 'adverbial', '在符合条件的店铺', '', 'detail'), gap(),
          wrapSegment('with no Buyee fees', 'adverbial', '没有 Buyee 费用', '', 'detail'),
          wrapSegment('.', 'other', '', '', 'detail'),
        ],
      }],
      translation: '你可以选购商品。',
    };
    await page.unroute('**/api/analyze');
    await page.route('**/api/analyze', route => route.fulfill({ json: wrapResult }));
    for (const width of [380, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#english-input').fill(wrapText);
      await page.locator('#analyze-button').click();
      await page.waitForFunction(() => !document.querySelector('#results').hidden && document.querySelectorAll('.sentence-card').length === 1 &&
        document.querySelector('.role-subject .english')?.textContent === 'You');
      await checkLayout();
      const rows = await page.evaluate(() => {
        const byTop = new Map();
        document.querySelectorAll('.annotation-line .phrase').forEach(phrase => {
          const key = Math.round(phrase.querySelector('.english').getBoundingClientRect().top);
          const row = byTop.get(key) || { top: key, hasTop: false, hasBottom: false };
          row.hasTop ||= phrase.classList.contains('has-top');
          row.hasBottom ||= phrase.classList.contains('has-bottom');
          byTop.set(key, row);
        });
        return [...byTop.values()].sort((a, b) => a.top - b.top);
      });
      assert.ok(rows.length >= 1);
      rows.slice(1).forEach((row, index) => {
        const previous = rows[index];
        // No label above this row and none below the previous one: normal text spacing.
        if (!row.hasTop && !previous.hasBottom) assert.ok(row.top - previous.top < 50, `unlabelled row gap ${row.top - previous.top}px at ${width}px`);
      });
      if (width === 380) assert.ok(rows.length > 1, 'sentence should wrap at phone width');
      checks++;
    }
    await page.unroute('**/api/analyze');
    await page.route('**/api/analyze', route => route.fulfill({ json: longResult }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#english-input').fill(longResult.sentences[0].text);
    await page.locator('#analyze-button').click();
    await page.waitForFunction(() => !document.querySelector('#results').hidden &&
      document.querySelector('.role-subject .english')?.textContent.startsWith('The extraordinarily'));

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
