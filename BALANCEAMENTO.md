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
