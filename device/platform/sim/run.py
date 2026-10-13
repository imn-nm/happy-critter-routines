#!/usr/bin/env python3
"""Build the simulator and open it in the browser.

    python device/platform/sim/run.py            # http://localhost:5190
    python device/platform/sim/run.py --no-open
"""
import functools
import http.server
import os
import subprocess
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 5190

subprocess.run([sys.executable, os.path.join(HERE, 'build.py')], check=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=os.path.join(HERE, 'web')))
url = f'http://localhost:{PORT}'
print(f'MyToki simulator: {url}  (Ctrl+C to stop)')
if '--no-open' not in sys.argv:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
