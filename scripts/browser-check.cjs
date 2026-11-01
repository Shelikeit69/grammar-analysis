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

    async function clauseGeometry(fixture) {
      return page.evaluate(({clauses, segmentTexts}) => {
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
        const nodes = [...line.querySelectorAll('.english')];
        const allText = nodes.flatMap(glyphs);
        const labels = [...line.querySelectorAll('.label')].map(node => node.getBoundingClientRect());
        const tracks = [...line.querySelectorAll('.clause-track')].map(node => {
          const rect = rel(node.getBoundingClientRect());
          const box = node.getBoundingClientRect();
          const textHit = allText.some(text => box.left < text.right && box.right > text.left && box.top < text.bottom && box.bottom > text.top);
          const labelHit = labels.some(label => box.left < label.right && box.right > label.left && box.top < label.bottom && box.bottom > label.top);
          return {clause: Number(node.dataset.clause), depth: Number(node.dataset.depth), rect, textHit, labelHit};
        });
        const marks = [...line.querySelectorAll('.clause-mark')].map(node => {
          const box = node.getBoundingClientRect();
          const rect = rel(box);
          const textHit = allText.some(text => box.left < text.right && box.right > text.left && box.top < text.bottom && box.bottom > text.top);
          const labelHit = labels.some(label => box.left < label.right && box.right > label.left && box.top < label.bottom && box.bottom > label.top);
          return {clause: Number(node.textContent), rect, textHit, labelHit};
        });
        const perClause = clauses.map(clause => {
          const rects = [];
          for (let index = clause.start; index < clause.end; index += 1) {
            if (nodes[index] && /[\p{L}\p{N}]/u.test(segmentTexts[index])) rects.push(...glyphs(nodes[index]));
          }
          const rows = [];
          rects.forEach(rect => {
            const center = (rect.top + rect.bottom) / 2;
            const row = rows.find(candidate => Math.abs(center - candidate.center) < 9);
            if (row) {
              row.top = Math.min(row.top, rect.top - lineRect.top);
              row.bottom = Math.max(row.bottom, rect.bottom - lineRect.top);
              row.left = Math.min(row.left, rect.left - lineRect.left);
              row.right = Math.max(row.right, rect.right - lineRect.left);
            } else {
              rows.push({center, top: rect.top - lineRect.top, bottom: rect.bottom - lineRect.top,
                left: rect.left - lineRect.left, right: rect.right - lineRect.left});
            }
          });
          return {
            left: rows.length ? Math.min(...rows.map(row => row.left)) : 0,
            right: rows.length ? Math.max(...rows.map(row => row.right)) : 0,
            rows,
          };
        });
        const layer = line.querySelector('.clause-layer');
        return {
          width: lineRect.width, height: lineRect.height,
          tracks, marks, perClause,
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
      }, {clauses: fixture.sentences[0].clauses, segmentTexts: fixture.sentences[0].segments.map(part => part.text)});
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
      ['nested', clauseFixtures.nestedRelative(), [1, 2]],
      ['three', clauseFixtures.nestedThree(), [1, 2, 3]],
      ['same-end', clauseFixtures.sameEnd(), [1, 2]],
      ['adjacent', clauseFixtures.adjacentObjects(), [1]],
    ];
    for (const [name, fixture, depths] of fixtures) {
      await page.setViewportSize({width: 1280, height: 1000});
      await showClauseFixture(fixture, true);
      await checkClauseFixture(name, fixture, depths);
      // The core view hides every clause-internal detail span and all brackets.
      await page.locator('#detail-toggle').uncheck();
      await page.waitForTimeout(120);
      const core = fixture.sentences[0].segments.filter(part => part.role !== 'other' && part.level === 'core');
      assert.equal(await page.locator('.clause-panel').count(), 0, `${name} core panel`);
      assert.equal(await page.locator('.clause-track').count(), 0, `${name} core tracks`);
      assert.equal(await page.locator('.annotated').count(), core.length, `${name} core spans`);
      assert.deepEqual(await page.locator('.role-subject.annotated .english').allTextContents(),
        core.filter(part => part.role === 'subject').map(part => part.text), `${name} core subject`);
      await page.locator('#detail-toggle').check();
      await page.waitForTimeout(260);
      await checkClauseFixture(name, fixture, depths);
    }

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

    // Re-analyze, switch example and clear leave no stale range lines.
    await showClauseFixture(nested, true);
    const before = await page.locator('.clause-track').count();
    await page.locator('#clear-button').click();
    assert.equal(await page.locator('#results').isVisible(), false);
    assert.equal(await page.locator('.clause-track').count(), 0);
    assert.equal(await page.locator('.clause-panel').count(), 0);
    await showClauseFixture(nested, true);
    assert.equal(await page.locator('.clause-track').count(), before);
    await page.locator('#example-button').click();
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.clause-track').count(), 0);
    assert.equal(await page.locator('.clause-panel').count(), 1);
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
