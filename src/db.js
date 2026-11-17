import { newCardState } from './scheduler.js';

const DB_VERSION = 1;
const KEEP_FIELDS = ['state', 'ease', 'interval', 'due', 'reps', 'lapses'];

// Merge a fresh word record into the stored card: content comes from the word list,
// scheduling (and a still-valid flag) from the stored card.
function mergeWord(existing, word, now) {
  if (!existing) return { ...word, ...newCardState(now) };
  const merged = { ...word };
  for (const k of KEEP_FIELDS) merged[k] = existing[k];
  if (existing.flagged && existing.definition === word.definition) merged.flagged = true;
  return merged;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

export async function openDb(name = 'vocab-pwa') {
  const idb = await new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('cards', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });

  const run = async (store, mode, fn) => {
    const tx = idb.transaction(store, mode);
    const result = await fn(tx.objectStore(store));
    await done(tx);
    return result;
  };

  return {
    close: () => idb.close(),
    async syncWords(words, now) {
      await run('cards', 'readwrite', async (store) => {
        const existing = new Map((await wrap(store.getAll())).map((c) => [c.id, c]));
        for (const w of words) {
          const before = existing.get(w.id);
          const merged = mergeWord(before, w, now);
          if (!before || !sameJson(before, merged)) store.put(merged);
        }
      });
    },
    async importAll(cards, meta) {
      const tx = idb.transaction(['cards', 'meta'], 'readwrite');
      for (const c of cards) tx.objectStore('cards').put(c);
      for (const [k, v] of Object.entries(meta)) tx.objectStore('meta').put(v, k);
      await done(tx);
    },
    getAllCards: () => run('cards', 'readonly', (s) => wrap(s.getAll())),
    putCard: (card) => run('cards', 'readwrite', (s) => wrap(s.put(card))),
    deleteCard: (id) => run('cards', 'readwrite', (s) => wrap(s.delete(id))),
    getMeta: (key) => run('meta', 'readonly', (s) => wrap(s.get(key))),
    setMeta: (key, value) => run('meta', 'readwrite', (s) => wrap(s.put(value, key))),
  };
}

export async function isDbAvailable() {
  try {
    if (!globalThis.indexedDB) return false;
    const db = await openDb('vocab-pwa-probe');
    db.close();
    return true;
  } catch {
    return false;
  }
}

// Fallback used when IndexedDB is unavailable: same interface, progress lives only in this session.
export function openMemoryDb() {
  const cards = new Map();
  const meta = new Map();
  return {
    close() {},
    async syncWords(words, now) {
      for (const w of words) cards.set(w.id, mergeWord(cards.get(w.id), w, now));
    },
    async importAll(list, newMeta) {
      for (const c of list) cards.set(c.id, c);
      for (const [k, v] of Object.entries(newMeta)) meta.set(k, v);
    },
    getAllCards: async () => [...cards.values()],
    putCard: async (card) => void cards.set(card.id, card),
    deleteCard: async (id) => void cards.delete(id),
    getMeta: async (key) => meta.get(key),
    setMeta: async (key, value) => void meta.set(key, value),
  };
}
