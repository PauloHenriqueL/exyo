# Prompts de imagem do Exyo

## Onde gerar

| Site | Custo | Bom para |
|---|---|---|
| [ImageFX (Google)](https://labs.google/fx/tools/image-fx) | grátis com conta Google | mapa e cenários; segue bem descrições longas |
| [Bing Image Creator / Microsoft Designer](https://www.bing.com/images/create) | grátis com conta Microsoft | brasões e ícones |
| [ChatGPT](https://chatgpt.com) (gerar imagem) | grátis com limite diário | ajustes por conversa ("agora sem o texto") |
| [Leonardo.ai](https://leonardo.ai) | créditos grátis por dia | manter o mesmo estilo em várias imagens |
| [Ideogram](https://ideogram.ai) | grátis com limite | quando a imagem **precisa** de texto legível (faixa do brasão) |
| [Adobe Firefly](https://firefly.adobe.com) | créditos grátis por mês | uso comercial mais seguro |

Os prompts estão em inglês porque esses geradores costumam obedecer melhor em inglês. Gere 3 ou 4 variações e escolha uma.

---

## 1. Mapa de fundo (obrigatório para trocar o provisório)

- **Formato:** paisagem 16:9, de preferência 1920×1080 ou maior.
- **Onde salvar:** substitua `client/public/map.jpg`, mantendo esse nome. Se o site entregar PNG ou WEBP, converta para JPG (qualquer conversor on-line serve) ou me peça para trocar a extensão no CSS.
- **Sem texto:** o jogo escurece o mapa e ele fica atrás das cartas, então nomes escritos pela IA viram borrões. O prompt já pede isso.

```
Hand-drawn medieval fantasy kingdom map on aged parchment, top-down view, ink and soft watercolor, muted sepia, ochre and faded teal palette. A mountain range along the northern edge with a long defensive stone wall at its foot. A dense royal forest on the west side. A slow winding river flowing from the northern mountains through a fertile valley with patchwork farm fields down to a small harbor town on the southeastern coast. A walled capital city with a castle in the center of the map. A frontier fortress on the eastern coast. A dashed dirt road crossing from the southwest to the east. A grey sea along the eastern and southern edges with small stylized waves and a tiny sailing ship. Compass rose in the bottom-left corner, ornate thin border. No text, no labels, no letters, no words. Low contrast, even lighting, soft vignette, 16:9 widescreen.
```

Se sair escuro ou contrastado demais, acrescente: `very light and faded, washed out colors`.

---

## 2. Brasões das 5 Casas (opcional; exige uma mudança no código para usar)

Hoje os brasões são SVG desenhados no código. Para usar imagens geradas, salve cada uma como `client/public/crests/<id>.png` (ids abaixo) e me peça para trocar o componente `Crest`. Formato quadrado (1:1), fundo liso. Em todos, troque o final por `plain flat background` se quiser recortar o fundo depois.

**aurivel — Casa Aurivel, os Mercadores**
```
Medieval heraldic coat of arms, shield divided per pale in burgundy wine red and polished gold, a golden balance scale held by a coiled serpent in the center, coins scattered at the base, ornate gold filigree mantling, rich velvet texture, warm candlelight, painterly fantasy board game art style, centered, symmetrical, isolated on parchment background, high detail, no text.
```

**ferrobranco — Casa Ferrobranco, os Guerreiros**
```
Medieval heraldic coat of arms, heater shield in dark steel grey with a blood-red chevron, a white iron wolf head with bared fangs above two crossed longswords, battle-scarred metal texture with dents and scratches, black iron mantling, cold northern light, gritty painterly fantasy board game art, centered, symmetrical, isolated on parchment background, high detail, no text.
```

**verdemar — Casa Verdemar, os Lavradores**
```
Medieval heraldic coat of arms, rounded shield in deep moss green with a golden wheat sheaf bound by a ribbon, an old oak tree with deep roots beneath it, embroidered fabric texture, mantling made of wheat stalks and oak leaves, warm golden-hour sunlight, painterly pastoral fantasy board game art, centered, symmetrical, isolated on parchment background, high detail, no text.
```

**lumen — Casa Lumen, os Curandeiros**
```
Medieval heraldic coat of arms, pearl-white shield with a celestial blue border, a radiant silver sun with a dove carrying a sprig of healing herbs in its center, subtle stained-glass glow, silver mantling shaped like flowing robes, soft divine light rays, serene painterly fantasy board game art, centered, symmetrical, isolated on parchment background, high detail, no text.
```

**corvalis — Casa Corvalis, os Sussurradores**
```
Medieval heraldic coat of arms, shield in midnight blue-black with a plum purple bend, a silver raven with an open eye on each wing perched on a closed key, smoky shadows and faint mist, tarnished silver mantling shaped like feathers, moonlit atmosphere, mysterious painterly fantasy board game art, centered, symmetrical, isolated on parchment background, high detail, no text.
```

Quer a faixa com o lema escrita? Use o Ideogram e acrescente `scroll banner below reading "<lema>"` (lemas em `content/houses.json`).

---

## 3. Ilustrações por categoria de carta (opcional; exige código para usar)

Uma ilustração por categoria pode aparecer no topo da carta. Formato 3:2, salve como `client/public/cards/<categoria>.jpg`. Comece cada prompt pelo **estilo comum** e acrescente a **cena**.

**Estilo comum (cole antes de cada cena):**
```
Painterly medieval fantasy board game card illustration, muted earthy palette, soft warm light, slightly vintage engraved texture, no text, no letters, 3:2 landscape, scene:
```

| Arquivo | Cena |
|---|---|
| `war.jpg` | `two armies clashing below a stone fortress at dusk, banners and crossed swords in the foreground` |
| `feast.jpg` | `a long royal banquet table in a candlelit great hall, nobles toasting, roasted boar and wine` |
| `plague.jpg` | `a foggy harbor street at night, plague doctors with beaked masks carrying lanterns` |
| `diplomacy.jpg` | `two envoys exchanging a sealed scroll across a council table with maps and wax seals` |
| `trade.jpg` | `a bustling medieval market by the docks, merchants weighing coins and spices on scales` |
| `faith.jpg` | `a cathedral interior with rays of light falling on a stone altar and kneeling pilgrims` |
| `crime.jpg` | `a hooded figure slipping a dagger behind a tavern curtain, candlelight and deep shadows` |
| `nature.jpg` | `a river flooding a valley village under storm clouds, wolves watching from the forest edge` |
