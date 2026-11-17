import { exportBackup, importBackup } from '../backup.js';

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

export async function renderSettings($screen, { db, onImported, onBackedUp }) {
  const last = await db.getMeta('lastBackupAt');
  const lastText = last ? new Date(last).toLocaleDateString('pt-BR') : 'nunca';
  $screen.innerHTML = `
    <section class="card add">
      <h2>Backup</h2>
      <p class="muted">Último backup: ${lastText}. Guarde o arquivo no iCloud Drive ou nos Arquivos.</p>
      <button class="primary" id="export">Exportar progresso</button>
      <label class="muted">Importar backup
        <input id="import" type="file" accept="application/json,.json">
      </label>
      <p id="backup-msg" class="muted" role="status"></p>
    </section>`;
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
