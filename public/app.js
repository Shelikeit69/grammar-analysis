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
let current = null;
let resultModel = null;
let serverModel = null;
let failureSnapshot = null;
let feedbackTrigger = null;
let feedbackSession = 0;
let feedbackSnapshot = null;
let controller = null;
let generation = 0;
let pasteTimer;
let composing = false;
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
  countWords();
  current = null;
  $('results').hidden = true;
  setStatus('');
}

function render() {
  if (!current) return;
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
        const labelText = isPredicatePart
          ? `谓语组成部分：与 ${head.lemma.trim().split(/\s+/u)[0]} 构成 ${head.lemma}`
          : `${roles[segment.role] || '其他'}：${meaning}`;
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
    });
    card.append(line, detail);
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
  const onRepair = () => {
    if (requestGeneration === generation) setStatus('正在修正格式，再试一次（会额外调用一次 DeepSeek）。');
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
function updateFeedbackLink() {
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
  $('feedback-next').textContent = link.long ? '会在新标签页打开 GitHub，请填写标题、粘贴完整正文，再点 Create 完成提交。' : '会在新标签页打开 GitHub，内容已填好，在那边点 Create 完成提交。';
  $('feedback-message').textContent = link.long ? '内容较长，链接不会附带标题和正文。请先复制完整正文，再到 GitHub 粘贴；标题也需填写。' : '';
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
$('feedback-consent').addEventListener('change', () => {$('feedback-open').disabled = !feedbackReady();});
$('feedback-description').addEventListener('input', updateFeedbackLink);
$('feedback-expected').addEventListener('input', updateFeedbackLink);
$('feedback-types').addEventListener('change', updateFeedbackLink);
$('feedback-copy').addEventListener('click', async () => {
  const body = $('feedback-body').value;
  const session = feedbackSession;
  try {
    await navigator.clipboard.writeText(body);
    if (session === feedbackSession && $('feedback-dialog').open && $('feedback-body').value === body) $('feedback-message').textContent = '已复制完整正文。剪贴板会保留内容，请按需清除。';
  } catch {
    if (session !== feedbackSession || !$('feedback-dialog').open || $('feedback-body').value !== body) return;
    $('feedback-details').open = true;
    $('feedback-body').focus(); $('feedback-body').select();
    $('feedback-message').textContent = '自动复制失败，正文已全选，请手动复制（Ctrl/Cmd+C 或手机长按复制）。';
  }
});
$('feedback-open').addEventListener('click', () => {
  if (!feedbackReady()) return;
  const link = issueLink($('feedback-title').textContent, $('feedback-body').value);
  window.open(link.url, '_blank', 'noopener,noreferrer');
  $('feedback-message').textContent = link.long ? '已打开 GitHub。请填写标题并粘贴完整正文，再点 Create 完成提交。' : '已打开 GitHub。请在新页面点 Create 完成提交。';
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
