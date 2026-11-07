import {createFeedback, issueLink} from './feedback.js';
import {TOOL_VERSION} from './version.js';
import {demoText, demoAnalysis} from './demo.js';
import {analyzeWithDeepSeek, ProviderError, DEFAULT_MODEL} from './deepseek.js';
import {readAnalysisResponse} from './server-client.js';

const $ = (id) => document.getElementById(id);
const input = $('english-input');
const status = $('status');
const analyzeButton = $('analyze-button');
const roles = {subject:'主语',predicate:'谓语',linking:'系动词',object:'宾语',predicative:'表语',complement:'补语',adverbial:'状语',attribute:'定语',other:'其他'};
const formNames = {prep:'介词短语','to-inf':'不定式',ing:'现在分词',ed:'过去分词',clause:'从句'};
let current = null;
let resultModel = null;
let serverModel = null;
let failureSnapshot = null;
let feedbackTrigger = null;
let feedbackSession = 0;
let feedbackSnapshot = null;
let feedbackCopied = false;
let controller = null;
let generation = 0;
let pasteTimer;
let composing = false;
// Clause brackets are re-measured after fonts, zoom and width changes. Every
// rerender replaces the cards, so these handles must be cleared first.
let clauseObserver = null;
let clauseLayoutFrame = 0;
let clauseLayoutTimer = 0;
let clauseLayouts = [];
function teardownClauseLayout() {
  cancelAnimationFrame(clauseLayoutFrame);
  clearTimeout(clauseLayoutTimer);
  clauseLayoutFrame = 0;
  clauseLayoutTimer = 0;
  clauseObserver?.disconnect();
  clauseObserver = null;
  clauseLayouts = [];
  // Clear leaves the old cards in place until the next render; drop their
  // overlays and lists so no stale clause markup survives a clear or rerender.
  document.querySelectorAll('.clause-layer, .clause-panel').forEach(node => node.remove());
}
function runClauseLayout() {
  clauseLayouts.forEach(layout => { try { layout(); } catch { /* ignore one card */ } });
}
function scheduleClauseLayout() {
  if (!clauseLayouts.length) return;
  cancelAnimationFrame(clauseLayoutFrame);
  clearTimeout(clauseLayoutTimer);
  clauseLayoutFrame = requestAnimationFrame(runClauseLayout);
  clauseLayoutTimer = setTimeout(runClauseLayout, 180);
}
// 'server': a local/Codespaces backend holds the key. 'browser': static hosting
// (GitHub Pages); the visitor's own key is used directly from this browser.
let mode = 'unknown';
const STORE = 'grammar-analysis.deepseek';
let settings = {apiKey: '', model: ''};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && typeof saved.apiKey === 'string') settings = {apiKey: saved.apiKey, model: typeof saved.model === 'string' ? saved.model : ''};
  } catch { /* storage unavailable: keep key in memory only */ }
}
let analyzedOnce = false;
function updateSteps() {
  if (mode !== 'browser') return;
  const ready = !!settings.apiKey;
  const states = {'step-get': ready ? 'done' : 'current', 'step-save': ready ? 'done' : '', 'step-paste': analyzedOnce ? 'done' : ready ? 'current' : ''};
  for (const [id, state] of Object.entries(states)) {
    const step = $(id);
    step.classList.toggle('done', state === 'done');
    step.classList.toggle('current', state === 'current');
    if (state === 'current') step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  }
}
const SIZE_STORE = 'grammar-analysis.textSize';
function applyTextSize(large) {
  document.documentElement.classList.toggle('large-text', large);
  $('text-size').setAttribute('aria-pressed', String(large));
  scheduleClauseLayout();
}
function toggleTextSize() {
  const large = !document.documentElement.classList.contains('large-text');
  applyTextSize(large);
  try { localStorage.setItem(SIZE_STORE, large ? 'large' : 'normal'); } catch { /* ignore */ }
}
function updateKeyState() {
  const ready = !!settings.apiKey;
  $('key-state').textContent = ready ? '已设置' : '未设置';
  $('key-state').classList.toggle('ready', ready);
  updateSteps();
  if (mode === 'browser') $('connection-status').textContent = ready ? `使用你的 DeepSeek 密钥 · ${settings.model || DEFAULT_MODEL}` : '例句可直接查看 · 分析需填写你的 DeepSeek 密钥';
}
function saveSettings() {
  cancelPending();
  settings = {apiKey: $('key-input').value.trim() || settings.apiKey, model: $('model-input').value.trim()};
  let storageUpdated = true;
  try {
    if ($('remember-key').checked && settings.apiKey) localStorage.setItem(STORE, JSON.stringify(settings));
    else localStorage.removeItem(STORE);
  } catch { storageUpdated = false; }
  $('key-input').value = '';
  $('key-input').placeholder = settings.apiKey ? '已保存（重新输入可替换）' : 'sk-…';
  updateKeyState();
  if (!storageUpdated) {
    setStatus('设置已在当前页面生效，但无法更新浏览器保存的记录。旧记录可能仍存在，请检查浏览器的站点数据。', true);
  } else {
    setStatus(settings.apiKey ? ($('remember-key').checked ? '密钥已保存在这台设备的浏览器中。' : '密钥仅在本次打开的页面中有效，关闭页面后需重新填写。') : '尚未填写密钥。');
  }
  if (settings.apiKey) $('key-panel').open = false;
}
function forgetSettings() {
  cancelPending();
  settings = {apiKey: '', model: ''};
  let removed = true;
  try { localStorage.removeItem(STORE); } catch { removed = false; }
  $('key-input').value = '';
  $('model-input').value = '';
  $('remember-key').checked = false;
  $('key-input').placeholder = 'sk-…';
  updateKeyState();
  setStatus(removed ? '已清除这台设备上的密钥。' : '当前页面的密钥已清除，但无法删除浏览器中的记录。请在浏览器设置里清除本站数据。', !removed);
}
function enableBrowserMode() {
  mode = 'browser';
  loadSettings();
  $('key-panel').hidden = false;
  $('steps').hidden = false;
  $('model-input').value = settings.model;
  $('remember-key').checked = !!settings.apiKey;
  if (settings.apiKey) $('key-input').placeholder = '已保存（重新输入可替换）';
  updateKeyState();
}
function browserError(error) {
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return '分析超时，请稍后重试。';
  if (error instanceof ProviderError && error.status) {
    if (error.status === 401) return 'DeepSeek 拒绝了这个密钥，请检查是否填写完整。';
    if (error.status === 402) return 'DeepSeek 账户余额不足。';
    if (error.status === 429) return '请求太频繁，请稍后再试。';
    if ([400, 404, 422].includes(error.status)) return `DeepSeek 不接受这次请求（${error.status}），请检查模型名称是否可用。`;
    return `DeepSeek 服务暂时不可用（${error.status}），请稍后重试。`;
  }
  if (error instanceof TypeError) return '浏览器无法直接连接 DeepSeek：可能是网络问题，或 DeepSeek 不允许网页跨域调用。';
  return 'AI 返回的结果不完整或与原文对不上，请重试。';
}

const clauseTypeNames = {relative: '定语从句', object: '宾语从句', adverbial: '状语从句'};
const clauseSubtypeNames = {time: '时间', condition: '条件', reason: '原因', concession: '让步', purpose: '目的', result: '结果', comparison: '比较', manner: '方式'};
function clauseName(clause) {
  if (clause.type !== 'adverbial') return clauseTypeNames[clause.type] || '从句';
  return `${clauseSubtypeNames[clause.subtype] || ''}状语从句`;
}
function sentenceClauses(sentence) {
  if (!Array.isArray(sentence.clauses)) return [];
  const segments = Array.isArray(sentence.segments) ? sentence.segments : [];
  return sentence.clauses.filter(clause => clause && clauseTypeNames[clause.type] &&
    Number.isInteger(clause.start) && Number.isInteger(clause.end) &&
    clause.start >= 0 && clause.end <= segments.length && clause.start < clause.end &&
    /[\p{L}\p{N}]/u.test(segments.slice(clause.start, clause.end).map(part => part.text).join('')));
}
function clauseDepth(clauses, clause) {
  return Math.min(3, 1 + clauses.filter(other =>
    other.start <= clause.start && other.end >= clause.end &&
    (other.start < clause.start || other.end > clause.end)).length);
}
function clauseText(sentence, clause) {
  return sentence.segments.slice(clause.start, clause.end).map(part => part.text).join('');
}
function clauseHasTwoContentSpans(sentence, clause) {
  return sentence.segments.slice(clause.start, clause.end)
    .filter(part => /[\p{L}\p{N}]/u.test(part.text)).length >= 2;
}
function textRects(node) {
  if (!node?.firstChild) return [];
  const range = document.createRange();
  range.selectNodeContents(node);
  const rects = Array.from(range.getClientRects()).filter(rect => rect.width > .5 && rect.height > .5);
  range.detach?.();
  return rects;
}
// Large text applies CSS zoom, so measured device pixels must be divided by
// the zoom factor before they become style offsets inside the zoomed line.
// offsetWidth is rounded to whole pixels, and that ratio drifts by a couple of
// pixels at the bottom of a tall wrapped sentence, so a 1000px probe measures
// the factor exactly instead.
function localScale(line) {
  const probe = element('span', 'clause-probe');
  probe.setAttribute('aria-hidden', 'true');
  line.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 && Number.isFinite(width) ? width / 1000 : 1;
}
function localRect(rect, lineRect, scale) {
  return {
    left: (rect.left - lineRect.left) / scale,
    right: (rect.right - lineRect.left) / scale,
    top: (rect.top - lineRect.top) / scale,
    bottom: (rect.bottom - lineRect.top) / scale,
  };
}
function groupTextRows(rects) {
  const rows = [];
  for (const rect of rects.slice().sort((a, b) => a.top - b.top || a.left - b.left)) {
    const center = (rect.top + rect.bottom) / 2;
    const row = rows.find(candidate => Math.abs(center - candidate.center) < 9);
    if (row) {
      row.top = Math.min(row.top, rect.top);
      row.bottom = Math.max(row.bottom, rect.bottom);
      row.left = Math.min(row.left, rect.left);
      row.right = Math.max(row.right, rect.right);
      row.center = (row.top + row.bottom) / 2;
    } else {
      rows.push({top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, center});
    }
  }
  return rows;
}
function nearestRow(rows, center) {
  return rows.reduce((best, row) => !best || Math.abs(row.center - center) < Math.abs(best.center - center) ? row : best, null);
}
function collectClauseRows(line, nodes, scale) {
  const lineRect = line.getBoundingClientRect();
  const rects = nodes.flatMap(node =>
    textRects(node).map(rect => localRect(rect, lineRect, scale)));
  const rows = groupTextRows(rects);
  nodes.forEach(node => {
    const phrase = node?.closest?.('.phrase');
    const own = groupTextRows(textRects(node).map(rect => localRect(rect, lineRect, scale)));
    if (!phrase || !own.length) return;
    const box = localRect(phrase.getBoundingClientRect(), lineRect, scale);
    const first = nearestRow(rows, own[0].center);
    const last = nearestRow(rows, own.at(-1).center);
    if (first && phrase.classList.contains('has-top')) first.top = Math.min(first.top, box.top);
    if (last && phrase.classList.contains('has-bottom')) last.bottom = Math.max(last.bottom, box.bottom);
    if (last) last.hasBottom = last.hasBottom || phrase.classList.contains('has-bottom');
  });
  return {lineRect, rows, rects};
}
// Room a text row needs under itself: a 10px gap, one 13px lane per nesting
// level, and the number badge centred on its lane. A row inside one wrapped
// span has no line box of its own, so the leading has to carry this space.
const CLAUSE_TRACK_BASE = 10;
function clauseTrackGap(depth) {
  return CLAUSE_TRACK_BASE + (depth - 1) * 13 + 6 + 3;
}
function clauseGeometry(line, sentence, nodes, clauses) {
  const lineRect = line.getBoundingClientRect();
  const scale = localScale(line);
  const {rows, rects} = collectClauseRows(line, nodes, scale);
  const entries = [];
  clauses.forEach((clause, clauseIndex) => {
    if (!clauseHasTwoContentSpans(sentence, clause)) return;
    const depth = clauseDepth(clauses, clause);
    const spans = [];
    for (let index = clause.start; index < clause.end; index += 1) {
      if (nodes[index] && /[\p{L}\p{N}]/u.test(sentence.segments[index].text)) {
        spans.push(...textRects(nodes[index]).map(rect => localRect(rect, lineRect, scale)));
      }
    }
    groupTextRows(spans).forEach(part => {
      const row = nearestRow(rows, part.center);
      if (row) entries.push({clause, clauseIndex, depth, part, row});
    });
  });
  return {lineRect, rows, rects, entries};
}
// Only a line that wraps inside itself has rows without their own line box; a
// single-row line already reserves room with the card padding and row margins.
function clauseRowHeight(nodes, geometry) {
  if (geometry.rows.length < 2 || !geometry.entries.length) return 0;
  const node = nodes.find(candidate => candidate?.isConnected) || nodes[0];
  if (!node) return 0;
  const style = getComputedStyle(node);
  const base = (parseFloat(style.fontSize) || 0) * (parseFloat(style.getPropertyValue('--clause-base-row')) || 2);
  const textHeight = Math.max(...geometry.rects.map(rect => rect.bottom - rect.top));
  const gap = Math.max(...geometry.entries.map(entry => clauseTrackGap(entry.depth)));
  // Round up so repeated measurements settle on one value instead of jittering.
  return Math.ceil(Math.max(base, textHeight + gap));
}
function drawClauseLayer(line, sentence, nodes, clauses) {
  line.querySelector('.clause-layer')?.remove();
  let geometry = clauseGeometry(line, sentence, nodes, clauses);
  if (!geometry.lineRect.width || !geometry.entries.length) return;
  const height = clauseRowHeight(nodes, geometry);
  const applied = parseFloat(line.style.getPropertyValue('--clause-row-height')) || 0;
  if (height !== applied) {
    if (height) line.style.setProperty('--clause-row-height', `${height}px`);
    else line.style.removeProperty('--clause-row-height');
    geometry = clauseGeometry(line, sentence, nodes, clauses);
  }
  if (!geometry.rows.length) return;
  const layer = element('div', 'clause-layer');
  layer.setAttribute('aria-hidden', 'true');
  geometry.entries.forEach(({clause, clauseIndex, depth, part, row}) => {
    const base = row.hasBottom ? row.bottom + 58 + CLAUSE_TRACK_BASE : part.bottom + CLAUSE_TRACK_BASE;
    const y = base + (depth - 1) * 13;
    const width = Math.max(2, part.right - part.left);
    const track = element('span', `clause-track type-${clause.type}`);
    track.style.left = `${part.left}px`;
    track.style.width = `${width}px`;
    track.style.top = `${y}px`;
    track.dataset.clause = String(clauseIndex + 1);
    track.dataset.depth = String(depth);
    const number = element('span', `clause-mark type-${clause.type}`, String(clauseIndex + 1));
    number.style.left = `${part.left}px`;
    number.style.top = `${y}px`;
    layer.append(track, number);
  });
  if (layer.childElementCount) line.append(layer);
}
function clausePanel(sentence, clauses) {
  const panel = element('section', 'clause-panel');
  panel.append(element('h3', 'clause-panel-title', '从句清单'));
  const list = element('ul', 'clause-list');
  clauses.forEach((clause, index) => {
    const item = element('li', 'clause-item');
    item.append(
      element('span', `clause-number type-${clause.type}`, String(index + 1)),
      element('span', `clause-type type-${clause.type}`, clauseName(clause)),
      element('span', 'clause-text', clauseText(sentence, clause)),
    );
    if (!clauseHasTwoContentSpans(sentence, clause)) item.append(element('span', 'clause-note', '单片段短从句，不画范围线'));
    list.append(item);
  });
  panel.append(list);
  return panel;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
function cancelPending() {
  closeFeedback();
  failureSnapshot = null;
  $('report-failure').hidden = true;
  clearTimeout(pasteTimer);
  generation += 1;
  controller?.abort();
  controller = null;
  analyzeButton.disabled = false;
  analyzeButton.textContent = '分析句子 ↗';
}
function countWords() {
  const count = (input.value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
  $('word-count').textContent = `${count} / 300 词`;
  return count;
}
function invalidate() {
  cancelPending();
  teardownClauseLayout();
  countWords();
  current = null;
  $('results').hidden = true;
  setStatus('');
}

function render() {
  if (!current) return;
  teardownClauseLayout();
  const detailed = $('detail-toggle').checked;
  const list = $('sentence-list');
  list.replaceChildren();
  current.sentences.forEach((sentence, sentenceIndex) => {
    const card = element('article', 'sentence-card');
    card.setAttribute('aria-label', `第 ${sentenceIndex + 1} 句`);
    card.append(element('div', 'sentence-header', `SENTENCE ${String(sentenceIndex + 1).padStart(2, '0')}`));
    if (sentence.tense) {
      const tense = element('div', 'tense-box');
      tense.append(element('div', 'tense-name', `时态：${sentence.tense}`));
      if (sentence.tenseReason) tense.append(element('div', 'tense-reason', `判断依据：${sentence.tenseReason}`));
      card.append(tense);
    }
    const line = element('div', 'annotation-line');
    const detail = element('div', 'phrase-detail');
    detail.hidden = true;
    detail.setAttribute('role', 'status');
    detail.id = `phrase-detail-${sentenceIndex}`;
    // Visible (clickable) phrase buttons by segment index, so a click can find its `modifies` target.
    const buttons = new Map();
    const englishNodes = [];
    let annotatedIndex = 0;
    sentence.segments.forEach((segment, segmentIndex) => {
      const visible = segment.role !== 'other' && (detailed || segment.level === 'core');
      const phrase = element('span', `phrase role-${segment.role} ${visible ? 'annotated' : 'plain'}${/^\s+$/u.test(segment.text) ? ' whitespace' : ''}`);
      const english = element(visible ? 'button' : 'span', 'english', segment.text);
      let annotationNode = null;
      if (visible) {
        english.type = 'button';
        english.setAttribute('aria-pressed', 'false');
        const meaning = segment.lemma ? `${segment.lemma}－${segment.translation}` : segment.translation;
        const headIndex = Number.isInteger(segment.predicateOf) ? segment.predicateOf : segmentIndex;
        const head = sentence.segments[headIndex];
        const predicateParts = sentence.segments.filter((part, index) => index === headIndex || part.predicateOf === headIndex);
        const isPredicatePart = headIndex !== segmentIndex;
        let labelText;
        if (isPredicatePart) {
          labelText = `谓语组成部分：与 ${head.lemma.trim().split(/\s+/u)[0]} 构成 ${head.lemma}`;
        } else {
          let roleLabel = roles[segment.role] || '其他';
          if (formNames[segment.form] && (segment.role === 'attribute' || segment.role === 'adverbial')) {
            roleLabel += ` · ${formNames[segment.form]}`;
            if (segment.role === 'attribute' && Number.isInteger(segment.modifies) && segment.modifies < segmentIndex) {
              roleLabel += '（后置）';
            }
          }
          labelText = `${roleLabel}：${meaning}`;
        }
        english.setAttribute('aria-label', `${segment.text}，${labelText}，查看说明`);
        const placement = segment.role === 'predicative' || (segment.role !== 'linking' && annotatedIndex % 2 === 1) ? 'bottom' : 'top';
        const annotation = element('span', `annotation ${placement}`);
        annotation.setAttribute('aria-hidden', 'true');
        const label = element('span', 'label', labelText);
        label.title = labelText;
        const connector = element('span', 'connector');
        annotation.append(...(placement === 'top' ? [label, connector] : [connector, label]));
        annotationNode = annotation;
        phrase.classList.add(placement === 'top' ? 'has-top' : 'has-bottom');
        buttons.set(segmentIndex, english);
        english.addEventListener('click', () => {
          const wasSelected = english.getAttribute('aria-pressed') === 'true';
          line.querySelectorAll('[aria-pressed]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
          line.querySelectorAll('.modifier-target').forEach((node) => {
            node.classList.remove('modifier-target');
            node.removeAttribute('aria-describedby');
          });
          english.setAttribute('aria-pressed', String(!wasSelected));
          detail.hidden = wasSelected;
          if (wasSelected) return;
          detail.textContent = `${segment.text} · ${labelText}${segment.detail ? `。${segment.detail}` : ''}`;
          if (predicateParts.length > 1) {
            const lastIndex = sentence.segments.lastIndexOf(predicateParts.at(-1));
            const objects = sentence.segments.slice(headIndex + 1, lastIndex).filter(part => part.role === 'object');
            const predicateDetail = head.detail?.trim() ? head.detail : predicateParts.find(part => part.detail?.trim())?.detail || '';
            detail.textContent = `${predicateParts.map(part => part.text.trim()).join('…')} 是同一谓语；${head.lemma}－${head.translation}。${objects.map(part => `${part.text} 是宾语。`).join('')}${predicateDetail}`;
          }
          const target = Number.isInteger(segment.modifies) ? sentence.segments[segment.modifies] : null;
          if (!target) return;
          detail.append(element('span', 'modifies-note', `修饰：${target.text}`));
          // The target may be hidden in the current view (a detail span in the core view): the note still names it.
          const targetButton = buttons.get(segment.modifies);
          if (targetButton) {
            targetButton.classList.add('modifier-target');
            targetButton.setAttribute('aria-describedby', detail.id);
          }
        });
        annotatedIndex += 1;
      }
      // english goes first so the grid baseline follows the text, not the label above it.
      phrase.append(english);
      if (annotationNode) phrase.append(annotationNode);
      line.append(phrase);
      englishNodes.push(english);
    });
    const clauses = detailed ? sentenceClauses(sentence) : [];
    if (clauses.length) {
      line.classList.add('clause-brackets');
      card.append(line, clausePanel(sentence, clauses), detail);
      clauseLayouts.push(() => drawClauseLayer(line, sentence, englishNodes, clauses));
    } else {
      card.append(line, detail);
    }
    const clauseHintCount = sentenceClauses(sentence).length;
    if (!detailed && clauseHintCount > 0) {
      card.append(element('p', 'clause-hint', `这句有 ${clauseHintCount} 个从句，勾选右上角「显示详细结构」查看从句范围和清单。`));
    }
    if (detailed && sentence.note) card.append(element('p', 'structure-note', sentence.note));
    const translation = element('div', 'translation-row');
    translation.append(element('span', 'translation-label', '整句翻译'), element('p', 'translation-text', sentence.translation));
    card.append(translation);
    const report = element('button', 'report-button report-sentence', '这句分析有问题？');
    report.type = 'button';
    report.addEventListener('click', () => openFeedback({sentence, model:resultModel}, report));
    card.append(report);
    list.append(card);
  });
  $('paragraph-translation').hidden = current.sentences.length < 2;
  $('paragraph-translation').querySelector('p').textContent = current.translation;
  $('results').hidden = false;
  if (clauseLayouts.length) {
    clauseObserver = new ResizeObserver(scheduleClauseLayout);
    clauseObserver.observe($('sentence-list'));
    document.fonts?.ready.then(scheduleClauseLayout);
    scheduleClauseLayout();
  }
}

function showExample() {
  cancelPending();
  input.value = demoText;
  countWords();
  current = demoAnalysis;
  resultModel = '内置示例（未调用模型）';
  $('result-badge').textContent = '内置示例';
  $('paragraph-translation').open = false;
  setStatus('这是预置示例，未调用 AI。粘贴你自己的英文即可开始分析。');
  render();
}

async function analyze() {
  if (composing) return;
  cancelPending();
  teardownClauseLayout();
  if (mode === 'unknown') { setStatus('正在检查运行环境，请稍候再试。'); return; }
  const text = input.value;
  if (!text.trim()) { setStatus('先输入一句英文吧。', true); input.focus(); return; }
  if (countWords() > 300 || text.length > 6000) { setStatus('请缩短到 300 词、6000 字符以内。', true); return; }
  if (mode === 'browser' && !settings.apiKey) { setStatus('请先在下方填写你的 DeepSeek 密钥。', true); $('key-panel').open = true; $('key-input').focus(); return; }
  const requestModel = mode === 'browser' ? settings.model || DEFAULT_MODEL : serverModel;
  const requestGeneration = generation;
  controller = new AbortController();
  const requestController = controller;
  const timeout = setTimeout(() => requestController.abort(), 95000);
  analyzeButton.disabled = true;
  analyzeButton.textContent = '正在分析…';
  $('results').hidden = true;
  setStatus('正在梳理语法结构与中文释义…');
  const onRepair = ({kind}) => {
    if (requestGeneration === generation) setStatus(kind === 'unsplit' ? '长从句没拆开，正在重新分析一次，会多一次 DeepSeek 调用…' : '正在修正格式，再试一次（会额外调用一次 DeepSeek）。');
  };
  try {
    let result;
    if (mode === 'browser') {
      result = await analyzeWithDeepSeek(text, {apiKey: settings.apiKey, model: settings.model || DEFAULT_MODEL, signal: requestController.signal, timeoutMs: 90000, onRepair});
      if (requestGeneration !== generation) return;
    } else {
      const response = await fetch('./api/analyze', {method:'POST', headers:{'Content-Type':'application/json', Accept:'application/x-ndjson'}, body:JSON.stringify({text}), signal:requestController.signal});
      result = await readAnalysisResponse(response, {onRepair, signal:requestController.signal});
      if (requestGeneration !== generation) return;
    }
    if (!Array.isArray(result.sentences) || !result.sentences.length) throw new Error('分析结果不完整，请重试。');
    current = result;
    resultModel = requestModel;
    $('result-badge').textContent = 'DeepSeek 分析';
    analyzedOnce = true;
    updateSteps();
    $('paragraph-translation').open = false;
    render();
    setStatus(`已分析 ${result.sentences.length} 句。`);
  } catch (error) {
    if (requestGeneration !== generation) return;
    current = null;
    $('results').hidden = true;
    const safeServerMessages = new Set([
      '尚未配置 DeepSeek API Key。请设置 Codespaces Secret 后重启 Codespace，或在本机 .env 中配置后重启服务。',
      '正在分析，请稍后重试。', '分析暂时失败，请稍后重试。', '分析失败，请稍后重试。',
      '分析结果不完整，请重试。', '分析结果格式不正确，请重试。', '分析结果过长，请缩短原文后重试。',
    ]);
    const displayError = mode === 'browser' ? browserError(error)
      : error.name === 'AbortError' ? '分析超时，请稍后重试。'
      : error instanceof TypeError || error instanceof SyntaxError ? '无法连接分析服务，请确认本地服务正在运行。'
      : safeServerMessages.has(error.message) ? error.message : '分析服务未能返回有效结果，请重试。';
    setStatus(displayError, true);
    failureSnapshot = {text, model:requestModel, error:displayError};
    $('report-failure').hidden = false;
  } finally {
    clearTimeout(timeout);
    if (requestGeneration === generation) {
      controller = null;
      analyzeButton.disabled = false;
      analyzeButton.textContent = '分析句子 ↗';
    }
  }
}


function closeFeedback() {
  feedbackSession += 1;
  const dialog = $('feedback-dialog');
  if (dialog.open) dialog.close();
  feedbackSnapshot = null;
  feedbackCopied = false;
  $('feedback-copy').disabled = true;
  $('feedback-title').textContent = '';
  $('feedback-sentence').textContent = '';
  $('feedback-body').value = '';
  $('feedback-description').value = '';
  $('feedback-expected').value = '';
  $('feedback-types').querySelectorAll('input').forEach(chip => {chip.checked = false;});
  $('feedback-details').open = false;
  $('feedback-consent').checked = false;
  $('feedback-open').disabled = true;
  $('feedback-message').textContent = '';
}
function feedbackReady() {
  return feedbackSnapshot && $('feedback-consent').checked &&
    ($('feedback-description').value.trim() || (feedbackSnapshot.sentence && $('feedback-types').querySelector('input:checked')));
}
function updateFeedbackActions() {
  const ready = !!feedbackReady();
  const long = !$('feedback-copy').hidden;
  $('feedback-copy').disabled = !ready;
  $('feedback-open').disabled = !ready || (long && !feedbackCopied);
  $('feedback-requirement').textContent = !ready
    ? '勾选「我知道内容会公开」并选一个问题类型或填写说明后可以提交。'
    : long && !feedbackCopied ? '请先点第 1 步复制反馈内容。' : '';
}
function updateFeedbackLink() {
  feedbackCopied = false;
  feedbackSession += 1;
  $('feedback-consent').checked = false;
  $('feedback-open').disabled = true;
  const draft = createFeedback({...feedbackSnapshot, version:TOOL_VERSION,
    types:Array.from($('feedback-types').querySelectorAll('input:checked'), chip => chip.value),
    description:$('feedback-description').value, expected:$('feedback-expected').value});
  $('feedback-title').textContent = draft.title;
  $('feedback-body').value = draft.body;
  const link = issueLink(draft.title, draft.body);
  $('feedback-copy').hidden = !link.long;
  $('feedback-open').textContent = link.long ? '② 打开 GitHub 粘贴 →' : '去 GitHub 提交 →';
  $('feedback-copy').textContent = '① 复制反馈内容';
  $('feedback-message').textContent = link.long ? '内容较长，链接放不下，需要分两步：' : '打开链接会将预览内容带到 GitHub，请先检查。会在新标签页打开，内容已填好，在那边点 Create 完成提交。';
  updateFeedbackActions();
}
function openFeedback(snapshot, trigger) {
  feedbackSession += 1;
  closeFeedback();
  feedbackSnapshot = snapshot;
  feedbackTrigger = trigger;
  $('feedback-sentence').textContent = snapshot.sentence ? snapshot.sentence.text : snapshot.text;
  $('feedback-types').hidden = !snapshot.sentence;
  $('feedback-consent').checked = false;
  $('feedback-open').disabled = true;
  updateFeedbackLink();
  $('feedback-dialog').showModal();
  $('feedback-description').focus({preventScroll:true});
  $('feedback-dialog').querySelector('.feedback-content').scrollTop = 0;
}
$('report-failure').addEventListener('click', () => {if (failureSnapshot) openFeedback(failureSnapshot, $('report-failure'));});
$('feedback-cancel').addEventListener('click', closeFeedback);
$('feedback-dialog').addEventListener('cancel', event => {event.preventDefault(); closeFeedback();});
$('feedback-dialog').addEventListener('close', () => {if (feedbackTrigger?.isConnected) feedbackTrigger.focus(); feedbackTrigger = null;});
$('feedback-consent').addEventListener('change', updateFeedbackActions);
$('feedback-description').addEventListener('input', updateFeedbackLink);
$('feedback-expected').addEventListener('input', updateFeedbackLink);
$('feedback-types').addEventListener('change', updateFeedbackLink);
$('feedback-copy').addEventListener('click', async () => {
  if (!feedbackReady()) return;
  const body = $('feedback-body').value;
  const session = feedbackSession;
  try {
    await navigator.clipboard.writeText(body);
    if (session !== feedbackSession || !$('feedback-dialog').open || $('feedback-body').value !== body) return;
    feedbackCopied = true;
    $('feedback-copy').textContent = '① 复制反馈内容 · 已复制 ✓';
    $('feedback-message').textContent = '已复制 ✓ 请点第 2 步，在 GitHub 粘贴后点 Create。剪贴板会保留内容，请按需清除。';
  } catch {
    if (session !== feedbackSession || !$('feedback-dialog').open || $('feedback-body').value !== body) return;
    $('feedback-details').open = true;
    $('feedback-body').focus(); $('feedback-body').select();
    feedbackCopied = true;
    $('feedback-message').textContent = '自动复制失败，正文已全选，请手动复制（Ctrl/Cmd+C 或手机长按复制）。手动复制好之后，再点第 2 步。剪贴板可能保留内容，请按需清除。';
  }
  updateFeedbackActions();
});
$('feedback-open').addEventListener('click', () => {
  if (!feedbackReady() || (!$('feedback-copy').hidden && !feedbackCopied)) return;
  const link = issueLink($('feedback-title').textContent, $('feedback-body').value);
  window.open(link.url, '_blank', 'noopener,noreferrer');
  $('feedback-message').textContent = link.long ? '已打开 GitHub。请粘贴反馈内容，再点 Create 完成提交。剪贴板可能保留内容，请按需清除。' : '已打开 GitHub。请在新页面点 Create 完成提交。';
});

input.addEventListener('input', invalidate);
input.addEventListener('compositionstart', () => {composing = true;});
input.addEventListener('compositionend', () => {composing = false;});
input.addEventListener('paste', () => {setTimeout(() => {clearTimeout(pasteTimer); pasteTimer = setTimeout(analyze, 650);}, 0);});
input.addEventListener('keydown', (event) => {if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {event.preventDefault(); analyze();}});
analyzeButton.addEventListener('click', analyze);
$('example-button').addEventListener('click', showExample);
$('clear-button').addEventListener('click', () => {input.value = ''; invalidate(); input.focus();});
$('detail-toggle').addEventListener('change', render);
window.addEventListener('resize', scheduleClauseLayout);
document.fonts?.addEventListener('loadingdone', scheduleClauseLayout);
showExample();
$('save-key').addEventListener('click', saveSettings);
$('text-size').addEventListener('click', toggleTextSize);
$('step-open-key').addEventListener('click', () => {$('key-panel').open = true; $('key-input').focus();});
try { applyTextSize(localStorage.getItem(SIZE_STORE) === 'large'); } catch { /* ignore */ }
$('forget-key').addEventListener('click', forgetSettings);
$('key-input').addEventListener('keydown', (event) => {if (event.key === 'Enter') {event.preventDefault(); saveSettings();}});
// A local/Codespaces server answers /api/status with JSON; static hosting does not.
fetch('./api/status', {signal: AbortSignal.timeout(8000)}).then((response) => {if (!response.ok) throw new Error(); return response.json();}).then((data) => {
  mode = 'server';
  serverModel = typeof data.model === 'string' && data.model.trim() ? data.model : null;
  $('connection-status').textContent = data.configured ? 'DeepSeek 已配置' : '示例可直接查看 · 分析需配置密钥';
}).catch(enableBrowserMode);
