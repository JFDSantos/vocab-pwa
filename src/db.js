import { newCardState } from './scheduler.js';

const DB_VERSION = 1;

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
    async seedIfEmpty(words, now) {
      const count = await run('cards', 'readonly', (s) => wrap(s.count()));
      if (count > 0) return;
      await run('cards', 'readwrite', (s) => {
        for (const w of words) s.put({ ...w, ...newCardState(now) });
      });
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
    async seedIfEmpty(words, now) {
      if (cards.size > 0) return;
      for (const w of words) cards.set(w.id, { ...w, ...newCardState(now) });
    },
    getAllCards: async () => [...cards.values()],
    putCard: async (card) => void cards.set(card.id, card),
    deleteCard: async (id) => void cards.delete(id),
    getMeta: async (key) => meta.get(key),
    setMeta: async (key, value) => void meta.set(key, value),
  };
}
