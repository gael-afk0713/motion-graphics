#!/usr/bin/env python3
"""Peixe-papagaio parte 2: word timings of the narration -> src/papagaio2/words.ts

  python scripts/papagaio2_words.py            (run with the faster-whisper venv python)

1. Transcribes public/papagaio2/p2_N.mp3 with faster-whisper (large-v3, word timestamps).
2. Aligns the ASR words to the SPOKEN form of the caption text (difflib); words the ASR heard
   differently keep their position (e.g. the voice says "amiro", the caption says "AMIGO").
3. Snaps word starts to the pauses found by ffmpeg silencedetect (as in parte 1).
4. Checks automatically that the caption text equals the narration of the briefing word by word
   (numbers may be digits) and prints the report; exits 1 on any mismatch.

Caption text: chunks separated by ' | ' (1-3 words each), *word* = yellow keyword. A display token
that is spoken as several words is mapped in SPOKEN (e.g. "95%" -> "noventa e cinco por cento").
"""
import difflib
import json
import re
import subprocess
import sys
import unicodedata

NARRATION = [
    "Você é um peixe-papagaio, o peixe que faz ilhas com o próprio cocô. E você escolheu: dormir no saco de baba.",
    "Antes de dormir, você solta um muco pela boca, que vai cobrindo o seu corpo inteiro. Em menos de uma hora, você está dentro de uma bolha. Esse é o seu mosquiteiro.",
    "Os parasitas chegam, famintos por sangue. Mas não conseguem passar.",
    "Num experimento, quase noventa e cinco por cento dos peixes sem a bolha foram picados. Com a bolha, só dez por cento. E fazer essa bolha custa só dois e meio por cento da energia do seu dia.",
    "Você acertou e sobreviveu à noite.",
    "Amanhece. Você sai da bolha, e está com fome.",
    "Você tem duas opções. A: comer no recife de fora, onde batem as ondas. B: comer na lagoa calma, perto da ilha.",
    "Comenta A ou B. Mas cuidado: uma delas te deixa sem nada para comer!",
    "E marca aquele amigo que ia escolher errado!",
]
TEXT = [
    "Você é um | *peixe-papagaio,* | o peixe que | faz *ilhas* | com o próprio | *cocô.* | E você escolheu: | dormir no | *saco* *de* *baba.*",
    "Antes de dormir, | você solta | um *muco* | pela boca, | que vai cobrindo | o seu | corpo inteiro. | Em menos | de uma hora, | você está | dentro de uma | *bolha.* | Esse é | o seu | *mosquiteiro.*",
    "Os *parasitas* | chegam, | famintos | por *sangue.* | Mas não | conseguem passar.",
    "Num experimento, | quase *95%* | dos peixes | sem a *bolha* | foram picados. | Com a *bolha,* | só *10%.* | E fazer | essa *bolha* | custa só *2,5%* | da *energia* | do seu dia.",
    "Você *acertou* | e *sobreviveu* | à noite.",
    "Amanhece. | Você sai | da *bolha,* | e está | com *fome.*",
    "Você tem | duas opções. | *A:* | comer no | *recife* *de* *fora,* | onde batem | as *ondas.* | *B:* | comer na | *lagoa* *calma,* | perto da ilha.",
    "Comenta *A* | ou *B.* | Mas cuidado: | uma delas | te deixa | *sem* *nada* | para comer!",
    "E *marca* | aquele *amigo* | que ia | escolher errado!",
]
SPOKEN = {"95%": "noventa e cinco por cento", "10%": "dez por cento", "2,5%": "dois e meio por cento"}
# known, accepted difference between the voice and the caption (do not "fix" the audio)
ACCEPTED = {(8, "amigo"): "amiro"}


def norm(w):
    w = unicodedata.normalize("NFKD", w.lower())
    w = "".join(c for c in w if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9%,]", "", w).strip(",")


def display_tokens(t):
    return [w for w in t.replace("|", " ").split()]


def spoken_words(tok):
    clean = tok.replace("*", "").rstrip(".,:!?")
    s = SPOKEN.get(clean, clean)
    return [norm(x) for x in re.split(r"[\s\-]+", s) if norm(x)]


def caption_vs_narration(i):
    """caption words (numbers spelled out) == narration words, in order"""
    cap = [w for tok in display_tokens(TEXT[i]) for w in spoken_words(tok)]
    nar = [norm(x) for x in re.split(r"[\s\-]+", NARRATION[i]) if norm(x)]
    return cap == nar, cap, nar


def ffprobe_dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True).stdout)


def silences(f):
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "silencedetect=noise=-30dB:d=0.05", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    ss = [float(x) for x in re.findall(r"silence_start: (-?[0-9.]+)", log)]
    se = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", log)]
    return list(zip(ss, se))


def main():
    ok_all = True
    print("== legenda x narracao (palavra por palavra)")
    for i in range(len(TEXT)):
        ok, cap, nar = caption_vs_narration(i)
        print(f"  fala {i + 1}: {'OK' if ok else 'DIFERENTE'} ({len(cap)} palavras)")
        if not ok:
            ok_all = False
            for op in difflib.SequenceMatcher(a=nar, b=cap, autojunk=False).get_opcodes():
                if op[0] != "equal":
                    print("    ", op[0], nar[op[1]:op[2]], "->", cap[op[3]:op[4]])

    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    out = []
    print("== ASR x fala")
    for i, t in enumerate(TEXT):
        f = f"public/papagaio2/p2_{i + 1}.mp3"
        dur = ffprobe_dur(f)
        # decode with ffmpeg (16 kHz mono float) instead of PyAV (version clash on this PC)
        import numpy as np
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                             capture_output=True).stdout
        segs, _ = model.transcribe(np.frombuffer(pcm, dtype=np.float32), language="pt", word_timestamps=True, beam_size=5,
                                   initial_prompt=NARRATION[i], vad_filter=False)
        asr = [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]
        asr_n = []
        for st, en, w in asr:  # split "peixe-papagaio" etc. so they line up with the spoken words
            parts = [p for p in re.split(r"[\s\-]+", w) if norm(p)]
            for k, p in enumerate(parts):
                asr_n.append((st + (en - st) * k / len(parts), norm(p), p))
        toks = display_tokens(t)
        exp = []  # (token index, spoken word)
        for ti, tok in enumerate(toks):
            for w in spoken_words(tok):
                exp.append((ti, w))
        sm = difflib.SequenceMatcher(a=[e[1] for e in exp], b=[a[1] for a in asr_n], autojunk=False)
        times = [None] * len(exp)
        heard = [None] * len(exp)
        for tag, a0, a1, b0, b1 in sm.get_opcodes():
            if tag == "equal" or (tag == "replace" and a1 - a0 == b1 - b0):
                for k in range(a1 - a0):
                    times[a0 + k] = asr_n[b0 + k][0]
                    heard[a0 + k] = asr_n[b0 + k][2]
        # unmatched: interpolate between the neighbours
        for k in range(len(times)):
            if times[k] is None:
                prev = next((times[j] for j in range(k - 1, -1, -1) if times[j] is not None), 0.0)
                nxt = next((times[j] for j in range(k + 1, len(times)) if times[j] is not None), dur)
                times[k] = prev + (nxt - prev) * 0.5
        diffs = [(exp[k][1], heard[k]) for k in range(len(exp)) if heard[k] is None or norm(heard[k]) != exp[k][1]]
        for w, h in diffs:
            acc = ACCEPTED.get((i, w)) == (norm(h) if h else None)
            print(f"  fala {i + 1}: legenda '{w}' / voz '{h}'" + (" (excecao conhecida, OK)" if acc else " (ASR diferente; tempo pela posicao)"))
        # start of each display token = start of its first spoken word
        tok_t = []
        for ti in range(len(toks)):
            tok_t.append(min(times[k] for k in range(len(exp)) if exp[k][0] == ti))
        sil = silences(f)
        sn = []
        for j, x in enumerate(tok_t):
            y = x + 0.02
            for s, e in sil:
                if s - 0.02 <= x <= e or 0 < e - x <= 0.12:
                    y = e
            if j == 0:
                y = sil[0][1] if sil and sil[0][0] <= 0.01 else max(0.0, x - 0.02)
            if sn and y <= sn[-1]:
                y = sn[-1] + 0.08
            sn.append(round(y, 3))
        print(f"  fala {i + 1}: {dur:.3f} s | " + " ".join(f"{tk.strip('*')}@{s:.2f}" for tk, s in zip(toks, sn)))
        out.append({"file": f"papagaio2/p2_{i + 1}.mp3", "dur": round(dur, 6), "text": t, "t": sn,
                    "asr": " ".join(a[2] for a in asr)})
    src = ("// generated by scripts/papagaio2_words.py: narration text (exact), caption chunks (' | '),\n"
           "// yellow keywords (*word*) and the start of each caption word in seconds (faster-whisper large-v3\n"
           "// word timestamps aligned to the text, snapped to the pauses from ffmpeg silencedetect).\n"
           "// dur = ffprobe duration. asr = what the ASR heard (for reference only).\n"
           "export const NARRATION = " + json.dumps(out, ensure_ascii=False, indent=1) + " as const;\n")
    with open("src/papagaio2/words.ts", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(src)
    print("legenda = narracao:", "100% OK" if ok_all else "FALHOU")
    sys.exit(0 if ok_all else 1)


if __name__ == "__main__":
    main()
