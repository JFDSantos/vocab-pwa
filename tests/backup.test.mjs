import test from 'node:test';
import assert from 'node:assert/strict';
import { exportBackup, importBackup, backupDue, requestPersistence } from '../src/backup.js';
import { openMemoryDb } from '../src/db.js';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const words = [
  { id: 'run', rank: 1, word: 'run', pos: 'verb', definition: 'To move fast.' },
  { id: 'table', rank: 2, word: 'table', pos: 'noun', definition: 'A piece of furniture.' },
];

async function seeded() {
  const db = openMemoryDb();
  await db.syncWords(words, NOW);
  return db;
}

test('roundtrip export→import restores progress', async () => {
  const a = await seeded();
  const [card] = await a.getAllCards();
  await a.putCard({ ...card, state: 'review', interval: 5, flagged: true });
  await a.setMeta('newLimit', 25);
  const json = await exportBackup(a);

  const b = await seeded();
  assert.deepEqual(await importBackup(b, json), { ok: true });
  const restored = (await b.getAllCards()).find((c) => c.id === card.id);
  assert.equal(restored.state, 'review');
  assert.equal(restored.interval, 5);
  assert.equal(restored.flagged, true);
  assert.equal(await b.getMeta('newLimit'), 25);
});

test('importing malformed JSON returns invalid and leaves data untouched', async () => {
  const db = await seeded();
  const before = await db.getAllCards();
  assert.deepEqual(await importBackup(db, '{not json'), { ok: false, reason: 'invalid' });
  assert.deepEqual(await importBackup(db, JSON.stringify({ version: 1, cards: [{ nope: true }] })), { ok: false, reason: 'invalid' });
  assert.deepEqual(await importBackup(db, JSON.stringify([1, 2])), { ok: false, reason: 'invalid' });
  assert.deepEqual(await db.getAllCards(), before);
});

test('importing version 99 returns version', async () => {
  const db = await seeded();
  assert.deepEqual(await importBackup(db, JSON.stringify({ version: 99, cards: [] })), { ok: false, reason: 'version' });
});

test('backupDue true when never backed up', () => {
  assert.equal(backupDue(undefined, NOW), true);
});

test('backupDue false at 13 days, true at 14', () => {
  assert.equal(backupDue(NOW - 13 * DAY, NOW), false);
  assert.equal(backupDue(NOW - 14 * DAY, NOW), true);
});

test('requestPersistence returns false when API missing', async () => {
  assert.equal(await requestPersistence(), false);
});

test('requestPersistence returns the browser answer when available', async () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage: { persist: async () => true } } });
  try {
    assert.equal(await requestPersistence(), true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', saved);
  }
});

const goodCard = { id: 'run', rank: 1, word: 'run', pos: 'verb', definition: 'To move fast.', state: 'review', ease: 2.5, interval: 3, due: NOW, reps: 2, lapses: 0 };
const bundle = (cards, meta) => JSON.stringify({ version: 1, cards, meta });

test('rejects cards that have the right shape but miss fields the app relies on', async () => {
  const db = await seeded();
  const before = await db.getAllCards();
  for (const bad of [
    { id: 'run', state: 'review', due: 0 },
    { ...goodCard, definition: undefined },
    { ...goodCard, interval: 'x' },
    { ...goodCard, reps: NaN },
    { ...goodCard, state: 'weird' },
    { ...goodCard, ipa: 5 },
  ]) {
    assert.deepEqual(await importBackup(db, bundle([bad], {})), { ok: false, reason: 'invalid' });
  }
  assert.deepEqual(await db.getAllCards(), before);
});

test('rejects meta values of the wrong type', async () => {
  const db = await seeded();
  const before = await db.getAllCards();
  for (const meta of [{ newLimit: 'abc' }, { newLimit: 99 }, { today: { day: 5 } }, { lastBackupAt: 'yesterday' }, 'oops']) {
    assert.deepEqual(await importBackup(db, bundle([goodCard], meta)), { ok: false, reason: 'invalid' });
  }
  assert.equal(await db.getMeta('newLimit'), undefined);
  assert.deepEqual(await db.getAllCards(), before);
});

test('accepts a complete backup, including meta', async () => {
  const db = await seeded();
  const meta = { newLimit: 12, today: { day: '2026-11-17', done: 3, extra: 0 }, lastBackupAt: NOW };
  assert.deepEqual(await importBackup(db, bundle([goodCard], meta)), { ok: true });
  assert.deepEqual(await db.getMeta('today'), meta.today);
});
