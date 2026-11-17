# Flashcards de vocabulário em inglês (PWA para iPhone) — Design

Data: 2026-11-17
Status: rascunho, aguardando aprovação do usuário

## Intenção e porquê

O usuário fala português, tem pouco vocabulário em inglês e acredita que o caminho mais curto para melhorar o inglês é, nesta ordem: vocabulário, depois gramática, depois listening. Quer um app do zero (não há APK de referência), para iPhone, que use palavras vindas de um dicionário. Este documento cobre só a primeira etapa (vocabulário).

## Objetivos

- Estudar as ~3.000 palavras mais frequentes do inglês, em ordem de frequência.
- Card: frente = palavra, pronúncia (IPA) e botão de áudio. Verso = definição curta e simples **em inglês** (escolha do usuário), frase de exemplo e um toque opcional para ver a tradução em português.
- Repetição espaçada: o usuário responde Errei / Difícil / Bom / Fácil e o app agenda a próxima revisão.
- Botão "adicionar palavra": busca online a definição de uma palavra fora da lista e a salva localmente como card.
- Funciona offline para estudar (lista embutida). Só "adicionar palavra" exige internet.
- Instalável na tela inicial do iPhone pelo Safari. Dados e progresso ficam no aparelho.
- Exportar e importar backup do progresso (arquivo).
- Áudio de pronúncia com a voz nativa do iOS (speechSynthesis, en-US), sem custo e offline.

## Não-objetivos (v1)

- Contas, login, sincronização entre aparelhos, servidor próprio.
- Publicação na App Store.
- Exercícios de gramática ou listening (etapas futuras).
- Notificações push.
- Otimizar para Android ou desktop (deve funcionar, mas iPhone é o alvo).

## Anti-objetivos

- Depender de internet para estudar o dia a dia.
- Perder o progresso do usuário.
- Definições difíceis demais para um iniciante (derrota o propósito).
- App pesado, lento ou cheio de configurações.

## Restrições

- iOS: PWA exige https, manifest, service worker e ícone `apple-touch-icon`. Instalação só pelo Safari ("Adicionar à Tela de Início").
- iOS: áudio só toca após um toque do usuário (sem autoplay).
- iOS: o armazenamento do Safari pode ser limpo pelo sistema. Por isso há exportação de backup.
- Hospedagem: GitHub Pages (usuário tem conta no GitHub).
- Licença: a lista de palavras e as definições devem vir de fontes com licença aberta compatível.

## Abordagens consideradas

- **A. Dados embutidos:** lista pré-preparada dentro do app. Offline e rápido, mas a qualidade depende da fonte e exige revisão das definições.
- **B. API online:** busca ao abrir cada palavra. Cobre qualquer palavra, mas precisa de internet e depende de serviço gratuito.
- **C. Híbrido (escolhida pelo usuário):** lista embutida (A) mais "adicionar palavra" via API (B).

Ordem de construção sugerida (minha chamada): primeiro a parte A completa e utilizável; depois "adicionar palavra" em cima dela. Ambas fazem parte da v1.

## Decisões já tomadas

Do usuário:
- Verso do card com definição em inglês.
- Abordagem C.
- Hospedar no GitHub Pages.

Minhas chamadas (o usuário pode corrigir):
- HTML, CSS e JavaScript puros, sem framework nem etapa de build.
- Armazenamento local em IndexedDB.
- Repetição espaçada em versão simplificada do SM-2 com os quatro botões acima.
- Limite diário de cards novos: 10 por padrão, ajustável.
- Toque opcional com tradução em português, só para a lista embutida. Palavras adicionadas via API não terão tradução na v1.
- API de dicionário para "adicionar palavra": Free Dictionary API (dictionaryapi.dev), por ser gratuita e sem chave.
- Interface em português.

## Chamadas minhas após revisão (o usuário pode corrigir)

- Lista de frequência: uma lista aberta de ~3.000 lemas (sem nomes próprios, formas flexionadas unidas ao lema). Fonte exata escolhida na fase de dados, com licença registrada.
- Um card por palavra, com o sentido mais comum primeiro. Classe gramatical (substantivo, verbo etc.) aparece no card. Palavras de sentidos muito diferentes podem ter até 2 cards.
- Palavras adicionadas via API: mostram só a primeira definição da API, e o usuário pode apagar o card. Elas entram na fila de estudo imediatamente e não contam no limite diário de novos.
- Cards novos seguem a ordem de frequência. Ao atingir o limite diário, o usuário pode pedir "estudar mais".
- Revisões atrasadas: mostradas em lotes de até 50 por sessão; o resto fica na fila. O dia vira às 4h da manhã.
- Armazenamento: o app pede `navigator.storage.persist()` e lembra o usuário de exportar backup a cada 14 dias.
- IPA em inglês americano; se a fonte não tiver IPA, o card omite a pronúncia escrita (o áudio continua).
- GitHub Pages como site de projeto num subcaminho (ex.: `/vocab-pwa/`), repositório público. `start_url` e escopo do service worker usam caminhos relativos.

## Fonte dos dados (decisão do usuário)

- Definições, exemplos e IPA vêm do Wiktionary (extração via Wiktextract), sem geração por IA.
- Minhas chamadas decorrentes: para cada palavra uso o sentido mais comum e, entre as glosas dele, a mais curta e simples. Palavras sem definição curta utilizável são descartadas e substituídas pela próxima da lista de frequência.
- Tradução em português: só aparece quando o Wiktionary tiver uma. Sem tradução, o toque some do card.
- Licença: o Wiktionary é CC BY-SA. O app mostra atribuição ao Wiktionary (tela "Sobre") e os dados derivados ficam sob a mesma licença, em repositório público.
- Risco aceito: algumas definições podem ficar mais difíceis do que o ideal. O app terá botão "reportar card ruim" para o usuário marcar cards a corrigir depois.

## Deixado para o construtor

- Fonte e licença da lista de frequência e das definições; como gerar e revisar definições simples e traduções para ~3.000 palavras.
- Intervalos exatos do algoritmo de repetição espaçada.
- Design visual (tema claro/escuro, tipografia, animação de virar o card).
- Estrutura de arquivos, estratégia de cache do service worker e formato do arquivo de backup.
- Tratamento de erros da API (offline, palavra não encontrada, limite de uso).
