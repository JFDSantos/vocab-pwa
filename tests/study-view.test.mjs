import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../src/ui/study.js';

const full = { id: 'run', word: 'run', pos: 'verb', ipa: '/ɹʌn/', definition: 'To move fast.', example: 'Run, and you might catch it!', pt: 'correr' };

test('renders word, ipa, definition, example and pt toggle', () => {
  const { frontHtml, backHtml } = renderCard(full);
  assert.match(frontHtml, /run/);
  assert.match(frontHtml, /\/ɹʌn\//);
  assert.match(backHtml, /To move fast\./);
  assert.match(backHtml, /Run, and you might catch it!/);
  assert.match(backHtml, /data-action="show-pt"/);
  assert.match(backHtml, /correr/);
});

test('renderCard omits ipa line when ipa missing', () => {
  const { frontHtml } = renderCard({ ...full, ipa: undefined });
  assert.doesNotMatch(frontHtml, /class="ipa"/);
  assert.doesNotMatch(frontHtml, /undefined/);
});

test('omits pt toggle and example when missing', () => {
  const { backHtml } = renderCard({ ...full, pt: undefined, example: undefined });
  assert.doesNotMatch(backHtml, /show-pt/);
  assert.doesNotMatch(backHtml, /class="example"/);
  assert.doesNotMatch(backHtml, /undefined/);
});

test('escapes html in word and example', () => {
  const { frontHtml, backHtml } = renderCard({ ...full, word: '<b>x</b>', example: '<img src=x onerror=1>' });
  assert.match(frontHtml, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(backHtml, /<img/);
});
