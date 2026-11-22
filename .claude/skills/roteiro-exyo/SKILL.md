---
name: roteiro-exyo
description: Escrever, revisar ou ampliar cartas, histórias, consequências e o roteiro do Exyo / Asas do Rei (Reino medieval com vizinhos e crises reais) para deixar as partidas mais imersivas. Use sempre que o pedido envolver cartas novas, textos de carta, cadeias de consequência, flags, o Rei, a princesa, as Casas ou o mundo do jogo, mesmo num pedido curto como "faz mais cartas de guerra" ou "melhora o texto dessa carta".
---

# Roteiro do Exyo

O Exyo é um jogo de conselho: 3–4 jogadores votam dilemas de um Reino medieval, cada um com um objetivo secreto. A imersão vem de **cartas que parecem acontecimentos de um lugar real**, com gente, lugares e consequências que voltam depois. Esta skill é o guia para escrever essas cartas e o checklist para não quebrar o jogo.

Antes de escrever, leia o que já existe: `content/dilemmas.json` (cartas), `content/king.json` (o Rei), `content/houses.json` (Casas e economia) e `BALANCEAMENTO.md`.

## 1. O mundo (história real, não um mundo inventado)

**Decisão de 2026-11-22:** os jogadores precisam reconhecer e saber falar os nomes. Use **cidades, impérios e crises reais** da Idade Média e das duas Guerras Mundiais. As crises modernas entram **adaptadas para a Idade Média**: Munique 1938 vira ceder uma província ao Khan; Sarajevo 1914 vira o herdeiro do Imperador assassinado na Capital; a Gripe Espanhola vira esconder a peste do exército; Enigma e Coventry viram ler o código do inimigo sem revelar.

**O nosso Reino não tem nome**, para qualquer jogador se ver nele. Os lugares do próprio Reino são genéricos: a Capital, o porto, a cidade do porto, as aldeias, o Vale, o Rio, a província do Leste, as montanhas. **Os vizinhos são reais:** Veneza e o Doge, o Sacro Império e o Imperador em Viena, a França, os Mongóis e o Grande Khan, a Liga Hanseática, os Medici de Florença, a Companhia Branca, os piratas de Argel, Zara, Caffa e Ragusa.

**A religião é a Igreja** (recurso Religião): o Papa em Roma, o bispo da catedral, padres, monges, frades, excomunhão, indulgências, Templários. Religião **sobe** com piedade, caridade, penitência e a Igreja elogiando a Coroa; **desce** com crueldade, sacrilégio, excomunhão, heresia e o bispo condenando o Rei. **Roma é a sede do Papa**: não a use como reino inimigo.

**Dois Reis por campanha:** a roda 1 é do **velho Rei**; ele morre no fim dela, e a roda 2 é do **jovem Rei, seu filho**. Os textos dizem só "o Rei". Desfechos graves podem dizer como o velho Rei morre (`kingDeath`).

**As Casas** (nunca fale por elas no texto, só cite como proponentes): Aurivel (mercadores, "Tudo tem seu preço"), Ferrobranco (guerreiros, "O aço não negocia"), Verdemar (lavradores, "Quem planta, governa"), Lumen (curandeiros, "A luz cura o reino"), Corvalis (sussurradores, "Saber é sobreviver").

**Recursos:** `health` Saúde, `faith` Religião, `military` Força Militar, `food` Comida, `wealth` Riqueza. Trilha de −7 a +7: chegar a −7 (falta) ou a +7 (excesso) em qualquer um derruba o Reino. Os recursos começam em 0 e podem ir de −6 a +6.

## 2. Como escrever uma carta imersiva

**Abertura (`prompt`)**: 1 ou 2 frases curtas, entre 80 e 200 caracteres (máx. 220). Diga com clareza o que está acontecendo e o que está sendo pedido. Os jogadores leem em voz alta numa chamada: simples e direto vale mais que atmosfera.
1. Comece por uma **cena concreta**: quem chega, o que se vê, ouve ou cheira. Nada de "O Reino enfrenta um desafio".
2. Dê **nome ou papel** a alguém (o capitão da guarda, um monge descalço, o mestre da Guilda).
3. Mostre **o que está em jogo dos dois lados**: quem ganha e quem perde com o SIM e com o NÃO.
4. Termine com **tensão**: um prazo, uma ameaça, um detalhe inquietante.

**Pergunta (`question`)**: uma frase de SIM/NÃO, começando de preferência com "O Reino deve…?" ou "O conselho deve…?". O SIM precisa ser uma ação clara.

**Os jogadores veem os efeitos antes de votar.** A carta mostra "Se SIM" e "Se NÃO" com os recursos que sobem e descem. Por isso a história tem que **combinar com os números**: se o SIM derruba Comida e sobe Força Militar, o texto precisa deixar claro por quê ("os soldados comem o trigo dos camponeses"). Dilemas morais abstratos, sem ligação visível com os recursos, confundem.

**Desfechos (`text` de cada variante)**: 1 frase, até ~110 caracteres (máx. 130), com uma **virada**: o preço escondido, quem ficou ressentido, o detalhe irônico. Ex.: "Lanças se quebram e cavaleiros juram lealdade. O tesoureiro chora sozinho." O empate (`tie`) é a **Indecisão do Conselho**: alguém age sem ordem e costuma dar errado.

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
      { "when": { "flag": "guarda_reforcada", "eq": true }, "text": "…", "effects": { "military": 2 } },
      { "text": "…", "effects": { "wealth": -1, "military": 1 }, "setFlags": { "muralha_nova": true }, "inject": [{ "card": "outra_carta", "inRounds": 3 }] }
    ],
    "no": [{ "text": "…", "effects": { "wealth": 1, "faith": -1 } }],
    "tie": [{ "text": "…", "effects": { "faith": -1 } }]
  }
}
```

- `kind`: `root` entra no baralho; `consequence` só aparece injetada por outra carta (`inject`).
- `category`: `war`, `feast`, `plague`, `diplomacy`, `trade`, `faith` (Fé), `crime` ou `nature` (define a ilustração da carta).
- Cada desfecho é uma lista de variantes: a **primeira** cujo `when` for verdadeiro vale. A **última precisa ser a padrão, sem `when`**.
- `when`/`requires` aceitam `{ "flag": "x", "eq": true }`, `{ "flag": "rei_reputacao", "lte": -2 }`, `{ "res": "food", "lte": 0 }`, `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`.
- `setFlags`: `true` marca um acontecimento; `{ "add": -1 }` soma num contador (ex.: `rei_reputacao`).

**Campos novos:** `"shared": true` na carta compartilhada; `"kingDeath": "de peste, como tantos…"` num desfecho (completa a frase "O velho Rei morreu …").

**Flags que já existem** (reaproveite para ligar histórias): `rota_de_veneza` (Embaixada SIM; a Peste lembra), `excomungado` (Zara; a Carta do Papa lembra, também na roda do filho), `companhia_no_reino` (Companhia Branca do nosso lado; muda O Inimigo Dentro dos Muros).

## 4. Estrutura das histórias e equilíbrio (não quebre o jogo)

**Poucas histórias longas, não muitas curtas** (pedido do playtest de 2026-11-22: os jogadores sentiam 20 histórias curtas sem consequência). Cada roda de 12 rodadas tem umas **3 histórias**, com **no máximo 2 abertas** ao mesmo tempo, alternando. O baralho tem **10 histórias** e cada campanha joga umas 6.

- **Toda raiz leva a 2 ou 3 cartas por qualquer caminho**: SIM, NÃO e empate trazem uma consequência, e as consequências do primeiro nível continuam pelo SIM e pelo NÃO. Os caminhos do meio podem se dividir.
- **O empate segue o pior caminho:** se o SIM ou o NÃO continua a história, o empate também continua, pelo ramo mais perigoso.
- **Cartas compartilhadas** (`shared`): crises genéricas que várias histórias trazem (O Inimigo Dentro dos Muros, A Revolta Camponesa, A Doença Chega à Capital, Os Cofres Vazios, O Inverno da Fome, O Bispo Contra o Rei, A Traição na Corte). **Texto sem nome de lugar nem de inimigo.** Saem no máximo uma vez por roda; se uma história chega a uma que já saiu, aquela ligação não acontece. As que se resolvem sozinhas também fecham a roda quando não sobra tempo para uma história nova.
- **Cada roda fecha as próprias histórias:** o velho Rei morre, e o que estava pendente não vem. Nenhuma carta de história se repete na campanha.
- **Pontos:** raiz ±1 por recurso; nós do meio até ±2; **o desfecho que fecha um caminho** (sem consequência) pode ter **um** recurso em ±3. A soma de SIM ou NÃO fica entre −1 e +1, e todo desfecho tem custo e ganho. O empate perde no máximo 1 por recurso e nunca ajuda.
- `inRounds` 1 ou 2: o motor adianta a próxima carta quando já há 2 histórias abertas, então o atraso só decide a ordem.
- Os recursos mexidos devem combinar com a história. Crime, guarda e fronteira são Força Militar; o humor e a fé do povo são Religião.
- **Variantes com `when`** lembram decisões anteriores, até da roda do pai. Toda flag criada precisa ser lida, e toda flag lida precisa ser criada (o teste falha se não for).
- **Voto aberto:** decisões públicas e solenes (casamento, julgamento, entregar uma província). Hoje são 5 cartas.
- Categorias hoje (58 cartas): Guerra 15, Intriga 9, Diplomacia 9, Fé 8, Comércio 6, Peste 5, Natureza 5, Banquete 1. Todo SIM e todo NÃO precisam mudar ao menos um recurso.

## 5. Fluxo de trabalho

1. Leia `content/dilemmas.json` e escolha onde a carta se encaixa: qual flag antiga ela lê e que cadeia ela abre.
2. Escreva as cartas seguindo as seções 2 a 4. Para um lote, planeje antes uma tabela curta: título, categoria, raiz ou consequência, flags lidas e escritas, Voto aberto.
3. Acrescente as cartas **no fim** da lista `dilemmas`, no mesmo estilo de formatação do arquivo (objetos pequenos em uma linha só, como `"effects": { "food": -1 }`). Não reformate o arquivo inteiro. Atualize `version` e `notes`.
4. Valide:
   ```bash
   npm test                           # validador de conteúdo + simulação de campanhas
   npm run balance -- 1000            # histórias por roda, cartas por história, colapso e pontos (estrategista, meio atenta, ao acaso)
   ```
5. Releia cada texto em voz alta, como a Mão do Rei vai ler na chamada. Se ficar longo ou confuso, corte.

**Atalho:** `npm run grafo` abre o editor (http://localhost:5180). A aba Lista mostra cada história com as consequências logo abaixo, e as compartilhadas numa seção própria; a aba Mapa mostra as ligações. Ele avisa as mesmas regras do `npm test` e salva no `content/dilemmas.json`.
6. Atualize a contagem de categorias na seção 4 desta skill e o `BACKLOG.md`.
