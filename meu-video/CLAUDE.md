# Curiosário — regras do projeto

## Ending padrão — OBRIGATÓRIA em todo vídeo gerado a partir de agora
- TODO vídeo novo termina com a ending padrão `CuriosarioOutro`
  (`src/components/CuriosarioOutro.tsx`, 135 frames = 4,5 s a 30 fps, com voz
  `public/brand/outro.mp3` e blips 8-bit). Não entregue vídeo sem ela.
- Use o wrapper `src/components/WithOutro.tsx` (veja Venus/Ovelha/Foguete em
  `src/Root.tsx`):
  ```tsx
  const MeuVideoComOutro = () => (
    <WithOutro contentFrames={DURATION}><MeuVideo /></WithOutro>
  );
  <Composition component={MeuVideoComOutro} durationInFrames={withOutroDuration(DURATION)} ... />
  ```
- A ending já fala "Se você gosta de curiosidades como essa, curta, siga e
  compartilhe!", então o vídeo não precisa de cena própria com essa fala.
- Não altere a ending sem aprovação (desenho e timing aprovados). Para ver
  sozinha: composição "Outro".
- Já têm a ending: Venus (substitui a cena de CTA "Segue pra mais
  curiosidades"), Ovelha e Foguete (substitui a cena 7, a da placa). Lesma fica
  sem (descartado).

## Regra dos pixels da logo
Cada pixel da logo é um quadrado de tamanho inteiro e fixo (12 px), em posição
inteira, desenhado em canvas sem suavização; sem rotate/scale/blur/glow/
transparência na logo e cores só da paleta do PNG. A galáxia cresce pelas
etapas de `scripts/galaxy_stages.py` (gera `src/components/galaxyStages.ts`).

## Render
`npx remotion render <Id> out/<nome>.mp4 --gl=swangle` em primeiro plano
(no ambiente de nuvem, acrescente `--ignore-certificate-errors` para a fonte
Silkscreen do Google Fonts carregar).
