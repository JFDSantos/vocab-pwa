import { newCardState } from './scheduler.js';

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

export async function lookupWord(input, fetchImpl = globalThis.fetch) {
  const word = String(input).trim().toLowerCase();
  if (!/^[a-z]+(?:['-][a-z]+)*$/.test(word)) return { ok: false, reason: 'not-found' };

  let res;
  try {
    res = await fetchImpl(API + encodeURIComponent(word));
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (res.status === 404) return { ok: false, reason: 'not-found' };
  if (!res.ok) return { ok: false, reason: 'error' };

  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'error' };
  }
  const entry = Array.isArray(body) ? body[0] : null;
  const meaning = entry?.meanings?.find((m) => m.definitions?.[0]?.definition);
  if (!meaning) return { ok: false, reason: 'not-found' };

  const first = meaning.definitions[0];
  const ipa = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text;
  const record = { id: `user:${word}`, rank: 0, word, pos: meaning.partOfSpeech, definition: first.definition };
  if (ipa) record.ipa = ipa;
  if (first.example) record.example = first.example;
  return { ok: true, record };
}

export async function addWord(db, input, now, fetchImpl = globalThis.fetch) {
  const word = String(input).trim().toLowerCase();
  const cards = await db.getAllCards();
  if (cards.some((c) => c.word === word)) return { ok: true, existing: true };

  const found = await lookupWord(word, fetchImpl);
  if (!found.ok) return found;
  await db.putCard({ ...found.record, ...newCardState(now), userAdded: true });
  return { ok: true, existing: false };
}
