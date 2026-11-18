import test from 'node:test';
import assert from 'node:assert/strict';
import { messageFor } from '../src/ui/add-word.js';

test('messageFor maps every outcome to a Portuguese message', () => {
  assert.match(messageFor({ ok: true, existing: false }, 'run'), /adicionada/i);
  assert.match(messageFor({ ok: true, existing: true }, 'run'), /já está/i);
  assert.match(messageFor({ ok: false, reason: 'not-found' }, 'zzz'), /não encontr/i);
  assert.match(messageFor({ ok: false, reason: 'offline' }, 'run'), /internet/i);
  assert.match(messageFor({ ok: false, reason: 'error' }, 'run'), /tente/i);
});
