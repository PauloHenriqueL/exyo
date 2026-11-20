# Balanceamento: fichas de voto e Mão do Rei

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
