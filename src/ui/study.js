export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function renderCard(card) {
  const frontHtml = [
    `<div class="word">${esc(card.word)}</div>`,
    card.ipa ? `<div class="ipa">${esc(card.ipa)}</div>` : '',
    `<button class="speak" data-action="speak" data-text="${esc(card.word)}" aria-label="Ouvir pronúncia">🔊</button>`,
  ].join('');

  const backHtml = [
    `<div class="pos">${esc(card.pos)}</div>`,
    `<div class="definition">${esc(card.definition)}</div>`,
    card.example ? `<div class="example">“${esc(card.example)}”</div>` : '',
    card.pt
      ? `<button class="link" data-action="show-pt">Ver em português</button><div class="pt" hidden>${esc(card.pt)}</div>`
      : '',
  ].join('');

  return { frontHtml, backHtml };
}
