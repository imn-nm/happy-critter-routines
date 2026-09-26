"""
Draws the app icon (a lime paw on the app's navy) and writes every size the
browser, phone home screens and the PWA manifest ask for into public/:

    favicon.svg            browser tab, modern browsers
    favicon.ico            browser tab, everything else (16/32/48)
    apple-touch-icon.png   iOS home screen (180, full bleed: iOS rounds it)
    icon-192.png           PWA manifest
    icon-512.png           PWA manifest
    icon-maskable-512.png  Android adaptive icon (full bleed, paw in the safe zone)

    python scripts/app-icons.py      (needs Pillow: pip install pillow)
"""
import math
import os

from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")

# The app's colours (tokens.css): focus navy, and lime for the one bright thing.
BG_LIGHT = "#323f78"
BG_DARK = "#1b2242"
PAW = "#dcef70"

# The paw on a 512 box: four toes (centre, radii, tilt) and a pad.
TOES = [
    (146, 222, 38, 50, -28),
    (214, 146, 41, 55, -10),
    (298, 146, 41, 55, 10),
    (366, 222, 38, 50, 28),
]
PAD_START = (256, 242)
PAD_CURVES = [
    ((208, 242), (160, 296), (146, 338)),
    ((132, 380), (154, 414), (196, 414)),
    ((222, 414), (236, 400), (256, 400)),
    ((276, 400), (290, 414), (316, 414)),
    ((358, 414), (380, 380), (366, 338)),
    ((352, 296), (304, 242), (256, 242)),
]


def scaled(x, y, scale):
    """Scale a point about the centre of the 512 box."""
    return 256 + (x - 256) * scale, 256 + (y - 256) * scale


# ── SVG ──────────────────────────────────────────────────────────────────────

def svg(scale=1.0, radius=112):
    toes = "".join(
        f'<ellipse cx="{scaled(cx, cy, scale)[0]:g}" cy="{scaled(cx, cy, scale)[1]:g}" '
        f'rx="{rx * scale:g}" ry="{ry * scale:g}" '
        f'transform="rotate({a} {scaled(cx, cy, scale)[0]:g} {scaled(cx, cy, scale)[1]:g})"/>'
        for cx, cy, rx, ry, a in TOES
    )
    x, y = scaled(*PAD_START, scale)
    d = f"M{x:g} {y:g}" + "".join(
        "C" + " ".join(f"{px:g} {py:g}" for px, py in (scaled(*p, scale) for p in curve))
        for curve in PAD_CURVES
    ) + "Z"
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{BG_LIGHT}"/><stop offset="1" stop-color="{BG_DARK}"/>'
        "</linearGradient></defs>"
        f'<rect width="512" height="512" rx="{radius}" fill="url(#bg)"/>'
        f'<g fill="{PAW}">{toes}<path d="{d}"/></g>'
        "</svg>\n"
    )


# ── Raster ───────────────────────────────────────────────────────────────────

def ellipse_points(cx, cy, rx, ry, angle, n=180):
    a = math.radians(angle)
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return pts


def pad_points(n=48):
    pts, (x0, y0) = [], PAD_START
    for (x1, y1), (x2, y2), (x3, y3) in PAD_CURVES:
        for i in range(1, n + 1):
            t = i / n
            u = 1 - t
            pts.append((
                u**3 * x0 + 3 * u**2 * t * x1 + 3 * u * t**2 * x2 + t**3 * x3,
                u**3 * y0 + 3 * u**2 * t * y1 + 3 * u * t**2 * y2 + t**3 * y3,
            ))
        x0, y0 = x3, y3
    return pts


def render(size, scale=1.0, radius=112, supersample=4):
    """The icon as an RGBA image; radius 0 fills the square edge to edge."""
    big = size * supersample
    k = big / 512

    # Diagonal navy gradient, light top-left to dark bottom-right.
    ramp = Image.linear_gradient("L").rotate(45, expand=True, resample=Image.BICUBIC)
    w, h = ramp.size
    ramp = ramp.crop((w // 2 - 128 // 1.42, h // 2 - 128 // 1.42, w // 2 + 128 // 1.42, h // 2 + 128 // 1.42))
    bg = ImageOps.colorize(ramp.resize((big, big), Image.BICUBIC), BG_LIGHT, BG_DARK).convert("RGBA")

    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * k, fill=255)
    icon = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)

    draw = ImageDraw.Draw(icon)
    to_px = lambda pts: [(x * k, y * k) for x, y in (scaled(px, py, scale) for px, py in pts)]
    for cx, cy, rx, ry, a in TOES:
        draw.polygon(to_px(ellipse_points(cx, cy, rx, ry, a)), fill=PAW)
    draw.polygon(to_px(pad_points()), fill=PAW)
    return icon.resize((size, size), Image.LANCZOS)


def main():
    # Tab icons are tiny, so the paw fills more of the square there.
    tab_scale = 1.18
    with open(os.path.join(PUBLIC, "favicon.svg"), "w", encoding="utf-8", newline="\n") as f:
        f.write(svg(scale=tab_scale, radius=112))
    render(256, scale=tab_scale).save(os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

    render(180, radius=0).convert("RGB").save(os.path.join(PUBLIC, "apple-touch-icon.png"), optimize=True)
    render(192).save(os.path.join(PUBLIC, "icon-192.png"), optimize=True)
    render(512).save(os.path.join(PUBLIC, "icon-512.png"), optimize=True)
    # Android crops adaptive icons to a circle or squircle: fill the square and
    # keep the paw inside the middle 80%.
    render(512, scale=0.92, radius=0).save(os.path.join(PUBLIC, "icon-maskable-512.png"), optimize=True)
    print("Wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png")


if __name__ == "__main__":
    main()
