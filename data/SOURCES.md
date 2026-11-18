# Fontes dos dados

- **Lista de frequência:** pacote Python `wordfreq` 3.1.1, `top_n_list('en', 6000)`. Dados sob CC BY-SA 4.0, código sob Apache 2.0. Obtida em 2026-11-17.
- **Definições, exemplos, IPA (en-US) e traduções pt:** Wiktionary (en.wiktionary.org), extraído pelo Wiktextract e baixado de kaikki.org, palavra por palavra, em 2026-11-17. Texto sob CC BY-SA 4.0 / GFDL. Atribuição obrigatória (tela "Sobre").
- **Seleção:** primeiro sentido limpo (sem gírias, vulgar, obsoleto, forma flexionada) da entrada com mais sentidos; definição mais curta (≤140 caracteres) desse sentido. Palavras sem definição curta utilizável saem e a próxima da lista entra. Nomes e abreviações listados em `data/exclude.txt`.
- **Tradução pt:** primeira tradução em português listada na entrada; pode não corresponder ao sentido escolhido. Use "reportar card ruim".

## Regerar

```bash
python3 -c "from wordfreq import top_n_list; open('.cache/freq.txt','w').write('\n'.join(top_n_list('en', 6000)))"
NODE_USE_ENV_PROXY=1 node scripts/fetch-wiktextract.mjs .cache/freq.txt .cache/wiktextract.jsonl 4800
node scripts/build-data.mjs .cache/freq.txt .cache/wiktextract.jsonl data/words.json 3000 data/exclude.txt
```
