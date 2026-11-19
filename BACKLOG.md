# Backlog

> Fonte da verdade sobre **onde estamos**. Atualizado a cada etapa.
> Legenda: `[x]` feito · `[~]` em andamento · `[ ]` pendente · `[?]` decisão em aberto

**Última atualização:** 2026-11-19
**Fase atual:** 4 — No ar em https://exyo.onrender.com (plano Free; pronto para o playtest)

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
- [x] +20 cartas (v0.2.0): 50 no total (30 raízes + 20 consequências), reforçando Intriga, Guerra e Natureza; novas cadeias ligadas a flags antigas
- [x] `content/houses.json`: 5 Casas, 10 metas (todas as combinações de 3 recursos altos), recursos iniciais em +2
- [x] Validação: ids únicos, injeções válidas, sem flags mortas, toda carta com `yes/no/tie` e variante padrão
- [x] Simulação inicial (20 mil partidas com votos aleatórios): 0,8% de colapso
- [x] Faixas das metas baixadas para alto = +3..+10 e moderado = −2..+2 (melhor caso simulado: ~3,6/5; votos aleatórios: maioria entre 1 e 3 pontos)
- [ ] Revisitar o balanceamento depois do primeiro playtest
- [x] Mão do Rei e Favor do Rei (2026-11-19): token de desempate que passa entre jogadores; 16 cartas dão Favor do Rei ao lado que agrada ao Rei; maior Favor (sozinho) toma a coroa (+5 fichas). Rei Osric III com gostos e desgostos mostrados na abertura
- [x] Economia balanceada por simulação (`scripts/balance.ts`, ver `BALANCEAMENTO.md`): 15 fichas iniciais, +5 para a Mão, Favor inicial 5
- [x] Roubar do Reino (recurso −1 → +1 ficha, só votando SIM/NÃO) e Voto aberto em 15 cartas (voto visível na hora e definitivo)
- [x] Carta "A Mão da Princesa": maior aposta no SIM vira a Mão até o fim da partida e zera o Favor de todos; sempre aparece na campanha
- [x] Textos de abertura das 51 cartas reescritos (mais longos e imersivos)
- [x] Animação das espadas removida a pedido (fica só o som)
- [x] Campanha 2×12 com votos aleatórios: ~16–18% de colapso (uma partida isolada: ~1%). Decidido (2026-11-19): manter, como tensão; o teste trava em 20% só para pegar pioras. Revisitar se o playtest mostrar colapsos demais
- [x] Validador de conteúdo e simulação de campanhas como testes (`shared/content.test.ts`)
- [x] Brasões em SVG (5) para o protótipo (componente `Crest`, escudo nas cores + símbolo)
- [ ] Ícones SVG por categoria de carta (8)
- [x] Áudio: 11 efeitos CC0 do Kenney (RPG Audio + Interface Sounds) em `client/public/audio/`, créditos no placar final
- [ ] Trilha de fundo / murmúrio gravado (hoje o murmúrio do conselho é sintetizado no navegador)
- [ ] Mapa definitivo: gerar com o prompt de `PROMPTS_IMAGENS.md` e substituir `client/public/map.jpg` (hoje: mapa provisório desenhado em `map.svg`)

## Fase 3 — Protótipo técnico
- [x] Projeto único `shared/ server/ client/ content/` (TypeScript, Vite, Vitest)
- [x] `shared/`: tipos, avaliador de condições, motor de regras puro + 9 testes
- [x] `server/`: login (telefone+nome, hash, token), SQLite (jogadores, partidas, log de eventos), sala Colyseus com máquina de estados; cada jogador recebe só a própria meta e o próprio voto
- [x] `client/`: login, lobby, escolha de Casa, mesa (carta, timer, trilha de recursos), votação com fichas, revelação, placar final
- [x] Animações básicas (Framer Motion): compra/flip da carta, selos dos votos, marcadores deslizando na trilha
- [x] Reconexão: a cadeira fica guardada; relogar com o mesmo telefone devolve o lugar. Sessão por aba (sessionStorage)
- [x] `scripts/bots.mjs`: 3 bots para testar sozinho
- [x] Validado no navegador: partida de 3 rodadas até o placar final, desktop e 390px
- [x] AudioDirector (Howler, `client/audio.ts`): sons por fase, tique-taque no fim da votação, murmúrio na discussão, botão de mudo
- [x] Campanha: 2 partidas de 12 rodadas (`TOTAL_MATCHES`); a 2ª herda recursos, fichas, flags e consequências pendentes; cada jogador recebe o outro objetivo da Casa; intervalo mostra só pontos (objetivos só no fim); placar final soma (máx. 10)
- [x] Efeitos: espadas se cruzando com faíscas nas cartas de Guerra; balões de conversa nos brasões durante a discussão; mapa do Reino ao fundo
- [x] Validado no navegador (2026-11-19): campanha completa com 2 bots, intervalo e placar final; desktop 1440px e 390px; console sem erros do app
- [ ] Polimento visual (passada de design), estados de erro mais claros
- [x] Corrigido: recarregar a página no meio da partida criava uma sala nova (a sala era trancada com lock()); agora volta à mesma mesa
- [ ] Testar duas abas do mesmo jogador

## Fase 4 — Deploy e playtest
- [x] Repositório público https://github.com/PauloHenriqueL/exyo (push na `main` faz deploy automático)
- [x] Deploy no Render: serviço `exyo`, plano Starter, região Virginia, `PHONE_PEPPER` configurado. Partida iniciada em produção com 3 bots
- [x] Serviço removido e recriado em 2026-11-19: `exyo`, plano **Free**, região Virginia, deploy automático da `main`, `PHONE_PEPPER` novo. Campanha 2×12 testada em produção com 2 bots (rodada completa, console sem erros)
- [ ] Plano Free dorme após 15 min sem acesso (~1 min para acordar): abrir o link alguns minutos antes do playtest, ou subir para o Starter (~US$ 7/mês)
- [ ] Disco persistente no Render (exige plano pago; pelo painel) para o SQLite sobreviver a deploys e reinícios
- [x] Partida aceita 2 a 4 jogadores: com 4 começa sozinha; com 3 pelo botão "Iniciar partida"; com 2 o servidor adiciona 1 bot (Autômato) que vota ao acaso
- [ ] Playtest #1 com 3–4 jogadores
- [ ] Ajustes pós-playtest

## Futuro (fora do protótipo)
- [ ] Brasões finais gerados a partir dos prompts (`PROMPTS_IMAGENS.md`) + trocar o componente `Crest`
- [ ] Ilustrações por categoria de carta (prompts em `PROMPTS_IMAGENS.md`)
- [ ] Trilha sonora própria (Suno/Udio)
- [ ] 5ª Casa como NPC
