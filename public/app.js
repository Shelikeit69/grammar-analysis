import {demoText, demoAnalysis} from './demo.js';

const $ = (id) => document.getElementById(id);
const input = $('english-input');
const status = $('status');
const analyzeButton = $('analyze-button');
const roles = {subject:'主语',predicate:'谓语',linking:'系动词',object:'宾语',predicative:'表语',complement:'补语',adverbial:'状语',attribute:'定语',other:'其他'};
let current = null;
let controller = null;
let generation = 0;
let pasteTimer;
let composing = false;

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
    const line = element('div', 'annotation-line');
    const detail = element('div', 'phrase-detail');
    detail.hidden = true;
    detail.setAttribute('role', 'status');
    let annotatedIndex = 0;
    sentence.segments.forEach((segment) => {
      const visible = segment.role !== 'other' && (detailed || segment.level === 'core');
      const phrase = element('span', `phrase role-${segment.role} ${visible ? 'annotated' : 'plain'}${/^\s+$/u.test(segment.text) ? ' whitespace' : ''}`);
      const english = element(visible ? 'button' : 'span', 'english', segment.text);
      if (visible) {
        english.type = 'button';
        english.setAttribute('aria-pressed', 'false');
        const meaning = segment.lemma ? `${segment.lemma}－${segment.translation}` : segment.translation;
        const labelText = `${roles[segment.role] || '其他'}：${meaning}`;
        english.setAttribute('aria-label', `${segment.text}，${labelText}，查看说明`);
        const placement = segment.role === 'predicative' || (segment.role !== 'linking' && annotatedIndex % 2 === 1) ? 'bottom' : 'top';
        const annotation = element('span', `annotation ${placement}`);
        annotation.setAttribute('aria-hidden', 'true');
        const label = element('span', 'label', labelText);
        label.title = labelText;
        const connector = element('span', 'connector');
        annotation.append(...(placement === 'top' ? [label, connector] : [connector, label]));
        phrase.append(annotation);
        english.addEventListener('click', () => {
          const wasSelected = english.getAttribute('aria-pressed') === 'true';
          line.querySelectorAll('[aria-pressed]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
          english.setAttribute('aria-pressed', String(!wasSelected));
          detail.hidden = wasSelected;
          detail.textContent = `${segment.text} · ${labelText}${segment.detail ? `。${segment.detail}` : ''}`;
        });
        annotatedIndex += 1;
      }
      phrase.append(english);
      line.append(phrase);
    });
    card.append(line, detail);
    if (detailed && sentence.note) card.append(element('p', 'structure-note', sentence.note));
    const translation = element('div', 'translation-row');
    translation.append(element('span', 'translation-label', '整句翻译'), element('p', 'translation-text', sentence.translation));
    card.append(translation);
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
  $('result-badge').textContent = '内置示例';
  $('paragraph-translation').open = false;
  setStatus('这是预置示例，未调用 AI。粘贴你自己的英文即可开始分析。');
  render();
}

async function analyze() {
  if (composing) return;
  cancelPending();
  const text = input.value;
  if (!text.trim()) { setStatus('先输入一句英文吧。', true); input.focus(); return; }
  if (countWords() > 300 || text.length > 6000) { setStatus('请缩短到 300 词、6000 字符以内。', true); return; }
  const requestGeneration = generation;
  controller = new AbortController();
  const requestController = controller;
  const timeout = setTimeout(() => requestController.abort(), 95000);
  analyzeButton.disabled = true;
  analyzeButton.textContent = '正在分析…';
  $('results').hidden = true;
  setStatus('正在梳理语法结构与中文释义…');
  try {
    const response = await fetch('/api/analyze', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text}), signal:requestController.signal});
    const result = await response.json();
    if (requestGeneration !== generation) return;
    if (!response.ok) throw new Error(result.error || '分析失败，请稍后重试。');
    if (!Array.isArray(result.sentences) || !result.sentences.length) throw new Error('分析结果不完整，请重试。');
    current = result;
    $('result-badge').textContent = 'DeepSeek 分析';
    $('paragraph-translation').open = false;
    render();
    setStatus(`已分析 ${result.sentences.length} 句。`);
  } catch (error) {
    if (requestGeneration !== generation) return;
    current = null;
    $('results').hidden = true;
    setStatus(error.name === 'AbortError' ? '分析超时，请稍后重试。' : error instanceof TypeError || error instanceof SyntaxError ? '无法连接分析服务，请确认本地服务正在运行。' : error.message, true);
  } finally {
    clearTimeout(timeout);
    if (requestGeneration === generation) {
      controller = null;
      analyzeButton.disabled = false;
      analyzeButton.textContent = '分析句子 ↗';
    }
  }
}

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
fetch('/api/status').then((response) => {if (!response.ok) throw new Error(); return response.json();}).then((data) => {
  $('connection-status').textContent = data.configured ? 'DeepSeek 已配置' : '示例可直接查看 · 分析需配置密钥';
}).catch(() => {$('connection-status').textContent = '示例可直接查看 · 请启动本地分析服务';});
