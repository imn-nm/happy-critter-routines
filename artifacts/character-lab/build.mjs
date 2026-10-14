// Builds index.html: bundles page.ts (with the app's pixel code) and inlines it into template.html.
//   node artifacts/character-lab/build.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const esbuild = createRequire(path.join(ROOT, 'package.json'))('esbuild');

const out = esbuild.buildSync({
  entryPoints: [path.join(HERE, 'page.ts')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
  tsconfig: path.join(ROOT, 'tsconfig.app.json'),
  alias: { '@': path.join(ROOT, 'src') },
  logLevel: 'warning',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(HERE, 'template.html'), 'utf8').replace('/*SCRIPT*/', () => js);
fs.writeFileSync(path.join(HERE, 'index.html'), html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} KB`);
