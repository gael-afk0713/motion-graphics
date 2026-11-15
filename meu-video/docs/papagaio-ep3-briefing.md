# Briefing — "PEIXE-PAPAGAIO – PARTE 3/3" (final da série interativa)

Resumo fiel do pedido do usuário (prompt do episódio) + os pedidos feitos DEPOIS, nas revisões das prévias.
Os pedidos posteriores valem mais que o briefing original quando contradizem.

## Contexto
- Composição "Papagaio3" (arquivo próprio, `src/papagaio3/`), duplicada da Papagaio2, reaproveitando peixe, recife,
  corais, areia, ondas, legendas, rótulos amarelos, bateria da parte 2 e a ending `<CuriosarioOutro />` sem alterações.
- Não alterar o modelo do peixe (Fish.tsx, gfx.ts). Só cor/padrão do material na cena 6 (propriedade nova, ex. `colorMode`).
  Peixe NUNCA de frente: só de lado ou 3/4.
- O público votou B (lagoa calma) = opção errada; reviravolta: passa fome na lagoa e atravessa até o recife de fora.
- Sem recapitulação: o 1º segundo funciona sozinho. Um animal, premissa em 2ª pessoa, visual 3D limpo, câmera sempre
  em movimento, palavra grande em destaque, legenda curta com uma linha de ciência e número.
- CTA tem que prometer consequência ("o mais pedido vira o próximo vídeo").

## Áudios
8 áudios (papagaio3_1..8 → public/papagaio3/p3_1..8.mp3), sem mexer em velocidade/corte. Cada cena = seu áudio + 4
frames. <Sequence> + <Audio> em sequência, sem sobrepor. Depois da cena 8, CuriosarioOutro.

## Narração (a legenda tem que ser EXATAMENTE este texto)
1. "O peixe-papagaio muda de sexo quando o chefe do grupo desaparece."
2. "Vocês votaram na lagoa calma. Péssima ideia."
3. "Sem coral vivo, não tem o que raspar. Seu bico morde pedra morta. Nada. Você está há horas sem comer, e cada vez mais fraco. Mas o pior ainda não aconteceu."
4. "Só tem um jeito: atravessar até o recife de fora, onde as ondas batem. A correnteza empurra você de volta. Você insiste."
5. "Quem votou A acertou. Você chega… e o macho que mandava aqui desapareceu."
6. "Sem ele, a maior fêmea do grupo pode virar macho em poucas semanas. E a maior… é você. As cores mudam. Você assume o grupo."
7. "E toda essa comida vira areia. Um peixe-papagaio solta dezenas de quilos por ano. O gigante, toneladas."
8. "Você nasceu fêmea, virou macho… e ainda construiu uma ilha. Qual animal você quer ser na próxima série? Comenta o nome."

## Selo
"PARTE 3/3": fundo amarelo, texto preto, canto sup. esquerdo (x≈60, y≈180), ~70% do tamanho do da parte 2, SÓ nos
primeiros 3 s, fade curto.

## Legendas
Karaokê 1–3 palavras, igual à fala, sincronizado. Fonte grossa branca com contorno preto. Palavras-chave em amarelo
#FFD23F: peixe-papagaio, muda de sexo, chefe, desaparece, fêmea, macho, lagoa, fome, sem coral vivo, pedra morta,
fraco, pior, recife de fora, ondas, correnteza, desapareceu, virar macho, cores, areia, quilos, toneladas, ilha,
comenta, nome. Posição y≈1250–1450. Área segura: nada importante nos 150 px de cima, 420 px de baixo e 160 px da
direita. Sem emojis.

## Cena a cena
1. Gancho: peixe fêmea (cinza-acastanhada) de lado no recife de dia, em movimento no frame 0, câmera se aproximando;
   legenda desde o 1º frame. "muda de sexo": rótulo amarelo gigante MUDA DE SEXO com pop + leve vibração/zoom curto.
   "chefe do grupo": 3–4 peixes-papagaio menores cinza/marrom ao fundo + um maior colorido (o chefe) no meio, de lado.
   "desaparece": o chefe se desfaz em brilho e some, sem gore. Sem recap, sem bolhas, sem nomes/fotos.
2. O voto: corte para a lagoa (turquesa clara, lisa, brilhante, areia branca, praia da ilha ao fundo). Bolhas de
   comentário brancas sem nomes/fotos com "B" amarelo + pop. "VOCÊS VOTARAM: B" com pop. "Péssima ideia": brilho esfria
   (mais pálido) + "PÉSSIMA IDEIA" em vermelho com pop. Whoosh só na entrada da cena 3.
3. A fome: whoosh (1º de 4). Câmera acompanha o peixe de lado, pedra morta e coral branco-acinzentado morto, quase sem
   algas. "Seu bico morde pedra morta": close lateral do bico raspando, sem alimento saindo, som de raspar. "Nada": pausa
   visual curta com som seco. Barra de energia (bateria da parte 2) no canto superior esvaziando; "cada vez mais fraco":
   nada mais devagar e barra vermelha. "Mas o pior ainda não aconteceu": zoom rápido + som grave curto de tensão, SEM whoosh.
4. A travessia: whoosh (2º de 4). Câmera lateral e baixa, lado calmo da lagoa → borda com ondas no recife de fora,
   espuma branca, água mais escura e agitada. "A correnteza empurra você de volta": avança e é empurrado para trás
   (recuo visível, partículas/bolhas passando rápido no sentido contrário), câmera treme levemente, som de água forte e
   sopro. "Você insiste": volta a avançar de lado, câmera mais próxima, atravessa a linha das ondas. Nunca de frente.
5. A chegada: whoosh (3º de 4) no corte para o recife de fora (mais fundo e claro, corais vivos coloridos, cardume de
   peixes menores), câmera sobe devagar. "Quem votou A acertou": destaque pequeno + check verde pequeno com pop, sem
   bolhas. "o macho que mandava aqui desapareceu": grupo de fêmeas (mesmo modelo, tons de cinza/marrom) sem direção, um
   espaço vazio no meio; NÃO repetir a animação de brilho; nada de morte/gore.
6. A mudança: o peixe (você) maior que as outras fêmeas. "E a maior… é você": seta amarela pequena apontando, com pop.
   "As cores mudam": mesmo modelo, troca animada do material de cinza-acastanhado para verde-azulado vivo com manchas
   rosa e laranja, transição suave em ondas da cabeça à cauda, brilho suave, som curto de transformação; sem mudar forma
   ou tamanho, nada anatômico. "Você assume o grupo": as fêmeas se aproximam e acompanham; câmera sobe em órbita lenta.
7. A areia: whoosh (4º de 4). Close lateral raspando coral vivo, nuvem de areia fina por trás. Areia caindo e se
   acumulando; depois time-lapse da areia crescendo até uma faixa de praia branca. "dezenas de quilos por ano": rótulo
   DEZENAS DE QUILOS com pop. "O gigante, toneladas": rótulo TONELADAS com pop e o time-lapse acelera. Não desenhar
   outra espécie nem outros números.
8. Fecho e CTA: sem whoosh. A areia forma uma ilha pequena com palmeira; o peixe nada ao redor, de lado. Rótulos FÊMEA
   e MACHO com pop curto, depois ILHA. "Qual animal…?": pergunta grande centralizada "QUAL ANIMAL?" em amarelo.
   "Comenta o nome": seta amarela animada para o botão de comentários (direita, y≈1150), sem ficar embaixo do botão, e
   "COMENTA" com pop. Texto pequeno (sem emoji): "O MAIS PEDIDO VIRA O PRÓXIMO VÍDEO". Corte seco para a ending.

## Áudio
Ambiente submarino bem baixo o vídeo todo. Efeitos do kit do earshot; síntese só para o que o banco não tem (raspar
pedra, correnteza, areia). Whoosh só nas 4 trocas de cena. Master −14 LUFS, true peak −1 dBTP. sfx_sync_check ≤ 40 ms.

## Ciência
Hermafroditismo sequencial em várias espécies; em grupos com macho dominante, se ele some, a maior fêmea PODE mudar
em poucas semanas (não todas as espécies). Dezenas a centenas de kg de areia/ano; o gigante (Bolbometopon muricatum)
chega a toneladas. NÃO colocar 70% no vídeo. A lagoa mostrada é pobre em coral vivo; não afirmar que toda lagoa é assim.

## Pedidos posteriores (revisões das prévias) — valem mais que o original
### Revisão da prévia 1
1. Rótulos grandes (MUDA DE SEXO, VOCÊS VOTARAM: B, PÉSSIMA IDEIA, DEZENAS DE QUILOS, TONELADAS, FÊMEA, MACHO, ILHA,
   QUAL ANIMAL?, COMENTA, o "A" com check, a seta da cena 6) centrados em x = 540 ± 4 px, rotação final 0° (balanço de
   até 3° por no máx. 8 frames no pop), largura máx. 760 px. A seta da cena 8 continua apontando ao botão (y≈1150).
2. Efeitos: nenhum acima da voz; pops/whooshes ≥ 6 dB abaixo do pico da voz da cena; sons de ação (raspar,
   correnteza, tensão, areia) 8–10 dB abaixo; ambiente bem baixo. Correnteza = fluxo de água contínuo e grave, sem
   estalos. Tensão da cena 3 = swell curto e baixo. Em nenhuma janela de 100 ms o efeito acima da voz.
3. Cena 4 refeita toda SUBMARINA: sem horizonte, céu ou nuvens; superfície só como faixa clara ondulada no TOPO com
   espuma e cristas; água mais escura e agitada; partículas/bolhas/areia da direita para a esquerda; peixe avança para
   a direita de verdade, é arrastado ~25% da largura em ~0,6 s, depois insiste e cruza a linha de espuma; sem faixas
   nas bordas do corte.
4. Cena 3: peixe inteiro/3/4 de lado com bico visível raspando; zoom do "Mas o pior" no máx. ~1,25x, cabeça inteira.
5. Cena 6: peixe inteiro durante a troca de cor (cabeça fora dos 160 px da direita); legenda "mudam." com contraste
   (escurecer levemente atrás ou mover os peixes, sem mover a legenda).
6. Cena 7: cabeça não cortada; nuvem de areia BEM visível (branca, densa) saindo por trás; peixe no quadro durante
   toda a fala "Um peixe-papagaio solta dezenas de quilos por ano"; a pilha de areia cresce com clareza em "toneladas".
7. Cena 8: texto "O MAIS PEDIDO VIRA O PRÓXIMO VÍDEO" com ~48–56 px de altura, branco com contorno preto, 2 linhas
   centralizadas, dentro da área segura, não embaixo do botão de comentários.
### Revisão da prévia 2
- Cena 3 "Seu bico morde pedra morta": bloco de coral morto cinza-esbranquiçado, áspero, textura de esqueleto de coral
  (sem forma de batata); 3 mordidas curtas (~6 frames) de lado em "morde / pedra / morta", corpo quase horizontal
  (máx. 8°), bico abre e fecha visivelmente, cabeça balança 4–6°; lascas cinza caindo com gravidade + poeira curta
  (~15 frames); riscos claros no bloco; "Nada.": o peixe se afasta, para, bloco intacto; push-in lento na cena toda;
  som "tec" seco ≥ 8 dB abaixo da voz; peixe inteiro de lado sem cortar a cabeça.
- Whooshes de ~18 s e ~26 s: −3 dB.
### Revisão da prévia 3
- Cena 8: em "construiu uma ilha", zoom na ilha do fundo.
### Revisão dos agentes sobre a v4 (aprovada pelo usuário: "os 5 + CTA")
- "O MAIS PEDIDO VIRA O PRÓXIMO VÍDEO" junto com "QUAL ANIMAL?"; a cena 8 segura +1,5 s (45 frames) antes da ending.
- Sem cinza na tela inteira no fim: só faixas escuras atrás dos textos; peixe mais visível na cena 8.
- Cena 6: peixe inteiro (com cauda) durante a troca de cor. Cena 7: focinho fora dos 160 px da direita. Cena 3: cauda
  dentro do quadro.
- Push-in suave na cena 4 (17,7–23 s) e na cena 6 (31–34,9 s); "O peixe-papagaio" numa linha só (sem o "O" sozinho).
### Correção de estética (v5) — mudar só ambiente, luz e materiais (sem editar Fish.tsx, gfx.ts, CuriosarioOutro.tsx, mp3)
1. Profundidade: névoa que escurece/satura para azul com a distância; 3–5 raios de luz suaves (opacidade ≤ 0,15, lentos);
   plâncton em 2 camadas; vinheta leve.
2. Chão: areia com ondulações e variação de tom, cáusticas lentas, conchas, tufos de alga, coral ramificado; pedras com
   formas variadas e textura de rocha/coral (não bolhas lisas).
3. Enquadramento: cena 3 e cenas de peixe sozinho com menos chão vazio, peixe um pouco mais baixo e maior, elementos
   desfocados em primeiro plano nas bordas; zona da legenda (base 420 px) legível. Cena 1: peixe inteiro com ≥ 60 px de
   folga nas laterais.
4. Peixe só por luz/material da cena: rim light azul-esverdeada, leve brilho especular, barriga mais clara.
5. Cenas da ilha (2 e finais): mesma paleta e luz do fundo do mar, ilha pequena vista do nível da água, ondas leves, céu
   em degradê, palmeira com volume e sombra, areia sem estourar (pico ≈ 90%).
6. Contraste: fundo das cenas finais em tons médios ou legenda com contorno/sombra reforçados; amarelo #FFD23F mantido.
7. Paleta: 1 azul-esverdeado dominante + 1 cor quente (coral/laranja); sem pastéis soltos nos corais da cena 5.
### Ajustes depois dos stills (aprovados com ajustes)
1. Ilha (cena 8 e finais): monte de areia com declive, rochas pequenas, espuma nas bordas, palmeira inteira com sombra,
   linha d'água com ondas; rótulos sem cobrir a ilha (ilha na faixa 600–1100 px, rótulo no topo seguro); o peixe sob a
   água é o mesmo peixe (mesma cor, leve atenuação azul), inteiro no quadro.
2. Cena 3: bloco de coral morto cinza-esbranquiçado, sem manchas coloridas; 1 raio de luz mais marcante no topo;
   opcional um cardume distante acima do peixe.
4. Variação sutil de tom nas escamas do dorso (verde/azul-acinzentado) só por material/luz da cena.
### Correção de sound design (v5) — só a camada de efeitos (sem mexer nos mp3 da voz)
1. Cama submarina contínua (grave suave low-pass ~600 Hz, bolhas esparsas), −30 dB abaixo da voz; timbre por cena: lagoa
   calma quase silêncio; cena 4 mais grave e com movimento; recife de fora mais vivo (cardume); ilha com ondas suaves.
2. Transições: varredura de filtro suave (swell de 0,3 s com low-pass subindo) no lugar dos whooshes, ≥ 6 dB abaixo da voz;
   máximo de 3 transições no vídeo.
3. Pops de rótulo/cartão: curtos e macios (bolha), −12 dB abaixo da voz, sem agudo acima de 6 kHz; low-pass 5 kHz em todos.
4. Mordida (cena 3): 3 "tec" secos e abafados, −10 dB abaixo da voz, sincronizados com o bico.
5. Sidechain: efeitos e cama 6–8 dB mais baixos enquanto a voz fala (ataque 20 ms, soltura 200 ms); destaques nas pausas.
6. Momentos-chave: 0,3 s de silêncio antes de "o macho que mandava aqui"; brilho sutil ascendente na troca de cor;
   areia = granulado suave. Todos abaixo da voz.
7. sfx_sync_check (40 ms) e lista final com tempo, tipo e nível relativo à voz; nenhum efeito acima de −6 dB da voz.
