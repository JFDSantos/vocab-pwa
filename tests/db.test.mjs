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

test('seedIfEmpty creates one new card per word', async () => {
  const db = await openDb(freshName());
  await db.seedIfEmpty(words, NOW);
  const cards = await db.getAllCards();
  assert.equal(cards.length, 2);
  const run = cards.find((c) => c.id === 'run');
  assert.equal(run.state, 'new');
  assert.equal(run.definition, 'To move fast.');
  assert.equal(run.rank, 1);
});

test('seedIfEmpty is idempotent', async () => {
  const db = await openDb(freshName());
  await db.seedIfEmpty(words, NOW);
  await db.seedIfEmpty(words, NOW + 1000);
  assert.equal((await db.getAllCards()).length, 2);
});

test('putCard persists changes across reopen', async () => {
  const name = freshName();
  const db = await openDb(name);
  await db.seedIfEmpty(words, NOW);
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
  await db.seedIfEmpty(words, NOW);
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
  await db.seedIfEmpty(words, NOW);
  await db.seedIfEmpty(words, NOW);
  const [card] = await db.getAllCards();
  await db.putCard({ ...card, state: 'review' });
  assert.equal((await db.getAllCards()).find((c) => c.id === card.id).state, 'review');
  await db.deleteCard('table');
  assert.equal((await db.getAllCards()).length, 1);
  await db.setMeta('k', 1);
  assert.equal(await db.getMeta('k'), 1);
});
