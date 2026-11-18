import { exportBackup, importBackup } from '../backup.js';
import { getNewLimit, setNewLimit, flaggedReport } from '../settings.js';
import { esc } from './study.js';

async function saveFile(json) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `vocabulario-backup-${stamp}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

const IMPORT_ERRORS = {
  invalid: 'Arquivo inválido. Nada foi alterado.',
  version: 'Esse backup é de uma versão desconhecida do app. Nada foi alterado.',
};

export async function renderSettings($screen, { db, getCards, onImported, onBackedUp, onLimitChange }) {
  const last = await db.getMeta('lastBackupAt');
  const lastText = last ? new Date(last).toLocaleDateString('pt-BR') : 'nunca';
  const limit = await getNewLimit(db);
  const report = flaggedReport(getCards());
  $screen.innerHTML = `
    <section class="card add">
      <h2>Estudo</h2>
      <label class="muted">Palavras novas por dia (1 a 50)
        <input id="limit" type="number" min="1" max="50" value="${limit}">
      </label>
    </section>
    <section class="card add">
      <h2>Cards marcados</h2>
      ${report
        ? `<pre class="report">${esc(report)}</pre><button id="copy-report">Copiar lista</button>`
        : '<p class="muted">Nenhum card marcado.</p>'}
    </section>
    <section class="card add">
      <h2>Backup</h2>
      <p class="muted">Último backup: ${lastText}. Guarde o arquivo no iCloud Drive ou nos Arquivos.</p>
      <button class="primary" id="export">Exportar progresso</button>
      <label class="muted">Importar backup
        <input id="import" type="file" accept="application/json,.json">
      </label>
      <p id="backup-msg" class="muted" role="status"></p>
    </section>`;
  document.getElementById('limit').onchange = async (e) => {
    const value = await setNewLimit(db, e.target.value);
    e.target.value = value;
    onLimitChange(value);
  };
  const $copy = document.getElementById('copy-report');
  if ($copy) $copy.onclick = async () => { await navigator.clipboard?.writeText(report); $copy.textContent = 'Copiado ✓'; };
  const $msg = document.getElementById('backup-msg');
  document.getElementById('export').onclick = async () => {
    const saved = await saveFile(await exportBackup(db));
    if (saved) {
      await db.setMeta('lastBackupAt', Date.now());
      onBackedUp();
      $msg.textContent = 'Backup exportado.';
    }
  };
  document.getElementById('import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await importBackup(db, await file.text());
    if (result.ok) {
      await onImported();
      $msg.textContent = 'Backup importado.';
    } else {
      $msg.textContent = IMPORT_ERRORS[result.reason];
    }
  };
}
