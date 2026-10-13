#!/usr/bin/env python3
"""One-time setup for the MyToki device code.

    python device/tools/setup.py            # what the simulator build needs
    python device/tools/setup.py --assets   # also the tools that regenerate fonts, icons and Biscuit

Everything lands inside device/ (.tools/, third_party/, tools/node_modules/), all git-ignored:
  - the Zig C compiler (from PyPI, in a private venv) to build the simulator as WebAssembly
  - LVGL v9.5.0, the same version Waveshare's ESP-IDF demo and the firmware use
With --assets:
  - lv_font_conv and resvg (npm, in device/tools) and fontTools (pip)
  - Unbounded, Space Grotesk, Amiko, Montserrat and Poppins from Google Fonts (SIL OFL), cut to the weights used
The ESP-IDF firmware build doesn't need any of this: ESP-IDF's component manager fetches LVGL.
"""
import os
import shutil
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEVICE = os.path.dirname(HERE)
TOOLS = os.path.join(DEVICE, '.tools')
VENV = os.path.join(TOOLS, 'venv')
PY = os.path.join(VENV, 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(VENV, 'bin', 'python')
LVGL_TAG = 'v9.5.0'
ZIG_VERSION = '0.16.0'
FONTS = {
    'Unbounded[wght].ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/unbounded/Unbounded%5Bwght%5D.ttf',
    'SpaceGrotesk[wght].ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf',
    'Amiko-400.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/amiko/Amiko-Regular.ttf',
    # the MyToki Circle design system (Figma 609:2719): titles and messages in Montserrat, labels in Poppins
    'Montserrat[wght].ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
    'Poppins-500.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Medium.ttf',
    'Poppins-700.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
}
WEIGHTS = {'Unbounded[wght].ttf': ('Unbounded', [400, 500, 600, 700]), 'SpaceGrotesk[wght].ttf': ('SpaceGrotesk', [400, 500, 700]),
           'Montserrat[wght].ttf': ('Montserrat', [500, 600])}


def run(cmd, **kw):
    print('>', ' '.join(cmd))
    subprocess.run(cmd, check=True, **kw)


def venv(packages):
    if not os.path.exists(PY):
        run([sys.executable, '-m', 'venv', VENV])
        run([PY, '-m', 'pip', 'install', '-q', '--upgrade', 'pip'])
    run([PY, '-m', 'pip', 'install', '-q'] + packages)


def lvgl():
    dst = os.path.join(DEVICE, 'third_party', 'lvgl')
    if os.path.exists(os.path.join(dst, 'lvgl.h')):
        print('LVGL already there')
        return
    if not shutil.which('git'):
        sys.exit('git is needed to fetch LVGL')
    run(['git', '-c', 'advice.detachedHead=false', 'clone', '-q', '--depth', '1', '--branch', LVGL_TAG,
         'https://github.com/lvgl/lvgl.git', dst])


def fonts():
    d = os.path.join(TOOLS, 'fonts')
    os.makedirs(d, exist_ok=True)
    for name, url in FONTS.items():
        path = os.path.join(d, name)
        if not os.path.exists(path):
            print('fetching', name)
            urllib.request.urlretrieve(url, path)
    script = (
        'import sys\nfrom fontTools.ttLib import TTFont\nfrom fontTools.varLib import instancer\n'
        'src, fam, w, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]\n'
        "instancer.instantiateVariableFont(TTFont(src), {'wght': w}).save(out)\n")
    for name, (family, weights) in WEIGHTS.items():
        for w in weights:
            out = os.path.join(d, f'{family}-{w}.ttf')
            if not os.path.exists(out):
                run([PY, '-c', script, os.path.join(d, name), family, str(w), out])


def main():
    venv([f'ziglang=={ZIG_VERSION}'] + (['fonttools'] if '--assets' in sys.argv else []))
    lvgl()
    if '--assets' in sys.argv:
        npm = shutil.which('npm') or shutil.which('npm.cmd')
        if not npm:
            sys.exit('Node.js (npm) is needed for the asset tools')
        run([npm, 'install', '--no-audit', '--no-fund'], cwd=HERE)
        fonts()
    print('\nReady. Build and open the simulator with:  python device/platform/sim/run.py')


if __name__ == '__main__':
    main()
