const DEFAULT_LIMIT = 10;

export async function getNewLimit(db) {
  return (await db.getMeta('newLimit')) ?? DEFAULT_LIMIT;
}

export async function setNewLimit(db, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return getNewLimit(db);
  const limit = Math.min(50, Math.max(1, Math.round(n)));
  await db.setMeta('newLimit', limit);
  return limit;
}

export function flaggedReport(cards) {
  return cards
    .filter((c) => c.flagged)
    .map((c) => `${c.word} (${c.pos}): ${c.definition}`)
    .join('\n');
}
