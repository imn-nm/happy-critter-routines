#!/usr/bin/env python3
"""Build the browser simulator: device/app + LVGL + cJSON -> platform/sim/web/mytoki.wasm.

    python device/platform/sim/build.py          # incremental
    python device/platform/sim/build.py --clean  # from scratch

Needs the Zig C compiler and the third-party sources: run `python device/tools/setup.py` once.
"""
import concurrent.futures
import glob
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEVICE = os.path.abspath(os.path.join(HERE, '..', '..'))
APP = os.path.join(DEVICE, 'app')
LVGL = os.path.join(DEVICE, 'third_party', 'lvgl')
CJSON = os.path.join(DEVICE, 'app', 'vendor', 'cjson')
OBJ = os.path.join(DEVICE, 'build', 'sim')
OUT = os.path.join(HERE, 'web', 'mytoki.wasm')

# Display and input drivers for other platforms (the rest of LVGL is switched by lv_conf.h).
LVGL_SKIP = ('/drivers/',)


def zig():
    venv = os.path.join(DEVICE, '.tools', 'venv')
    py = os.path.join(venv, 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(venv, 'bin', 'python')
    if os.path.exists(py):
        return [py, '-m', 'ziglang']
    if shutil.which('zig'):
        return ['zig']
    sys.exit('No Zig compiler found. Run: python device/tools/setup.py')


def sources():
    if not os.path.exists(os.path.join(LVGL, 'lvgl.h')):
        sys.exit('LVGL is missing. Run: python device/tools/setup.py')
    lv = [p for p in glob.glob(os.path.join(LVGL, 'src', '**', '*.c'), recursive=True)
          if not any(s in p.replace('\\', '/') for s in LVGL_SKIP)]
    app = glob.glob(os.path.join(APP, '**', '*.c'), recursive=True)
    return lv, app + [os.path.join(HERE, 'main_sim.c')]


def newest(paths):
    return max((os.path.getmtime(p) for p in paths), default=0)


def main():
    if '--clean' in sys.argv and os.path.exists(OBJ):
        shutil.rmtree(OBJ)
    os.makedirs(OBJ, exist_ok=True)
    cc = zig() + ['cc', '-target', 'wasm32-wasi']
    common = ['-O2', '-g0', '-DLV_CONF_INCLUDE_SIMPLE', '-I', HERE, '-I', LVGL, '-I', os.path.join(DEVICE, 'third_party'),
              '-I', APP, '-I', CJSON]
    lv, ours = sources()
    conf_time = os.path.getmtime(os.path.join(HERE, 'lv_conf.h'))
    headers_time = max(conf_time, newest(glob.glob(os.path.join(APP, '**', '*.h'), recursive=True)))

    jobs, objs = [], []
    for src in lv + ours:
        rel = os.path.relpath(src, DEVICE).replace(os.sep, '_').replace('..', 'up')
        obj = os.path.join(OBJ, rel[:-2] + '.o')
        objs.append(obj)
        dep = conf_time if src in lv else headers_time
        if not os.path.exists(obj) or os.path.getmtime(obj) < max(os.path.getmtime(src), dep):
            flags = common if src in lv else common + ['-Wall', '-Wno-unused-function', '-Wno-missing-braces']
            jobs.append((src, obj, flags))

    def compile_one(job):
        src, obj, flags = job
        r = subprocess.run(cc + flags + ['-c', src, '-o', obj], capture_output=True, text=True)
        return src, r.returncode, (r.stdout + r.stderr).strip()

    failed = False
    if jobs:
        print(f'compiling {len(jobs)} files')
        with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
            for src, code, out in ex.map(compile_one, jobs):
                if out:
                    print(out)
                if code:
                    failed = True
                    print(f'FAILED: {os.path.relpath(src, DEVICE)}')
    if failed:
        sys.exit(1)

    # One response file: the object list is longer than Windows allows on a command line.
    rsp = os.path.join(OBJ, 'link.rsp')
    with open(rsp, 'w') as f:
        f.write('\n'.join('"' + o.replace(os.sep, '/') + '"' for o in objs))
    link = cc + ['-mexec-model=reactor', '-Wl,-z,stack-size=1048576', '-Wl,--initial-memory=33554432',
                 '-o', OUT, '@' + rsp]
    r = subprocess.run(link, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout + r.stderr)
        sys.exit('link failed')
    print(f'built {os.path.relpath(OUT, DEVICE)} ({os.path.getsize(OUT) // 1024} KB)')


if __name__ == '__main__':
    main()
