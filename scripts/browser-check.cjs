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
      assert.ok(await page.locator('.annotated').evaluateAll(nodes => nodes.every(node => {
        const bottom = ['attribute','adverbial','complement'].some(role => node.classList.contains('role-' + role));
        const label = node.querySelector('.label').getBoundingClientRect();
        const english = node.querySelector('.english').getBoundingClientRect();
        return bottom ? label.top >= english.bottom : label.bottom <= english.top;
      })), 'role determines label position, including subordinate constituents');
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

    assert.ok(await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = hex => hex.trim().slice(1).match(/../g).map(x => parseInt(x,16)/255)
        .map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
        .reduce((sum,x,i) => sum+x*[.2126,.7152,.0722][i],0);
      const paper = luminance(style.getPropertyValue('--paper'));
      return ['subject','predicate','object','adverbial','attribute','complement','error'].every(name =>
        (paper+.05)/(luminance(style.getPropertyValue('--'+name))+.05) >= 4.5);
    }), 'small role labels have 4.5:1 contrast on paper');
    await checkLayout();
    assert.equal(await page.locator('.tense-name').first().innerText(), `时态：${demoAnalysis.sentences[0].tense}`);
    assert.equal(await page.locator('.tense-reason').first().innerText(), '判断依据：' + demoAnalysis.sentences[0].tenseReason);
    checks++;
    await page.locator('.annotated .english').first().click();
    assert.ok((await page.locator('.phrase-detail').innerText()).includes(demoAnalysis.sentences[0].segments.find(part => part.role !== 'other' && part.level === 'core').detail));
    // A core span has no modifies: no "修饰" note and nothing highlighted.
    assert.equal(await page.locator('.modifies-note').count(), 0);
    assert.equal(await page.locator('.modifier-target').count(), 0);
    checks++;
    await page.locator('#detail-toggle').check();
    assert.equal(await page.locator('.annotated').count(), demoAnalysis.sentences[0].segments.filter(part => part.role !== 'other').length);
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
    // Pasting only fills the box: no timer, no request until the button is clicked.
    await page.waitForTimeout(700);
    assert.equal(routeCalls, 0);
    assert.equal(await page.locator('#results').isVisible(), false);
    await page.locator('#analyze-button').click();
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

    // Inline corrections render from normalized model output. These fixtures
    // prove display and cleanup, not live model accuracy.
    const correctionText = 'The contents of the box is very unique, so please handles them with care.';
    const correctionSeg = (text, role, translation = '', lemma = '', level = 'core') => ({ text, role, translation, lemma, detail: '测试', level });
    const correctionGap = () => correctionSeg(' ', 'other', '', '', 'detail');
    const isStart = correctionText.indexOf('is');
    const handlesStart = correctionText.indexOf('handles');
    const correctionFixture = {
      sentences: [{
        text: correctionText, translation: '盒子里的东西非常独特，请小心拿放。', note: '纠错测试',
        segments: [
          correctionSeg('The contents', 'subject', '内容'),
          correctionGap(),
          correctionSeg('of the box', 'attribute', '盒子里的', '', 'detail'),
          correctionGap(),
          correctionSeg('is', 'linking', '是', 'be'),
          correctionGap(),
          correctionSeg('very unique', 'predicative', '非常独特'),
          correctionSeg(', so ', 'other', '', '', 'detail'),
          correctionSeg('please', 'adverbial', '请', '', 'detail'),
          correctionGap(),
          correctionSeg('handles', 'predicate', '拿放', 'handle'),
          correctionGap(),
          correctionSeg('them', 'object', '它们'),
          correctionGap(),
          correctionSeg('with care', 'adverbial', '小心地', '', 'detail'),
          correctionSeg('.', 'other', '', '', 'detail'),
        ],
        corrections: [
          { start: isStart, end: isStart + 2, text: 'is', fix: 'are', reason: '主语 The contents 是复数，系动词应用 are。' },
          { start: handlesStart, end: handlesStart + 7, text: 'handles', fix: 'handle', reason: '祈使句 please 后要用动词原形 handle。' },
        ],
      }],
      translation: '盒子里的东西非常独特，请小心拿放。',
    };
    const plainText = 'The cat sat on the mat, so it was happy.';
    const plainFixture = {
      sentences: [{
        text: plainText, translation: '猫坐在垫子上，所以它很开心。', note: '标点与普通文字测试',
        segments: [
          correctionSeg('The', 'attribute', '这', '', 'detail'),
          correctionGap(),
          correctionSeg('cat', 'subject', '猫'),
          correctionGap(),
          correctionSeg('sat', 'predicate', '坐', 'sit'),
          correctionGap(),
          correctionSeg('on the mat', 'adverbial', '在垫子上', '', 'detail'),
          correctionSeg(', so ', 'other', '', '', 'detail'),
          correctionSeg('it', 'subject', '它'),
          correctionGap(),
          correctionSeg('was', 'linking', '是', 'be'),
          correctionGap(),
          correctionSeg('happy', 'predicative', '开心'),
          correctionSeg('.', 'other', '', '', 'detail'),
        ],
        corrections: [
          { start: plainText.indexOf('so'), end: plainText.indexOf('so') + 2, text: 'so', fix: 'and', reason: '测试普通文字' },
          { start: plainText.length - 1, end: plainText.length, text: '.', fix: '?', reason: '测试标点' },
        ],
      }],
      translation: '猫坐在垫子上，所以它很开心。',
    };
    const mainExpected = {
      texts: ['is', 'handles'], fixes: ['are', 'handle'],
      items: ['is → are：主语 The contents 是复数，系动词应用 are。', 'handles → handle：祈使句 please 后要用动词原形 handle。'],
    };
    const plainExpected = {
      texts: ['so', '.'], fixes: ['and', '?'], plain: [true, true],
      items: ['so → and：测试普通文字', '. → ?：测试标点'],
    };
    async function showCorrectionFixture(fixture, detailed) {
      await page.unroute('**/api/analyze');
      await page.route('**/api/analyze', route => route.fulfill({ json: fixture }));
      await page.locator('#detail-toggle').setChecked(detailed);
      await page.locator('#english-input').fill(fixture.sentences[0].text);
      await page.locator('#analyze-button').click();
      await page.waitForFunction(text => !document.querySelector('#results').hidden &&
        [...document.querySelectorAll('.english')].map(node => node.textContent).join('') === text, fixture.sentences[0].text);
      await page.waitForTimeout(140);
    }
    async function checkCorrections(expected) {
      const marks = await page.evaluate(() => [...document.querySelectorAll('.correction-mark')].map(node => {
        const rect = node.getBoundingClientRect();
        const box = node.closest('.english').getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          text: node.textContent, width: rect.width,
          inside: rect.left >= box.left - 1 && rect.right <= box.right + 1 &&
            rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1,
          line: style.textDecorationLine, decoration: style.textDecorationStyle,
          plain: node.closest('.phrase')?.classList.contains('plain'),
        };
      }));
      assert.ok(marks.every(mark => /\S/.test(mark.text)), 'whitespace has no correction mark');
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('.correction-effect .correction-original')]
        .every(node => node.nextSibling?.nodeType === Node.TEXT_NODE && node.nextSibling.textContent === ' ')),
        'summary uses a plain space between original and fix');
      assert.deepEqual(marks.map(mark => mark.text), expected.texts, 'wavy positions');
      const letters = await page.locator('.annotation-line .correction-letter').evaluateAll(nodes => nodes.map(node => node.dataset.letter));
      assert.deepEqual(letters, await page.locator('.correction-item .correction-letter').evaluateAll(nodes => nodes.map(node => node.dataset.letter)));
      assert.equal(letters.length, expected.items.length);
      assert.deepEqual(letters, expected.items.map((_, i) => String.fromCharCode(97 + i)));
      assert.ok(await page.locator('.correction-letter').evaluateAll(nodes => nodes.every(node => node.getAttribute('aria-hidden') === 'true')));
      assert.ok(await page.locator('.correction-mark').evaluateAll(nodes => nodes.every(node => {
        const root = getComputedStyle(document.documentElement);
        const probe = document.createElement('span');
        document.body.append(probe);
        probe.style.color = root.getPropertyValue('--error');
        const error = getComputedStyle(probe).color;
        probe.style.color = root.getPropertyValue('--predicate');
        const predicate = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(node).textDecorationColor === error && error !== predicate;
      })), 'wavy correction uses error color');
      await checkLayout();
      for (const mark of marks) {
        assert.ok(mark.width > 0, `${mark.text} has width`);
        assert.equal(mark.inside, true, `${mark.text} stays inside its phrase`);
        assert.ok(mark.line.includes('underline'), `${mark.text} underline`);
        assert.equal(mark.decoration, 'wavy', `${mark.text} wavy`);
      }
      if (expected.plain) assert.deepEqual(marks.map(mark => mark.plain), expected.plain, 'plain text marks');
      assert.equal(await page.locator('.correction-summary').count(), 1);
      assert.match(await page.locator('.correction-summary').innerText(), /^纠错：/);
      const style = await page.evaluate(() => ({
        original: [...document.querySelectorAll('.correction-effect .correction-original')].map(node => ({
          text: node.textContent, line: getComputedStyle(node).textDecorationLine,
        })),
        fix: [...document.querySelectorAll('.correction-effect .correction-fix')].map(node => ({
          text: node.textContent, weight: getComputedStyle(node).fontWeight, line: getComputedStyle(node).textDecorationLine,
        })),
      }));
      assert.deepEqual(style.original.map(item => item.text), expected.texts, 'summary originals');
      assert.ok(style.original.every(item => item.line.includes('line-through')), 'summary originals are struck through');
      assert.deepEqual(style.fix.map(item => item.text), expected.fixes, 'summary fixes');
      assert.ok(style.fix.every(item => Number(item.weight) >= 600 && item.line.includes('underline')), 'fixes are bold and underlined');
      assert.deepEqual(await page.locator('.correction-item').allTextContents(), expected.items, 'correction list');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    }

    await page.setViewportSize({ width: 1280, height: 1000 });
    await showCorrectionFixture(correctionFixture, true);
    await checkCorrections(mainExpected);
    await page.locator('#detail-toggle').uncheck();
    await page.waitForTimeout(180);
    await checkCorrections(mainExpected);
    await page.locator('#detail-toggle').check();
    await page.waitForTimeout(180);
    checks++;
    // A correction on a comma-adjacent plain word and on the final punctuation
    // must still draw at the right character positions.
    await showCorrectionFixture(plainFixture, false);
    await checkCorrections(plainExpected);
    checks++;
    const crossing = structuredClone(correctionFixture);
    crossing.sentences[0].corrections = [{start:isStart, end:handlesStart + 7,
      text:correctionText.slice(isStart, handlesStart + 7), fix:'are ready', reason:'跨片段测试'}];
    await showCorrectionFixture(crossing, true);
    assert.equal(await page.locator('.correction-mark').evaluateAll(nodes =>
      nodes.some(node => !node.textContent.trim())), false, 'cross-segment whitespace remains unmarked');

    // A sentence without corrections keeps the exact previous DOM.
    await showCorrectionFixture(demoAnalysis, true);
    assert.equal(await page.locator('.correction-summary').count(), 0, 'no correction line');
    assert.equal(await page.locator('.correction-mark').count(), 0, 'no wavy marks');
    checks++;
    // View, large-text, phone width, re-analyze and clear leave no residue.
    await page.setViewportSize({ width: 390, height: 844 });
    await showCorrectionFixture(correctionFixture, true);
    await checkCorrections(mainExpected);
    await page.locator('#text-size').click();
    await page.waitForTimeout(220);
    await checkCorrections(mainExpected);
    await page.locator('#detail-toggle').uncheck();
    await page.waitForTimeout(160);
    await checkCorrections(mainExpected);
    await page.locator('#detail-toggle').check();
    await page.waitForTimeout(160);
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('.correction-summary').count(), 0, 'clear drops correction line');
    assert.equal(await page.locator('.correction-mark').count(), 0, 'clear drops wavy marks');
    await showCorrectionFixture(correctionFixture, true);
    await checkCorrections(mainExpected);
    await showCorrectionFixture(demoAnalysis, true);
    assert.equal(await page.locator('.correction-summary').count(), 0, 'sentence switch drops correction line');
    assert.equal(await page.locator('.correction-mark').count(), 0, 'sentence switch drops wavy marks');
    await page.locator('#text-size').click();
    await page.waitForTimeout(220);
    await page.setViewportSize({ width: 390, height: 844 });
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


    // Mocked provider output exercises both separated predicates, preserving order and selection.
    const { separated } = await import('../tests/fixtures/predicate.mjs');
    for (const turnOff of [false, true]) {
     for (const emptyHead of [false, true]) {
      const fixture = separated(turnOff);
      const head = fixture.sentences[0].segments[2];
      const particle = fixture.sentences[0].segments[6];
      particle.detail = turnOff ? 'off 与前面的 turned 构成短语动词 turn off。' : 'up 与前面的 give 构成短语动词 give up。';
      if (emptyHead) head.detail = '';
      await page.unroute('**/api/analyze');
      await page.route('**/api/analyze', route => route.fulfill({json: fixture}));
      await page.locator('#english-input').fill(fixture.sentences[0].text);
      await page.locator('#analyze-button').click();
      await page.waitForFunction(text => !document.querySelector('#results').hidden && [...document.querySelectorAll('.english')].map(n => n.textContent).join('') === text, fixture.sentences[0].text);
      for (const width of [1280, 390]) {
        await page.setViewportSize({width, height: 900});
        for (const detailed of [false, true]) {
          await page.locator('#detail-toggle').setChecked(detailed);
          assert.equal(await originalText(), fixture.sentences[0].text);
          assert.deepEqual(await page.locator('.role-predicate .english').allTextContents(), turnOff ? ['turned', 'off'] : ['should give', 'up']);
          assert.deepEqual(await page.locator('.role-object .english').allTextContents(), [turnOff ? 'the light' : 'it']);
          assert.match(await page.locator('.role-predicate .label').first().innerText(), turnOff ? /谓语：turn off－关掉/ : /谓语：give up－放弃/);
          assert.equal(await page.locator('.role-predicate .label').last().innerText(), turnOff ? '谓语组成部分：与 turn 构成 turn off' : '谓语组成部分：与 give 构成 give up');
          for (const word of turnOff ? ['turned', 'off'] : ['should give', 'up']) {
            await phraseButton(word).click();
            const explanation = await page.locator('.phrase-detail').innerText();
            assert.match(explanation, turnOff ? /turned…off 是同一谓语/ : /should give…up 是同一谓语/);
            assert.match(explanation, turnOff ? /the light 是宾语/ : /it 是宾语/);
            if (!turnOff && !emptyHead) assert.match(explanation, /should 表示应该/);
            const expectedDetail = emptyHead ? particle.detail : head.detail;
            assert.equal(explanation.split(expectedDetail).length - 1, 1);
            if (!emptyHead) assert.ok(!explanation.includes(particle.detail));
            assert.equal(explanation, `${turnOff ? 'turned…off 是同一谓语；turn off－关掉。the light' : 'should give…up 是同一谓语；give up－放弃。it'} 是宾语。${expectedDetail}`);
            assert.equal(await page.locator('[aria-pressed="true"].english').count(), 1);
            assert.equal(await page.locator('.modifier-target').count(), 0);
            await phraseButton(word).click();
          }
          await checkLayout();
          checks++;
        }
      }
     }
    }

    await page.unroute('**/api/analyze');
    await page.route('**/api/analyze', route => route.fulfill({json: longResult}));
    await page.locator('#english-input').fill(longResult.sentences[0].text);
    await page.locator('#analyze-button').click();
    await page.waitForFunction(() => !document.querySelector('#results').hidden && document.querySelector('.role-subject .english')?.textContent.startsWith('The extraordinarily'));
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

    // Clause list and range brackets (PR 2). Fixtures are mocked models; they
    // prove rendering and validation, not live model behaviour.
    const clauseFixtures = await import('../tests/fixtures/clauses.mjs');
    const clauseLabel = clause => clause.type === 'relative' ? '定语从句'
      : clause.type === 'object' ? '宾语从句'
      : `${({time:'时间',condition:'条件',reason:'原因',concession:'让步',purpose:'目的',result:'结果',comparison:'比较',manner:'方式'})[clause.subtype] || ''}状语从句`;
    const clauseText = sentence => clause =>
      sentence.segments.slice(clause.start, clause.end).map(part => part.text).join('');

    async function showClauseFixture(fixture, detailed = true) {
      await page.unroute('**/api/analyze');
      await page.route('**/api/analyze', route => route.fulfill({json: fixture}));
      await page.locator('#detail-toggle').setChecked(detailed);
      await page.locator('#english-input').fill(fixture.sentences[0].text);
      await page.locator('#analyze-button').click();
      await page.waitForFunction(text => !document.querySelector('#results').hidden &&
        [...document.querySelectorAll('.english')].map(node => node.textContent).join('') === text, fixture.sentences[0].text);
      await page.waitForTimeout(260);
    }

    async function clauseGeometry(fixture, targetText) {
      return page.evaluate(({clauses, segmentTexts, target}) => {
        const line = document.querySelector('.annotation-line');
        const lineRect = line.getBoundingClientRect();
        const rel = rect => ({left: rect.left - lineRect.left, right: rect.right - lineRect.left,
          top: rect.top - lineRect.top, bottom: rect.bottom - lineRect.top});
        const glyphs = node => {
          if (!node?.firstChild) return [];
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].filter(rect => rect.width > .5 && rect.height > .5);
        };
        const groupRows = rects => {
          const rows = [];
          rects.forEach(rect => {
            const center = (rect.top + rect.bottom) / 2;
            const row = rows.find(candidate => Math.abs(center - candidate.center) < 9);
            if (row) {
              row.top = Math.min(row.top, rect.top);
              row.bottom = Math.max(row.bottom, rect.bottom);
              row.left = Math.min(row.left, rect.left);
              row.right = Math.max(row.right, rect.right);
              row.center = (row.top + row.bottom) / 2;
            } else {
              rows.push({center, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right});
            }
          });
          return rows.sort((a, b) => a.top - b.top)
            .map(row => ({top: row.top - lineRect.top, bottom: row.bottom - lineRect.top,
              left: row.left - lineRect.left, right: row.right - lineRect.left}));
        };
        const nodes = [...line.querySelectorAll('.english')];
        const allText = nodes.flatMap(glyphs);
        const labels = [...line.querySelectorAll('.label')].map(node => node.getBoundingClientRect());
        const overlaps = (box, rect) => box.left < rect.right && box.right > rect.left && box.top < rect.bottom && box.bottom > rect.top;
        // A range ends with 4px end ticks below the hairline. Measure the drawn
        // band, not just the 1.5px border box, so the ticks count as a collision.
        const probe = document.createElement('span');
        probe.className = 'clause-probe';
        line.append(probe);
        const zoom = probe.getBoundingClientRect().width / 1000 || 1;
        probe.remove();
        const tickBox = box => ({left: box.left, right: box.right, top: box.top, bottom: box.bottom + 4 * zoom});
        const tracks = [...line.querySelectorAll('.clause-track')].map(node => {
          const box = node.getBoundingClientRect();
          const band = tickBox(box);
          return {clause: Number(node.dataset.clause), depth: Number(node.dataset.depth), rect: rel(box), drawn: rel(band),
            textHit: allText.some(text => overlaps(band, text)), labelHit: labels.some(label => overlaps(band, label))};
        });
        const marks = [...line.querySelectorAll('.clause-mark')].map(node => {
          const box = node.getBoundingClientRect();
          const rect = rel(box);
          return {clause: Number(node.textContent), depth: Number(node.parentElement ? node.dataset.depth : 0), rect,
            textHit: allText.some(text => overlaps(box, text)), labelHit: labels.some(label => overlaps(box, label))};
        });
        const perClause = clauses.map(clause => {
          const rects = [];
          for (let index = clause.start; index < clause.end; index += 1) {
            if (nodes[index] && /[\p{L}\p{N}]/u.test(segmentTexts[index])) rects.push(...glyphs(nodes[index]));
          }
          const rows = groupRows(rects);
          return {
            left: rows.length ? Math.min(...rows.map(row => row.left)) : 0,
            right: rows.length ? Math.max(...rows.map(row => row.right)) : 0,
            rows,
          };
        });
        const layer = line.querySelector('.clause-layer');
        const targetNode = target ? nodes.find(node => node.textContent === target) : null;
        const card = line.closest('.sentence-card');
        const tailBoxes = [...(card?.querySelectorAll('.clause-panel, .structure-note, .translation-row, .report-button') || [])]
          .map(node => node.getBoundingClientRect());
        const tailHit = [...line.querySelectorAll('.clause-track, .clause-mark')].some(node => {
          const box = node.getBoundingClientRect();
          const band = node.classList.contains('clause-track') ? tickBox(box) : box;
          return tailBoxes.some(other => overlaps(band, other));
        });
        return {
          width: lineRect.width, height: lineRect.height,
          rows: groupRows(allText), tracks, marks, perClause,
          targetRows: targetNode ? groupRows(glyphs(targetNode)).length : 0,
          rowHeight: parseFloat(getComputedStyle(targetNode || nodes.find(node => node)).fontSize) * 2,
          appliedRowHeight: line.style.getPropertyValue('--clause-row-height').trim(),
          tailHit,
          panel: [...document.querySelectorAll('.clause-item')].map(node => ({
            number: node.querySelector('.clause-number')?.textContent,
            type: node.querySelector('.clause-type')?.textContent,
            text: node.querySelector('.clause-text')?.textContent,
            note: node.querySelector('.clause-note')?.textContent || '',
          })),
          panelTitle: document.querySelector('.clause-panel-title')?.textContent,
          overflow: document.documentElement.scrollWidth > innerWidth,
          layerHidden: layer ? layer.getAttribute('aria-hidden') === 'true' : true,
          pointerNone: layer ? getComputedStyle(layer).pointerEvents === 'none' : true,
          focusable: [...(layer?.querySelectorAll('*') || [])].some(node => node.tabIndex >= 0),
          markOverlap: marks.some((mark, index) => marks.slice(index + 1).some(other =>
            mark.rect.left < other.rect.right && mark.rect.right > other.rect.left &&
            mark.rect.top < other.rect.bottom && mark.rect.bottom > other.rect.top)),
          trackTextHit: tracks.some(track => track.textHit),
          trackLabelHit: tracks.some(track => track.labelHit),
          markTextHit: marks.some(mark => mark.textHit),
          markLabelHit: marks.some(mark => mark.labelHit),
        };
      }, {clauses: fixture.sentences[0].clauses, segmentTexts: fixture.sentences[0].segments.map(part => part.text), target: targetText || ''});
    }

    async function checkClauseFixture(name, fixture, expectedDepths) {
      const sentence = fixture.sentences[0];
      const expected = sentence.clauses.map(clause => ({
        number: String(sentence.clauses.indexOf(clause) + 1),
        type: clauseLabel(clause),
        text: clauseText(sentence)(clause),
        spans: sentence.segments.slice(clause.start, clause.end).filter(part => /[\p{L}\p{N}]/u.test(part.text)).length,
      }));
      const geometry = await clauseGeometry(fixture);
      assert.deepEqual(geometry.panel.map(item => [item.number, item.type, item.text]),
        expected.map(item => [item.number, item.type, item.text]), `${name} panel`);
      assert.equal(geometry.panelTitle, '从句清单');
      assert.ok(await page.locator('.clause-number,.clause-mark').evaluateAll(nodes => nodes.every(node => {
        const style = getComputedStyle(node);
        return parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle === 'solid' && parseFloat(style.borderRadius) <= 1 && style.color === 'rgb(85, 85, 85)';
      })), 'clause numbers use square gray borders');
      assert.equal(geometry.overflow, false, `${name} overflow`);
      assert.equal(geometry.layerHidden, true, `${name} layer hidden`);
      assert.equal(geometry.pointerNone, true, `${name} pointer-events`);
      assert.equal(geometry.focusable, false, `${name} tab order`);
      assert.equal(geometry.trackTextHit, false, `${name} track on text`);
      assert.equal(geometry.trackLabelHit, false, `${name} track on label`);
      assert.equal(geometry.markTextHit, false, `${name} number on text`);
      assert.equal(geometry.markLabelHit, false, `${name} number on label`);
      assert.equal(geometry.markOverlap, false, `${name} numbers overlap`);
      assert.deepEqual([...new Set(geometry.tracks.map(track => track.depth))].sort(), expectedDepths, `${name} depths`);
      for (const [index, clause] of expected.entries()) {
        const own = geometry.tracks.filter(track => track.clause === index + 1);
        if (clause.spans < 2) {
          assert.equal(own.length, 0, `${name} single-span clause draws no line`);
          assert.match(geometry.panel[index].note, /单片段短从句/, `${name} single-span note`);
          continue;
        }
        assert.ok(own.length >= geometry.perClause[index].rows.length, `${name} clause ${index + 1} line per text row`);
        for (const track of own) {
          assert.ok(track.rect.left >= geometry.perClause[index].left - 1.5 && track.rect.right <= geometry.perClause[index].right + 1.5,
            `${name} clause ${index + 1} line stays on its text`);
          assert.ok(track.rect.left >= -1 && track.rect.right <= geometry.width + 1 &&
            track.rect.top >= -1 && track.rect.bottom <= geometry.height + 1, `${name} line inside card`);
          const rows = geometry.perClause[index].rows
            .filter(candidate => track.rect.left >= candidate.left - 1.5 && track.rect.right <= candidate.right + 1.5);
          assert.ok(rows.length >= 1, `${name} clause ${index + 1} line matches its text row`);
          assert.ok(rows.some(candidate => track.rect.top > candidate.bottom),
            `${name} clause ${index + 1} line sits below its text row`);
          const mark = geometry.marks.find(candidate => candidate.clause === track.clause &&
            Math.abs((candidate.rect.top + candidate.rect.bottom) / 2 - track.rect.top) < 1.5);
          assert.ok(mark, `${name} clause ${index + 1} number matches its line`);
        }
        assert.equal(geometry.marks.filter(mark => mark.clause === index + 1).length, own.length,
          `${name} one number per line, not one list per row`);
      }
      checks++;
    }

    const fixtures = [
      ['conditional', clauseFixtures.conditional(), [1]],
      ['object', clauseFixtures.objectClause(), [1]],
      ['object-backbone', clauseFixtures.objectBackbone(), [1, 2]],
      ['nested', clauseFixtures.nestedRelative(), [1, 2]],
      ['three', clauseFixtures.nestedThree(), [1, 2, 3]],
      ['long-text-anchors', clauseFixtures.longTextAnchors(), [1, 2, 3]],
      ['same-end', clauseFixtures.sameEnd(), [1, 2]],
      ['adjacent', clauseFixtures.adjacentObjects(), [1]],
    ];
    for (const [name, fixture, depths] of fixtures) {
      await page.setViewportSize({width: 1280, height: 1000});
      await showClauseFixture(fixture, true);
      await checkClauseFixture(name, fixture, depths);
      if (name === 'object-backbone') {
        assert.deepEqual(await page.locator('.clause-item .clause-type').allTextContents(), ['宾语从句', '时间状语从句']);
      }
      // Count clause items in detailed view before switching to default.
      const clauseItemCount = await page.locator('.clause-item').count();
      // The core view hides detail spans and all brackets, but shows a clause count hint.
      await page.locator('#detail-toggle').uncheck();
      await page.waitForTimeout(120);
      const core = fixture.sentences[0].segments.filter(part => part.role !== 'other' && part.level === 'core');
      assert.equal(await page.locator('.clause-panel').count(), 0, `${name} core panel`);
      assert.equal(await page.locator('.clause-track').count(), 0, `${name} core tracks`);
      assert.equal(await page.locator('.clause-hint').count(), clauseItemCount > 0 ? 1 : 0, `${name} core clause hint`);
      if (clauseItemCount > 0) {
        assert.match(await page.locator('.clause-hint').innerText(), new RegExp(`这句有 ${clauseItemCount} 个从句`), `${name} hint count`);
        // Position assertion: hint is below the last .english and above .translation-row.
        const positionCheck = await page.evaluate(() => {
          const hint = document.querySelector('.clause-hint');
          const englishNodes = document.querySelectorAll('.english');
          const translationRow = document.querySelector('.translation-row');
          if (!hint || !englishNodes.length || !translationRow) return null;
          const lastEnglish = englishNodes[englishNodes.length - 1];
          const hintBox = hint.getBoundingClientRect();
          const englishBox = lastEnglish.getBoundingClientRect();
          const translationBox = translationRow.getBoundingClientRect();
          return {
            hintTop: hintBox.top,
            englishBottom: englishBox.bottom,
            translationTop: translationBox.top,
          };
        });
        assert.ok(positionCheck, 'missing clause hint position');
        assert.ok(positionCheck.hintTop > positionCheck.englishBottom, `${name} hint below last english`);
        assert.ok(positionCheck.hintTop < positionCheck.translationTop, `${name} hint above translation`);
      }
      assert.equal(await page.locator('.annotated').count(), core.length, `${name} core spans`);
      assert.deepEqual(await page.locator('.role-subject.annotated .english').allTextContents(),
        core.filter(part => part.role === 'subject').map(part => part.text), `${name} core subject`);
      if (name === 'object-backbone') {
        assert.deepEqual(await page.locator('.annotated .english').allTextContents(), ['I', 'know', 'she', 'was working']);
      }
      if (name === 'long-text-anchors') {
        assert.deepEqual(await page.locator('.annotated .english').allTextContents(), ['Our town', 'has', 'a new library']);
      }
      await page.locator('#detail-toggle').check();
      await page.waitForTimeout(260);
      assert.equal(await page.locator('.clause-hint').count(), 0, `${name} detailed hint`);
      await checkClauseFixture(name, fixture, depths);
    }

    // Form fixture: labels show structural type and post-position marker.
    const formFixture = clauseFixtures.withForm();
    await showClauseFixture(formFixture, true);
    const allLabels = await page.locator('.annotated .label').allTextContents();
    // 'In the morning' is adverbial/prep; adverbial never gets （后置）
    assert.ok(allLabels.some(text => text.includes('状语 · 介词短语') && !text.includes('（后置）')), 'adverbial with form has no 后置');
    // 'to finish the work' is attribute/to-inf modifying 'plan' at index 5; it is at index 7, so 5 < 7 → （后置）
    assert.ok(allLabels.some(text => text.includes('定语 · 不定式（后置）')), 'post-positioned attribute has form with 后置');
    checks++;
    // Click 'to finish the work' and check phrase-detail shows form type
    const formPhraseButton = text => page.locator('.annotated .english', { hasText: new RegExp(`^${text}$`) });
    await formPhraseButton('to finish the work').click();
    assert.ok((await page.locator('.phrase-detail').innerText()).includes('定语 · 不定式（后置）'), 'phrase-detail shows form type on click');
    checks++;
    // Old fixtures without form stay unchanged.
    await showClauseFixture(clauseFixtures.conditional(), true);
    const oldLabels = await page.locator('.annotated .label').allTextContents();
    assert.ok(oldLabels.every(text => !text.includes('· ')), 'old fixture labels have no form separator');
    checks++;
    // Form without modifies: attribute + form but no modifies → no （后置）
    const noModifiesFixture = clauseFixtures.withFormNoModifies();
    await showClauseFixture(noModifiesFixture, true);
    const noModifiesLabels = await page.locator('.annotated .label').allTextContents();
    assert.ok(noModifiesLabels.some(text => text.includes('定语 · 介词短语') && !text.includes('（后置）')), 'attribute with form but no modifies has no 后置');
    checks++;

    // Width, phone and large-text changes re-measure the same ranges.
    const nested = clauseFixtures.nestedRelative();
    await showClauseFixture(nested, true);
    for (const width of [900, 390, 380]) {
      await page.setViewportSize({width, height: 900});
      await page.waitForTimeout(220);
      const geometry = await clauseGeometry(nested);
      assert.equal(geometry.tracks.some(track => track.textHit || track.labelHit), false, `no overlap at ${width}px`);
      assert.ok(geometry.tracks.filter(track => track.clause === 1).length >= 2, `outer clause wraps per row at ${width}px`);
      assert.equal(geometry.tracks.filter(track => track.clause === 2).length,
        geometry.perClause[1].rows.length, `inner clause numbers match rows at ${width}px`);
      await checkClauseFixture(`nested-${width}`, nested, [1, 2]);
    }
    await page.locator('#text-size').click();
    await page.waitForTimeout(260);
    await page.setViewportSize({width: 1280, height: 1000});
    await page.waitForTimeout(220);
    await checkClauseFixture('nested-large-text', nested, [1, 2]);
    await page.locator('#text-size').click();
    await page.waitForTimeout(220);

    // A single legal span that wraps inside itself still gets one lane per
    // visual row. longAdverbialSpan() is a rendering fixture, not a claim that
    // the live model produces this split.
    const longSpan = clauseFixtures.longAdverbialSpan();
    const longTarget = longSpan.sentences[0].segments[16].text;
    async function checkWrappedSpan(label, expectWrap) {
      const sentence = longSpan.sentences[0];
      const geometry = await clauseGeometry(longSpan, longTarget);
      assert.ok(geometry.rows.length >= 2, `${label}: the line has several text rows`);
      if (expectWrap) assert.ok(geometry.targetRows >= 2, `${label}: one span breaks inside itself (${geometry.targetRows} rows)`);
      assert.deepEqual([...new Set(geometry.tracks.map(track => track.depth))].sort((a, b) => a - b), [1, 2, 3],
        `${label}: three lanes`);
      for (const [name, value] of Object.entries({
        trackTextHit: geometry.trackTextHit, trackLabelHit: geometry.trackLabelHit,
        markTextHit: geometry.markTextHit, markLabelHit: geometry.markLabelHit,
        markOverlap: geometry.markOverlap, tailHit: geometry.tailHit, overflow: geometry.overflow,
      })) assert.equal(value, false, `${label}: ${name}`);
      if (geometry.targetRows >= 2) {
        assert.ok(parseFloat(geometry.appliedRowHeight) >= geometry.rowHeight,
          `${label}: wrapped rows reserve lanes (${geometry.appliedRowHeight} >= ${geometry.rowHeight})`);
      }
      const lanes = [];
      for (const [index] of sentence.clauses.entries()) {
        const rows = geometry.perClause[index].rows;
        const own = geometry.tracks.filter(track => track.clause === index + 1);
        assert.ok(own.length >= rows.length, `${label} clause ${index + 1}: a lane per text row`);
        assert.equal(geometry.marks.filter(mark => mark.clause === index + 1).length, own.length,
          `${label} clause ${index + 1}: one number per lane`);
        for (const track of own) {
          // The lane belongs to the row whose clause text it covers (same
          // horizontal extent), sits under that row and stops above the next.
          const below = rows.filter(row => row.bottom <= track.rect.top - 2 &&
            track.rect.left >= row.left - 1.5 && track.rect.right <= row.right + 1.5);
          assert.ok(below.length, `${label} clause ${index + 1}: lane under its own row`);
          const owner = below.reduce((best, row) => row.bottom > best.bottom ? row : best);
          const next = geometry.rows.filter(row => row.top > owner.bottom).sort((a, b) => a.top - b.top)[0];
          if (next) assert.ok(track.drawn.bottom <= next.top - 0.5,
            `${label} clause ${index + 1}: lane clears the next row`);
          const mark = geometry.marks.find(candidate => candidate.clause === track.clause &&
            Math.abs((candidate.rect.top + candidate.rect.bottom) / 2 - track.rect.top) < 1.5);
          assert.ok(mark, `${label} clause ${index + 1}: number on its lane`);
          lanes.push({clause: track.clause, depth: track.depth, row: Math.round(owner.bottom), top: track.rect.top});
        }
      }
      for (const lane of lanes) {
        for (const other of lanes.filter(candidate => candidate.row === lane.row)) {
          if (other.depth === lane.depth) assert.ok(Math.abs(other.top - lane.top) < 1,
            `${label}: one lane per depth and row`);
          else if (other.depth > lane.depth) assert.ok(other.top > lane.top + 8,
            `${label}: depth ${other.depth} lane clears depth ${lane.depth}`);
        }
      }
      checks++;
    }

    await page.setViewportSize({width: 1280, height: 1000});
    await showClauseFixture(longSpan, true);
    await checkWrappedSpan('long-span-wide', false);
    for (const width of [390, 380]) {
      await page.setViewportSize({width, height: 844});
      await page.waitForTimeout(300);
      await checkWrappedSpan(`long-span-${width}`, true);
    }
    // Back to desktop, then large text at phone width; measurements must settle
    // instead of re-triggering the observer loop.
    await page.setViewportSize({width: 1280, height: 1000});
    await page.waitForTimeout(300);
    await checkWrappedSpan('long-span-wide-again', false);
    await page.locator('#text-size').click();
    await page.waitForTimeout(300);
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(320);
    await checkWrappedSpan('long-span-390-large', true);
    const laneSignature = geometry => geometry.tracks.map(track =>
      `${track.clause}/${track.depth}:${Math.round(track.rect.top * 100) / 100},${Math.round(track.rect.left * 100) / 100}`).join('|');
    const settled = await clauseGeometry(longSpan, longTarget);
    await page.waitForTimeout(300);
    const again = await clauseGeometry(longSpan, longTarget);
    assert.equal(again.appliedRowHeight, settled.appliedRowHeight, 'wrapped row height settles');
    assert.equal(laneSignature(again), laneSignature(settled), 'wrapped lanes settle');
    checks++;
    await page.locator('#text-size').click();
    await page.waitForTimeout(300);
    // Detail off, back on, then re-analyze and clear at phone width.
    await page.locator('#detail-toggle').uncheck();
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.clause-track').count(), 0, 'core view hides wrapped lanes');
    assert.equal(await page.locator('.clause-panel').count(), 0, 'core view hides wrapped list');
    await page.locator('#detail-toggle').check();
    await page.waitForTimeout(320);
    await checkWrappedSpan('long-span-after-toggle', true);
    const wrappedLanes = await page.locator('.clause-track').count();
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('.clause-layer').count(), 0, 'clear drops wrapped lanes');
    assert.equal(await page.locator('.clause-panel').count(), 0, 'clear drops wrapped list');
    checks++;
    await showClauseFixture(longSpan, true);
    await page.waitForTimeout(320);
    assert.equal(await page.locator('.clause-track').count(), wrappedLanes, 're-analysis redraws the same lanes');
    await checkWrappedSpan('long-span-after-rerun', true);
    await page.setViewportSize({width: 1280, height: 1000});
    await page.waitForTimeout(300);

    // Built-in example: a five-word clause gets a list entry but no line.
    await page.unroute('**/api/analyze');
    await page.locator('#example-button').click();
    await page.locator('#detail-toggle').check();
    await page.waitForTimeout(260);
    assert.deepEqual(await page.locator('.clause-item .clause-text').allTextContents(), ['who keep going every day']);
    assert.deepEqual(await page.locator('.clause-item .clause-type').allTextContents(), ['定语从句']);
    assert.equal(await page.locator('.clause-note').count(), 1);
    assert.equal(await page.locator('.clause-track').count(), 0);
    checks++;

    // No clauses, all-invalid clauses and a legacy result render as before.
    const conditional = clauseFixtures.conditional();
    for (const clauses of [undefined, 'bad', [{start: 0, end: 2, type: 'unknown'}], [{start: 9, end: 99, type: 'relative'}]]) {
      const legacy = structuredClone(conditional);
      if (clauses === undefined) delete legacy.sentences[0].clauses;
      else legacy.sentences[0].clauses = clauses;
      await showClauseFixture(legacy, true);
      assert.equal(await page.locator('.clause-panel').count(), 0, `no panel for ${JSON.stringify(clauses)}`);
      assert.equal(await page.locator('.clause-track').count(), 0, `no tracks for ${JSON.stringify(clauses)}`);
      assert.equal(await originalText(), legacy.sentences[0].text);
      checks++;
    }
    // No-clause and all-invalid-clause fixtures: default view has no hint.
    for (const clauses of [undefined, 'bad', [{start: 0, end: 2, type: 'unknown'}], [{start: 9, end: 99, type: 'relative'}]]) {
      const legacy = structuredClone(conditional);
      if (clauses === undefined) delete legacy.sentences[0].clauses;
      else legacy.sentences[0].clauses = clauses;
      await showClauseFixture(legacy, false);
      assert.equal(await page.locator('.clause-hint').count(), 0, `no hint for ${JSON.stringify(clauses)}`);
      checks++;
    }

    // Re-analyze, switch example and clear leave no stale range lines.
    await showClauseFixture(nested, true);
    const before = await page.locator('.clause-track').count();
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('.clause-track').count(), 0);
    assert.equal(await page.locator('.clause-panel').count(), 0);
    assert.equal(await page.locator('.clause-hint').count(), 0, 'clear drops hint');
    await showClauseFixture(nested, true);
    assert.equal(await page.locator('.clause-track').count(), before);
    await page.locator('#example-button').click();
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.clause-track').count(), 0);
    assert.equal(await page.locator('.clause-panel').count(), 1);
    // Built-in example has 1 clause; default view shows hint, detailed view hides it.
    await page.locator('#detail-toggle').uncheck();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.clause-hint').count(), 1, 'example default hint');
    await page.locator('#detail-toggle').check();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.clause-hint').count(), 0, 'example detailed no hint');
    checks++;

    // modifies click highlight still works on a clause sentence.
    await showClauseFixture(nested, true);
    await page.locator('.role-subject .english').first().click();
    assert.deepEqual(await page.locator('.modifier-target').allTextContents(), []);
    await page.locator('.role-adverbial .english').first().click();
    assert.deepEqual(await page.locator('.modifier-target').allTextContents(), ['works']);
    await page.locator('.role-adverbial .english').first().click();
    assert.deepEqual(await page.locator('.modifier-target').allTextContents(), []);
    await checkLayout();
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
