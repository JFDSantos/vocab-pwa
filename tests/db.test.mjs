import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, openMemoryDb, isDbAvailable } from '../src/db.js';

const NOW = 1_700_000_000_000;
const words = [
  { id: 'run', rank: 1, word: 'run', pos: 'verb', definition: 'To move fast.' },
  { id: 'table', rank: 2, word: 'table', pos: 'noun', definition: 'A piece of furniture.' },
];
let n = 0;
const freshName = () => `test-db-${n++}`;

test('syncWords creates one new card per word', async () => {
  const db = await openDb(freshName());
  await db.syncWords(words, NOW);
  const cards = await db.getAllCards();
  assert.equal(cards.length, 2);
  const run = cards.find((c) => c.id === 'run');
  assert.equal(run.state, 'new');
  assert.equal(run.definition, 'To move fast.');
  assert.equal(run.rank, 1);
});

test('syncWords is idempotent', async () => {
  const db = await openDb(freshName());
  await db.syncWords(words, NOW);
  await db.syncWords(words, NOW + 1000);
  assert.equal((await db.getAllCards()).length, 2);
});

test('putCard persists changes across reopen', async () => {
  const name = freshName();
  const db = await openDb(name);
  await db.syncWords(words, NOW);
  const [card] = await db.getAllCards();
  await db.putCard({ ...card, state: 'review', interval: 3 });
  db.close();
  const again = await openDb(name);
  const saved = (await again.getAllCards()).find((c) => c.id === card.id);
  assert.equal(saved.state, 'review');
  assert.equal(saved.interval, 3);
});

test('deleteCard removes the card', async () => {
  const db = await openDb(freshName());
  await db.syncWords(words, NOW);
  await db.deleteCard('run');
  assert.deepEqual((await db.getAllCards()).map((c) => c.id), ['table']);
});

test('meta roundtrip', async () => {
  const db = await openDb(freshName());
  assert.equal(await db.getMeta('newLimit'), undefined);
  await db.setMeta('newLimit', 15);
  assert.equal(await db.getMeta('newLimit'), 15);
});

test('isDbAvailable is false when indexedDB is undefined', async () => {
  const saved = globalThis.indexedDB;
  delete globalThis.indexedDB;
  try {
    assert.equal(await isDbAvailable(), false);
  } finally {
    globalThis.indexedDB = saved;
  }
  assert.equal(await isDbAvailable(), true);
});

test('memory db supports the same operations without indexedDB', async () => {
  const db = openMemoryDb();
  await db.syncWords(words, NOW);
  await db.syncWords(words, NOW);
  const [card] = await db.getAllCards();
  await db.putCard({ ...card, state: 'review' });
  assert.equal((await db.getAllCards()).find((c) => c.id === card.id).state, 'review');
  await db.deleteCard('table');
  assert.equal((await db.getAllCards()).length, 1);
  await db.setMeta('k', 1);
  assert.equal(await db.getMeta('k'), 1);
});

for (const [label, make] of [['indexedDB', async () => openDb(freshName())], ['memory', async () => openMemoryDb()]]) {
  test(`syncWords updates content, keeps scheduling, drops removed optional fields, adds new words (${label})`, async () => {
    const db = await make();
    await db.syncWords([{ ...words[0], ipa: '/x/' }, words[1]], NOW);
    const run = (await db.getAllCards()).find((c) => c.id === 'run');
    await db.putCard({ ...run, state: 'review', interval: 7, due: NOW + 5, reps: 3 });
    const fixed = [{ ...words[0], definition: 'To move quickly.' }, words[1], { id: 'new', rank: 3, word: 'new', pos: 'adj', definition: 'Recent.' }];
    await db.syncWords(fixed, NOW + 100);
    const cards = await db.getAllCards();
    const after = cards.find((c) => c.id === 'run');
    assert.equal(after.definition, 'To move quickly.');
    assert.equal('ipa' in after, false);
    assert.equal(after.state, 'review');
    assert.equal(after.interval, 7);
    assert.equal(after.reps, 3);
    const added = cards.find((c) => c.id === 'new');
    assert.equal(added.state, 'new');
    assert.equal(cards.length, 3);
  });

  test(`syncWords clears flagged only when the definition changed, and leaves user-added cards alone (${label})`, async () => {
    const db = await make();
    await db.syncWords(words, NOW);
    const [run, table] = ['run', 'table'].map(async (id) => (await db.getAllCards()).find((c) => c.id === id));
    await db.putCard({ ...(await run), flagged: true });
    await db.putCard({ ...(await table), flagged: true });
    await db.putCard({ id: 'user:zed', rank: 0, word: 'zed', pos: 'noun', definition: 'Letter.', state: 'new', ease: 2.5, interval: 0, due: NOW, reps: 0, lapses: 0, userAdded: true });
    await db.syncWords([{ ...words[0], definition: 'Changed.' }, words[1]], NOW);
    const cards = await db.getAllCards();
    assert.equal(cards.find((c) => c.id === 'run').flagged, undefined);
    assert.equal(cards.find((c) => c.id === 'table').flagged, true);
    assert.equal(cards.find((c) => c.id === 'user:zed').definition, 'Letter.');
  });

  test(`importAll writes cards and meta together (${label})`, async () => {
    const db = await make();
    await db.syncWords(words, NOW);
    const [card] = await db.getAllCards();
    await db.importAll([{ ...card, state: 'review' }], { newLimit: 7 });
    assert.equal((await db.getAllCards()).find((c) => c.id === card.id).state, 'review');
    assert.equal(await db.getMeta('newLimit'), 7);
  });
}
