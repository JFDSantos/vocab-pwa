const HOUR = 60 * 60 * 1000;
const DAY_START_HOUR = 4;

export function studyDay(now) {
  const d = new Date(now - DAY_START_HOUR * HOUR);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildQueue(cards, { now, newLimit, newDoneToday, extraNew = 0, reviewBatch = 50 }) {
  const due = cards
    .filter((c) => c.state !== 'new' && c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, reviewBatch);

  const fresh = cards.filter((c) => c.state === 'new');
  const added = fresh.filter((c) => c.userAdded);
  const slots = Math.max(0, newLimit - newDoneToday + extraNew);
  const listed = fresh
    .filter((c) => !c.userAdded)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, slots);

  return [...due, ...added, ...listed];
}
