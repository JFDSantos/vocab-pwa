export function renderAbout($screen) {
  $screen.innerHTML = `
    <section class="card add">
      <h2>Sobre</h2>
      <p class="muted">Definições, exemplos, pronúncia (IPA) e traduções vêm do
        <a href="https://en.wiktionary.org/">Wiktionary</a>, sob a licença
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>,
        extraídos pelo <a href="https://github.com/tatuylonen/wiktextract">Wiktextract</a>.</p>
      <p class="muted">A lista de palavras mais frequentes vem do pacote
        <a href="https://github.com/rspeer/wordfreq">wordfreq</a> (CC BY-SA 4.0).</p>
      <p class="muted">Os dados derivados deste app seguem a mesma licença CC BY-SA.
        Alguma definição ruim? Use “Reportar card ruim” na tela de estudo.</p>
    </section>`;
}
