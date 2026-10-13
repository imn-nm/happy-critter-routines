"""Lay out the frames platform/sim/fxtour.mjs rendered, one row per scene: python tools/frames.py [scene...]"""
import os, sys, re
from PIL import Image, ImageDraw
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build', 'fx')
files = sorted(f for f in os.listdir(d) if f.endswith('.png') and re.match(r'.*_\d{4}\.png$', f))
scenes = {}
for f in files:
    name, ms = f[:-4].rsplit('_', 1)
    scenes.setdefault(name, []).append((int(ms), f))
want = sys.argv[1:] or list(scenes)
cell, hh = 236, 258
rows = [n for n in want if n in scenes]
width = max(len(scenes[n]) for n in rows) * cell
im = Image.new('RGB', (width, hh * len(rows)), (30, 30, 30))
dr = ImageDraw.Draw(im)
for r, n in enumerate(rows):
    for c, (ms, f) in enumerate(sorted(scenes[n])):
        s = Image.open(os.path.join(d, f)).convert('RGB').resize((233, 233))
        im.paste(s, (c * cell + 2, r * hh + 22))
        dr.text((c * cell + 4, r * hh + 5), n + ' +' + str(ms) + ' ms', fill=(240, 240, 240))
out = os.path.join(d, 'strip_' + '_'.join(rows)[:40] + '.png')
im.save(out)
print(out)
