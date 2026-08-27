import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PixelSprite, { type CritterMood } from "@/components/critters/PixelSprite";
import { CRITTERS } from "@/components/critters/pixelCharacters";
import type { EyeBox, PixelModel } from "@/components/critters/pixelModel";

/**
 * Visual pixel editor at /preview/critter-editor for hand-tuning the six
 * critters: paint / erase cells, pick colors, mark eyes, and draw POSES —
 * alternate full frames. Name a pose after a mood (celebrate, eating, sleep,
 * worried, happy, idle) and the pet flips between its base drawing and that
 * pose in that mood, Tamagotchi-style. Everything previews live and
 * auto-saves to localStorage per critter; the Export panel emits a
 * ready-to-paste model literal for pixelCharacters.ts. It never mutates the
 * shipped art — it's a tuning bench.
 */

// A roomy canvas with free cells on every side, so poses can extend arms,
// legs and ears past the base silhouette.
const COLS = 26;
const ROWS = 26;
const CELL = 20; // px per grid cell in the editing canvas
// Shipped critters live within x 0–16, y 0–19; shift them on load so the
// drawing sits centered with working room all around.
const LOAD_OFFSET = { x: 4, y: 3 };

const MOODS: CritterMood[] = ["idle", "happy", "eating", "celebrate", "worried", "sleep"];

type Tool = "paint" | "erase" | "eye" | "move";

const key = (x: number, y: number) => `${x},${y}`;
const parseKey = (k: string) => k.split(",").map(Number) as [number, number];
// v3: pose drafts on the enlarged canvas; older drafts are left behind.
const storeKey = (id: string) => `critter-editor:v3:${id}`;

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

interface PoseDraft {
  name: string;
  cells: Map<string, string>; // "x,y" -> hex
}

interface Draft {
  id: string;
  name: string;
  description: string;
  cells: Map<string, string>; // base frame
  eyeKeys: Set<string>;
  poses: PoseDraft[];
  /**
   * Cumulative offset of the base frame vs the shipped model's coordinates
   * (load centering + any moves). Applied to the pass-through parts rig on
   * export so e.g. the bunny's ears stay glued to the moved drawing.
   */
  shift: { x: number; y: number };
}

const cellsToMap = (cells: { x: number; y: number; c: string }[]) => {
  const m = new Map<string, string>();
  for (const c of cells) m.set(key(c.x, c.y), c.c);
  return m;
};

const mapToCells = (m: Map<string, string>) =>
  [...m.entries()].map(([k, c]) => {
    const [x, y] = parseKey(k);
    return { x, y, c };
  });

const draftFromModel = (m: PixelModel): Draft => {
  const ox = LOAD_OFFSET.x, oy = LOAD_OFFSET.y;
  const shifted = (cs: { x: number; y: number; c: string }[]) =>
    cs.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
  const cells = cellsToMap(shifted(m.cells));
  const eyeKeys = new Set<string>();
  for (const e of m.eyes ?? [])
    for (let x = e.x1 + ox; x <= e.x2 + ox; x++)
      for (let y = e.y1 + oy; y <= e.y2 + oy; y++)
        if (cells.has(key(x, y))) eyeKeys.add(key(x, y));
  const poses: PoseDraft[] = (m.poses ?? []).map((p) => ({ name: p.name, cells: cellsToMap(shifted(p.cells)) }));
  return { id: m.id, name: m.name, description: m.description, cells, eyeKeys, poses, shift: { ...LOAD_OFFSET } };
};

// The editor doesn't touch lofi/parts — they pass through from the shipped
// model so an export never strips them (e.g. the bunny's ear rig).
const draftToModel = (d: Draft): PixelModel => {
  const src = CRITTERS.find((c) => c.id === d.id);
  const model: PixelModel = {
    id: d.id,
    name: d.name,
    description: d.description,
    cells: mapToCells(d.cells),
    eyes: eyeBoxesFromKeys(d.eyeKeys),
  };
  if (src?.lofi) model.lofi = true;
  if (src?.parts?.length) {
    // Shift the rig by the same offset as the base drawing so it stays attached.
    model.parts = src.parts.map((p) => ({
      ...p,
      pivot: { x: p.pivot.x + d.shift.x, y: p.pivot.y + d.shift.y },
      cells: p.cells.map((c) => ({ x: c.x + d.shift.x, y: c.y + d.shift.y })),
    }));
  }
  const poses = d.poses.filter((p) => p.cells.size > 0);
  if (poses.length) model.poses = poses.map((p) => ({ name: p.name, cells: mapToCells(p.cells) }));
  return model;
};

// Serialise a draft for localStorage (Map/Set aren't JSON-native).
const serialise = (d: Draft) =>
  JSON.stringify({
    ...d,
    cells: [...d.cells.entries()],
    eyeKeys: [...d.eyeKeys],
    poses: d.poses.map((p) => ({ name: p.name, cells: [...p.cells.entries()] })),
  });
const deserialise = (raw: string): Draft => {
  const o = JSON.parse(raw);
  return {
    ...o,
    cells: new Map(o.cells),
    eyeKeys: new Set<string>(o.eyeKeys),
    poses: (o.poses ?? []).map((p: { name: string; cells: [string, string][] }) => ({
      name: p.name,
      cells: new Map(p.cells),
    })),
    shift: o.shift ?? { ...LOAD_OFFSET },
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
  const cellLines = (cells: { x: number; y: number; c: string }[], indent: string) =>
    cells.map((c) => `${indent}{ x: ${c.x}, y: ${c.y}, c: "${c.c}" },`).join("\n");
  const eyes = (m.eyes ?? [])
    .map((e) => `    { x1: ${e.x1}, y1: ${e.y1}, x2: ${e.x2}, y2: ${e.y2} },`)
    .join("\n");
  let extras = "";
  if (m.lofi) extras += `\n  lofi: true,`;
  if (m.parts?.length) {
    const parts = m.parts
      .map((p) => {
        const cellStr = p.cells.map((c) => `{ x: ${c.x}, y: ${c.y} }`).join(", ");
        return `    { name: "${p.name}", pivot: { x: ${p.pivot.x}, y: ${p.pivot.y} },${p.holdsEyes ? " holdsEyes: true," : ""} cells: [${cellStr}] },`;
      })
      .join("\n");
    extras += `\n  parts: [\n${parts}\n  ],`;
  }
  if (m.poses?.length) {
    const poses = m.poses
      .map((p) => `    {\n      name: "${p.name}",\n      cells: [\n${cellLines(p.cells, "        ")}\n      ],\n    },`)
      .join("\n");
    extras += `\n  poses: [\n${poses}\n  ],`;
  }
  return `const ${m.id}: PixelModel = {
  id: "${m.id}",
  name: "${m.name}",
  description: "${m.description}",
  cells: [
${cellLines(m.cells, "    ")}
  ],
  eyes: [
${eyes}
  ],${extras}
};`;
};

const CritterEditor = () => {
  const [activeId, setActiveId] = useState(CRITTERS[0].id);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(CRITTERS[0].id));
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState("#0a0d0c");
  const [mood, setMood] = useState<CritterMood>("idle");
  // -1 = base frame; otherwise index into draft.poses
  const [frame, setFrame] = useState(-1);
  const [copied, setCopied] = useState(false);
  const painting = useRef(false);
  // Last grid cell the cursor visited while dragging with the move tool.
  const moveAnchor = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { setDraft(loadDraft(activeId)); setFrame(-1); }, [activeId]);

  useEffect(() => {
    try { localStorage.setItem(storeKey(activeId), serialise(draft)); } catch { /* quota */ }
  }, [draft, activeId]);

  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const model = useMemo(() => draftToModel(draft), [draft]);

  const activeCells = frame < 0 ? draft.cells : draft.poses[frame]?.cells ?? draft.cells;

  // Unique colors across base + poses, for quick reuse as swatches.
  const palette = useMemo(() => {
    const set = new Set<string>(draft.cells.values());
    draft.poses.forEach((p) => p.cells.forEach((c) => set.add(c)));
    return [...set];
  }, [draft]);

  const applyCell = (x: number, y: number) => {
    setDraft((d) => {
      const k = key(x, y);
      if (frame < 0) {
        const cells = new Map(d.cells);
        const eyeKeys = new Set(d.eyeKeys);
        if (tool === "paint") cells.set(k, color);
        else if (tool === "erase") { cells.delete(k); eyeKeys.delete(k); }
        else if (cells.has(k)) eyeKeys.has(k) ? eyeKeys.delete(k) : eyeKeys.add(k);
        return { ...d, cells, eyeKeys };
      }
      const poses = d.poses.map((p, i) => {
        if (i !== frame) return p;
        const cells = new Map(p.cells);
        if (tool === "paint") cells.set(k, color);
        else cells.delete(k); // eye tool acts as erase on pose frames
        return { ...p, cells };
      });
      return { ...d, poses };
    });
  };

  /** Shift the whole active frame by (dx, dy); refused if anything would leave the grid. */
  const moveFrame = (dx: number, dy: number) => {
    if (!dx && !dy) return;
    setDraft((d) => {
      const source = frame < 0 ? d.cells : d.poses[frame]?.cells;
      if (!source || source.size === 0) return d;
      const moved = new Map<string, string>();
      for (const [k, c] of source) {
        const [x, y] = parseKey(k);
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return d; // would fall off — refuse
        moved.set(key(nx, ny), c);
      }
      if (frame < 0) {
        const eyeKeys = new Set<string>();
        for (const k of d.eyeKeys) {
          const [x, y] = parseKey(k);
          eyeKeys.add(key(x + dx, y + dy));
        }
        return { ...d, cells: moved, eyeKeys, shift: { x: d.shift.x + dx, y: d.shift.y + dy } };
      }
      return { ...d, poses: d.poses.map((p, i) => (i === frame ? { ...p, cells: moved } : p)) };
    });
  };

  const addPose = () => {
    setDraft((d) => {
      // Duplicate whichever frame is showing, so a pose starts as a copy to nudge.
      const source = frame < 0 ? d.cells : d.poses[frame]?.cells ?? d.cells;
      const taken = new Set(d.poses.map((p) => p.name));
      const name = MOODS.find((m) => m !== "idle" && !taken.has(m)) ?? `pose${d.poses.length + 1}`;
      return { ...d, poses: [...d.poses, { name, cells: new Map(source) }] };
    });
    setFrame(draft.poses.length);
    if (tool === "eye") setTool("paint");
  };

  const deletePose = (i: number) => {
    setDraft((d) => ({ ...d, poses: d.poses.filter((_, j) => j !== i) }));
    setFrame(-1);
  };

  const renamePose = (i: number, name: string) =>
    setDraft((d) => ({ ...d, poses: d.poses.map((p, j) => (j === i ? { ...p, name } : p)) }));

  const resetCritter = () => {
    localStorage.removeItem(storeKey(activeId));
    setDraft(draftFromModel(CRITTERS.find((c) => c.id === activeId)!));
    setFrame(-1);
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportCode(model));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  const editingPose = frame >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-rose-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Critter Editor</h1>
          <p className="text-slate-500">
            Paint cells, mark eyes, and draw poses — alternate frames named after a
            mood. Edits auto-save locally; copy the export into <code>pixelCharacters.ts</code>.
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
              {/* Frame selector: base + poses */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setFrame(-1)}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    !editingPose ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  base
                </button>
                {draft.poses.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setFrame(i); if (tool === "eye") setTool("paint"); }}
                    className={`rounded-md px-3 py-1 text-sm font-medium ${
                      frame === i ? "bg-amber-500 text-white" : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
                <Button size="sm" variant="outline" onClick={addPose}>+ pose</Button>
              </div>

              {editingPose && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <label className="text-slate-500">name</label>
                  <select
                    value={MOODS.includes(draft.poses[frame].name as CritterMood) ? draft.poses[frame].name : "__custom"}
                    onChange={(e) => { if (e.target.value !== "__custom") renamePose(frame, e.target.value); }}
                    className="rounded border border-slate-200 px-1.5 py-1 capitalize"
                  >
                    {MOODS.filter((m) => m !== "idle").map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value="__custom">custom…</option>
                  </select>
                  <input
                    value={draft.poses[frame].name}
                    onChange={(e) => renamePose(frame, e.target.value)}
                    className="w-24 rounded border border-slate-200 px-1.5 py-0.5"
                  />
                  <button onClick={() => deletePose(frame)} className="text-xs text-rose-500">delete pose</button>
                </div>
              )}

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border border-slate-200 p-0.5">
                  {(["paint", "erase", ...(editingPose ? [] : ["eye"]), "move"] as Tool[]).map((t) => (
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
                {tool === "move" && (
                  <div className="flex items-center gap-1">
                    {([["←", -1, 0], ["↑", 0, -1], ["↓", 0, 1], ["→", 1, 0]] as const).map(([label, dx, dy]) => (
                      <button
                        key={label}
                        onClick={() => moveFrame(dx, dy)}
                        className="h-8 w-8 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        title={`Nudge ${editingPose ? "pose" : "pet"} 1 cell`}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="ml-1 text-xs text-slate-400">or drag the drawing</span>
                  </div>
                )}
              </div>

              {/* Palette swatches */}
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
                className={`relative select-none rounded ${tool === "move" ? "cursor-move" : ""}`}
                style={{
                  width: COLS * CELL,
                  height: ROWS * CELL,
                  // Checkerboard so transparent (empty) cells are obvious.
                  backgroundImage: "repeating-conic-gradient(#f1f1ef 0 25%, #e7e7e4 0 50%)",
                  backgroundSize: "16px 16px",
                }}
                onMouseLeave={() => { painting.current = false; }}
              >
                {Array.from({ length: ROWS }).map((_, y) =>
                  Array.from({ length: COLS }).map((_, x) => {
                    const k = key(x, y);
                    const fill = activeCells.get(k);
                    // Onion skin: while editing a pose, ghost the base drawing
                    // underneath so it's easy to keep the silhouette aligned.
                    const ghost = editingPose && !fill ? draft.cells.get(k) : undefined;
                    const isEye = !editingPose && draft.eyeKeys.has(k);
                    return (
                      <div
                        key={k}
                        onMouseDown={() => {
                          painting.current = true;
                          if (tool === "move") moveAnchor.current = { x, y };
                          else applyCell(x, y);
                        }}
                        onMouseEnter={() => {
                          if (!painting.current) return;
                          if (tool === "move") {
                            const a = moveAnchor.current;
                            if (a) moveFrame(x - a.x, y - a.y);
                            moveAnchor.current = { x, y };
                          } else {
                            applyCell(x, y);
                          }
                        }}
                        className="absolute border border-black/5"
                        style={{
                          left: x * CELL,
                          top: y * CELL,
                          width: CELL,
                          height: CELL,
                          backgroundColor: fill ?? (ghost ? `${ghost}40` : "transparent"),
                          boxShadow: isEye ? "inset 0 0 0 2px #38bdf8" : undefined,
                        }}
                      />
                    );
                  })
                )}
              </div>
              {editingPose && (
                <p className="mt-2 text-xs text-slate-500">
                  Faint cells are the base frame (onion skin) — paint over them to build the pose.
                </p>
              )}
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
                  <p className="text-center text-xs text-slate-500">
                    A pose named after a mood flips base ↔ pose in that mood, replacing
                    the built-in motion. Pick the mood above to watch it.
                  </p>
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
                  <code>src/components/critters/pixelCharacters.ts</code>, or send it to
                  Claude to apply.
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
