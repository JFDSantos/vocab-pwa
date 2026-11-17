# Flashcards de vocabulário em inglês (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA instalável no iPhone com flashcards de vocabulário em inglês (~3.000 palavras do Wiktionary), repetição espaçada, áudio nativo, adição de palavras via API e backup.

**Architecture:** App estático em JavaScript puro (ES modules, sem build). Lógica pura (agendador, fila, backup, dados) isolada em `src/` e testada com o test runner nativo do Node. UI fina por cima. Dados de palavras gerados por script offline e commitados em `data/words.json`. Service worker faz cache de tudo para uso offline.

**Tech Stack:** HTML/CSS/JS puros, IndexedDB, `speechSynthesis`, Service Worker, Node 20+ (`node --test`), `fake-indexeddb` (dev), Playwright (verificação do shell PWA), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-17-vocab-flashcards-pwa-design.md`

## Global Constraints

- Interface em português; conteúdo dos cards (definições, exemplos) em inglês.
- Sem framework, sem etapa de build, sem servidor próprio.
- Todos os caminhos relativos (site de projeto em subcaminho, ex.: `/vocab-pwa/`): `start_url` e `scope` = `./`.
- Verso do card: definição curta em inglês + frase de exemplo + toque opcional para tradução em português (só se existir).
- Botões de resposta: `Errei` / `Difícil` / `Bom` / `Fácil`.
- 10 cards novos por dia por padrão, ajustável; ordem de frequência; "estudar mais" após o limite.
- Revisões atrasadas: lotes de até 50 por sessão. O dia vira às 04:00 locais.
- Áudio: `speechSynthesis`, `lang = "en-US"`, só após toque do usuário.
- Palavras adicionadas via API: só a primeira definição, sem tradução, entram na fila na hora, não contam no limite diário, podem ser apagadas. API: `https://api.dictionaryapi.dev/api/v2/entries/en/<word>`.
- Backup: exportar/importar arquivo JSON; lembrete a cada 14 dias; `navigator.storage.persist()` na inicialização.
- Atribuição ao Wiktionary (CC BY-SA) na tela "Sobre"; dados derivados em repositório público.
- Botão "reportar card ruim" marca o card localmente (`flagged: true`) e permite listar/exportar os marcados.

## Review Focus

- Lista de palavras vazia ou JSON corrompido: o app mostra mensagem clara, não tela em branco.
- IndexedDB indisponível (modo privado/bloqueado): o app avisa que o progresso não será salvo e ainda deixa estudar na sessão.
- "Adicionar palavra" offline, palavra inexistente (404) ou API fora do ar: mensagem em português, nenhum card criado.
- Adicionar uma palavra que já está na lista: não duplica; abre o card existente.
- Importar backup malformado ou de versão desconhecida: rejeita sem apagar o progresso atual.
- Palavra sem IPA ou sem tradução: card renderiza sem campos vazios nem "undefined".
- `speechSynthesis` ausente ou sem voz en-US: botão de áudio desabilita sem erro.
- Mudança de fuso/relógio ou uso entre 00:00 e 04:00: cartões do "dia" não se perdem nem duplicam.

---

## File Structure

```
index.html, styles.css, manifest.webmanifest, sw.js, icons/        shell PWA
src/scheduler.js     agendamento (SM-2 simplificado), puro
src/queue.js         fila diária, limites, dia 04:00, puro
src/db.js            IndexedDB (cards, meta)
src/backup.js        export/import/lembrete
src/speech.js        áudio
src/dictionary-api.js  busca online para "adicionar palavra"
src/app.js, src/ui/  telas: estudo, adicionar, config, sobre
scripts/build-data.mjs   gera data/words.json a partir do Wiktextract
data/words.json      lista gerada e commitada
tests/*.test.mjs, tests/fixtures/
```

### Task 1: Esqueleto do projeto

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `tests/smoke.test.mjs`

**Interfaces:**
- Produces: `npm test` roda `node --test tests/`; `"type": "module"`.

- [ ] **Step 1:** `git init` em `/home/user/vocab-pwa`; criar `package.json` (`type: module`, script `test`, devDependency `fake-indexeddb`).
- [ ] **Step 2:** Escrever `tests/smoke.test.mjs` com um teste `smoke` que faz `assert.equal(1, 1)`. Rodar `npm test`; esperado: 1 teste passa.
- [ ] **Step 3:** Commit `chore: project skeleton`.

### Task 2: Agendador (SM-2 simplificado)

**Files:**
- Create: `src/scheduler.js`
- Test: `tests/scheduler.test.mjs`

**Interfaces:**
- Produces:
  - `type Grade = 'again' | 'hard' | 'good' | 'easy'`
  - `type CardState = { state: 'new'|'learning'|'review', ease: number, interval: number /*dias*/, due: number /*epoch ms*/, reps: number, lapses: number }`
  - `newCardState(now: number): CardState` → `{state:'new', ease:2.5, interval:0, due:now, reps:0, lapses:0}`
  - `schedule(card: CardState, grade: Grade, now: number): CardState` (puro, não muta)

- [ ] **Step 1: Testes** (nomes e asserts):
  - `again on new card` → `state 'learning'`, `due === now + 10*60*1000`, `lapses` inalterado em card novo.
  - `again on review card` → `state 'learning'`, `lapses +1`, `ease` cai 0.2 (mínimo 1.3).
  - `good on new card` → `state 'review'`, `interval === 1`, `due === now + 86400000`.
  - `easy on new card` → `interval === 4`.
  - `good on review card` → `interval === Math.round(old.interval * old.ease)`.
  - `hard on review card` → `interval === Math.max(1, Math.round(old.interval * 1.2))`, `ease` -0.15.
  - `easy on review card` → intervalo `round(old*ease*1.3)`, `ease` +0.15.
  - `does not mutate input`.
- [ ] **Step 2:** Rodar testes; esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `newCardState` e `schedule` conforme tabela acima; `reps +1` em toda resposta.
- [ ] **Step 4:** Rodar testes; esperado: PASS. Commit `feat: spaced-repetition scheduler`.

### Task 3: Fila diária

**Files:**
- Create: `src/queue.js`
- Test: `tests/queue.test.mjs`

**Interfaces:**
- Consumes: `CardState` (Task 2).
- Produces:
  - `type Card = CardState & { id: string, rank: number, userAdded?: boolean }`
  - `studyDay(now: number): string` → `YYYY-MM-DD` local, deslocado −4h.
  - `buildQueue(cards: Card[], opts: { now: number, newLimit: number, newDoneToday: number, extraNew?: number, reviewBatch?: number /*padrão 50*/ }): Card[]` → ordem: revisões vencidas (mais atrasadas primeiro, máx. `reviewBatch`), depois cards `userAdded` novos (sem contar no limite), depois novos por `rank` até `newLimit - newDoneToday + (extraNew ?? 0)`.

- [ ] **Step 1: Testes:**
  - `studyDay at 03:59 belongs to previous day` e `at 04:00 belongs to new day` (usar datas locais construídas com `new Date(y,m,d,h,mi)`).
  - `overdue reviews come first, most overdue first`.
  - `caps reviews at reviewBatch`.
  - `new cards follow rank order and respect newLimit - newDoneToday`.
  - `user-added new cards are always included and do not consume the limit`.
  - `extraNew adds more new cards`.
  - `empty card list returns []`.
- [ ] **Step 2:** Rodar; esperado FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat: daily study queue`.

### Task 4: Pipeline de dados (Wiktionary → `data/words.json`)

**Files:**
- Create: `scripts/build-data.mjs`, `tests/fixtures/wiktextract-sample.jsonl`, `tests/fixtures/freq-sample.txt`, `data/words.json`, `data/SOURCES.md`
- Test: `tests/build-data.test.mjs`

**Interfaces:**
- Produces:
  - `pickEntry(entries: WiktextractEntry[]): WordRecord | null`
  - `type WordRecord = { id: string, rank: number, word: string, pos: string, ipa?: string, definition: string, example?: string, pt?: string }`
  - `buildWords(freqList: string[], entries: Iterable<WiktextractEntry>, target: number): WordRecord[]`
  - CLI: `node scripts/build-data.mjs <freq.txt> <wiktextract.jsonl> data/words.json 3000`

- [ ] **Step 1: Testes** com fixtures pequenas (inclua: palavra com vários sentidos, sem IPA, sem tradução pt, só forma flexionada, nome próprio, sem glosa curta):
  - `picks first sense with shortest gloss`.
  - `uses en-US IPA when present, omits ipa otherwise`.
  - `includes pt translation only when entry has lang_code "pt"`.
  - `skips entries without usable short gloss (>140 chars or empty) and fills from next frequency word`.
  - `skips proper nouns and inflected forms ("form-of" glosses)`.
  - `assigns rank 1..N contiguous in frequency order`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar `pickEntry`/`buildWords`/CLI. A fonte da lista de frequência (lemas, licença aberta) é escolha do construtor; registrar fonte, licença e data em `data/SOURCES.md`. Dump do Wiktextract: baixar o JSONL de inglês do kaikki.org; só ler, não commitar o dump.
- [ ] **Step 4:** PASS. **Step 5:** Rodar o CLI real com alvo 3000; verificar `data/words.json` com 3000 registros, nenhum com `definition` vazia, e abrir 20 aleatórios para checar legibilidade. Commit `feat: build word data from Wiktionary`.

### Task 5: Camada de armazenamento

**Files:**
- Create: `src/db.js`
- Test: `tests/db.test.mjs` (usa `fake-indexeddb/auto`)

**Interfaces:**
- Consumes: `Card`, `WordRecord`, `newCardState`.
- Produces:
  - `openDb(): Promise<Db>`; `Db.seedIfEmpty(words: WordRecord[], now: number): Promise<void>`
  - `Db.getAllCards(): Promise<(Card & WordRecord & {flagged?: boolean})[]>`
  - `Db.putCard(card): Promise<void>`; `Db.deleteCard(id: string): Promise<void>`
  - `Db.getMeta<T>(key: string): Promise<T|undefined>`; `Db.setMeta(key: string, value: unknown): Promise<void>`
  - `isDbAvailable(): Promise<boolean>`

- [ ] **Step 1: Testes:** `seedIfEmpty creates one new card per word`; `seedIfEmpty is idempotent`; `putCard persists changes across reopen`; `deleteCard removes`; `meta roundtrip`; `isDbAvailable is false when indexedDB is undefined` (apagar `globalThis.indexedDB` no teste).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar com stores `cards` (keyPath `id`) e `meta`. **Step 4:** PASS. Commit `feat: IndexedDB storage`.

### Task 6: Tela de estudo + áudio

**Files:**
- Create: `index.html`, `styles.css`, `src/app.js`, `src/ui/study.js`, `src/speech.js`
- Test: `tests/speech.test.mjs`, `tests/study-view.test.mjs`

**Interfaces:**
- Consumes: `buildQueue`, `schedule`, `Db`.
- Produces:
  - `canSpeak(): boolean`; `speak(text: string): void` (`lang: 'en-US'`).
  - `renderCard(card: Card & WordRecord): { frontHtml: string, backHtml: string }` — omite IPA/pt/exemplo ausentes; escapa HTML.
  - Tela: frente (palavra, IPA, 🔊) → toque revela verso → 4 botões; botão "ver em português" só se `pt`; botão "reportar card ruim".

- [ ] **Step 1: Testes:** `renderCard omits ipa line when ipa missing`; `omits pt toggle when pt missing`; `escapes html in word and example`; `canSpeak false when speechSynthesis undefined`; `speak sets lang en-US` (stub de `speechSynthesis`/`SpeechSynthesisUtterance`).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Fluxo do app: carregar `data/words.json`, `seedIfEmpty`, `buildQueue`, responder → `schedule` → `putCard`, atualizar `newDoneToday` em meta por `studyDay`. Estados vazios: fila vazia ("Nada para hoje" + botão "Estudar mais"); JSON inválido → mensagem; DB indisponível → aviso e progresso só em memória.
- [ ] **Step 4:** PASS. **Step 5:** Verificação manual com `npx serve .` (ou `python3 -m http.server`) e Playwright screenshot em viewport iPhone (390×844) mostrando frente e verso. Commit `feat: study screen and audio`.

### Task 7: Shell PWA (manifest, service worker, ícones)

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`
- Modify: `index.html`
- Test: `tests/pwa-shell.test.mjs` (Playwright, Chromium pré-instalado)

**Interfaces:**
- Produces: `sw.js` faz precache de `index.html`, `styles.css`, `src/**`, `data/words.json`, ícones; cache versionado (`CACHE = 'vocab-v1'`); respostas de `api.dictionaryapi.dev` nunca vão para o cache.

- [ ] **Step 1: Testes (Playwright):** `manifest has relative start_url and scope "./"`; `index.html links manifest and apple-touch-icon and apple-mobile-web-app-capable`; `after first load, going offline still renders the study screen`; `dictionary API requests are not cached`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar; gerar ícones simples (PNG) por script. Registrar o SW com caminho relativo.
- [ ] **Step 4:** PASS. Commit `feat: installable offline PWA shell`.

### Task 8: Adicionar palavra via API

**Files:**
- Create: `src/dictionary-api.js`, `src/ui/add-word.js`
- Test: `tests/dictionary-api.test.mjs`

**Interfaces:**
- Consumes: `Db`, `WordRecord`.
- Produces:
  - `lookupWord(word: string, fetchImpl = fetch): Promise<{ ok: true, record: WordRecord } | { ok: false, reason: 'not-found'|'offline'|'error' }>` — `record.id = 'user:' + word.toLowerCase()`, só primeira definição, `rank` ignorado.
  - `addWord(db: Db, word: string, now: number): Promise<{ ok: true, existing: boolean } | { ok: false, reason: string }>` — se já existir (qualquer id com mesmo `word`), não duplica.

- [ ] **Step 1: Testes** (com `fetchImpl` falso): `maps first definition, ipa and example`; `404 returns not-found`; `fetch rejecting returns offline`; `500 returns error`; `addWord does not duplicate a word from the main list` (`existing: true`); `added card is userAdded and state new`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar; UI com campo de texto, mensagens em português por `reason`. Cards adicionados mostram botão "apagar".
- [ ] **Step 4:** PASS. Commit `feat: add word from dictionary API`.

### Task 9: Backup, lembrete e persistência

**Files:**
- Create: `src/backup.js`, `src/ui/settings.js`
- Test: `tests/backup.test.mjs`

**Interfaces:**
- Consumes: `Db`.
- Produces:
  - `exportBackup(db: Db): Promise<string>` → JSON `{ version: 1, exportedAt, cards: [...], meta: {...} }`
  - `importBackup(db: Db, json: string): Promise<{ ok: true } | { ok: false, reason: 'invalid'|'version' }>` — valida antes de gravar; não altera nada se inválido.
  - `backupDue(lastBackupAt: number|undefined, now: number): boolean` — `true` se nunca ou ≥ 14 dias.
  - `requestPersistence(): Promise<boolean>` — chama `navigator.storage.persist()` se existir.

- [ ] **Step 1: Testes:** `roundtrip export→import restores progress`; `importing malformed JSON returns invalid and leaves data untouched`; `importing version 99 returns version`; `backupDue true when never backed up`; `false at 13 days, true at 14`; `requestPersistence returns false when API missing`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Export usa `navigator.share` com arquivo quando disponível (iOS) e cai para download via `<a download>`. Banner de lembrete no topo quando `backupDue`.
- [ ] **Step 4:** PASS. Commit `feat: backup export/import and reminder`.

### Task 10: Configurações, Sobre, cards marcados e deploy

**Files:**
- Create: `src/ui/about.js`; Modify: `src/ui/settings.js`, `README.md`
- Create: `.github/workflows/pages.yml` (ou instruções de Pages "deploy from branch")

**Interfaces:**
- Consumes: `Db.getMeta/setMeta`, `buildQueue`.

- [ ] **Step 1:** Config: limite diário (1–50, padrão 10) salvo em meta `newLimit`; lista de cards marcados com botão "copiar lista". Tela "Sobre": atribuição ao Wiktionary (CC BY-SA, link) e fonte da lista de frequência (de `data/SOURCES.md`).
- [ ] **Step 2:** Teste `tests/settings.test.mjs`: `newLimit clamps to 1..50 and persists`.
- [ ] **Step 3:** Rodar `npm test` completo e a verificação Playwright; tudo deve passar.
- [ ] **Step 4:** Criar repositório público no GitHub, push, habilitar Pages. Abrir a URL no iPhone, "Adicionar à Tela de Início", e verificar manualmente: abre em tela cheia, funciona em modo avião, áudio toca após toque, backup exporta.
- [ ] **Step 5:** Commit `docs: about screen, settings, deploy`.

---

## Self-Review

- **Cobertura da spec:** cards e verso (T6), repetição espaçada (T2/T3), offline/instalável (T7), adicionar palavra (T8), backup/persistência (T9), áudio (T6), Wiktionary/atribuição/reportar (T4/T6/T10), limite diário e "estudar mais" (T3/T10), GitHub Pages (T7/T10). Sem lacunas conhecidas.
- **Consistência de tipos:** `Card`, `CardState`, `WordRecord`, `Db` definidos em T2–T5 e usados com os mesmos nomes depois.
- **Review Focus:** cada linha tem teste ou verificação nas tasks 4–9 (JSON vazio/corrompido e DB indisponível em T6, API em T8, duplicatas em T8, backup inválido em T9, campos ausentes e áudio em T6, virada às 04:00 em T3).
