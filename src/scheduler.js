const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const MIN_EASE = 1.3;

export function newCardState(now) {
  return { state: 'new', ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0 };
}

export function schedule(card, grade, now) {
  const next = { ...card, reps: card.reps + 1 };
  const isReview = card.state === 'review';

  if (grade === 'again') {
    next.state = 'learning';
    next.interval = 0;
    next.due = now + 10 * MIN;
    if (isReview) {
      next.lapses = card.lapses + 1;
      next.ease = Math.max(MIN_EASE, card.ease - 0.2);
    }
    return next;
  }

  next.state = 'review';
  if (grade === 'hard') next.ease = Math.max(MIN_EASE, card.ease - 0.15);
  if (grade === 'easy') next.ease = card.ease + 0.15;

  if (!isReview) {
    next.interval = grade === 'easy' ? 4 : 1;
  } else if (grade === 'hard') {
    next.interval = Math.max(1, Math.round(card.interval * 1.2));
  } else if (grade === 'good') {
    next.interval = Math.round(card.interval * card.ease);
  } else {
    next.interval = Math.round(card.interval * card.ease * 1.3);
  }
  next.due = now + next.interval * DAY;
  return next;
}
