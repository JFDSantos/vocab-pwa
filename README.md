# Vocabulário em inglês (PWA)

Flashcards de vocabulário em inglês para iPhone: ~3.000 palavras mais frequentes, definições do Wiktionary, repetição espaçada, áudio nativo, funciona offline.

- Design: `docs/superpowers/specs/2026-11-17-vocab-flashcards-pwa-design.md`
- Plano: `docs/superpowers/plans/2026-11-17-vocab-flashcards-pwa.md`
- Fontes dos dados e como regenerá-los: `data/SOURCES.md`

## Rodar localmente

```bash
python3 -m http.server 8000   # abra http://localhost:8000
npm test
```

## Publicar no GitHub Pages

1. Crie um repositório público e faça push da branch `main`.
2. No GitHub: Settings → Pages → Source: **GitHub Actions**.
3. O workflow `.github/workflows/pages.yml` publica em `https://<usuario>.github.io/<repo>/`.

## Instalar no iPhone

Abra a URL no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**. Depois de instalado, funciona em modo avião (só "Adicionar palavra" precisa de internet).

## Licença dos dados

Definições, exemplos e traduções: Wiktionary, CC BY-SA 4.0. Lista de frequência: wordfreq, CC BY-SA 4.0.
