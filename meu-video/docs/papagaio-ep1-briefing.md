VÍDEO NOVO: "PEIXE-PAPAGAIO – PARTE 1/3" (série interativa do Curiosário)

CONTEXTO
- Projeto Remotion do canal Curiosário (pasta meu-video). Vídeo vertical 1080x1920, 30 fps, 3D com @remotion/three.
- Se for sessão nova: rode `npm install` e `NODE_USE_ENV_PROXY=1 npx remotion browser ensure`.
- Render SEMPRE em PRIMEIRO PLANO (nunca em background) com `--gl=swangle`.
- Crie a composição "Papagaio1" num arquivo próprio. Não mexa nos vídeos antigos.
- Este é o EPISÓDIO 1 de 3: o público vota nos comentários (A ou B) e a resposta mais votada vira a parte 2.

ARQUIVOS
- Salve os 9 áudios que anexei em public/papagaio/: papagaio1.mp3 até papagaio9.mp3. Se faltar algum, PARE e me avise.
- Meça a duração REAL de cada um com ffprobe. Cada cena dura exatamente o seu áudio (+ 4 frames de respiro). Coloque cada áudio com <Sequence> + <Audio src={staticFile(...)} />, em sequência, sem sobrepor.
- Depois da cena 9, entra a ending padrão <CuriosarioOutro /> (componente já existente, sem alterar).

NARRAÇÃO (a legenda tem que ser EXATAMENTE este texto, palavra por palavra)
1. "Você acordou como um peixe-papagaio. E o seu cocô constrói ilhas."
2. "Seus dentes são grudados num bico, e nunca param de crescer. Essa é a sua picareta."
3. "Com ela, você arranca pedaços de coral para comer as algas. Mas coral é pedra."
4. "Por isso, você tem um segundo par de mandíbulas dentro da garganta, que mói tudo. Esse é o seu moedor."
5. "O que sobra, você solta como areia. Nas Maldivas, mais de 85% da areia nova dos recifes vem de peixes como você. E as ondas levam essa areia até as ilhas. Essa é a sua fábrica de ilhas."
6. "Mas anoitece. E saem parasitas minúsculos que sugam sangue. Os mosquitos do mar."
7. "De dia, um peixe-limpador tira eles de você. Mas à noite, ele também dorme."
8. "Você tem duas opções. A: fazer um saco de dormir com a sua própria baba. B: se esconder numa fenda do coral."
9. "Comenta A ou B. A mais votada decide se você sobrevive à noite!"
(Números podem aparecer como dígitos na legenda: "85%".)

PADRÕES DE VÍDEOS VIRAIS DESSE ESTILO (siga à risca)
- Frame 0 já com movimento, o peixe na tela e a legenda aparecendo. Nada de tela preta, fade-in ou logo no começo.
- A surpresa principal ("o seu cocô constrói ilhas") é mostrada VISUALMENTE antes dos 4 segundos.
- Troque de plano a cada 2–3 segundos (cortes secos ou whip/zoom rápido). Nenhum plano parado por mais de 3 s.
- Câmera sempre se mexendo: tracking lateral acompanhando o peixe, push-in nos detalhes, nunca estática.
- Anatomia mostrada com "raio-X": a cabeça do peixe fica translúcida e a parte explicada brilha.
- Cada ação tem efeito sonoro sincronizado (mordida, trituração, bolhas, whoosh). Isso prende muito.

ESTILO VISUAL
- 3D estilizado e caprichado (meio-termo entre realista e cartoon, como animação de documentário), iluminação suave, cores vivas no recife.
- Mundo: recife de coral raso e tropical, água azul-turquesa, raios de sol entrando pela superfície (god rays), cáusticas de luz no fundo, partículas flutuando, bolhas.
- PROTAGONISTA: peixe-papagaio com corpo oval e robusto, escamas grandes bem visíveis e o BICO na frente (dentes fundidos formando placas, como um bico de papagaio). No episódio 1, use a coloração da FASE INICIAL: tons mais discretos de marrom-avermelhado e cinza, com nadadeiras levemente avermelhadas. IMPORTANTE para a série: as cores vivas (azul/verde) ficam guardadas para a parte 3, quando ele muda. Mesmo discreto, o peixe precisa ser bonito e expressivo, com olho grande e brilhante.
- Corais variados (cérebro, chifre-de-veado, mesa) em rosa, roxo, laranja e amarelo, algas verdes finas por cima das pedras de coral.

LEGENDAS (padrão do canal)
- Karaokê com 1 a 3 palavras por vez, EXATAMENTE igual à fala, sincronizado com a voz.
- Fonte sem serifa bem grossa, branca, com contorno preto grosso. Palavras-chave em AMARELO #FFD23F: cocô, ilhas, bico, picareta, coral, pedra, moedor, areia, 85%, Maldivas, fábrica de ilhas, parasitas, sangue, mosquitos do mar, dorme, A, B, sobrevive.
- Posição: centro horizontal, por volta de y = 1250–1450 px. ÁREA SEGURA DO TIKTOK: nada importante nos 150 px de cima, nos 420 px de baixo e nos 160 px da direita (botões).
- SEM EMOJIS em nenhum texto do vídeo.
- RÓTULOS DE FERRAMENTA: quando a voz fala "picareta", "moedor" e "fábrica de ilhas", aparece a palavra GIGANTE em amarelo com contorno preto no terço superior (y ≈ 300–450), com pop de escala + whoosh: "PICARETA", "MOEDOR", "FÁBRICA DE ILHAS". Fica até o fim da cena.
- SELO DA SÉRIE: "PARTE 1/3" pequeno no canto superior esquerdo (x ≈ 60, y ≈ 180), fundo amarelo e texto preto, o vídeo inteiro (some só na ending).

CENA A CENA
CENA 1 (papagaio1) – GANCHO
- 0 s: close lateral do peixe nadando (já em movimento no frame 0), atrás dele sai uma nuvem fina de areia branca, que desce brilhando. Visual limpo, nada nojento: parece areia, não sujeira.
- Na fala "constrói ilhas": a câmera sobe rápido acompanhando os grãos de areia, atravessa a superfície da água e revela de cima uma ilhota de areia branca com 2–3 coqueiros, cercada de água turquesa. Essa revelação tem que acontecer antes de 4 s.

CENA 2 (papagaio2) – O BICO
- Corte para um close frontal da boca. A cabeça fica translúcida (raio-X) e os dentes do bico brilham, mostrando que são muitos dentes pequenos grudados formando uma placa.
- Em "nunca param de crescer": o bico cresce um pouco para a frente com uma seta amarela e um efeito de "extrusão" amarela.
- Em "picareta": o peixe dá uma bicada num coral e saltam lascas de pedra com faísca. Som de "crack". Rótulo PICARETA.

CENA 3 (papagaio3) – COMER CORAL
- Plano médio: o peixe raspa a superfície de um coral coberto de algas verdes, e as marcas brancas das mordidas ficam no coral.
- Em "Mas coral é pedra": corte seco para um close do pedaço de coral na boca. Congela 0,3 s com o som de "clank" de pedra. Tensão.

CENA 4 (papagaio4) – A SEGUNDA MANDÍBULA
- Vista em corte (raio-X) da cabeça e da garganta: atrás da boca, um segundo par de mandíbulas com placas de "dentes molares" se movendo para frente e para trás.
- Os pedaços de coral passam e saem triturados como pó fino, com som de pedra moendo. Rótulo MOEDOR.

CENA 5 (papagaio5) – FÁBRICA DE ILHAS (cena mais longa, faça 4 planos)
- Plano 1 ("O que sobra, você solta como areia"): o peixe solta a nuvem de areia branca, que cai brilhando no fundo e forma montinhos.
- Plano 2 ("Nas Maldivas"): transição whip para um globo 3D que gira e dá zoom no Oceano Índico até as Maldivas (pino amarelo com o nome "MALDIVAS").
- Plano 3 ("mais de 85%"): número "85%" gigante, contando de 0 a 85 com som de tique, ao lado de um montinho de areia que cresce.
- Plano 4 ("as ondas levam essa areia até as ilhas"): vista aérea: ondas carregam a areia do recife até a praia de uma ilha, e a faixa de areia da ilha cresce um pouco. Em "fábrica de ilhas": rótulo FÁBRICA DE ILHAS.

CENA 6 (papagaio6) – A NOITE CHEGA
- Em "Mas anoitece": transição rápida de dia para noite (a luz azul-turquesa vira azul-escuro, raios de lua, o recife fica sombrio). Som grave de tensão.
- Surgem dezenas de criaturinhas parecidas com camarões minúsculos (isópodes), com olhinhos brilhando, saindo das frestas do coral e nadando em direção à câmera. Som de enxame abafado.
- Em "sugam sangue": close de uma delas com a boca encostando numa escama, e uma pequena gota vermelha. Nada de gore. Em "mosquitos do mar": elas cercam o peixe.

CENA 7 (papagaio7) – O AJUDANTE DORME
- "De dia, um peixe-limpador…": flashback com a luz do dia e um tom levemente amarelado, como lembrança. Um peixinho-limpador (azul com uma faixa preta do focinho à cauda) bica os parasitas do corpo do peixe-papagaio, que fica parado e relaxado.
- "Mas à noite, ele também dorme": corte de volta para a noite. O peixe-limpador está dormindo numa fresta do coral, com "z z z" saindo em bolhas. O peixe-papagaio olha, sozinho. Os parasitas se aproximam.

CENA 8 (papagaio8) – A ESCOLHA
- A tela se divide em dois cartões verticais, lado a lado.
  - Cartão A (borda turquesa, letra "A" gigante no topo, texto "SACO DE BABA"): o peixe começa a soltar pela boca uma bolha transparente e brilhante que vai envolvendo o corpo. Mostre só o começo, sem revelar se funciona.
  - Cartão B (borda laranja, letra "B" gigante no topo, texto "FENDA NO CORAL"): o peixe entrando numa fenda escura do coral.
- Cada cartão entra com pop + whoosh exatamente quando a voz fala "A:" e "B:".

CENA 9 (papagaio9) – CHAMADA PARA COMENTAR
- Os dois cartões continuam na tela, pulsando de leve. Texto grande no centro: "COMENTA A OU B".
- Uma seta amarela animada aponta para o lado direito da tela, por volta de y ≈ 1150 (onde fica o botão de comentários do TikTok), sem ficar embaixo do botão.
- Em "sobrevive à noite": os parasitas passam rapidamente na frente da câmera, como um aviso. Corte seco para a ending.

ÁUDIO
- Ambiente submarino de fundo bem baixo (bolhas, água) durante o vídeo inteiro, a cerca de –24 dB, nunca competindo com a voz.
- Efeitos sincronizados: whoosh nas transições; crack na bicada; trituração no moedor; tique na contagem do 85%; som grave de tensão na noite; enxame abafado nos parasitas; pop nos cartões A/B e nos rótulos.
- Gere os efeitos por síntese (ffmpeg/WebAudio) ou use arquivos livres de direitos que já estejam no projeto. NUNCA use música ou efeitos com direitos autorais. Se não der para fazer algum efeito, deixe sem e me avise.

PRECISÃO CIENTÍFICA (não invente nada além disso)
- O bico é feito de dentes fundidos. A segunda mandíbula fica na garganta e tritura o coral. A areia sai depois da digestão.
- Os parasitas são isópodes minúsculos parecidos com camarões. Não desenhe mosquito de verdade.
- Peixe-limpador: pequeno, azul com faixa preta lateral.
- Não mostre se o saco de baba funciona. Isso é a parte 2.

ANTES DO RENDER FINAL
1. Me mande 1 frame do meio de cada cena (9 frames) + o frame 0, numa imagem lado a lado, e a duração total.
2. Espere eu aprovar.

DEPOIS DE APROVADO
- Renderize "Papagaio1" em PRIMEIRO PLANO com `--gl=swangle` em out/papagaio-parte1.mp4.
- Rode ffprobe e me mostre que tem áudio, a resolução 1080x1920 e a duração total.
- Commit: "Peixe-papagaio parte 1".
