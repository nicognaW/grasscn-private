"""Assemble: game frames [0, CUT) then stage frames at 60 fps, with sounds on their frames."""
import json, os, subprocess, sys
L = "/tmp/claude-0/-home-user-grasscn/af7d1b75-ebb3-5e26-8f14-cce022af46f2/scratchpad/launch"
CUT = 120; out = sys.argv[1]
seq = f"{L}/seq"; os.makedirs(seq, exist_ok=True)
for f in os.listdir(seq): os.remove(os.path.join(seq, f))
# Montage frames: join the three passes column by column (each column has its own cursor).
import numpy as np
from PIL import Image
meta = json.load(open(f"{L}/montage.json"))
comp = f"{L}/composite"; os.makedirs(comp, exist_ok=True)
xs = np.arange(1920)
stage = sorted(os.listdir(f"{L}/stage"))
for name in stage:
    n = int(name[6:11])
    if not (meta["from"] <= n < meta["to"]): continue
    shift = meta["track"][n - meta["from"]]
    col = ((np.floor(xs + shift) % 1920) // 640).astype(int)
    imgs = [np.asarray(Image.open(f"{L}/{d}/{name}").convert("RGB")) for d in ("stage", "stage-p2", "stage-p3")]
    joined = imgs[0].copy()
    for k in (1, 2): joined[:, col == k] = imgs[k][:, col == k]
    Image.fromarray(joined).save(f"{comp}/{name}", compress_level=1)
def src(name):
    n = int(name[6:11])
    return f"{comp}/{name}" if meta["from"] <= n < meta["to"] else f"{L}/stage/{name}"
frames = [f"{L}/recorder/frames/title/title-{i:05d}.png" for i in range(CUT)] + [src(p) for p in stage]
for i, src in enumerate(frames): os.symlink(src, f"{seq}/{i:05d}.png")
sounds = json.load(open(f"{L}/sounds.json"))
args = ["ffmpeg", "-loglevel", "error", "-y", "-framerate", "60", "-i", f"{seq}/%05d.png"]
filters = []
for i, s in enumerate(sounds):
    args += ["-i", f"{L}/assets/{s['kind']}.ogg"]
    ms = round((CUT + s["frame"]) * 1000 / 60)
    filters.append(f"[{i + 1}:a]adelay={ms}|{ms},volume={0.5 if s['kind'] == 'challenge' else 0.6}[a{i}]")
music = len(sounds) + 1
args += ["-i", f"{L}/assets/music.wav"]
filters.append(f"[{music}:a]aformat=sample_rates=48000:channel_layouts=stereo[m]")
mix = "".join(f"[a{i}]" for i in range(len(sounds))) + f"[m]amix=inputs={len(sounds) + 1}:normalize=0,apad[a]"
args += ["-filter_complex", ";".join(filters + [mix]), "-map", "0:v", "-map", "[a]", "-shortest",
         "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "160k", out]
subprocess.run(args, check=True)
print("frames", len(frames), "sounds", len(sounds), "->", out)
