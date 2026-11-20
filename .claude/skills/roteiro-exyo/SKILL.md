---
name: roteiro-exyo
description: Escrever, revisar ou ampliar cartas, dilemas, consequências e o roteiro do Exyo (o Reino do Rei Osric III) para deixar as partidas mais imersivas. Use sempre que o pedido envolver cartas novas, textos de carta, cadeias de consequência, flags, o Rei, a princesa, as Casas ou o mundo do jogo, mesmo num pedido curto como "faz mais cartas de guerra" ou "melhora o texto dessa carta".
---

# Roteiro do Exyo

O Exyo é um jogo de conselho: 3–4 jogadores votam dilemas de um Reino medieval, cada um com um objetivo secreto. A imersão vem de **cartas que parecem acontecimentos de um lugar real**, com gente, lugares e consequências que voltam depois. Esta skill é o guia para escrever essas cartas e o checklist para não quebrar o jogo.

Antes de escrever, leia o que já existe: `content/dilemmas.json` (cartas), `content/king.json` (o Rei), `content/houses.json` (Casas e economia) e `BALANCEAMENTO.md`.

## 1. O mundo (use estes nomes; não invente outros sem necessidade)

**O Rei Osric III, o Leão Grisalho.** Velho, desconfiado, orgulhoso. Aparece só como personagem das histórias (não há mais mecânica de Favor do Rei; a Mão do Rei só desempata e passa de jogador em jogador a cada rodada). Sobrinha: **Lady Mirela** (casou com o príncipe vizinho). Sobrinho capturado por piratas.

**Sem religião.** O jogo não tem recurso de fé: cartas sobre igreja, bispos, bruxas, milagres ou presságios confundem os jogadores, porque ninguém entende como afetam os recursos. Não escreva cartas assim.

**Lugares** (estão no mapa e nas cartas): a Capital e o Trono de Pedra; a **Muralha do Norte** e os clãs do norte; a **Floresta do Rei**; o **Rio Lento** e **o Vale**; **o Porto** e a **Costa Cinzenta**; o castelo de **Pedravento** na fronteira leste; a **Estrada do Rei**; o hospital de São Bérnio.

**Forças de fora:** o reino vizinho (aliado ou rival), o **Califado do Sul** (deserto, especiarias, remédios), a **Liga das Cidades Livres** (mercadores), piratas, clãs do norte.

**Gente recorrente:** o tesoureiro, o capitão da guarda, o médico do Sul, os médicos da corte, o Barão Sem-Terra, a Guilda dos Ferreiros.

**As Casas** (nunca fale por elas no texto, só cite como proponentes): Aurivel (mercadores, "Tudo tem seu preço"), Ferrobranco (guerreiros, "O aço não negocia"), Verdemar (lavradores, "Quem planta, governa"), Lumen (curandeiros, "A luz cura o reino"), Corvalis (sussurradores, "Saber é sobreviver").

**Recursos:** `health` Saúde, `security` Segurança, `military` Força Militar, `food` Comida, `wealth` Riqueza. Trilha de −10 a +10; −10 em qualquer um derruba o Reino.

## 2. Como escrever uma carta imersiva

**Abertura (`prompt`)**: 3 a 5 frases, entre 300 e 550 caracteres.
1. Comece por uma **cena concreta**: quem chega, o que se vê, ouve ou cheira. Nada de "O Reino enfrenta um desafio".
2. Dê **nome ou papel** a alguém (o capitão da guarda, um monge descalço, o mestre da Guilda).
3. Mostre **o que está em jogo dos dois lados**: quem ganha e quem perde com o SIM e com o NÃO.
4. Termine com **tensão**: um prazo, uma ameaça, um detalhe inquietante.

**Pergunta (`question`)**: uma frase de SIM/NÃO, começando de preferência com "O Reino deve…?" ou "O conselho deve…?". O SIM precisa ser uma ação clara.

**Os jogadores veem os efeitos antes de votar.** A carta mostra "Se SIM" e "Se NÃO" com os recursos que sobem e descem. Por isso a história tem que **combinar com os números**: se o SIM derruba Comida e sobe Força Militar, o texto precisa deixar claro por quê ("os soldados comem o trigo dos camponeses"). Dilemas morais abstratos, sem ligação visível com os recursos, confundem.

**Desfechos (`text` de cada variante)**: 1 ou 2 frases com uma **virada**: o preço escondido, quem ficou ressentido, o detalhe irônico. Ex.: "Lanças se quebram e cavaleiros juram lealdade. O tesoureiro chora sozinho." O empate (`tie`) é a **Indecisão do Conselho**: alguém age sem ordem e costuma dar errado.

**Tom:** sóbrio, medieval, com ironia seca. Frases curtas. Português do Brasil.

**Evite a cara de texto de IA:**
- aberturas atmosféricas genéricas ("Em tempos sombrios…", "Numa terra distante…");
- listas de três adjetivos, "não apenas X, mas também Y", moral no fim ("e assim o Reino aprendeu…");
- palavras vagas ("desafio", "jornada", "crucial", "intrigante");
- explicar o efeito no texto ("a Saúde cai"). O texto conta a história; os números ficam nos `effects`.

## 3. Formato da carta (JSON)

```json
{
  "id": "nome_em_snake_case",
  "kind": "root",
  "category": "war",
  "title": "A Muralha do Norte",
  "prompt": "…",
  "question": "O Reino deve reforçar a muralha?",
  "openVote": true,
  "outcomes": {
    "yes": [
      { "when": { "flag": "guarda_reforcada", "eq": true }, "text": "…", "effects": { "security": 3 } },
      { "text": "…", "effects": { "wealth": -2, "security": 2 }, "setFlags": { "muralha_nova": true }, "inject": [{ "card": "outra_carta", "inRounds": 3 }] }
    ],
    "no": [{ "text": "…", "effects": { "wealth": 1, "security": -1 } }],
    "tie": [{ "text": "…", "effects": { "security": -1, "wealth": -1 } }]
  }
}
```

- `kind`: `root` entra no baralho; `consequence` só aparece injetada por outra carta (`inject`).
- `category`: `war`, `feast`, `plague`, `diplomacy`, `trade`, `faith`, `crime` ou `nature` (define a ilustração da carta).
- Cada desfecho é uma lista de variantes: a **primeira** cujo `when` for verdadeiro vale. A **última precisa ser a padrão, sem `when`**.
- `when`/`requires` aceitam `{ "flag": "x", "eq": true }`, `{ "flag": "rei_reputacao", "lte": -2 }`, `{ "res": "food", "lte": 0 }`, `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`.
- `setFlags`: `true` marca um acontecimento; `{ "add": -1 }` soma num contador (ex.: `rei_reputacao`).

**Flags que já existem** (reaproveite para ligar cartas novas às antigas): `alianca_rompida`, `alianca_vizinhos`, `bandidos_perdoados`, `bandidos_tolerados`, `cavaleiros_leais`, `celeiro_real`, `comercio_aberto`, `espioes_fugidos`, `guarda_reforcada`, `hospital_construido`, `impostos_altos`, `medico_aceito`, `mercado_negro`, `norte_saqueado`, `povo_revoltado`, `quarentena`, `rede_desmantelada`, `rota_do_sul`, `traicao_viajantes`, `viajantes_aceitos`, `viajantes_clandestinos`, `viajantes_leais`, `viajantes_recusados`.

## 4. Regras de equilíbrio (não quebre o jogo)

- **Todo desfecho tem custo e ganho.** Nenhum SIM ou NÃO pode ser só bom.
- Cada efeito vai de −3 a +3; a soma de um desfecho fica entre −2 e +1. O empate soma de −1 a −3: indecisão custa caro.
- Os recursos mexidos devem combinar com a história (uma peste mexe em Saúde, não em Força Militar sem motivo).
- **Variantes com `when`** são a melhor forma de imersão: a carta lembra do que o conselho fez antes ("Com a guarda já reforçada…"). Prefira ler flags existentes a criar novas.
- **Toda flag criada precisa ser lida** em alguma carta, e toda flag lida precisa ser criada (o teste falha se não for).
- **Consequências:** `inRounds` entre 2 e 5. Toda carta `consequence` precisa ser injetada por alguém.
- **Voto aberto:** decisões públicas ou cerimoniais (festas, julgamentos, juramentos). Cerca de 1 a cada 3 cartas.
- Mantenha o equilíbrio de categorias. Hoje (44 cartas): Intriga 10, Guerra 8, Diplomacia 7, Peste 6, Banquete 5, Natureza 5, Comércio 4. **Comércio e Banquete pedem cartas. A categoria Fé não é mais usada.** Todo SIM e todo NÃO precisam mudar ao menos um recurso (o teste exige).

## 5. Fluxo de trabalho

1. Leia `content/dilemmas.json` e escolha onde a carta se encaixa: qual flag antiga ela lê e que cadeia ela abre.
2. Escreva as cartas seguindo as seções 2 a 4. Para um lote, planeje antes uma tabela curta: título, categoria, raiz ou consequência, flags lidas e escritas, Favor do Rei, Voto aberto.
3. Acrescente as cartas **no fim** da lista `dilemmas`, no mesmo estilo de formatação do arquivo (objetos pequenos em uma linha só, como `"effects": { "food": -1 }`). Não reformate o arquivo inteiro. Atualize `version` e `notes`.
4. Valide:
   ```bash
   npm test                           # validador de conteúdo + simulação (colapso abaixo de 20%)
   npx tsx scripts/balance.ts 1000    # opcional: confere a economia com bots estrategistas
   ```
5. Releia cada texto em voz alta, como a Mão do Rei vai ler na chamada. Se soar como relatório, reescreva como cena.
6. Atualize a contagem de categorias na seção 4 desta skill e o `BACKLOG.md`.
