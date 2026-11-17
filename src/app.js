import { openDb, openMemoryDb, isDbAvailable } from './db.js';
import { buildQueue, studyDay } from './queue.js';
import { schedule } from './scheduler.js';
import { renderCard } from './ui/study.js';
import { speak, canSpeak } from './speech.js';
import { addWord } from './dictionary-api.js';
import { renderAddWord } from './ui/add-word.js';
import { renderSettings } from './ui/settings.js';
import { renderAbout } from './ui/about.js';
import { getNewLimit } from './settings.js';
import { backupDue, requestPersistence } from './backup.js';

const $screen = document.getElementById('screen');
const $counts = document.getElementById('counts');
const $notice = document.getElementById('notice');

const state = { db: null, cards: [], newLimit: 10, today: { day: '', done: 0, extra: 0 }, focusId: null, view: 'study', showingDone: false };

function notice(text) {
  $notice.textContent = text;
  $notice.hidden = !text;
}

async function loadWords() {
  const res = await fetch('./data/words.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const words = await res.json();
  if (!Array.isArray(words) || words.length === 0) throw new Error('empty');
  return words;
}

async function loadToday() {
  const day = studyDay(Date.now());
  const saved = await state.db.getMeta('today');
  state.today = saved && saved.day === day ? saved : { day, done: 0, extra: 0 };
  state.newLimit = await getNewLimit(state.db);
}

const currentQueue = () =>
  buildQueue(state.cards, { now: Date.now(), newLimit: state.newLimit, newDoneToday: state.today.done, extraNew: state.today.extra });

function showError(message) {
  $screen.innerHTML = `<div class="empty"><p>${message}</p><button class="primary" id="retry">Tentar de novo</button></div>`;
  document.getElementById('retry').onclick = () => location.reload();
}

function showDone() {
  state.showingDone = true;
  $counts.textContent = '';
  $screen.innerHTML = `<div class="empty"><h2>Tudo certo por hoje 🎉</h2><p>Volte mais tarde para revisar, ou estude mais palavras novas agora.</p><button class="primary" id="more">Estudar mais</button></div>`;
  document.getElementById('more').onclick = async () => {
    state.today.extra += 10;
    await state.db.setMeta('today', state.today);
    showNext();
  };
}

function showNext() {
  state.showingDone = false;
  const queue = currentQueue();
  const focus = state.focusId && state.cards.find((c) => c.id === state.focusId);
  state.focusId = null;
  if (queue.length === 0 && !focus) return showDone();
  const card = focus || queue[0];
  $counts.textContent = `${queue.length} na fila`;
  const { frontHtml, backHtml } = renderCard(card);
  $screen.innerHTML = `
    <div class="card" id="card">${frontHtml}<div id="back" hidden>${backHtml}</div></div>
    <button class="primary" id="reveal">Mostrar resposta</button>
    <div class="grades" id="grades" hidden>
      <button data-grade="again">Errei</button><button data-grade="hard">Difícil</button>
      <button data-grade="good">Bom</button><button data-grade="easy">Fácil</button>
    </div>
    <button class="flag" id="flag">Reportar card ruim</button>
    ${card.userAdded ? '<button class="del" id="del">Apagar esta palavra</button>' : ''}`;
  const $ = (id) => document.getElementById(id);
  $('reveal').onclick = () => { $('back').hidden = false; $('grades').hidden = false; $('reveal').hidden = true; };
  $('flag').onclick = async () => { card.flagged = true; await state.db.putCard(card); $('flag').textContent = 'Marcado ✓'; };
  if (card.userAdded) {
    $('del').onclick = async () => {
      await state.db.deleteCard(card.id);
      state.cards = state.cards.filter((c) => c.id !== card.id);
      showNext();
    };
  }
  $('card').onclick = (e) => {
    const action = e.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'speak') speak(action.dataset.text);
    if (action.dataset.action === 'show-pt') { $('card').querySelector('.pt').hidden = false; action.hidden = true; }
  };
  if (!canSpeak()) $('card').querySelector('[data-action="speak"]')?.setAttribute('hidden', '');
  $('grades').onclick = async (e) => {
    const grade = e.target.dataset.grade;
    if (!grade) return;
    const wasNew = card.state === 'new';
    Object.assign(card, schedule(card, grade, Date.now()));
    if (wasNew && !card.userAdded) { state.today.done += 1; await state.db.setMeta('today', state.today); }
    await state.db.putCard(card);
    showNext();
  };
}

function showView(view) {
  state.view = view;
  document.querySelectorAll('#nav [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  if (view === 'add') {
    $counts.textContent = '';
    renderAddWord($screen, async (word) => {
      const result = await addWord(state.db, word, Date.now());
      if (result.ok) state.cards = await state.db.getAllCards();
      if (result.ok && result.existing) {
        state.focusId = result.id;
        showView('study');
      }
      return result;
    });
  } else if (view === 'settings') {
    $counts.textContent = '';
    renderSettings($screen, {
      db: state.db,
      getCards: () => state.cards,
      onLimitChange: (limit) => { state.newLimit = limit; },
      onBackedUp: () => notice(''),
      onImported: async () => { state.cards = await state.db.getAllCards(); await loadToday(); },
    });
  } else if (view === 'about') {
    $counts.textContent = '';
    renderAbout($screen);
  } else {
    showNext();
  }
}

document.getElementById('nav').addEventListener('click', (e) => {
  const view = e.target.dataset.view;
  if (view) showView(view);
});

async function resume() {
  const previousDay = state.today.day;
  await loadToday();
  if (state.view === 'study' && (state.today.day !== previousDay || state.showingDone)) showNext();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.db) resume();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted && state.db) resume();
});

async function init() {
  let words;
  try {
    words = await loadWords();
  } catch {
    return showError('Não consegui carregar a lista de palavras.');
  }
  if (await isDbAvailable()) {
    state.db = await openDb();
  } else {
    state.db = openMemoryDb();
    notice('Seu navegador não permite salvar o progresso. Você pode estudar, mas ele será perdido ao fechar.');
  }
  await state.db.syncWords(words, Date.now());
  state.cards = await state.db.getAllCards();
  await loadToday();
  requestPersistence();
  if (!$notice.textContent && backupDue(await state.db.getMeta('lastBackupAt'), Date.now())) {
    notice('Faça um backup do seu progresso em Config → Exportar progresso.');
  }
  showNext();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

init();
