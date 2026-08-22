import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PixelSprite, { type CritterMood } from "@/components/critters/PixelSprite";
import { CRITTERS } from "@/components/critters/pixelCharacters";
import type {
  EyeBox,
  Part,
  PartMotion,
  PartMotionType,
  PixelModel,
} from "@/components/critters/pixelModel";

/**
 * Visual pixel editor at /preview/critter-editor for hand-tuning the six
 * critters: paint / erase cells, pick colors, mark eyes, carve out rigged
 * parts (arm / leg / head) with a joint pivot, and choreograph how each part
 * moves per mood. Everything previews live and auto-saves to localStorage per
 * critter; the Export panel emits a ready-to-paste model literal for
 * pixelCharacters.ts. It never mutates the shipped art — it's a tuning bench.
 */

// A generous canvas: existing critters live within x 0–16, y 0–19.
const COLS = 18;
const ROWS = 20;
const CELL = 22; // px per grid cell in the editing canvas

const MOODS: CritterMood[] = ["idle", "happy", "excited", "celebrate", "worried", "sleep"];
const MOTIONS: PartMotionType[] = ["none", "swing", "bob", "sway", "flop"];
// A palette for outlining parts on the grid so each is visually distinct.
const PART_COLORS = ["#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444", "#3b82f6"];

type Tool = "paint" | "erase" | "eye" | "part" | "pivot";

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

interface EditorPart {
  name: string;
  pivot: { x: number; y: number };
  cellKeys: Set<string>;
  holdsEyes: boolean;
  motion: Record<string, PartMotion>;
}

interface Draft {
  id: string;
  name: string;
  description: string;
  cells: Map<string, string>; // "x,y" -> hex
  eyeKeys: Set<string>;
  parts: EditorPart[];
}

const draftFromModel = (m: PixelModel): Draft => {
  const cells = new Map<string, string>();
  for (const c of m.cells) cells.set(key(c.x, c.y), c.c);
  const eyeKeys = new Set<string>();
  for (const e of m.eyes ?? [])
    for (let x = e.x1; x <= e.x2; x++)
      for (let y = e.y1; y <= e.y2; y++)
        if (cells.has(key(x, y))) eyeKeys.add(key(x, y));
  const parts: EditorPart[] = (m.parts ?? []).map((p) => ({
    name: p.name,
    pivot: { ...p.pivot },
    cellKeys: new Set(p.cells.map((c) => key(c.x, c.y))),
    holdsEyes: !!p.holdsEyes,
    motion: { ...(p.motion ?? {}) },
  }));
  return { id: m.id, name: m.name, description: m.description, cells, eyeKeys, parts };
};

const draftToModel = (d: Draft): PixelModel => {
  const model: PixelModel = {
    id: d.id,
    name: d.name,
    description: d.description,
    cells: [...d.cells.entries()].map(([k, c]) => {
      const [x, y] = parseKey(k);
      return { x, y, c };
    }),
    eyes: eyeBoxesFromKeys(d.eyeKeys),
  };
  if (d.parts.length) {
    model.parts = d.parts.map<Part>((p) => {
      const part: Part = {
        name: p.name,
        pivot: p.pivot,
        cells: [...p.cellKeys].map((k) => {
          const [x, y] = parseKey(k);
          return { x, y };
        }),
      };
      if (p.holdsEyes) part.holdsEyes = true;
      const moods = Object.keys(p.motion).filter((mo) => p.motion[mo]?.type !== "none");
      if (moods.length) {
        part.motion = {};
        for (const mo of moods) part.motion[mo] = p.motion[mo];
      }
      return part;
    });
  }
  return model;
};

// Serialise a draft for localStorage (Map/Set aren't JSON-native).
const serialise = (d: Draft) =>
  JSON.stringify({
    ...d,
    cells: [...d.cells.entries()],
    eyeKeys: [...d.eyeKeys],
    parts: d.parts.map((p) => ({ ...p, cellKeys: [...p.cellKeys] })),
  });
const deserialise = (raw: string): Draft => {
  const o = JSON.parse(raw);
  return {
    ...o,
    cells: new Map(o.cells),
    eyeKeys: new Set<string>(o.eyeKeys),
    parts: (o.parts ?? []).map((p: { cellKeys: string[]; motion?: Record<string, PartMotion> }) => ({
      ...p,
      cellKeys: new Set<string>(p.cellKeys),
      motion: p.motion ?? {},
    })),
  };
};

const loadDraft = (id: string): Draft => {
  try {
    const raw = localStorage.getItem(storeKey(id));
    if (raw) return deserialise(raw);
  } catch { /* ignore corrupt storage */ }
  return draftFromModel(CRITTERS.find((c) => c.id === id)!);
};

const exportCode = (m: PixelModel): string => {
  const cells = m.cells
    .map((c) => `    { x: ${c.x}, y: ${c.y}, c: "${c.c}" },`)
    .join("\n");
  const eyes = (m.eyes ?? [])
    .map((e) => `    { x1: ${e.x1}, y1: ${e.y1}, x2: ${e.x2}, y2: ${e.y2} },`)
    .join("\n");
  let partsBlock = "";
  if (m.parts?.length) {
    const partStrs = m.parts.map((p) => {
      const cellStr = p.cells.map((c) => `{ x: ${c.x}, y: ${c.y} }`).join(", ");
      const lines = [
        `    {`,
        `      name: "${p.name}",`,
        `      pivot: { x: ${p.pivot.x}, y: ${p.pivot.y} },`,
        p.holdsEyes ? `      holdsEyes: true,` : null,
      ].filter(Boolean) as string[];
      if (p.motion && Object.keys(p.motion).length) {
        const mo = Object.entries(p.motion)
          .map(([k, v]) =>
            `        ${k}: { type: "${v.type}", amp: ${v.amp}, dur: ${v.dur}${v.delay ? `, delay: ${v.delay}` : ""} },`
          )
          .join("\n");
        lines.push(`      motion: {\n${mo}\n      },`);
      }
      lines.push(`      cells: [${cellStr}],`);
      lines.push(`    },`);
      return lines.join("\n");
    });
    partsBlock = `\n  parts: [\n${partStrs.join("\n")}\n  ],`;
  }
  return `const ${m.id}: PixelModel = {
  id: "${m.id}",
  name: "${m.name}",
  description: "${m.description}",
  cells: [
${cells}
  ],
  eyes: [
${eyes}
  ],${partsBlock}
};`;
};

const CritterEditor = () => {
  const [activeId, setActiveId] = useState(CRITTERS[0].id);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(CRITTERS[0].id));
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState("#0a0d0c");
  const [mood, setMood] = useState<CritterMood>("idle");
  const [activePart, setActivePart] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const painting = useRef(false);

  useEffect(() => { setDraft(loadDraft(activeId)); setActivePart(null); }, [activeId]);

  useEffect(() => {
    try { localStorage.setItem(storeKey(activeId), serialise(draft)); } catch { /* quota */ }
  }, [draft, activeId]);

  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const model = useMemo(() => draftToModel(draft), [draft]);

  const palette = useMemo(() => [...new Set<string>(draft.cells.values())], [draft.cells]);

  const applyCell = (x: number, y: number) => {
    setDraft((d) => {
      const cells = new Map(d.cells);
      const eyeKeys = new Set(d.eyeKeys);
      const parts = d.parts.map((p) => ({ ...p, cellKeys: new Set(p.cellKeys) }));
      const k = key(x, y);
      if (tool === "paint") {
        cells.set(k, color);
      } else if (tool === "erase") {
        cells.delete(k);
        eyeKeys.delete(k);
        parts.forEach((p) => p.cellKeys.delete(k));
      } else if (tool === "eye") {
        if (cells.has(k)) eyeKeys.has(k) ? eyeKeys.delete(k) : eyeKeys.add(k);
      } else if (tool === "part") {
        if (activePart !== null && cells.has(k)) {
          // Exclusive membership: a cell belongs to at most one part.
          parts.forEach((p, i) => { if (i !== activePart) p.cellKeys.delete(k); });
          parts[activePart].cellKeys.add(k);
        }
      } else if (tool === "pivot") {
        if (activePart !== null) parts[activePart].pivot = { x: x + 0.5, y: y + 0.5 };
      }
      return { ...d, cells, eyeKeys, parts };
    });
  };

  const updatePart = (i: number, patch: Partial<EditorPart>) =>
    setDraft((d) => ({ ...d, parts: d.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const updateMotion = (i: number, mo: CritterMood, patch: Partial<PartMotion>) =>
    setDraft((d) => ({
      ...d,
      parts: d.parts.map((p, j) => {
        if (j !== i) return p;
        const prev = p.motion[mo] ?? { type: "none", amp: 10, dur: 1, delay: 0 };
        return { ...p, motion: { ...p.motion, [mo]: { ...prev, ...patch } } };
      }),
    }));

  const addPart = () =>
    setDraft((d) => {
      const name = `part${d.parts.length + 1}`;
      const parts = [...d.parts, { name, pivot: { x: 9, y: 10 }, cellKeys: new Set<string>(), holdsEyes: false, motion: {} }];
      return { ...d, parts };
    });

  const deletePart = (i: number) =>
    setDraft((d) => ({ ...d, parts: d.parts.filter((_, j) => j !== i) }));

  const resetCritter = () => {
    localStorage.removeItem(storeKey(activeId));
    setDraft(draftFromModel(CRITTERS.find((c) => c.id === activeId)!));
    setActivePart(null);
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCode(model));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  // Which part (if any) owns each cell, for grid outlines.
  const cellPart = useMemo(() => {
    const m = new Map<string, number>();
    draft.parts.forEach((p, i) => p.cellKeys.forEach((k) => m.set(k, i)));
    return m;
  }, [draft.parts]);

  const part = activePart !== null ? draft.parts[activePart] : null;
  const partMotion = part?.motion[mood] ?? { type: "none" as PartMotionType, amp: 10, dur: 1, delay: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Critter Editor</h1>
          <p className="text-slate-500">
            Paint cells, mark eyes, rig moving parts, and choreograph moods.
            Edits auto-save locally; copy the export into <code>pixelCharacters.ts</code>.
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
                  {(["paint", "erase", "eye", "part", "pivot"] as Tool[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTool(t)}
                      className={`rounded px-2.5 py-1 text-sm capitalize ${
                        tool === t ? "bg-slate-800 text-white" : "text-slate-600"
                      }`}
                    >
                      {t}
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

              {(tool === "part" || tool === "pivot") && activePart === null && (
                <p className="mb-2 text-xs text-amber-600">
                  Select or add a part below to use this tool.
                </p>
              )}

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
                  backgroundImage: "repeating-conic-gradient(#f1f1ef 0 25%, #e7e7e4 0 50%)",
                  backgroundSize: "16px 16px",
                }}
                onMouseLeave={() => { painting.current = false; }}
              >
                {Array.from({ length: ROWS }).map((_, y) =>
                  Array.from({ length: COLS }).map((_, x) => {
                    const k = key(x, y);
                    const fill = draft.cells.get(k);
                    const isEye = draft.eyeKeys.has(k);
                    const pi = cellPart.get(k);
                    let ring: string | undefined;
                    if (isEye) ring = "inset 0 0 0 2px #38bdf8";
                    else if (pi !== undefined)
                      ring = `inset 0 0 0 ${pi === activePart ? 3 : 2}px ${PART_COLORS[pi % PART_COLORS.length]}`;
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
                          boxShadow: ring,
                        }}
                      />
                    );
                  })
                )}
                {/* Pivot marker for the active part */}
                {part && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 border-white"
                    style={{
                      left: part.pivot.x * CELL - 5,
                      top: part.pivot.y * CELL - 5,
                      width: 10,
                      height: 10,
                      backgroundColor: PART_COLORS[(activePart ?? 0) % PART_COLORS.length],
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                    }}
                    title="Part pivot (joint)"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live preview + rig + export */}
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

            {/* Parts + rig */}
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800">Parts</h2>
                  <Button size="sm" onClick={addPart}>Add part</Button>
                </div>

                {draft.parts.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No parts yet. Add one, select the <b>part</b> tool, and paint the cells
                    that should move together (e.g. an arm). Use the <b>pivot</b> tool to
                    click the joint it swings from.
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  {draft.parts.map((p, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-2 ${
                        i === activePart ? "border-slate-800 bg-slate-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setActivePart(i); if (tool !== "part" && tool !== "pivot") setTool("part"); }}
                          className="h-4 w-4 shrink-0 rounded-full border"
                          style={{ backgroundColor: i === activePart ? PART_COLORS[i % PART_COLORS.length] : "transparent", borderColor: PART_COLORS[i % PART_COLORS.length] }}
                          title="Select part"
                        />
                        <input
                          value={p.name}
                          onChange={(e) => updatePart(i, { name: e.target.value })}
                          className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-sm"
                        />
                        <span className="text-xs text-slate-400">{p.cellKeys.size} cells</span>
                        <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={p.holdsEyes}
                            onChange={(e) => updatePart(i, { holdsEyes: e.target.checked })}
                          />
                          eyes
                        </label>
                        <button
                          onClick={() => { deletePart(i); if (activePart === i) setActivePart(null); }}
                          className="text-xs text-rose-500"
                        >
                          delete
                        </button>
                      </div>

                      {i === activePart && (
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          <div className="mb-2 text-xs text-slate-500">
                            Motion for <b className="capitalize">{mood}</b> (pick a mood above)
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={partMotion.type}
                              onChange={(e) => updateMotion(i, mood, { type: e.target.value as PartMotionType })}
                              className="rounded border border-slate-200 px-1.5 py-1 text-sm capitalize"
                            >
                              {MOTIONS.map((mt) => <option key={mt} value={mt}>{mt}</option>)}
                            </select>
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              amp
                              <input
                                type="number" step="1"
                                value={partMotion.amp}
                                onChange={(e) => updateMotion(i, mood, { amp: Number(e.target.value) })}
                                className="w-16 rounded border border-slate-200 px-1 py-0.5 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              dur
                              <input
                                type="number" step="0.1"
                                value={partMotion.dur}
                                onChange={(e) => updateMotion(i, mood, { dur: Number(e.target.value) })}
                                className="w-16 rounded border border-slate-200 px-1 py-0.5 text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs text-slate-500">
                              delay
                              <input
                                type="number" step="0.1"
                                value={partMotion.delay ?? 0}
                                onChange={(e) => updateMotion(i, mood, { delay: Number(e.target.value) })}
                                className="w-16 rounded border border-slate-200 px-1 py-0.5 text-sm"
                              />
                            </label>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            swing = rotate ±amp° about the pivot · bob/sway = shift ±amp cells ·
                            dur in seconds · delay offsets phase (use dur/2 to alternate limbs)
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-800">Export</h2>
                  <Button size="sm" onClick={copyExport}>{copied ? "Copied!" : "Copy code"}</Button>
                </div>
                <textarea
                  readOnly
                  value={exportCode(model)}
                  className="h-56 w-full rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Paste this over the matching critter in{" "}
                  <code>src/components/critters/pixelCharacters.ts</code>, or send it to Claude to apply.
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
