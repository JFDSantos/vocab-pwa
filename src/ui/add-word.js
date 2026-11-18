import { esc } from './study.js';

export function messageFor(result, word) {
  if (result.ok) {
    return result.existing
      ? `“${word}” já está no seu app.`
      : `Palavra “${word}” adicionada. Ela aparece nos seus estudos de hoje.`;
  }
  if (result.reason === 'not-found') return `Palavra “${word}” não encontrada no dicionário.`;
  if (result.reason === 'offline') return 'Sem internet. Conecte-se para adicionar palavras novas.';
  return 'O dicionário online falhou. Tente de novo em instantes.';
}

export function renderAddWord($screen, onSubmit) {
  $screen.innerHTML = `
    <form class="card add" id="add-form">
      <h2>Adicionar palavra</h2>
      <p class="muted">Busca a definição em inglês no dicionário online (precisa de internet).</p>
      <input id="add-input" type="text" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: serendipity" required>
      <button class="primary" type="submit">Adicionar</button>
      <p id="add-msg" class="muted" role="status"></p>
    </form>`;
  const $msg = document.getElementById('add-msg');
  document.getElementById('add-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('add-input');
    const word = input.value.trim();
    $msg.textContent = 'Buscando…';
    const result = await onSubmit(word);
    $msg.innerHTML = esc(messageFor(result, word.toLowerCase()));
    if (result.ok) input.value = '';
  };
}
