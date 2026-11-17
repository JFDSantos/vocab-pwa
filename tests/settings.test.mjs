import test from 'node:test';
import assert from 'node:assert/strict';
import { getNewLimit, setNewLimit, flaggedReport } from '../src/settings.js';
import { openMemoryDb } from '../src/db.js';

test('newLimit defaults to 10', async () => {
  assert.equal(await getNewLimit(openMemoryDb()), 10);
});

test('newLimit clamps to 1..50 and persists', async () => {
  const db = openMemoryDb();
  assert.equal(await setNewLimit(db, 100), 50);
  assert.equal(await getNewLimit(db), 50);
  assert.equal(await setNewLimit(db, 0), 1);
  assert.equal(await setNewLimit(db, 12.6), 13);
  assert.equal(await getNewLimit(db), 13);
});

test('newLimit ignores non-numeric input and keeps the current value', async () => {
  const db = openMemoryDb();
  await setNewLimit(db, 20);
  assert.equal(await setNewLimit(db, 'abc'), 20);
  assert.equal(await getNewLimit(db), 20);
});

test('flaggedReport lists only flagged cards, one per line', () => {
  const cards = [
    { id: 'a', word: 'run', pos: 'verb', definition: 'To move fast.', flagged: true },
    { id: 'b', word: 'table', pos: 'noun', definition: 'Furniture.' },
    { id: 'c', word: 'set', pos: 'verb', definition: 'To put.', flagged: true },
  ];
  assert.equal(flaggedReport(cards), 'run (verb): To move fast.\nset (verb): To put.');
  assert.equal(flaggedReport([]), '');
});
