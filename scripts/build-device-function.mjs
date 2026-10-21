// Bundles src/lib/devicePlan.ts into supabase/functions/mytoki-device/plan.js, so the MyToki
// handheld's server builds its day plan with the browser's own code. Run after changing anything
// the plan is built from (npm run device:function), then deploy the function.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The plan code never queries or renders: the browser's client (created at import, with
// localStorage), the JSX runtime and the icons' SVG paths (icon components are only defined, never
// drawn: taskIconKey needs their names) are stubbed.
const STUBS = {
  "@/integrations/supabase/client":
    "export const supabase = new Proxy({}, { get() { throw new Error('no browser supabase client on the server'); } });",
  "react/jsx-runtime": "export const jsx = () => null; export const jsxs = jsx; export const Fragment = Symbol('Fragment');",
  "./uiconPaths": "export const UICON_VIEWBOX = ''; export const UICON_PATHS = {};",
};

const resolve = {
  name: "app-resolve",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.path === "./uiconPaths" && !args.resolveDir.replaceAll("\\", "/").endsWith("src/components/icons")) return undefined;
      if (STUBS[args.path]) return { path: args.path, namespace: "stub" };
      if (args.path.startsWith("@/")) {
        return b.resolve("./" + args.path.slice(2), { resolveDir: path.join(root, "src"), kind: args.kind });
      }
      return undefined;
    });
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

const outfile = path.join(root, "supabase/functions/mytoki-device/plan.js");
const out = await build({
  entryPoints: [path.join(root, "src/lib/devicePlan.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  mainFields: ["module", "main"],
  conditions: ["import", "default"],
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  banner: { js: "// Generated from src/lib/devicePlan.ts by `npm run device:function`: don't edit by hand." },
  plugins: [resolve],
  logLevel: "info",
  write: false,
});

// PLAN_REV: which build of the plan code made a day, so the function's ETag changes with it (a
// handheld's "not changed" from before a deploy can't hold back a day built a new way)
const code = out.outputFiles[0].text;
const rev = createHash("sha256").update(code).digest("hex").slice(0, 10);
writeFileSync(outfile, `${code}export const PLAN_REV = "${rev}";\n`);
