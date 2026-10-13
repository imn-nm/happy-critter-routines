const path = require('path');
const fs = require('fs');
const ROOT = 'C:/Users/imaan/happy-critter-routines';
const esbuild = require(ROOT + '/node_modules/esbuild');
const PETS = ROOT + '/src/components/pets';
const exportsFor = { BathTime: 'BathGame', CarrotCatch: 'CatchGame', BubblePop: 'BubbleGame', Peekaboo: 'PeekGame' };
const entry = `
import { PIXEL_CLIPS } from "./pixel/clips";
import { backdrop, shadowUnder, CLIP_SCENE } from "./pixel/scenes";
import { PAL } from "./pixel/pix";
import { front } from "./pixel/sprites";
import { denScene } from "./playtime/scenes";
import { SY as PSY } from "./playtime/stage";
import { drawPose } from "./playtime/actions";
import { __BathGame } from "./playtime/BathTime";
import { __CatchGame } from "./playtime/CarrotCatch";
import { __BubbleGame } from "./playtime/BubblePop";
import { __PeekGame } from "./playtime/Peekaboo";
export { PIXEL_CLIPS, backdrop, shadowUnder, CLIP_SCENE, PAL, front, denScene, PSY, drawPose, __BathGame, __CatchGame, __BubbleGame, __PeekGame };
`;
esbuild.build({
  stdin: { contents: entry, resolveDir: PETS, loader: 'ts', sourcefile: 'entry.ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: __dirname + '/app.cjs',
  tsconfig: ROOT + '/tsconfig.json', logLevel: 'info', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  loader: { '.svg': 'text', '.png': 'empty', '.mp3': 'empty', '.wav': 'empty', '.css': 'empty' },
  plugins: [{ name: 'export-games', setup(b) {
    b.onLoad({ filter: /(BathTime|CarrotCatch|BubblePop|Peekaboo)\.tsx$/ }, async args => {
      const name = path.basename(args.path, '.tsx');
      const src = fs.readFileSync(args.path, 'utf8') + `\nexport { ${exportsFor[name]} as __${exportsFor[name]} };\n`;
      return { contents: src, loader: 'tsx' };
    });
  } }],
}).then(() => console.log('bundled'), e => { console.error(e.message); process.exit(1); });
