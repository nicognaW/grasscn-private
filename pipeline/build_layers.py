"""Split recorded game frames into exact layers: logo, splash, extras (icons + texts)."""
import sys, os
import numpy as np
from PIL import Image
F = sys.argv[1]; OUT = sys.argv[2]; N = int(sys.argv[3]); S = 3
START = int(sys.argv[4]) if len(sys.argv) > 4 else 0
os.makedirs(OUT, exist_ok=True)
load = lambda d, g: np.asarray(Image.open(f"{F}/{d}/{d}-{g:05d}.png").convert("RGB"))
logo_box = (180*S, 18*S, 460*S, 90*S)  # x0, y0, x1, y1
buttons = [(220,138,200),(220,162,200),(220,186,200),(220,234,98),(322,234,98)]
def rgba(src, mask):
    out = np.zeros((*src.shape[:2], 4), np.uint8); out[..., :3] = src; out[..., 3] = mask * 255
    return Image.fromarray(out, "RGBA")
for g in range(START, N):
    T, P, Nn = load("title", g), load("panorama", g), load("nosplash", g)
    ui = (Nn != P).any(axis=2)
    box = np.zeros_like(ui); x0, y0, x1, y1 = logo_box; box[y0:y1, x0:x1] = True
    btn = np.zeros_like(ui)
    for x, y, w in buttons: btn[y*S:(y+20)*S, x*S:(x+w)*S] = True
    if g == START:
        stray = ui & btn
        ys, xs = np.nonzero(ui & ~box)
        print("non-logo UI bbox (px)", xs.min(), ys.min(), xs.max(), ys.max())
    rgba(Nn, ui & box).save(f"{OUT}/logo-{g:05d}.png", compress_level=1)
    rgba(T, (T != Nn).any(axis=2)).save(f"{OUT}/splash-{g:05d}.png", compress_level=1)
    rgba(Nn, ui & ~box & ~btn).save(f"{OUT}/extras-{g:05d}.png", compress_level=1)
print("layers", N)
