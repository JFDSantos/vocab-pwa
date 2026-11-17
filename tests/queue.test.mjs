import test from 'node:test';
import assert from 'node:assert/strict';
import { studyDay, buildQueue } from '../src/queue.js';

const NOW = new Date(2026, 0, 5, 12, 0).getTime();
const DAY = 86_400_000;
const mk = (id, over = {}) => ({ id, rank: Number(id.replace(/\D/g, '')) || 0, state: 'new', ease: 2.5, interval: 0, due: NOW, reps: 0, lapses: 0, ...over });
const overdue = (id, daysAgo) => mk(id, { state: 'review', interval: 3, due: NOW - daysAgo * DAY });
const opts = (o = {}) => ({ now: NOW, newLimit: 10, newDoneToday: 0, ...o });

test('studyDay at 03:59 belongs to previous day', () => {
  assert.equal(studyDay(new Date(2026, 0, 5, 3, 59).getTime()), '2026-01-04');
});

test('studyDay at 04:00 belongs to new day', () => {
  assert.equal(studyDay(new Date(2026, 0, 5, 4, 0).getTime()), '2026-01-05');
});

test('overdue reviews come first, most overdue first', () => {
  const q = buildQueue([mk('w1'), overdue('r1', 1), overdue('r2', 5)], opts());
  assert.deepEqual(q.map((c) => c.id), ['r2', 'r1', 'w1']);
});

test('reviews not yet due are excluded', () => {
  const future = mk('r1', { state: 'review', due: NOW + DAY });
  assert.deepEqual(buildQueue([future], opts()), []);
});

test('caps reviews at reviewBatch', () => {
  const cards = [overdue('r1', 1), overdue('r2', 2), overdue('r3', 3)];
  assert.equal(buildQueue(cards, opts({ reviewBatch: 2 })).length, 2);
});

test('new cards follow rank order and respect newLimit - newDoneToday', () => {
  const cards = [mk('w3'), mk('w1'), mk('w2'), mk('w4')];
  const q = buildQueue(cards, opts({ newLimit: 3, newDoneToday: 1 }));
  assert.deepEqual(q.map((c) => c.id), ['w1', 'w2']);
});

test('user-added new cards are always included and do not consume the limit', () => {
  const cards = [mk('w1'), mk('w2'), mk('u1', { userAdded: true, rank: 0 })];
  const q = buildQueue(cards, opts({ newLimit: 1 }));
  assert.deepEqual(q.map((c) => c.id), ['u1', 'w1']);
});

test('extraNew adds more new cards', () => {
  const cards = [mk('w1'), mk('w2'), mk('w3')];
  const q = buildQueue(cards, opts({ newLimit: 1, extraNew: 1 }));
  assert.deepEqual(q.map((c) => c.id), ['w1', 'w2']);
});

test('empty card list returns []', () => {
  assert.deepEqual(buildQueue([], opts()), []);
});
