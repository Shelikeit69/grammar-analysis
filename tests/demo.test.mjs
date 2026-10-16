import test from 'node:test';
import assert from 'node:assert/strict';
import {demoAnalysis, demoText} from '../public/demo.js';
import {validateAnalysis} from '../lib/analysis.mjs';

test('example preserves felt, binds nervous to predicative, and meets live contract', () => {
  const result = validateAnalysis(demoAnalysis, demoText);
  const segments = result.sentences[0].segments;
  assert.equal(segments.map(part => part.text).join(''), demoText);
  assert.equal(segments.find(part => part.text === 'felt').lemma, 'feel');
  assert.equal(segments.find(part => part.text === 'felt').role, 'linking');
  assert.equal(segments.find(part => part.text === 'nervous').role, 'predicative');
  assert.equal(segments.find(part => part.text === 'in the stadium').level, 'detail');
});
