const VERSION = 1;
const META_KEYS = ['today', 'newLimit', 'lastBackupAt'];
const BACKUP_INTERVAL_DAYS = 14;

export async function exportBackup(db) {
  const meta = {};
  for (const key of META_KEYS) {
    const value = await db.getMeta(key);
    if (value !== undefined) meta[key] = value;
  }
  return JSON.stringify({ version: VERSION, exportedAt: Date.now(), cards: await db.getAllCards(), meta });
}

const STATES = ['new', 'learning', 'review'];
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const optStr = (v) => v === undefined || typeof v === 'string';

const isCard = (c) =>
  c && typeof c === 'object' &&
  isStr(c.id) && isStr(c.word) && isStr(c.pos) && isStr(c.definition) &&
  STATES.includes(c.state) &&
  [c.ease, c.interval, c.due, c.reps, c.lapses].every(isNum) &&
  optStr(c.ipa) && optStr(c.example) && optStr(c.pt);

const META_VALIDATORS = {
  newLimit: (v) => Number.isInteger(v) && v >= 1 && v <= 50,
  today: (v) => v && typeof v === 'object' && isStr(v.day) && isNum(v.done) && isNum(v.extra),
  lastBackupAt: isNum,
};

function validMeta(meta) {
  if (meta === undefined) return true;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  return Object.entries(meta).every(([k, v]) => !(k in META_VALIDATORS) || META_VALIDATORS[k](v));
}

export async function importBackup(db, json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'invalid' };
  if (data.version !== VERSION) return { ok: false, reason: typeof data.version === 'number' ? 'version' : 'invalid' };
  if (!Array.isArray(data.cards) || !data.cards.every(isCard) || !validMeta(data.meta)) return { ok: false, reason: 'invalid' };

  const meta = {};
  for (const key of META_KEYS) if (data.meta?.[key] !== undefined) meta[key] = data.meta[key];
  await db.importAll(data.cards, meta);
  return { ok: true };
}

export function backupDue(lastBackupAt, now) {
  if (typeof lastBackupAt !== 'number') return true;
  return now - lastBackupAt >= BACKUP_INTERVAL_DAYS * 86_400_000;
}

export async function requestPersistence() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
