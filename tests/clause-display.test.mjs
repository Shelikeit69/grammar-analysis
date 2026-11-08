import test from 'node:test';
import assert from 'node:assert/strict';
import {clauseDisplayMode} from '../public/analysis.js';
import {nurseClause, longTextAnchors} from './fixtures/clauses.mjs';

function sentenceFor(...counts) {
  const segments = [];
  const clauses = counts.map(count => {
    const start = segments.length;
    segments.push({text: 'who '}, {text: Array(count - 1).fill('works').join(' ')});
    return {start, end: segments.length, type: 'relative'};
  });
  return {segments, clauses};
}

test('seven-word outer clause with nested clause uses boxes', () => {
  assert.equal(clauseDisplayMode(nurseClause().sentences[0]), 'boxes');
});
test('twelve words uses boxes, thirteen uses tracks', () => {
  assert.equal(clauseDisplayMode(sentenceFor(12)), 'boxes');
  assert.equal(clauseDisplayMode(sentenceFor(13)), 'tracks');
});
test('any long outer clause selects tracks for the entire sentence', () => {
  assert.equal(clauseDisplayMode(sentenceFor(5, 13)), 'tracks');
  assert.equal(clauseDisplayMode(longTextAnchors().sentences[0]), 'tracks');
});
test('missing clauses or only single content spans draw neither boxes nor tracks', () => {
  assert.equal(clauseDisplayMode({segments: []}), 'none');
  assert.equal(clauseDisplayMode({segments:[{text:'who works here'}, {text:' '},{text:'when she calls'}],
    clauses:[{start:0,end:2},{start:2,end:3}]}), 'none');
});
test('nested words are counted once and word-count rules include contractions and hyphens', () => {
  const sentence = sentenceFor(12);
  sentence.clauses.push({start:1,end:2,type:'object'});
  sentence.segments[0].text = "who don't well-known ";
  sentence.segments[1].text = Array(9).fill('works').join(' ');
  assert.equal(clauseDisplayMode(sentence), 'boxes');
});
