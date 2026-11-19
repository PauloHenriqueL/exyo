# Prompts de imagem do Exyo

> **Situação (2026-11-19):** já estão no jogo o Rei (sério e sorrindo), a princesa, os 5 brasões e as 8 ilustrações de categoria, em `client/public/art/` (versões leves em WebP; os originais ficam em `arte-original/`, fora do git). **Falta o mapa** (pedido 1): o fundo ainda é o provisório.

## Como usar no Gemini

Abra o [Gemini](https://gemini.google.com) e comece **uma conversa nova só para a arte do jogo**.

1. Mande primeiro o **Prompt mestre** abaixo. Ele fixa o estilo para todas as imagens.
2. Depois peça **uma imagem por mensagem**, colando os pedidos da lista na ordem. Na mesma conversa, o Gemini mantém o estilo.
3. Se uma imagem sair com letras ou nomes escritos, responda: `refaça igual, mas sem nenhum texto, letra ou número`.
4. Se ficar escura ou contrastada demais para fundo de tela, responda: `refaça mais clara e desbotada, com pouco contraste`.
5. Baixe cada imagem e salve com o nome indicado. Depois é só me pedir para encaixar as imagens no jogo. O mapa entra sozinho: basta trocar o arquivo.

### Prompt mestre (mande primeiro)

```
Você vai criar a arte de um jogo de tabuleiro digital chamado "Exyo", sobre um conselho medieval que aconselha um rei velho e desconfiado. Vou pedir várias imagens, uma por vez, e todas precisam parecer da mesma coleção.

Estilo fixo para TODAS as imagens:
- pintura digital com cara de ilustração de jogo de tabuleiro de fantasia medieval, pinceladas visíveis, leve textura de pergaminho e gravura antiga;
- paleta terrosa e quente: ocre, sépia, vinho, dourado envelhecido, verde-musgo e azul-acinzentado desbotado;
- luz suave de vela ou de fim de tarde, contraste moderado;
- NUNCA escreva texto, letras, números, assinaturas, marcas d'água ou molduras com palavras;
- nada de estilo anime, cartoon ou foto realista.

Responda apenas "Entendido" e espere meu primeiro pedido.
```

### Pedidos (um por mensagem, na ordem)

**1. Mapa do Reino** → salvar como `client/public/map.jpg` (troca direta, sem código)
```
Imagem 1, formato paisagem 16:9. Mapa do Reino visto de cima, desenhado à mão em pergaminho envelhecido, tinta e aquarela suave. Cordilheira ao norte com uma longa muralha de pedra no pé das montanhas. Floresta densa a oeste. Um rio lento e sinuoso desce das montanhas, atravessa um vale fértil com campos cultivados em retalhos e chega a uma pequena cidade portuária na costa sudeste. No centro, uma capital murada com um castelo. Uma fortaleza de fronteira na costa leste. Uma estrada de terra tracejada cruzando do sudoeste ao leste. Mar cinzento nas bordas leste e sul, com ondas estilizadas e um pequeno veleiro. Rosa dos ventos no canto inferior esquerdo e borda fina ornamentada. Cores bem desbotadas e pouco contraste, porque será fundo de tela atrás de textos. Sem nenhum nome escrito.
```

**2. O Rei Osric III, o Leão Grisalho** → `client/public/king.jpg` (precisa de código: aparece na tela de abertura)
```
Imagem 2, formato retrato 3:4. Retrato de busto do Rei Osric III, um rei de cerca de 70 anos, cabelos e barba grisalhos e volumosos como uma juba de leão, olhar duro e desconfiado, rugas profundas, cicatriz antiga no rosto. Usa uma coroa de ferro e ouro gasta e um manto vermelho-vinho com gola de pele, sentado num trono de pedra escura. Ao fundo, estandartes e a luz de velas de um salão de pedra. Expressão de quem lembra de cada traição. Composição centralizada, fundo escuro para destacar o rosto.
```

**3. A princesa Elara** → `client/public/princess.jpg` (precisa de código: aparece na carta "A Mão da Princesa")
```
Imagem 3, formato retrato 3:4. A princesa Elara, filha única do velho rei, cerca de 20 anos, postura altiva e olhar inteligente e um pouco desafiador. Cabelo castanho trançado com fios dourados, vestido de veludo verde-escuro com bordados de ouro e um pequeno diadema. Ela está numa sacada do castelo ao entardecer, com o salão do conselho ao fundo, desfocado. Um anel de noivado sobre uma almofada de veludo vermelho em primeiro plano.
```

**4 a 8. Brasões das 5 Casas** → `client/public/crests/<id>.png` (precisa de código: substitui os brasões desenhados)

Mande um de cada vez. Formato quadrado 1:1, com fundo liso de pergaminho claro.
```
Imagem 4, quadrada 1:1. Brasão heráldico medieval da Casa Aurivel, os Mercadores: escudo dividido ao meio em vermelho-vinho e dourado polido, uma balança dourada segurada por uma serpente enrolada no centro, moedas espalhadas na base, ornamentos de filigrana dourada. Centralizado, simétrico, isolado sobre fundo liso de pergaminho claro. Sem faixa com lema e sem texto.
```
```
Imagem 5, quadrada 1:1. Brasão heráldico medieval da Casa Ferrobranco, os Guerreiros: escudo de aço cinza-escuro com uma divisa em V vermelho-sangue, cabeça de lobo branca de dentes à mostra sobre duas espadas longas cruzadas, metal marcado por amassados e arranhões de batalha. Centralizado, simétrico, isolado sobre fundo liso de pergaminho claro. Sem texto.
```
```
Imagem 6, quadrada 1:1. Brasão heráldico medieval da Casa Verdemar, os Lavradores: escudo arredondado verde-musgo com um feixe de trigo dourado amarrado por uma fita e um carvalho antigo de raízes profundas abaixo, ornamentos de espigas e folhas de carvalho. Centralizado, simétrico, isolado sobre fundo liso de pergaminho claro. Sem texto.
```
```
Imagem 7, quadrada 1:1. Brasão heráldico medieval da Casa Lumen, os Curandeiros: escudo branco-pérola com borda azul-celeste, um sol de prata radiante com uma pomba levando um ramo de ervas medicinais no centro, brilho suave de vitral. Centralizado, simétrico, isolado sobre fundo liso de pergaminho claro. Sem texto.
```
```
Imagem 8, quadrada 1:1. Brasão heráldico medieval da Casa Corvalis, os Sussurradores: escudo azul-meia-noite quase preto com uma faixa diagonal roxa, um corvo de prata pousado sobre uma chave fechada, com um olho aberto desenhado em cada asa, névoa e sombras ao redor. Centralizado, simétrico, isolado sobre fundo liso de pergaminho claro. Sem texto.
```

**9 a 16. Ilustrações das categorias de carta** → `client/public/cards/<categoria>.jpg` (precisa de código: aparece no topo das cartas)

Formato paisagem 3:2. Comece cada pedido com `Imagem N, paisagem 3:2, ilustração de carta:` e cole a cena:

| Arquivo | Cena |
|---|---|
| `war.jpg` | dois exércitos se chocando ao pé de uma fortaleza de pedra ao entardecer, estandartes e lanças em primeiro plano |
| `feast.jpg` | longa mesa de banquete real num grande salão iluminado por velas, nobres brindando, javali assado e vinho |
| `plague.jpg` | rua do porto coberta de neblina à noite, médicos da peste com máscaras de bico carregando lanternas |
| `diplomacy.jpg` | dois embaixadores trocando um pergaminho lacrado sobre uma mesa de conselho com mapas e selos de cera |
| `trade.jpg` | mercado movimentado junto às docas, mercadores pesando moedas e especiarias em balanças |
| `faith.jpg` | interior de catedral com raios de luz sobre um altar de pedra e peregrinos ajoelhados |
| `crime.jpg` | figura encapuzada escondendo um punhal atrás da cortina de uma taverna, luz de vela e sombras fortes |
| `nature.jpg` | rio transbordando sobre uma aldeia no vale sob nuvens de tempestade, lobos observando da borda da floresta |

---

## Outras IAs para gerar imagens

| IA | Custo | Melhor para |
|---|---|---|
| [Gemini](https://gemini.google.com) | grátis com conta Google, com limite diário | a série toda numa conversa só, mantendo o estilo; edita a imagem com pedidos ("deixe mais claro") |
| [ChatGPT](https://chatgpt.com) | grátis com limite; mais no plano pago | segue muito bem descrições longas e correções por conversa; bom para o Rei e a princesa |
| [Midjourney](https://www.midjourney.com) | pago (a partir de ~US$ 10/mês) | a arte mais bonita e "de capa de jogo"; ótimo para o mapa e os retratos |
| [Leonardo.ai](https://leonardo.ai) | créditos grátis por dia | manter o mesmo personagem e estilo em várias imagens (Rei e princesa em cenas diferentes) |
| [Ideogram](https://ideogram.ai) | grátis com limite | quando a imagem **precisa** de texto legível, como a faixa com o lema no brasão |
| [Recraft](https://www.recraft.ai) | créditos grátis | brasões e ícones em **vetor (SVG)**, que ficam nítidos em qualquer tamanho |
| [Adobe Firefly](https://firefly.adobe.com) | créditos grátis por mês | uso comercial mais seguro (treinado em imagens licenciadas) |
| [Bing Image Creator](https://www.bing.com/images/create) | grátis com conta Microsoft | alternativa grátis rápida para testar ideias |

Para os brasões, a melhor combinação é gerar no Gemini ou no ChatGPT e, se quiser a versão final em vetor, refazer no Recraft com o mesmo texto.
