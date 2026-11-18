import test from 'node:test';
import assert from 'node:assert/strict';
import { newCardState, schedule } from '../src/scheduler.js';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const review = (over = {}) => ({ state: 'review', ease: 2.5, interval: 10, due: NOW, reps: 5, lapses: 0, ...over });

test('again on new card', () => {
  const c = schedule(newCardState(NOW), 'again', NOW);
  assert.equal(c.state, 'learning');
  assert.equal(c.due, NOW + 10 * 60 * 1000);
  assert.equal(c.lapses, 0);
});

test('again on review card', () => {
  const c = schedule(review(), 'again', NOW);
  assert.equal(c.state, 'learning');
  assert.equal(c.lapses, 1);
  assert.ok(Math.abs(c.ease - 2.3) < 1e-9);
  assert.equal(schedule(review({ ease: 1.4 }), 'again', NOW).ease, 1.3);
});

test('good on new card', () => {
  const c = schedule(newCardState(NOW), 'good', NOW);
  assert.equal(c.state, 'review');
  assert.equal(c.interval, 1);
  assert.equal(c.due, NOW + DAY);
});

test('easy on new card', () => {
  assert.equal(schedule(newCardState(NOW), 'easy', NOW).interval, 4);
});

test('good on review card', () => {
  const old = review();
  assert.equal(schedule(old, 'good', NOW).interval, Math.round(old.interval * old.ease));
});

test('hard on review card', () => {
  const old = review();
  const c = schedule(old, 'hard', NOW);
  assert.equal(c.interval, Math.max(1, Math.round(old.interval * 1.2)));
  assert.ok(Math.abs(c.ease - 2.35) < 1e-9);
});

test('easy on review card', () => {
  const old = review();
  const c = schedule(old, 'easy', NOW);
  assert.equal(c.interval, Math.round(old.interval * old.ease * 1.3));
  assert.ok(Math.abs(c.ease - 2.65) < 1e-9);
});

test('does not mutate input', () => {
  const old = review();
  const copy = { ...old };
  schedule(old, 'good', NOW);
  assert.deepEqual(old, copy);
});
