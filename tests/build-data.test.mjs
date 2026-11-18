import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFreqList, pickEntry, buildWords, applyExclude } from '../scripts/build-data.mjs';

const entries = readFileSync(new URL('./fixtures/wiktextract-sample.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));
const freq = parseFreqList(readFileSync(new URL('./fixtures/freq-sample.txt', import.meta.url), 'utf8'));
const byWord = (w) => entries.filter((e) => e.word === w);

test('parseFreqList keeps order, lowercases, dedupes and drops non-alphabetic tokens', () => {
  assert.deepEqual(freq, ['the', 'run', 'was', 'london', 'table', 'inconceivable', 'water', 'xyzzy', 'apple', 'banana']);
});

test('picks first sense with shortest gloss', () => {
  const r = pickEntry(byWord('run'));
  assert.equal(r.definition, 'To move fast.');
  assert.equal(r.pos, 'verb');
  assert.equal(r.example, 'Run, and you might still catch the train!');
});

test('uses en-US IPA when present, omits ipa otherwise', () => {
  assert.equal(pickEntry(byWord('table')).ipa, '/ˈteɪbəl/');
  assert.equal('ipa' in pickEntry(byWord('water')), false);
});

test('includes pt translation only when entry has lang_code "pt"', () => {
  assert.equal(pickEntry(byWord('water')).pt, 'água');
  assert.equal('pt' in pickEntry(byWord('table')), false);
});

test('skips entries without usable short gloss and fills from next frequency word', () => {
  assert.equal(pickEntry(byWord('inconceivable')), null);
  const words = buildWords(freq, entries, 3).map((w) => w.word);
  assert.deepEqual(words, ['run', 'table', 'water']);
});

test('skips proper nouns and inflected forms', () => {
  assert.equal(pickEntry(byWord('london')), null);
  assert.equal(pickEntry(byWord('was')), null);
});

test('assigns rank 1..N contiguous in frequency order', () => {
  const out = buildWords(freq, entries, 10);
  assert.deepEqual(out.map((w) => w.word), ['run', 'table', 'water', 'apple', 'banana']);
  assert.deepEqual(out.map((w) => w.rank), [1, 2, 3, 4, 5]);
  assert.equal(out[0].id, 'run');
});

const mkEntry = (word, pos, senses, extra = {}) => ({ word, lang_code: 'en', pos, senses, ...extra });
const sense = (gloss, tags = []) => ({ glosses: [gloss], tags });

test('skips senses tagged slang or vulgar and uses the next clean sense', () => {
  const e = mkEntry('crap', 'noun', [sense('Something worthless.', ['slang', 'vulgar']), sense('Waste material.')]);
  assert.equal(pickEntry([e]).definition, 'Waste material.');
  assert.equal(pickEntry([mkEntry('peter', 'noun', [sense('The penis.', ['slang'])])]), null);
});

test('skips the whole word when its main sense is an inflected form', () => {
  const e = mkEntry('walls', 'noun', [sense('plural of wall', ['form-of', 'plural']), sense('The vagina.', ['slang'])]);
  assert.equal(pickEntry([e]), null);
  const adj = mkEntry('longer', 'adj', [sense('comparative form of long: more long', ['form-of'])]);
  const noun = mkEntry('longer', 'noun', [sense('One who longs for something.')]);
  assert.equal(pickEntry([adj, noun]), null);
});

test('skips "action of the verb" glosses', () => {
  const e = mkEntry('talking', 'noun', [sense('The action of the verb talk.')]);
  assert.equal(pickEntry([e]), null);
});

test('prefers the entry with the most senses', () => {
  const few = mkEntry('set', 'noun', [sense('A group of things.')]);
  const many = mkEntry('set', 'verb', [sense('To put something down.'), sense('To fix in place.'), sense('To prepare.')]);
  assert.equal(pickEntry([few, many]).pos, 'verb');
});

test('applyExclude removes listed words case-insensitively', () => {
  assert.deepEqual(applyExclude(['john', 'run', 'mary'], '# names\nJohn\nmary\n'), ['run']);
});

test('skips senses whose raw gloss is labelled slang even without a slang tag', () => {
  const dirty = { glosses: ['A girl or woman.'], raw_glosses: ['(UK, slang) A girl or woman.'], tags: [] };
  const clean = sense('A warm-blooded animal with feathers.');
  assert.equal(pickEntry([mkEntry('bird', 'noun', [dirty, clean])]).definition, 'A warm-blooded animal with feathers.');
});

test('drops the entry when its first clean sense is too long instead of using a later sense', () => {
  const long = sense('An animal of the clade ' + 'x'.repeat(150));
  const later = sense('A girl or woman.');
  assert.equal(pickEntry([mkEntry('bird', 'noun', [long, later])]), null);
});
