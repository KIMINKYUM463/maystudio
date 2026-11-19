"""
Synthesizes the built-in background music loops and sound effects into public/audio/.
Everything is generated from code here, so there is no third-party licence to track.
Run: python scripts/make-audio.py   (needs numpy; mp3 encoding uses Remotion's bundled ffmpeg)
"""
import glob
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
FFMPEG = glob.glob(os.path.join(ROOT, "node_modules", "@remotion", "compositor-*", "ffmpeg*"))[0]
rng = np.random.default_rng(7)


def hz(note):
    """'A4' / 'C#3' / 'Bb2' -> frequency."""
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[note[0]]
    rest = note[1:]
    if rest[0] == "#":
        n, rest = n + 1, rest[1:]
    elif rest[0] == "b":
        n, rest = n - 1, rest[1:]
    midi = 12 * (int(rest) + 1) + n
    return 440.0 * 2 ** ((midi - 69) / 12)


def env(n, a=0.01, r=0.2, sustain=1.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * sustain
    tail = max(1, int(r * SR))
    if n > tail:
        e[-tail:] *= np.linspace(1, 0, tail)
    return e


def decay(n, seconds):
    return np.exp(-np.arange(n) / SR / seconds)


def lowpass(x, cutoff):
    # one-pole, run twice for a gentler 12 dB slope
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i, v in enumerate(x):
            acc = (1 - a) * v + a * acc
            y[i] = acc
        x = y
    return x


def lowpass_fft(x, cutoff):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(spec, len(x))


def bandpass_fft(x, lo, hi):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec[(f < lo) | (f > hi)] *= 0.05
    return np.fft.irfft(spec, len(x))


def reverb_loop(x, seconds=1.6, mix=0.25):
    """Circular convolution with a decaying noise tail: the tail wraps to the start, so the loop is seamless."""
    n = len(x)
    ir_len = int(seconds * SR)
    ir = rng.standard_normal(ir_len) * decay(ir_len, seconds / 4)
    ir = lowpass_fft(np.pad(ir, (0, n - ir_len)), 5000)[:n] if n > ir_len else ir[:n]
    wet = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir, n), n)
    wet *= np.max(np.abs(x)) / (np.max(np.abs(wet)) + 1e-9)
    return x * (1 - mix) + wet * mix


def place(buf, sound, at):
    i = int(at * SR) % len(buf)
    end = i + len(sound)
    if end <= len(buf):
        buf[i:end] += sound
    else:  # wrap into the loop start
        cut = len(buf) - i
        buf[i:] += sound[:cut]
        buf[: end - len(buf)] += sound[cut:]


# ---------- instruments ----------
def pad(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * freq * d * t + rng.uniform(0, 6)) for d in (0.997, 1.0, 1.003))
    x += 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return x / 3.3 * env(n, a=0.9, r=0.9)


def epiano(freq, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t + 0.6 * np.sin(2 * np.pi * freq * 2 * t) * decay(n, 0.3))
    x *= (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t))
    return vel * x * decay(n, 1.1) * env(n, a=0.004, r=0.05)


def pluck(freq, dur, bright=0.5):
    """Karplus-Strong string (ukulele-ish)."""
    n = int(dur * SR)
    period = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.5 * (buf[i % period] + buf[(i + 1) % period]) * (0.994 + 0.004 * bright)
    return out * env(n, a=0.002, r=0.03)


def kick(vol=1.0):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.12)


def snare(vol=1.0):
    n = int(0.25 * SR)
    noise = bandpass_fft(rng.standard_normal(n), 1200, 9000)
    tone = np.sin(2 * np.pi * 190 * np.arange(n) / SR) * decay(n, 0.05)
    return vol * (0.7 * noise / np.max(np.abs(noise)) * decay(n, 0.07) + 0.4 * tone)


def hat(vol=1.0, length=0.05):
    n = int(length * SR)
    x = bandpass_fft(rng.standard_normal(n), 7000, 16000)
    return vol * x / np.max(np.abs(x)) * decay(n, length / 3)


def shaker(vol=1.0):
    n = int(0.09 * SR)
    x = bandpass_fft(rng.standard_normal(n), 5000, 12000)
    return vol * x / np.max(np.abs(x)) * np.hanning(n)


# ---------- tracks ----------
def track_calm():
    """잔잔한 감성: 72 BPM, warm pads + soft electric piano arpeggios."""
    bpm, bars = 72, 8
    beat = 60 / bpm
    total = bars * 4 * beat
    buf = np.zeros(int(total * SR))
    chords = [["F3", "A3", "C4", "E4"], ["E3", "G3", "B3", "D4"], ["D3", "F3", "A3", "C4"], ["C3", "E3", "G3", "B3"]]
    for bar in range(bars):
        ch = chords[bar % 4]
        for note in ch:
            place(buf, 0.18 * pad(hz(note), 4 * beat + 0.8), bar * 4 * beat)
        place(buf, 0.22 * pad(hz(ch[0]) / 2, 4 * beat + 0.8), bar * 4 * beat)
        arp = [ch[0], ch[2], ch[3], ch[1]]
        for i in range(8):
            note = arp[i % 4]
            f = hz(note) * 2
            place(buf, 0.13 * epiano(f, 1.4, vel=0.8 if i % 2 else 1.0), bar * 4 * beat + i * beat / 2)
    return reverb_loop(lowpass_fft(buf, 6000), 2.2, 0.32)


def track_bright():
    """산뜻한 여행: 112 BPM, strummed plucks, kick/clap and shaker."""
    bpm, bars = 112, 16
    beat = 60 / bpm
    total = bars * 4 * beat
    buf = np.zeros(int(total * SR))
    chords = [["C4", "E4", "G4", "C5"], ["G3", "B3", "D4", "G4"], ["A3", "C4", "E4", "A4"], ["F3", "A3", "C4", "F4"]]
    strum = [0, 0.75, 1.5, 2, 2.5, 3.25]
    for bar in range(bars):
        ch = chords[bar % 4]
        start = bar * 4 * beat
        for k, s in enumerate(strum):
            for j, note in enumerate(ch):
                place(buf, (0.11 if k % 2 == 0 else 0.08) * pluck(hz(note), 0.9, 0.6), start + s * beat + j * 0.012)
        place(buf, 0.25 * pluck(hz(ch[0]) / 2, 1.6, 0.2), start)
        place(buf, 0.25 * pluck(hz(ch[0]) / 2, 1.6, 0.2), start + 2 * beat)
        for b in range(4):
            if b in (0, 2):
                place(buf, 0.55 * kick(), start + b * beat)
            else:
                place(buf, 0.28 * snare(), start + b * beat)
            for h in range(2):
                place(buf, 0.12 * shaker(), start + (b + h / 2) * beat)
    return reverb_loop(buf, 1.0, 0.15)


def track_lofi():
    """로파이 휴식: 80 BPM, mellow keys, lazy boom-bap and vinyl crackle."""
    bpm, bars = 80, 10
    beat = 60 / bpm
    total = bars * 4 * beat
    n_total = int(total * SR)
    buf = np.zeros(n_total)
    chords = [["D3", "F3", "A3", "C4", "E4"], ["G2", "F3", "B3", "E4"], ["C3", "E3", "G3", "B3", "D4"], ["A2", "G3", "C#4", "E4"]]
    swing = 0.06
    for bar in range(bars):
        ch = chords[bar % 4]
        start = bar * 4 * beat
        for j, note in enumerate(ch):
            place(buf, 0.12 * epiano(hz(note), 3.6, vel=0.9), start + j * 0.02)
        place(buf, 0.09 * epiano(hz(ch[-1]) * 2, 1.2), start + 2.5 * beat + swing)
        place(buf, 0.5 * kick(), start)
        place(buf, 0.35 * kick(), start + 1.75 * beat + swing)
        place(buf, 0.45 * kick(), start + 2.5 * beat)
        place(buf, 0.26 * snare(), start + beat)
        place(buf, 0.26 * snare(), start + 3 * beat)
        for h in range(8):
            place(buf, 0.07 * hat(), start + h * beat / 2 + (swing if h % 2 else 0))
    buf = lowpass_fft(buf, 3800)
    crackle = np.zeros(n_total)
    pops = rng.integers(0, n_total, int(total * 9))
    crackle[pops] = rng.uniform(-1, 1, len(pops))
    crackle = bandpass_fft(crackle, 1500, 8000) * 0.5 + bandpass_fft(rng.standard_normal(n_total), 200, 4000) * 0.004
    return reverb_loop(buf, 1.4, 0.2) + crackle


# ---------- sound effects ----------
def sfx_whoosh():
    n = int(0.55 * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    spec = np.fft.rfft(noise)
    x = np.fft.irfft(spec, n)
    out = np.zeros(n)
    # sweep a band from low to high in 12 slices
    for k in range(12):
        lo = 300 + 3500 * (k / 12) ** 1.5
        seg = bandpass_fft(x, lo, lo * 2.2)
        w = np.exp(-((t - (k + 0.5) / 12) ** 2) / 0.006)
        out += seg * w
    out *= np.sin(np.pi * t) ** 1.5
    return out / np.max(np.abs(out)) * 0.8


def sfx_pop():
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = 320 + 700 * np.exp(-t * 40)
    return 0.8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.04) * env(n, a=0.002, r=0.01)


def sfx_ding():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    f0 = 1318.5
    x = sum(a * np.sin(2 * np.pi * f0 * m * t) * decay(n, d) for m, a, d in ((1, 1, 0.6), (2.76, 0.45, 0.25), (5.4, 0.2, 0.12)))
    return 0.55 * x * env(n, a=0.002, r=0.05)


def sfx_impact():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = 42 + 80 * np.exp(-t * 12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.35)
    hit = lowpass_fft(rng.standard_normal(n), 2500) * decay(n, 0.06)
    x = boom + 0.5 * hit / np.max(np.abs(hit))
    return 0.85 * x / np.max(np.abs(x)) * env(n, a=0.001, r=0.1)


# ---------- output ----------
def write_mp3(name, x, bitrate="160k"):
    x = np.asarray(x, dtype=np.float64)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89  # peak -1 dBFS; volume is set per project
    pcm = (x * 32767).astype("<i2")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        path = tmp.name
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dest = os.path.join(OUT, f"{name}.mp3")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", path, "-codec:a", "libmp3lame", "-b:a", bitrate, dest], check=True)
    os.remove(path)
    print(f"{name}.mp3  {len(x) / SR:.1f}s")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    write_mp3("bgm-calm", track_calm())
    write_mp3("bgm-bright", track_bright())
    write_mp3("bgm-lofi", track_lofi())
    write_mp3("sfx-whoosh", sfx_whoosh(), "128k")
    write_mp3("sfx-pop", sfx_pop(), "128k")
    write_mp3("sfx-ding", sfx_ding(), "128k")
    write_mp3("sfx-impact", sfx_impact(), "128k")
