import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PixelSprite, { type CritterMood } from "@/components/critters/PixelSprite";
import { CRITTERS } from "@/components/critters/pixelCharacters";
import type { EyeBox, PixelModel } from "@/components/critters/pixelModel";

/**
 * Visual pixel editor at /preview/critter-editor for hand-tuning the six
 * critters: paint / erase cells, pick colors, mark which cells are eyes, and
 * watch every mood update live. Edits persist to localStorage per critter so
 * they survive reloads, and the Export panel emits a ready-to-paste model
 * literal for pixelCharacters.ts. It never mutates the shipped art — it's a
 * tuning bench, and you commit changes by copying the export into the source.
 */

// A generous canvas: existing critters live within x 0–16, y 0–19.
const COLS = 18;
const ROWS = 20;
const CELL = 22; // px per grid cell in the editing canvas

const MOODS: CritterMood[] = ["idle", "happy", "excited", "celebrate", "worried", "sleep"];

type Tool = "paint" | "erase" | "eye";

const key = (x: number, y: number) => `${x},${y}`;
const parseKey = (k: string) => k.split(",").map(Number) as [number, number];

const storeKey = (id: string) => `critter-editor:${id}`;

/** Merge a set of eye cells into one bounding box per 4-connected group. */
const eyeBoxesFromKeys = (keys: Set<string>): EyeBox[] => {
  const remaining = new Set(keys);
  const boxes: EyeBox[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as string;
    const stack = [start];
    remaining.delete(start);
    let [minX, minY] = parseKey(start);
    let maxX = minX, maxY = minY;
    while (stack.length) {
      const [x, y] = parseKey(stack.pop()!);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = key(x + dx, y + dy);
        if (remaining.has(nk)) { remaining.delete(nk); stack.push(nk); }
      }
    }
    boxes.push({ x1: minX, y1: minY, x2: maxX, y2: maxY });
  }
  return boxes;
};

interface Draft {
  id: string;
  name: string;
  description: string;
  cells: Map<string, string>; // "x,y" -> hex
  eyeKeys: Set<string>;
}

const draftFromModel = (m: PixelModel): Draft => {
  const cells = new Map<string, string>();
  for (const c of m.cells) cells.set(key(c.x, c.y), c.c);
  const eyeKeys = new Set<string>();
  for (const e of m.eyes ?? [])
    for (let x = e.x1; x <= e.x2; x++)
      for (let y = e.y1; y <= e.y2; y++)
        if (cells.has(key(x, y))) eyeKeys.add(key(x, y));
  return { id: m.id, name: m.name, description: m.description, cells, eyeKeys };
};

const draftToModel = (d: Draft): PixelModel => ({
  id: d.id,
  name: d.name,
  description: d.description,
  cells: [...d.cells.entries()].map(([k, c]) => {
    const [x, y] = parseKey(k);
    return { x, y, c };
  }),
  eyes: eyeBoxesFromKeys(d.eyeKeys),
});

// Serialise a draft for localStorage (Map/Set aren't JSON-native).
const serialise = (d: Draft) =>
  JSON.stringify({ ...d, cells: [...d.cells.entries()], eyeKeys: [...d.eyeKeys] });
const deserialise = (raw: string): Draft => {
  const o = JSON.parse(raw);
  return { ...o, cells: new Map(o.cells), eyeKeys: new Set<string>(o.eyeKeys) };
};

const loadDraft = (id: string): Draft => {
  try {
    const raw = localStorage.getItem(storeKey(id));
    if (raw) return deserialise(raw);
  } catch { /* ignore corrupt storage */ }
  const model = CRITTERS.find((c) => c.id === id)!;
  return draftFromModel(model);
};

const exportCode = (m: PixelModel): string => {
  const cells = m.cells
    .map((c) => `    { x: ${c.x}, y: ${c.y}, c: "${c.c}" },`)
    .join("\n");
  const eyes = (m.eyes ?? [])
    .map((e) => `    { x1: ${e.x1}, y1: ${e.y1}, x2: ${e.x2}, y2: ${e.y2} },`)
    .join("\n");
  return `const ${m.id}: PixelModel = {
  id: "${m.id}",
  name: "${m.name}",
  description: "${m.description}",
  cells: [
${cells}
  ],
  eyes: [
${eyes}
  ],
};`;
};

const CritterEditor = () => {
  const [activeId, setActiveId] = useState(CRITTERS[0].id);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(CRITTERS[0].id));
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState("#0a0d0c");
  const [mood, setMood] = useState<CritterMood>("idle");
  const [copied, setCopied] = useState(false);
  const painting = useRef(false);

  // Switch critters — load that critter's saved draft (or its original).
  useEffect(() => { setDraft(loadDraft(activeId)); }, [activeId]);

  // Persist on every edit so tweaks survive a reload.
  useEffect(() => {
    try { localStorage.setItem(storeKey(activeId), serialise(draft)); } catch { /* quota */ }
  }, [draft, activeId]);

  // Stop painting even if the mouse is released outside the grid.
  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const model = useMemo(() => draftToModel(draft), [draft]);

  // Unique colors used in this critter, for quick reuse as swatches.
  const palette = useMemo(() => {
    const set = new Set<string>(draft.cells.values());
    return [...set];
  }, [draft.cells]);

  const applyCell = (x: number, y: number) => {
    setDraft((d) => {
      const cells = new Map(d.cells);
      const eyeKeys = new Set(d.eyeKeys);
      const k = key(x, y);
      if (tool === "paint") {
        cells.set(k, color);
      } else if (tool === "erase") {
        cells.delete(k);
        eyeKeys.delete(k);
      } else {
        // eye toggle — only meaningful on a filled cell
        if (cells.has(k)) eyeKeys.has(k) ? eyeKeys.delete(k) : eyeKeys.add(k);
      }
      return { ...d, cells, eyeKeys };
    });
  };

  const resetCritter = () => {
    localStorage.removeItem(storeKey(activeId));
    setDraft(draftFromModel(CRITTERS.find((c) => c.id === activeId)!));
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCode(model));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Critter Editor</h1>
          <p className="text-slate-500">
            Paint cells, mark eyes, preview moods. Edits auto-save locally; copy
            the export into <code>pixelCharacters.ts</code> to make them permanent.
          </p>
        </header>

        {/* Critter picker */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CRITTERS.map((c) => (
            <Button
              key={c.id}
              variant={c.id === activeId ? "default" : "outline"}
              onClick={() => setActiveId(c.id)}
              className="capitalize"
            >
              {c.id}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto,1fr]">
          {/* Editing canvas */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-slate-200 p-0.5">
                  {(["paint", "erase", "eye"] as Tool[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTool(t)}
                      className={`rounded px-3 py-1 text-sm capitalize ${
                        tool === t ? "bg-slate-800 text-white" : "text-slate-600"
                      }`}
                    >
                      {t === "eye" ? "eye toggle" : t}
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                  title="Pick paint color"
                />
              </div>

              {/* Palette swatches from this critter's colors */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {palette.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setColor(c); setTool("paint"); }}
                    className={`h-6 w-6 rounded border ${
                      color.toLowerCase() === c.toLowerCase()
                        ? "border-slate-800 ring-2 ring-slate-400"
                        : "border-slate-300"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>

              <div
                className="relative select-none rounded"
                style={{
                  width: COLS * CELL,
                  height: ROWS * CELL,
                  // Checkerboard so transparent (empty) cells are obvious.
                  backgroundImage:
                    "repeating-conic-gradient(#f1f1ef 0 25%, #e7e7e4 0 50%)",
                  backgroundSize: "16px 16px",
                }}
                onMouseLeave={() => { painting.current = false; }}
              >
                {/* grid cells */}
                {Array.from({ length: ROWS }).map((_, y) =>
                  Array.from({ length: COLS }).map((_, x) => {
                    const k = key(x, y);
                    const fill = draft.cells.get(k);
                    const isEye = draft.eyeKeys.has(k);
                    return (
                      <div
                        key={k}
                        onMouseDown={() => { painting.current = true; applyCell(x, y); }}
                        onMouseEnter={() => { if (painting.current) applyCell(x, y); }}
                        className="absolute border border-black/5"
                        style={{
                          left: x * CELL,
                          top: y * CELL,
                          width: CELL,
                          height: CELL,
                          backgroundColor: fill ?? "transparent",
                          boxShadow: isEye ? "inset 0 0 0 2px #38bdf8" : undefined,
                        }}
                      />
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live preview + export */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-xl bg-white/60 p-4">
                    <PixelSprite model={model} size={200} mood={mood} />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {MOODS.map((m) => (
                      <Button
                        key={m}
                        size="sm"
                        variant={m === mood ? "default" : "outline"}
                        onClick={() => setMood(m)}
                        className="capitalize"
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetCritter} className="text-rose-600">
                    Reset {activeId} to original
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800">Export</h2>
                  <Button size="sm" onClick={copyExport}>
                    {copied ? "Copied!" : "Copy code"}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={exportCode(model)}
                  className="h-56 w-full rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Paste this over the matching critter in{" "}
                  <code>src/components/critters/pixelCharacters.ts</code> (and add it
                  to the <code>CRITTERS</code> array), or send it to Claude to apply.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CritterEditor;
