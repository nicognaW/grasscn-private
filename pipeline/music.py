"""Original soundtrack for the launch video, synthesized from scratch (no samples, no copyrighted music).

Part 1 (menu ambience): sparse, soft piano with long reverb, in the spirit of a game title screen.
Part 2 (city-pop / J-jazz-pop bed): electric piano, bass and swung drums on the IVmaj7-III7-vim7-v7-I7
progression (Fmaj7 E7 Am7 Gm7 C7), crossfaded in when the browser is revealed.
Usage: python3 music.py out.wav total_seconds crossfade_at_seconds end_card_at_seconds
"""
import sys
import wave

import numpy as np

SR = 48000
out_path, TOTAL, XF, END = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
N = int(TOTAL * SR)
rng = np.random.default_rng(7)


def hz(note):
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    name, octave = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[name] + 12 * (octave + 1) - 69) / 12)


def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def piano(f, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)  # slight inharmonicity
        s += np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * (1 / k**1.4) * np.exp(-t * (0.9 + 0.55 * k))
    attack = np.minimum(1, t / 0.006)
    hammer = rng.normal(0, 1, len(t)) * np.exp(-t * 90) * 0.02
    return (s * attack + hammer) * vel * 0.18


def reverb(x, seconds=3.2, mix=0.45):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, n) * np.exp(-t * 6.9 / seconds)
    ir[: int(0.012 * SR)] = 0
    ir /= np.sqrt(np.sum(ir**2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix * 0.9


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


# ---- Part 1: menu ambience (until XF + 2 s) ----
intro = np.zeros(N)
beat = 1.0  # 60 bpm, unhurried
chords = [["D3", "A3", "C#4", "F#4"], ["B2", "F#3", "A3", "D4"], ["G2", "D3", "F#3", "B3"], ["A2", "E3", "B3", "C#4"]]
melody = [(0.5, "F#5"), (2.0, "E5"), (3.0, "A4"), (4.5, "D5"), (6.0, "C#5"), (7.0, "B4"), (8.5, "A4"), (10.0, "F#4")]
for bar, chord in enumerate(chords * 2):
    t0 = bar * 4 * beat * 0.75
    if t0 > XF + 2:
        break
    for i, note in enumerate(chord):
        add(intro, t0 + i * 0.22, piano(hz(note), 4.5, 0.55 - i * 0.06))
for when, note in melody:
    if when < XF + 2:
        add(intro, when * 0.75 + 0.1, piano(hz(note), 4.0, 0.75))
intro = reverb(intro, 3.4, 0.5)

# ---- Part 2: city-pop bed, 100 bpm, swung eighths ----
bpm = 100
b = 60 / bpm
swing = 0.62  # second eighth lands at 62% of the beat
pop = np.zeros(N)
start = XF - 0.4  # pickup just before the crossfade


def rhodes(f, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    index = 1.6 * np.exp(-t * 3.2)
    mod = np.sin(2 * np.pi * f * t) * index
    tone = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 1.1)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.8 * t)
    return tone * env * trem * vel * 0.07


def bass(f, dur, vel=1.0):
    t = np.arange(int(dur * SR)) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / 0.006) * np.exp(-t * 2.4)
    return np.tanh(tone * 1.4) * env * vel * 0.16


def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 52 + 90 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.32


def snare():
    t = np.arange(int(0.25 * SR)) / SR
    noise = lowpass(rng.normal(0, 1, len(t)), 6000) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
    return (noise * 0.6 + tone * 0.5) * 0.16


def hat(open_=False):
    t = np.arange(int((0.18 if open_ else 0.05) * SR)) / SR
    noise = rng.normal(0, 1, len(t))
    noise = noise - lowpass(noise, 7000)  # crude high-pass
    return noise * np.exp(-t * (18 if open_ else 70)) * 0.05


KICK, SNARE = kick(), snare()
# Fmaj7 | E7 | Am7 | Gm7 C7  (voiced around middle C)
prog = [
    (["F3", "A3", "C4", "E4"], "F2", 4),
    (["E3", "G#3", "B3", "D4"], "E2", 4),
    (["A3", "C4", "E4", "G4"], "A2", 4),
    (["G3", "Bb3", "D4", "F4"], "G2", 2),
    (["E3", "G3", "Bb3", "C4"], "C2", 2),
]
t = start
bar_i = 0
while t < TOTAL:
    for chord, root, beats in prog:
        if t >= TOTAL:
            break
        # Comping: on the beat and the swung "and" of 2.
        for hit, vel in [(0, 1.0), (1 + swing, 0.75)] if beats == 4 else [(0, 0.9)]:
            for note in chord:
                add(pop, t + hit * b + rng.uniform(0, 0.012), rhodes(hz(note), 1.8, vel))
        # Bass: root, fifth-ish walk.
        r = hz(root)
        steps = [(0, r, 1.0), (1.5, r, 0.6), (2, r * 1.5, 0.85), (3 + swing, r * 2, 0.6)] if beats == 4 else [(0, r, 1.0), (1, r * 1.5, 0.7)]
        for when, f, vel in steps:
            add(pop, t + when * b, bass(f, 0.6, vel))
        # Drums.
        for beat_i in range(beats):
            bt = t + beat_i * b
            if beat_i % 2 == 0:
                add(pop, bt, KICK)
            else:
                add(pop, bt, SNARE)
            add(pop, bt, hat(), 1.0)
            add(pop, bt + swing * b, hat(beat_i == 3), 0.8)
        if beats == 4:
            add(pop, t + (1 + swing) * b, KICK, 0.6)
        t += beats * b
        bar_i += 1
pop = reverb(pop, 1.6, 0.18)

# ---- Mix: crossfade at XF, gentle fade at the end card ----
tt = np.arange(N) / SR
xf = np.clip((tt - XF) / 2.0, 0, 1)
xf = xf * xf * (3 - 2 * xf)
mix = intro * (1 - xf) + pop * xf
fade_in = np.clip(tt / 0.8, 0, 1)
fade_out = np.clip((TOTAL - tt) / max(0.1, TOTAL - END), 0, 1) ** 1.5
mix = mix * fade_in * fade_out
mix /= max(1e-9, np.max(np.abs(mix)))
mix *= 10 ** (-5 / 20)  # peak -5 dBFS; UI sounds sit on top
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(out_path, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out_path, TOTAL, "s")
