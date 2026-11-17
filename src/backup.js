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

const isCard = (c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.state === 'string' && typeof c.due === 'number';

export async function importBackup(db, json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'invalid' };
  if (data.version !== VERSION) return { ok: false, reason: typeof data.version === 'number' ? 'version' : 'invalid' };
  if (!Array.isArray(data.cards) || !data.cards.every(isCard)) return { ok: false, reason: 'invalid' };

  for (const card of data.cards) await db.putCard(card);
  for (const key of META_KEYS) {
    if (data.meta && data.meta[key] !== undefined) await db.setMeta(key, data.meta[key]);
  }
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
