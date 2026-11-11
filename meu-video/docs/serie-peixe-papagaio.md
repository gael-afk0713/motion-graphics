# Série "Peixe-papagaio" (3 partes) — memória do projeto

Tudo o que foi decidido e aprovado na parte 1, para qualquer sessão nova continuar daqui. Leia antes de
mexer na série. O briefing original do episódio 1 está em `docs/papagaio-ep1-briefing.md`.

## A série
- Vídeo vertical 1080x1920, 30 fps, 3D com `@remotion/three`, canal **Curiosário**, narração em português.
- Formato interativo: cada parte termina com uma escolha **A ou B** votada nos comentários; a resposta mais
  votada vira a parte seguinte.
- **Parte 1** (pronta, composição `Papagaio1`, `out/papagaio-parte1.mp4`, 62,4 s): você é um peixe-papagaio,
  o bico de dentes fundidos ("picareta"), come coral, a segunda mandíbula na garganta ("moedor"), solta areia
  que forma ilhas ("fábrica de ilhas", Maldivas >85%), à noite vêm parasitas (isópodes), o peixe-limpador dorme.
  Escolha final: **A = saco de dormir de baba** (casulo de muco) / **B = esconder numa fenda do coral**.
  Na parte 1 NÃO se mostra se o saco de baba funciona.
- **Parte 2**: a opção mais votada (ainda não definida pelo usuário).
- **Parte 3**: o peixe **muda de cor** para a fase terminal (azul/verde vivo, como o macho adulto da foto 2
  de referência). Até lá, use SÓ as cores da fase inicial.

## O protagonista (aprovado depois de várias rodadas — não mude sem pedir)
Código: `src/papagaio/Fish.tsx` (geometria) e `src/papagaio/gfx.ts` (pele, cores, texturas).
- **Cores da fase inicial** (`INITIAL_PHASE` em gfx.ts): dorso `#6b615d`, lado `#8c776d`, barriga
  `#c9523f`, cabeça `#84756f`, queixo `#d06a55`, contorno das escamas `#34221f`. Cinza-acastanhado com barriga
  e nadadeiras avermelhadas; escamas grandes com contorno mais escuro; cabeça lisa (sem escamas).
- **Corpo**: oval alongado, testa arredondada descendo até um focinho que afina até a ponta (ajustado lado a
  lado com fotos reais: `TOP/BOT/WID` em Fish.tsx). O usuário recusou a cabeça em "cone" e a cabeça em "bola".
- **Olho**: menor e realista mas expressivo, íris âmbar com brilho (`ex 0.66, ey 0.1, R 0.052`).
- **Bico** (o ponto mais discutido): na ponta do focinho, um pouco abaixo do meio.
  - De frente: **meia-lua** (borda de cima quase reta, de baixo curva = "sorriso"), ~35% da largura da cabeça,
    sempre **entreaberta** (vão escuro entre as placas), sem aro colorido em volta.
  - **Lábio de cima** carnudo, um tom mais rosado que a cabeça, cobrindo a base da placa de cima.
  - Duas **placas grossas 3D** creme-esverdeadas, superfície em **mosaico de dentinhos fundidos**, **sutura
    vertical** no centro, **borda serrilhada** (fileira de dentinhos redondos).
  - De lado: ponta curta e clara saindo do focinho; a **placa de cima só um pouco à frente da de baixo**
    (≤10% do comprimento do bico) — o usuário pediu para recuá-la.
  - Ao morder: as placas fecham com força e voltam a entreabrir (`open`: 0,3 repouso, 0 fechado, 1 aberto).
- **Raio-X** (cenas 2 e 4): cabeça translúcida escura com contorno azul; **só o olho do lado da câmera**
  aparece; câmera afastada o bastante para ver contorno da cabeça, olho e boca. Cena 2: bico creme brilhante
  com mosaico em destaque e fileiras novas (amarelas) nascendo na base. Cena 4: cabeça inteira em perfil, as
  duas placas de "molares" NA GARGANTA, depois push-in até elas moendo coral.
- **Câmera**: o peixe **nunca aparece de frente**. Frame 0 e cena 1 em 3/4 mais de lado.

## Mundo e efeitos visuais aprovados
- Recife raso tropical, água turquesa, god rays, cáusticas, partículas, bolhas.
- **Corais**: sem listras/moiré. Corais-cérebro com relevo orgânico irregular em cores naturais (bege,
  mostarda, verde-oliva, lilás suave: `BRAIN` em Reef.tsx); mesa e chifre-de-veado arredondados; demais
  corais rosa/roxo/laranja/amarelo um pouco dessaturados.
- **Areia/cocô**: sai da parte de TRÁS do corpo, perto da cauda (`VENT`), como **grãos** brancos brilhantes
  que caem e se espalham, quase sem névoa — nunca parecer fumaça ou sujeira.
- **Noite**: luz de lua azulada de cima + rim light no contorno do peixe; atrás dos cartões A/B o peixe aparece
  de perfil.
- Ilhota de areia branca com coqueiros vista de cima; globo com pino amarelo "MALDIVAS" (textura NASA Blue
  Marble já no projeto).

## Ciência (não inventar além disso)
Bico = dentes fundidos. A segunda mandíbula (faríngea) fica na garganta e tritura o coral. A areia sai depois
da digestão. Parasitas = isópodes minúsculos parecidos com camarões (gnatídeos), nunca mosquitos de verdade.
Peixe-limpador: pequeno, azul com faixa preta lateral. Não mostrar se o saco de baba funciona (parte 2).

## Texto na tela (padrão do canal)
- Legenda karaokê 1–3 palavras, **exatamente** a fala, sincronizada por palavra (tempos de ASR:
  `scripts/papagaio_words.py` → `src/papagaio/words.ts`; o ASR usou sherpa-onnx + Parakeet baixado dos
  releases do GitHub). Montserrat Black, branca, contorno preto grosso, palavras-chave amarelas `#FFD23F`,
  topo em y=1262.
- Área segura do TikTok: nada importante nos 150 px de cima, 420 px de baixo, 160 px da direita.
- Sem emojis. Rótulos gigantes amarelos no terço superior ("PICARETA", "MOEDOR", "FÁBRICA DE ILHAS") com pop.
- Selo "PARTE 1/3" (x 60, y 180, fundo amarelo, texto preto) o vídeo inteiro, some na ending.
- Termina com a ending padrão `CuriosarioOutro` (regra do CLAUDE.md).

## Áudio
- Narração: um arquivo por cena em `public/papagaio/`, usada como veio; cada cena dura o áudio + 4 frames.
- Parte 1: efeitos sintetizados (`scripts/papagaio_sfx.py`). **Da parte 2 em diante: efeitos do banco do
  earshot + verificação de sincronia ≤ 40 ms** (seção "Efeitos sonoros com o earshot" do CLAUDE.md).
  Na parte 1 a verificação deu 55/55 efeitos dentro do limite (pior 11 ms).
- Masterização final: –14 LUFS integrado, true peak ≤ –1 dBTP (`scripts/papagaio_master.sh`; mira –1,5 porque
  o AAC sobe o pico ~0,6 dB).

## Como o usuário gosta de trabalhar
- Português, direto. Ele aprova em etapas: **antes do render final, mandar frame 0 + 1 frame do meio de cada
  cena numa imagem lado a lado + a duração total, e esperar a aprovação.** Closes do peixe (lado / 3/4) quando
  o personagem muda; comparações lado a lado com fotos reais quando pedido.
- Render SEMPRE em primeiro plano, `--gl=swangle` (+ `--ignore-certificate-errors` na nuvem), em trechos de
  200 frames (`--codec=h264-mkv --concurrency=4`, ~4–6 min cada; se um trecho der timeout de áudio, refaça com
  `--timeout=120000`), juntar com `ffmpeg -f concat -c copy`, masterizar, conferir com ffprobe
  (1080x1920, duração, stream de áudio), mandar o mp4 + frame 0, commit com a mensagem pedida e push.
- Não mexer nos vídeos antigos. Avisar o que não deu para fazer, nunca simular.

## Ferramentas no repositório
- `scripts/papagaio_stills.mjs <dir> <escala> <frames...>` — renderiza frames soltos (env `COMP=<Id>`,
  `REUSE_BUNDLE=1` para não re-empacotar).
- Composição `Papagaio1Peixe`: folha do modelo (frame 0 = cabeça de lado, 1 = peixe inteiro de lado,
  2 = 3/4). Composição `Papagaio1Sfx`: só os efeitos (para a verificação de sincronia).
- `scripts/earshot_kit.py`, `scripts/sfx_cues.mjs`, `scripts/sfx_sync_check.py`, `audio/curiosario-kit.json`,
  demo `SfxSyncDemo` — ver CLAUDE.md.

## Referências visuais (não estão no repo)
O usuário mandou: (1) foto de frente de um peixe-papagaio azul "sorrindo" soltando areia (rosto, bico, nuvem
de areia), (2) foto de lado de um macho adulto colorido (formato do corpo, escamas, perfil do bico — cores
proibidas até a parte 3), (3) recortes ampliados da boca de frente e da cabeça de lado. Também foram usadas
fotos do Wikimedia Commons (um exemplar de lado e um *Scarus ghobban* em 3/4 com cores parecidas com as
nossas). Use-as só como referência, nunca no vídeo. Se precisar delas numa sessão nova, peça ao usuário.

## Ambiente de nuvem (environment "motion-graphics")
Rede liberada além dos registros de pacotes: remotion.media, NASA, Wikimedia Commons, PyTorch, Hugging Face
(+ CDN Xet). O script de setup instala `npm install`, o Chrome do Remotion e o earshot com os modelos.
