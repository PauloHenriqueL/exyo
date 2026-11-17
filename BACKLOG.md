# Backlog

> Fonte da verdade sobre **onde estamos**. Atualizado a cada etapa.
> Legenda: `[x]` feito · `[~]` em andamento · `[ ]` pendente · `[?]` decisão em aberto

**Última atualização:** 2026-11-16
**Fase atual:** 3 — Protótipo jogável rodando local (partida completa validada com 1 humano + 3 bots)

---

## Fase 1 — Design e alinhamento
- [x] Sessão de alinhamento (13 decisões de regras/arquitetura)
- [x] GDD v0.1 (escrito na pasta antiga `kingdome/`, que não existe mais)
- [ ] Recriar `GDD.md` nesta pasta
- [ ] Revisão do GDD pelo time
- [?] Nome final do jogo
- [?] Duração da votação: manter 45 s?

## Fase 2 — Conteúdo
- [x] `content/dilemmas.json`: 30 cartas (18 raízes + 12 consequências), 23 flags
- [x] `content/houses.json`: 5 Casas, 10 metas (todas as combinações de 3 recursos altos), recursos iniciais em +2
- [x] Validação: ids únicos, injeções válidas, sem flags mortas, toda carta com `yes/no/tie` e variante padrão
- [x] Simulação inicial (20 mil partidas com votos aleatórios): 0,8% de colapso
- [x] Faixas das metas baixadas para alto = +3..+10 e moderado = −2..+2 (melhor caso simulado: ~3,6/5; votos aleatórios: maioria entre 1 e 3 pontos)
- [ ] Revisitar o balanceamento depois do primeiro playtest
- [ ] Mover o validador/simulador para o repositório (`shared/`) quando o monorepo existir
- [x] Brasões em SVG (5) para o protótipo (componente `Crest`, escudo nas cores + símbolo)
- [ ] Ícones SVG por categoria de carta (8)
- [ ] Curadoria de áudio CC0/CC-BY + `audio-manifest.json` + tela de créditos

## Fase 3 — Protótipo técnico
- [x] Projeto único `shared/ server/ client/ content/` (TypeScript, Vite, Vitest)
- [x] `shared/`: tipos, avaliador de condições, motor de regras puro + 9 testes
- [x] `server/`: login (telefone+nome, hash, token), SQLite (jogadores, partidas, log de eventos), sala Colyseus com máquina de estados; cada jogador recebe só a própria meta e o próprio voto
- [x] `client/`: login, lobby, escolha de Casa, mesa (carta, timer, trilha de recursos), votação com fichas, revelação, placar final
- [x] Animações básicas (Framer Motion): compra/flip da carta, selos dos votos, marcadores deslizando na trilha
- [x] Reconexão: a cadeira fica guardada; relogar com o mesmo telefone devolve o lugar. Sessão por aba (sessionStorage)
- [x] `scripts/bots.mjs`: 3 bots para testar sozinho
- [x] Validado no navegador: partida de 3 rodadas até o placar final, desktop e 390px
- [ ] AudioDirector (Howler) + manifesto de áudio (depende da curadoria)
- [ ] Polimento visual (passada de design), estados de erro mais claros
- [ ] Testar reconexão no meio da votação e duas abas do mesmo jogador

## Fase 4 — Deploy e playtest
- [ ] Deploy no Render (web service + disco persistente para SQLite)
- [ ] Playtest #1 com 4 jogadores
- [ ] Ajustes pós-playtest

## Futuro (fora do protótipo)
- [ ] Brasões finais gerados a partir dos prompts do GDD
- [ ] Trilha sonora própria (Suno/Udio)
- [ ] 5ª Casa como NPC
