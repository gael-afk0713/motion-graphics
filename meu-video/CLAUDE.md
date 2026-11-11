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

## Efeitos sonoros com o earshot — OBRIGATÓRIO a partir do Peixe-papagaio parte 2
Ferramenta: [earshot](https://github.com/Leonxlnx/earshot) (ouvidos para agentes; banco de 252 efeitos
feitos em código, sem direitos autorais). Não sintetize mais efeitos à mão (whoosh, pop, impacto, bolhas,
tique etc.): eles saem do banco `sfx` do earshot. Só leitos contínuos que o banco não tem (ambiente
submarino, drone grave) ainda podem ser sintetizados, e isso precisa ser dito na entrega.

**Instalação (sessão nova, se `earshot` não existir)** — README oficial:
```
uv tool install "earshot[mcp] @ git+https://github.com/Leonxlnx/earshot"
earshot doctor --fetch     # modelos CLAP + AudioSet (~1,1 GB); precisa de huggingface.co e do CDN Xet liberados
```
`earshot doctor` deve terminar com "earshot looks healthy".

**1. Gerar os efeitos do vídeo** a partir do kit do canal (`audio/curiosario-kit.json`: um som do banco
por papel — whoosh.short, whoosh.long, pop, hit, crack, clank, drip, tick; escolhidos com `earshot rank`):
```
python3 scripts/earshot_kit.py audio/curiosario-kit.json <video>    # public/<video>/sfx/kit + src/<video>/kit.ts
```
(rode com o python do earshot: `$(dirname $(readlink -f $(which earshot)))/python`). Na lista de efeitos
do vídeo (`src/<video>/sfx.ts`, só dados: `FPS`, `SFX_DIR`, `FX`) use `kitFx(papel, frameDaAcao, take)`:
ele já põe o ataque (ou o pico do whoosh) no frame da ação, com o ponto medido pelo earshot. Para um papel
novo, acrescente-o ao kit (escolha o som com `earshot sfx list` + `earshot rank`). Modelo pronto:
`src/sfxdemo/` (composições `SfxSyncDemo` e `SfxSyncDemoSfx`).

**2. Depois do render: verificar a sincronia (atraso máximo 40 ms)**
- Registre também a composição `<Id>Sfx` (só os efeitos, sem imagem/voz; renderiza em segundos) e rode:
```
npx remotion render <Id>Sfx out/<video>-sfx-stem.wav --codec=wav --ignore-certificate-errors
node scripts/sfx_cues.mjs src/<video>/sfx.ts out/<video>-cues.json
$(dirname $(readlink -f $(which earshot)))/python scripts/sfx_sync_check.py out/<video>.mp4 \
    out/<video>-cues.json --stem out/<video>-sfx-stem.wav --sfx-dir public --json out/<video>-sync.json
```
- O script confere que a faixa de efeitos está alinhada ao áudio final, roda o `earshot timeline` (escuta)
  e mede cada efeito exatamente; o veredito é da medição exata (o earshot sozinho pode responder com uma
  sílaba da voz, ou marcar o início de um whoosh em vez do pico).
- Todo item `FIX (move N frames)`: mova aquele efeito N frames no `sfx.ts`, re-renderize os trechos
  afetados + a faixa de efeitos e rode de novo, até 100% OK (código de saída 0).
- Mostre ao usuário o resumo da verificação (as 5 primeiras linhas do relatório + o que foi corrigido).

**3. Masterização** (como na parte 1): `scripts/papagaio_master.sh in out.mp4` → –14 LUFS, true peak ≤ –1 dBTP.
