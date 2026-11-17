import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupWord, addWord } from '../src/dictionary-api.js';
import { openMemoryDb } from '../src/db.js';

const NOW = 1_700_000_000_000;
const apiBody = [{
  word: 'serendipity',
  phonetic: '/ˌsɛɹ.ənˈdɪp.ɪ.ti/',
  phonetics: [{ text: '/ˌsɛɹ.ənˈdɪp.ɪ.ti/' }],
  meanings: [
    { partOfSpeech: 'noun', definitions: [{ definition: 'Finding something good by chance.', example: 'It was pure serendipity.' }, { definition: 'Second one.' }] },
    { partOfSpeech: 'verb', definitions: [{ definition: 'Other pos.' }] },
  ],
}];
const okFetch = (body) => async () => ({ ok: true, status: 200, json: async () => body });
const statusFetch = (status) => async () => ({ ok: false, status, json: async () => ({}) });
const failingFetch = async () => { throw new TypeError('Failed to fetch'); };

test('maps first definition, ipa and example', async () => {
  const r = await lookupWord('Serendipity', okFetch(apiBody));
  assert.equal(r.ok, true);
  assert.deepEqual(r.record, {
    id: 'user:serendipity', rank: 0, word: 'serendipity', pos: 'noun',
    ipa: '/ˌsɛɹ.ənˈdɪp.ɪ.ti/', definition: 'Finding something good by chance.', example: 'It was pure serendipity.',
  });
});

test('404 returns not-found', async () => {
  assert.deepEqual(await lookupWord('zzzz', statusFetch(404)), { ok: false, reason: 'not-found' });
});

test('fetch rejecting returns offline', async () => {
  assert.deepEqual(await lookupWord('run', failingFetch), { ok: false, reason: 'offline' });
});

test('500 returns error', async () => {
  assert.deepEqual(await lookupWord('run', statusFetch(500)), { ok: false, reason: 'error' });
});

test('input that is not a single word returns not-found without calling fetch', async () => {
  let called = false;
  const spy = async () => { called = true; };
  assert.deepEqual(await lookupWord('two words', spy), { ok: false, reason: 'not-found' });
  assert.deepEqual(await lookupWord('   ', spy), { ok: false, reason: 'not-found' });
  assert.equal(called, false);
});

test('addWord does not duplicate a word from the main list', async () => {
  const db = openMemoryDb();
  await db.syncWords([{ id: 'run', rank: 1, word: 'run', pos: 'verb', definition: 'To move fast.' }], NOW);
  const r = await addWord(db, 'Run', NOW, failingFetch);
  assert.deepEqual(r, { ok: true, existing: true });
  assert.equal((await db.getAllCards()).length, 1);
});

test('added card is userAdded and state new', async () => {
  const db = openMemoryDb();
  const r = await addWord(db, 'serendipity', NOW, okFetch(apiBody));
  assert.deepEqual(r, { ok: true, existing: false });
  const [card] = await db.getAllCards();
  assert.equal(card.userAdded, true);
  assert.equal(card.state, 'new');
  assert.equal(card.id, 'user:serendipity');
});

test('addWord passes through failure reasons and creates no card', async () => {
  const db = openMemoryDb();
  assert.deepEqual(await addWord(db, 'zzzz', NOW, statusFetch(404)), { ok: false, reason: 'not-found' });
  assert.equal((await db.getAllCards()).length, 0);
});
