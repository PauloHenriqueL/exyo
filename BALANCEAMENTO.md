# Balanceamento: pontos de influência, trilha, cartas e Religião

Os números ficam em `content/houses.json` → `economy` e são escolhidos com `scripts/balance.ts`.

```bash
npx tsx scripts/balance.ts 3000                      # grade padrão
START=10,15,20 BONUS=3,5 npx tsx scripts/balance.ts  # só algumas combinações
```

## Como a simulação funciona

- 4 jogadores, campanha de 2 partidas × 12 rodadas, com as 51 cartas.
- Bots "estrategistas": avaliam SIM e NÃO pelo próprio objetivo secreto e evitam o colapso. Apostam fichas conforme o que está em jogo e se abstêm quando tanto faz. Roubam do Reino quando faltam fichas, disputam o Favor do Rei e apostam alto na Mão da Princesa.
- Medidas:
  - **colapso%**: o Reino caiu.
  - **vit.Mão0%**: vitórias da primeira Mão do Rei (sorteada); o justo é 25%.
  - **vit.MãoFim%**: vitórias de quem termina como Mão.
  - **trocas Mão**: quantas vezes a coroa muda de dono.
  - **desempate%**: rodadas decididas pela Mão.
  - **escassez%**: votos em que o jogador queria apostar mais fichas do que tinha.

## Resultado (2026-11-19, 3.000 campanhas por combinação)

| Fichas iniciais | Bônus da Mão | colapso | vit. Mão inicial | vit. Mão no fim | trocas | escassez |
|---|---|---|---|---|---|---|
| 10 | 5 | 0,2% | 26,7% | 34,2% | 2,0 | 34% |
| 12 | 3 | 0,1% | 26,3% | 29,0% | 2,0 | 34% |
| **15** | **5** | **0,1%** | **26,5%** | **31,9%** | **2,0** | **26%** |
| 20 | 3 | 0,0% | 27,4% | 27,7% | 2,1 | 21% |
| 20 | 5 | 0,0% | 28,8% | 30,5% | 2,1 | 19% |

**Escolha: 15 fichas iniciais, +5 ao virar a Mão do Rei** (a Mão sorteada começa com 20) **e Favor do Rei inicial 5**.

- A primeira Mão sorteada fica perto do justo (26,5% contra 25%): o sorteio não decide o jogo.
- Ser a Mão no fim vale a disputa (31,9%), sem ser decisivo. Com bônus 8, isso sobe para cerca de 36%.
- Em 1 de cada 4 votos o jogador queria apostar mais do que tinha, então fichas são um recurso de verdade. Com 10 fichas, a falta aparece em 1 de cada 3 votos e o jogo fica mais apertado. Com 20, fichas quase nunca faltam.
- A coroa troca de mãos cerca de 2 vezes por campanha, sem contar a princesa.
- O colapso quase não acontece com jogadores que votam pensando no objetivo. Com votos aleatórios, fica em cerca de 15% (teste em `shared/content.test.ts`).

Revisitar depois do playtest: se a Mão ficar forte demais, baixe `handBonus` para 3. Se as fichas sobrarem, baixe `startingTokens` para 12.

## Atualização (2026-11-20): sem roubo do Reino e sem cartas de religião

2.000 campanhas por combinação, mesmos bots:

| Fichas | Bônus | vit. Mão inicial | vit. Mão no fim | escassez |
|---|---|---|---|---|
| 15 | 0 | 31,4% (com 20 fichas) | 24,8% | 24% |
| 15 | 1 | 30,8% | 27,5% | 31% |
| 15 | 5 | 33,9% | 30,8% | 26% |
| 20 | 3 | 32,2% | 27,0% | 20% |

Sem o roubo e com menos cartas de Favor do Rei (13 em vez de 16), **a primeira Mão sorteada vence cerca de 31–34%**, acima do justo (25%). A vantagem continua mesmo com bônus 0: vem do poder de desempatar desde o início, não das fichas. Mantivemos 15 fichas e bônus 5 para não mudar regras no meio dos testes.

**A observar no próximo playtest:** se a primeira Mão vencer demais, as alavancas certas são mais cartas de Favor do Rei (a coroa troca mais) ou a coroa começar sem dono, sendo dada ao primeiro jogador que ganhar Favor.

## Atualização (2026-11-20, depois do playtest): sem Rei, sem Mão do Rei, sem princesa

O Favor do Rei, a Mão do Rei (desempate e bônus) e a carta da princesa saíram. A economia agora é só `startingTokens`. `scripts/balance.ts` foi simplificado: bots votam olhando a mesma prévia de SIM/NÃO que os jogadores veem na carta.

1.500 campanhas por valor:

| Fichas iniciais | colapso | escassez | abstenção | empates |
|---|---|---|---|---|
| 8 | 0,1% | 39% | 38% | 27% |
| 10 | 0,0% | 35% | 38% | 27% |
| 12 | 0,1% | 32% | 38% | 27% |
| **15** | **0,1%** | **26%** | **39%** | **26%** |
| 20 | 0,0% | 17% | 38% | 26% |

**Mantido: 15 fichas.** A observar: sem a Mão do Rei, cerca de 1 rodada em 4 termina em empate (Indecisão do Conselho), sobretudo quando muitos se abstêm.

## Atualização (2026-11-20): Mão do Rei rotativa, só para desempate

A Mão do Rei voltou, sem bônus nem Favor: a primeira é sorteada e a cada rodada passa ao próximo da mesa. Num empate vale o voto dela; se ela se absteve, é Indecisão do Conselho. `scripts/balance.ts` ganhou a coluna "desempate pela Mão".

2.000 campanhas por valor:

| Fichas iniciais | colapso | escassez | abstenção | empates | desempate pela Mão |
|---|---|---|---|---|---|
| 8 | 0,0% | 40% | 38% | 20% | 9% |
| 10 | 0,1% | 36% | 38% | 20% | 8% |
| 12 | 0,0% | 32% | 38% | 20% | 8% |
| **15** | **0,0%** | **26%** | **39%** | **20%** | **8%** |
| 20 | 0,0% | 17% | 39% | 20% | 7% |

**Mantido: 15 fichas.** Os empates caem de ~27% para ~20% das rodadas; os que sobram são rodadas em que a Mão se absteve.

## Atualização (2026-11-22): pontos de influência, trilha de −7 a +7 e cartas reequilibradas

Regras novas:
- **Pontos de influência:** 15 por jogador para a campanha toda. Votar SIM ou NÃO gasta pelo menos 1 ponto e o peso do voto é o número de pontos gastos. Abster-se não custa nem rende. Com 0 pontos, só dá para se abster.
- **Trilha de −7 a +7:** chegar a qualquer ponta derruba o Reino (falta ou excesso). O jogo vive entre −6 e +6.

Com as cartas antigas (efeitos até ±3/±4) e essas regras, o Reino caía em 39–54% das campanhas mesmo com jogadores estratégicos. Ajustes, todos medidos com `npm run balance`:
- **Cartas raiz mexem ±1 por recurso; consequências até ±2.** Nenhum recurso foi tirado de nenhum desfecho (os textos falam de todos); só a intensidade diminuiu.
- **SIM e NÃO somam entre −1 e +1** quando dá para chegar lá só diminuindo intensidades; **o empate perde no máximo 1 por recurso** e nunca ajuda.
- **Recursos começam em +1** (antes +2): com as duas pontas derrubando, +2 deixava o topo perto demais.
- **Objetivos:** alto = **+3 a +6** (antes +3 a +10), moderado = −2 a +2. O teto do alto é a última casa antes da queda.
- Os textos das 44 cartas foram reescritos curtos e diretos (abertura de 1–2 frases, desfecho de 1 frase).

Decisão das faixas e do valor inicial (800–2.000 campanhas por linha, 4 jogadores, 2×12 rodadas, 15 pontos):

| Início | Alto | Mesa | Colapso (−7 / +7) | Pontos por partida (de 5) |
|---|---|---|---|---|
| 0 | +3..+6 | estrategista | 3,3% (3,3 / 0,0) | 1,40 |
| 0 | +3..+6 | ao acaso | 46,5% (37,3 / 9,3) | 1,48 |
| **+1** | **+3..+6** | **estrategista** | **1,5% (1,5 / 0,0)** | **1,62** |
| **+1** | **+3..+6** | **ao acaso** | **40,3% (17,6 / 22,6)** | **1,80** |
| +2 | +3..+6 | estrategista | 15,6% (15,3 / 0,4) | 2,01 |
| +2 | +3..+6 | ao acaso | 48,6% (6,0 / 42,6) | 2,08 |

Resultado escolhido (2.000 campanhas, `npm run balance`):

| Mesa | Colapso | Abstenção | Sem pontos | Empates | Mão decide | Ninguém votou | Pontos/partida | Pontos que sobram |
|---|---|---|---|---|---|---|---|---|
| estrategista | 1,5% | 62% | 4% | 38% | 3% | 37% | 1,62 | 2,7 |
| ao acaso | 40,3% | 38% | 7% | 12% | 14% | 4% | 1,80 | 0,5 |

Os objetivos estão equilibrados entre as Casas: de 1,58 a 1,69 ponto por partida com bots estrategistas.

**A observar no playtest:**
- Com 15 pontos para 24 rodadas, quem joga com cuidado guarda pontos e ~1 em 3 rodadas termina **sem ninguém votando** (Indecisão do Conselho). Se isso deixar o jogo parado, as alavancas são mais pontos iniciais ou o empate não custar nada.
- Votando ao acaso, o Reino cai em ~40% das campanhas: a trilha curta pune quem não olha a prévia da carta.

## Ajuste (2026-11-22, pedido do autor): abster-se rende 1 ponto e recursos começam em 0

- **Abster-se volta a render +1 ponto de influência.** Votar continua custando pelo menos 1 ponto, então quem gastou tudo não vota de graça: precisa se abster uma rodada para votar com peso 1 na seguinte.
- **Recursos começam em 0** e vão de −6 a +6 sem perder; −7 e +7 derrubam o Reino. As casas das pontas mostram o número 7 em vermelho.
- Cartas e faixas dos objetivos não mudaram.

2.000 campanhas, `npm run balance`:

| Mesa | Colapso (−7 / +7) | Abstenção | Sem pontos | Empates | Mão decide | Ninguém votou | Pontos/partida | Pontos que sobram |
|---|---|---|---|---|---|---|---|---|
| estrategista | 0,6% (0,6 / 0,0) | 54% | 0,1% | 28% | 4% | 27% | 1,44 | 13,1 |
| ao acaso | 47,8% (37,5 / 10,3) | 33% | 0,4% | 9% | 15% | 1% | 1,52 | 7,0 |

Média dos recursos no fim de cada partida (estrategista): Saúde −2,4 · Segurança −1,7 · Força Militar −1,8 · Comida −2,2 · Riqueza −2,1. Pontos por objetivo: de 1,33 (Ferrobranco B) a 1,50 (Aurivel B, Verdemar A).

**A observar:** começando em 0, a deriva negativa das cartas e dos empates deixa os objetivos "alto" (+3 a +6) mais difíceis, e Ferrobranco fica um pouco atrás. Se o playtest confirmar, as alavancas são o empate não custar nada ou deixar algumas cartas um pouco mais positivas (dá para fazer pelo `npm run grafo`).

## Religião no lugar de Segurança (2026-11-22)

Segurança era o recurso mais usado (116 efeitos em 37 de 44 cartas) e falava de três coisas diferentes. Cada efeito foi remapeado à mão:
- **crime, espiões, guarda e fronteira → Força Militar** (quando o desfecho já mexia em Força Militar, os dois foram somados ou a Segurança saiu);
- **humor, confiança e fé do povo → Religião**, com o texto reescrito para mostrar o Templo, os sacerdotes ou o povo rezando;
- alguns desfechos ganharam outra troca para não ficarem só bons ou só ruins (por exemplo, o Cerco de Pedravento agora reabre a estrada dos grãos: +Comida).

Depois entraram **8 cartas novas de religião** (6 raiz, 2 consequências) e os objetivos das Casas foram redistribuídos entre as mesmas 10 combinações: Lumen tem Religião alta nas duas metas; Ferrobranco, Aurivel e Verdemar têm uma meta com e outra sem; Corvalis tem Religião nas duas.

Efeitos por recurso: Riqueza 113 · Força Militar 82 · Religião 71 · Comida 68 · Saúde 67 (52 cartas).

2.000 campanhas, `npm run balance`:

| Mesa | Colapso (−7 / +7) | Empates | Mão decide | Ninguém votou | Pontos/partida |
|---|---|---|---|---|---|
| estrategista | 0,4% (0,4 / 0,0) | 35% | 3,5% | 33% | 1,49 |
| ao acaso | 43,8% (39,2 / 4,6) | 8% | 15% | 1% | 1,52 |

Pontos por objetivo (estrategista): de 1,39 (Lumen B) a 1,64 (Verdemar B). Média dos recursos no fim de cada partida: Saúde −2,2 · Religião −1,5 · Força Militar −2,1 · Comida −2,2 · Riqueza −2,0.

## Histórias longas com fatos reais (2026-11-22)

Pedido do autor depois do playtest: os jogadores sentiam que passavam por 20 histórias curtas, que suas escolhas não tinham consequência e que um dilema resolvido na roda 1 voltava na roda 2. A meta passou a ser umas 3 histórias por roda, cada uma com várias consequências.

- **Baralho:** 10 histórias (raiz + 4 a 6 cartas próprias) e 7 cartas compartilhadas, 58 no total. Cada campanha joga umas 6 histórias. As crises são reais e adaptadas: Veneza em 1204, a Peste Negra em 1347, os Mongóis em 1241 com Munique e Dunquerque, Sarajevo em 1914 e as trincheiras, a Grande Fome de 1315, Enigma e os Templários, a Hansa e os Medici, Lutero e Hus, a Revolta de 1381, a Companhia Branca e o Lusitânia.
- **Motor:** no máximo 2 histórias abertas. Uma raiz nova só abre com menos de 2 em andamento e pelo menos 3 rodadas restantes na roda; senão, a próxima consequência pendente é adiantada. No fim da roda, sem nada pendente, entra uma crise compartilhada que se resolve sozinha. A troca de roda (morte do velho Rei) descarta o que estava pendente. Cartas de história nunca se repetem; as compartilhadas saem no máximo uma vez por roda.
- **Repetição relatada no playtest:** no código anterior, nenhuma carta se repetia em 2000 campanhas simuladas. O que parecia repetição eram temas parecidos em cartas diferentes (Peste no Porto e A Segunda Onda; Invasão do Norte, Torres e Cerco). Agora cada tema fica numa história só.
- **Pontos:** raiz ±1, nós do meio ±2, desfecho que fecha um caminho até ±3 em um recurso. A soma de SIM ou NÃO fica entre −1 e +1, e o empate segue o pior caminho.

2.000 campanhas, `npm run balance`:

| Mesa | Histórias por roda | Cartas por história | Colapso (−7 / +7) | Empates | Pontos/partida |
|---|---|---|---|---|---|
| estrategista | 3,7 (+0,6 crise) | 3,7 | 0,5% (0,5 / 0,0) | 24% | 1,71 |
| meio atenta | 3,8 (+0,6 crise) | 3,6 | 7,2% (4,9 / 2,3) | 10% | 1,76 |
| ao acaso | 3,9 (+0,6 crise) | 3,5 | 81,5% (54,1 / 27,4) | 9% | 1,59 |

Pontos por objetivo, com estrategistas: de 1,62 a 1,78, todos parelhos.

**Atenção:**
- **Votar ao acaso agora derruba o Reino em ~80% das campanhas** (antes eram ~44%), porque as consequências pesam mais. Uma mesa que olha a prévia metade das vezes cai em ~7%. Vale observar no próximo playtest.
- Cerca de 0,4 história por roda fica pela metade quando o velho Rei morre.
- Comida termina a partida mais baixa que os outros recursos (média −2,5 com estrategistas).
