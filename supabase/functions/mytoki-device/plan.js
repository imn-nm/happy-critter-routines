// Generated from src/lib/devicePlan.ts by `npm run device:function`: don't edit by hand.

// src/components/pets/pixel/pix.ts
var KEY = (x, y) => (y + 256) * 1024 + (x + 256);
var xOf = (k) => k % 1024 - 256;
var yOf = (k) => Math.floor(k / 1024) - 256;
var Pix = class _Pix {
  m = /* @__PURE__ */ new Map();
  set(x, y, c) {
    if (c && c !== ".") this.m.set(KEY(x, y), c);
    return this;
  }
  get(x, y) {
    return this.m.get(KEY(x, y));
  }
  del(x, y) {
    this.m.delete(KEY(x, y));
  }
  clone() {
    const p = new _Pix();
    p.m = new Map(this.m);
    return p;
  }
  each(fn) {
    for (const [k, c] of this.m) fn(xOf(k), yOf(k), c);
  }
  /** Paint rows of palette keys; "." is empty. `color` overrides every cell. */
  stamp(rows, dx = 0, dy = 0, color) {
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const c = r[x];
        if (c !== ".") this.set(x + dx, y + dy, color ?? c);
      }
    });
    return this;
  }
  /** Paint another map on top. */
  merge(o, dx = 0, dy = 0) {
    o.each((x, y, c) => this.set(x + dx, y + dy, c));
    return this;
  }
  bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    this.each((x, y) => {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    return { x0, y0, x1, y1 };
  }
  /** Mirror left to right within a sprite `w` cells wide. */
  flipX(w) {
    const p = new _Pix();
    this.each((x, y, c) => p.set(w - 1 - x, y, c));
    return p;
  }
};
var rep = (s, n = 2) => Array(n).fill(s);
var runs = (p, list, c = "W") => {
  for (const [y, a, b] of list) for (let x = a; x <= b; x++) p.set(x, y, c);
  return p;
};

// src/components/pets/pixel/accessories.ts
var PARTY_HAT = [
  "....YY....",
  "...YYYY...",
  "....YY....",
  "....NN....",
  "...NNNN...",
  "...GGGG...",
  "..GGGGGG..",
  "..NNNNNN..",
  ".NNNNNNNN.",
  ".GGGGGGGG.",
  "GGGGGGGGGG",
  "NNNNNNNNNN",
  "gggggggggg"
];
var BOW = ["MM.....MM", "MRM...MRM", "MRPM.MPRM", "MPPPMPPPM", "MRPM.MPRM", "MRM...MRM", "MM.....MM"];
var HEART = [".PP.PP.", "PPPPPPP", "PFPPPPP", ".PPPPP.", "..PPP..", "...P..."];
var BOWTIE = ["XX..XX", "XXxxXX", "XX..XX"];
var WIZARD = [
  "..........NN",
  "........NNN.",
  ".......NNN..",
  "......NNNN..",
  "......NNYN..",
  ".....NNNNNN.",
  ".....NNNNNN.",
  "....NNNYNNN.",
  "....NNNNNNNN",
  "...NNNNNNNNN",
  "...NNYNNNNNN"
];
var TIARA = [
  ".....YY.....",
  ".....YY.....",
  "....YPPY....",
  ".Y..YPPY..Y.",
  ".YY.YYYY.YY.",
  "YBYYYYYYYYBY",
  "YYYYYYYYYYYY",
  "yyyyyyyyyyyy"
];
var FLOWER = [".cc.", "cYYc", "cYYc", ".cc."];
var MEDAL = [".yyy.", "yYYYy", "yYFYy", "yYYYy", ".yyy."];
var CAPE_ICON = ["XXYYXX", "XXXXXX", ".XXXXXX", ".XXXXXX", "XXXXXXX", "XXXXXXXX", "xXxXxXxX"];
var PILE = { head: -20, neck: -11, face: -5 };
function straw(p, y, a, b, shade = false) {
  for (let x = a; x <= b; x++) p.set(x, y, shade || (x * 2 + y) % 5 === 0 ? "a" : "A");
}
var row = (p, y, a, b, c) => {
  for (let x = a; x <= b; x++) p.set(x, y, c);
};
var ACCESSORIES = {
  hat: {
    slot: "head",
    name: "Party hat",
    draw(p, v) {
      if (v === "sleep") p.stamp(PARTY_HAT, PILE.head, 8);
      else p.stamp(PARTY_HAT, 6, 0);
    }
  },
  // A tall woven crown with a red ribbon over a wide brim.
  straw: {
    slot: "head",
    name: "Straw hat",
    draw(p, v) {
      if (v === "sleep") {
        straw(p, 17, PILE.head + 2, PILE.head + 6);
        for (let x = PILE.head + 2; x <= PILE.head + 6; x++) {
          p.set(x, 18, "X");
          p.set(x, 19, "X");
        }
        straw(p, 20, PILE.head - 1, PILE.head + 9);
        return;
      }
      const [c0, c1, b0, b1] = v === "front" ? [4, 17, -3, 24] : [3, 17, -5, 23];
      straw(p, 5, c0 + 2, c1 - 2);
      for (let y = 6; y <= 8; y++) straw(p, y, c0 + 1, c1 - 1);
      row(p, 9, c0 + 1, c1 - 1, "X");
      row(p, 10, c0 + 1, c1 - 1, "x");
      straw(p, 11, b0 + 1, b1 - 1);
      straw(p, 12, b0, b1, true);
    }
  },
  // A rounded crown with a button on top and a white patch; the peak faces the way the rabbit does.
  cap: {
    slot: "head",
    name: "Baseball cap",
    draw(p, v) {
      if (v === "sleep") {
        row(p, 17, PILE.head + 1, PILE.head + 4, "X");
        row(p, 18, PILE.head, PILE.head + 5, "X");
        row(p, 19, PILE.head, PILE.head + 5, "X");
        row(p, 20, PILE.head, PILE.head + 8, "x");
        return;
      }
      const dx = 0;
      p.set(10 + dx, 4, "x");
      p.set(11 + dx, 4, "x");
      row(p, 5, 7 + dx, 14 + dx, "X");
      row(p, 6, 5 + dx, 16 + dx, "X");
      row(p, 7, 4 + dx, 17 + dx, "X");
      for (let y = 8; y <= 11; y++) row(p, y, 3 + dx, 18 + dx, "X");
      for (const [x, y] of [[9, 8], [10, 8], [9, 9], [10, 9]]) p.set(x + dx, y, "F");
      if (v === "front") {
        row(p, 12, 2, 19, "x");
        row(p, 13, 3, 18, "x");
        return;
      }
      row(p, 11, -2, 4, "x");
      row(p, 12, -4, 6, "x");
    }
  },
  // Big flowers on a leafy band.
  crown: {
    slot: "head",
    name: "Flower crown",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["P.Y.B", "GGGGG"], PILE.head, 19);
        return;
      }
      const [a, b, xs] = v === "front" ? [3, 18, [3, 9, 15]] : [2, 20, [2, 9, 16]];
      row(p, 11, a, b, "G");
      row(p, 12, a, b, "g");
      ["P", "Y", "B"].forEach((c, i) => p.stamp(FLOWER.map((r) => r.replace(/Y/g, c === "Y" ? "O" : "Y").replace(/c/g, c)), xs[i], 8));
    }
  },
  bow: {
    slot: "head",
    name: "Ear bow",
    draw(p, v) {
      p.stamp(BOW, v === "sleep" ? PILE.head : v === "front" ? 0 : 1, v === "sleep" ? 14 : 6);
    }
  },
  // A tall knitted dome with a ribbed band and a pom-pom; the ears poke out either side.
  beanie: {
    slot: "head",
    name: "Beanie",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp([".YY..", "NNNN.", "NnNnN", "nnnnn"], PILE.head + 1, 16);
        return;
      }
      const dx = v === "front" ? 0 : 1;
      const [a, b] = v === "front" ? [3, 18] : [2, 20];
      p.stamp([".YY.", "YYYY", ".YY."], 9 + dx, 1);
      row(p, 4, 8 + dx, 13 + dx, "N");
      row(p, 5, 6 + dx, 15 + dx, "N");
      row(p, 6, 5 + dx, 16 + dx, "N");
      for (let y = 7; y <= 9; y++) for (let x = 4 + dx; x <= 17 + dx; x++) p.set(x, y, (x + y) % 3 === 0 ? "n" : "N");
      row(p, 10, a, b, "N");
      for (let y = 11; y <= 13; y++) for (let x = a; x <= b; x++) p.set(x, y, x % 2 ? "n" : "N");
    }
  },
  tiara: {
    slot: "head",
    name: "Tiara",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["Y.B.Y", "YYYYY", "yyyyy"], PILE.head + 1, 18);
        return;
      }
      p.stamp(TIARA, v === "front" ? 5 : 6, 5);
    }
  },
  wizard: {
    slot: "head",
    name: "Wizard hat",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["..NN..", ".NYNN.", "NNNNNN", "nnnnnnn"], PILE.head, 17);
        return;
      }
      const [x0, a, b] = v === "front" ? [4, 1, 20] : [5, 1, 22];
      p.stamp(WIZARD, x0, 0);
      row(p, 11, a + 1, b - 1, "n");
      row(p, 12, a, b, "n");
    }
  },
  specs: {
    slot: "face",
    name: "Round specs",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["tt.tt", "t.t.t"], PILE.face, 19);
        return;
      }
      const [l, r] = v === "front" ? [4, 14] : [2, 11];
      for (const c of [l, r]) {
        for (let x = c; x <= c + 3; x++) {
          p.set(x, 15, "t");
          p.set(x, 20, "t");
        }
        for (let y = 16; y <= 19; y++) {
          p.set(c - 1, y, "t");
          p.set(c + 4, y, "t");
        }
      }
      for (let x = l + 5; x <= r - 2; x++) p.set(x, 17, "t");
      if (v === "side") for (let x = r + 5; x <= 21; x++) p.set(x, 17, "t");
    }
  },
  hearts: {
    slot: "face",
    name: "Heart shades",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["PP.PP", ".P.P."], PILE.face, 19);
        return;
      }
      const [l, r] = v === "front" ? [3, 13] : [1, 10];
      p.stamp(HEART, l, 15);
      p.stamp(HEART, r, 15);
      for (let x = l + 7; x < r; x++) p.set(x, 16, "M");
      if (v === "side") for (let x = r + 7; x <= 21; x++) p.set(x, 16, "M");
    }
  },
  shades: {
    slot: "face",
    name: "Cool shades",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["kk.kk", "k...k"], PILE.face, 19);
        return;
      }
      const [l, r] = v === "front" ? [3, 13] : [1, 10];
      for (const c of [l, r]) {
        for (let y = 15; y <= 19; y++) row(p, y, c, c + 5, y === 19 && (c === l || c === r) ? "k" : "k");
        p.set(c + 1, 16, "L");
        p.set(c + 2, 16, "L");
      }
      row(p, 16, l + 6, r - 1, "k");
      if (v === "side") row(p, 16, r + 6, 21, "k");
    }
  },
  scarf: {
    slot: "neck",
    name: "Cozy scarf",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["XxXxX", "XXXXX"], PILE.neck, 19);
        return;
      }
      const [a, b, tx] = v === "front" ? [4, 17, 12] : [6, 20, 7];
      for (let x = a; x <= b; x++) {
        p.set(x, 26, x % 3 === 0 ? "x" : "X");
        p.set(x, 27, (x + 1) % 3 === 0 ? "x" : "X");
      }
      for (let y = 28; y <= 32; y++) for (let x = tx; x <= tx + 2; x++) p.set(x, y, y === 30 ? "x" : "X");
      p.set(tx, 33, "X");
      p.set(tx + 2, 33, "X");
    }
  },
  bowtie: {
    slot: "neck",
    name: "Bow tie",
    draw(p, v) {
      if (v === "sleep") p.stamp(BOWTIE, PILE.neck, 18);
      else p.stamp(BOWTIE, v === "front" ? 8 : 7, 26);
    }
  },
  medal: {
    slot: "neck",
    name: "Gold medal",
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["X.X", ".y.", "yYy", ".y."], PILE.neck, 17);
        return;
      }
      const cx = v === "front" ? 10 : 7;
      for (let i = 0; i < 3; i++) {
        p.set(cx - 3 + i, 26 + i, "X");
        p.set(cx + 4 - i, 26 + i, "N");
      }
      p.stamp(MEDAL, cx - 1, 29);
    }
  },
  // A hero's cape: a clasp at the neck, and the cape itself only where there
  // is no fur, so it hangs behind the rabbit.
  cape: {
    slot: "neck",
    name: "Hero cape",
    icon: CAPE_ICON,
    draw(p, v) {
      if (v === "sleep") {
        p.stamp(["XXXXXX", "xXXXXx"], PILE.neck - 1, 19);
        return;
      }
      const behind = (x, y, c) => {
        if (!p.get(x, y)) p.set(x, y, c);
      };
      if (v === "front") {
        for (let y = 24; y <= 36; y++) {
          const spread = Math.min(3, y - 24 >> 2);
          for (let x = 3 - spread; x <= 18 + spread; x++) behind(x, y, y === 36 && x % 2 ? "x" : "X");
        }
        row(p, 26, 6, 15, "X");
        p.set(10, 26, "Y");
        p.set(11, 26, "Y");
        return;
      }
      for (let y = 24; y <= 39; y++) {
        const reach = 22 + Math.min(9, y - 24);
        for (let x = 12; x <= reach; x++) behind(x, y, y === 39 && x % 2 ? "x" : "X");
      }
      row(p, 26, 7, 20, "X");
      p.set(8, 26, "Y");
    }
  }
};
var ACCESSORY_IDS = Object.keys(ACCESSORIES);
var SLOTS = [
  { slot: "head", label: "Head" },
  { slot: "face", label: "Face" },
  { slot: "neck", label: "Neck" }
];
function normalizeOutfit(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const { slot } of SLOTS) {
    const id = raw[slot];
    if (typeof id === "string" && id in ACCESSORIES && ACCESSORIES[id].slot === slot) out[slot] = id;
  }
  return Object.keys(out).length ? out : null;
}

// src/components/pets/pixel/sprites.ts
var SIDE = new Pix().stamp([
  ...rep(".....WWWW......WWW..........."),
  ...rep("...WWWWWWWW..WWOWWWW........."),
  ...rep(".WWWWWWOOWW..WWOOOWW........."),
  ...rep(".WWWWOOOOWW..WWOOOWW........."),
  ...rep(".....OOOOWW..WWOOOWW........."),
  ...rep(".....WWWWWWWWWWOWWW.........."),
  ...rep("..WWWWWWWWWWWWWWWWWWW........", 4),
  ...rep("WWKKKKWWWWWKKKKWWWWWWWW......", 4),
  ...rep("WWWWWWWPPWWWWWWWWWWWWWW......"),
  ...rep("WWWWWWWWWWWWWWWWWWWWWWW......"),
  ...rep("..WWWWWWWWWWWWWWWWWWW........"),
  ...rep(".......WWWWWWWWWWWWW........."),
  ...rep(".....WWWWWWWWWWWWWWWWW......."),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWW..."),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWWWWW", 4),
  ...rep(".....WWWWWWWWWWWWWWWWWWWWW..."),
  ...rep("...WWWWWWWWWWWWWWWWWWW.......")
]);
var FRONT_BASE = new Pix().stamp([
  ...rep("....WWWW......WWWW...."),
  ...rep("..WWWWWWWW..WWOOWWWW.."),
  ...rep(".WWWWWOOWW..WWOOOOWW.."),
  ...rep(".WWWOOOOWW..WWOOOOWW.."),
  ...rep("....OOOOWW..WWOOOOWW.."),
  ...rep("....WWWWWWWWWWOOWW...."),
  ...rep("...WWWWWWWWWWWWWWWW...", 4),
  ...rep(".WWWKKKKWWWWWWKKKKWWW.", 4),
  ...rep(".WWWWWWWWWPPWWWWWWWWW."),
  ...rep(".WWWWWWWWWWWWWWWWWWWW."),
  ...rep("...WWWWWWWWWWWWWWWW..."),
  ...rep(".....WWWWWWWWWWWW....."),
  ...rep("....WWWWWWWWWWWWWW....", 10),
  ...rep("....WWWWWW..WWWWWW....")
]);
var T_LEFT_ARM = [[3, 28, 33], [2, 28, 33], [1, 28, 33], [0, 28, 33], [-1, 29, 32]];
var tiltedArm = (k) => {
  const p = FRONT_BASE.clone();
  for (const [x, top, bottom] of T_LEFT_ARM) {
    const lift = Math.round(k * (3 - x));
    for (let y = top - lift; y <= bottom - lift; y++) p.set(x, y, "W");
  }
  return p;
};
var TPOSE = runs(FRONT_BASE.clone(), [
  [28, 0, 3],
  [29, -1, 3],
  [30, -1, 3],
  [31, -1, 3],
  [32, -1, 3],
  [33, 0, 3],
  [28, 18, 21],
  [29, 18, 22],
  [30, 18, 22],
  [31, 18, 22],
  [32, 18, 22],
  [33, 18, 21]
]);
var FRONT_POSES = { rest: FRONT_BASE, wave: tiltedArm(1), waveLow: tiltedArm(0.5), t: TPOSE };
var SLEEPER = new Pix().stamp([
  ".....................WWW............",
  ".................WWWWWWW............",
  "............WWWWWWWWWWWWWWW.........",
  ".....WWWWWWWWWWWWWWWWWWWWWWW........",
  ".....WWWWWWWWWWWWWWWWWWWWWWW........",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWW........",
  "..WWWWWWWWWWWWWWWWOOOOOOOOW.........",
  "..WWWWWWWWWWWWWWWWOWWWWWWWW.........",
  "..WWWWWWWWWWWWWWWWWWWWW.............",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWW.......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW......",
  "WWKKKKWWWWWKKKKWWWWWWWWWWWWWWW......",
  "WWWWWWWPPWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWPPWWWWWWWWWWWWWWWWWWWWW......",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW..",
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  "..WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
  ".....WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW.",
  "......WWWWWWWWWWWWWWWWWWWWWWWWWWWW.."
]);
var PICTURE_STROKES = [
  [3, 2, "Y"],
  [2, 3, "Y"],
  [3, 3, "Y"],
  [4, 3, "Y"],
  [2, 2, "Y"],
  [4, 2, "Y"],
  [2, 4, "Y"],
  [3, 4, "Y"],
  [4, 4, "Y"],
  [1, 1, "y"],
  [5, 1, "y"],
  [1, 5, "y"],
  [5, 5, "y"],
  [9, 2, "N"],
  [10, 2, "N"],
  [11, 2, "N"],
  [8, 3, "N"],
  [9, 3, "N"],
  [10, 3, "N"],
  [11, 3, "N"],
  [12, 3, "N"],
  ...Array.from({ length: 14 }, (_, x) => [x, 11, "G"]),
  [1, 10, "G"],
  [7, 10, "G"],
  [12, 10, "G"],
  [4, 10, "g"],
  [4, 9, "g"],
  [4, 7, "P"],
  [3, 8, "P"],
  [5, 8, "P"],
  [4, 8, "Y"],
  [10, 10, "g"],
  [10, 9, "g"],
  [10, 8, "g"],
  [10, 5, "P"],
  [9, 6, "P"],
  [11, 6, "P"],
  [10, 7, "P"],
  [10, 6, "Y"]
];
var PICTURE_CELLS = PICTURE_STROKES.length;

// src/components/pets/pixel/characters.ts
var FRIENDS = {
  robot: {
    id: "robot",
    name: "Robot",
    parts: {
      s: { name: "Shell", colour: "#b9c4d8" },
      d: { name: "Shell side", colour: "#6784b8" },
      t: { name: "Shell face", colour: "#c4cfe4" },
      k: { name: "Screen", colour: "#2c2838" },
      e: { name: "Eyes", colour: "#ffffff" }
    },
    eyePart: "e",
    eyeBack: "k",
    fur: "s",
    rest: {
      left: -3,
      top: 6,
      grid: [
        ".sssssssssssssssssssddddddddd.",
        "ssssssssssssssssssssdddddddddd",
        "ssskkkkkkkkkkkkkksssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "ssskkkkkkkkkkkkkksssdddddddddd",
        "ssssssssssssssssssssdddddddddd",
        ".sssssssssssssssssssddddddddd.",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        ".........ssssssssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........"
      ],
      eyes: [[1, 15], [9, 15]]
    },
    front: {
      left: -1,
      top: 6,
      grid: [
        ".ssssssssssssssssssssss.",
        "dssssssssssssssssssssssd",
        "dssskkkkkkkkkkkkkkkksssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dssskkkkkkkkkkkkkkkksssd",
        "dssssssssssssssssssssssd",
        ".ssssssssssssssssssssss.",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        "......dssssssssssd......",
        ".......ssssssssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss......."
      ],
      eyes: [[5, 15], [13, 15]]
    },
    asleep: {
      left: -6,
      top: 4,
      grid: [
        ".......ssssssssssssssssssd......",
        ".......sssssssssssssssssddd.....",
        "......ssssssssssssssssssddd.....",
        ".....ssssssssssssssssssddddd....",
        "....ssssssssssssssssssdddddd....",
        "....sssssssssssssssssddddddd....",
        "...sssssssssssssssssddddddddd...",
        "..ssssssssssssssssssddddddddd...",
        ".ssssssssssssssssssdddddddddd...",
        ".tttttttttttttttttdddddddddddd..",
        "ttttttttttttttttttttdddddddddd..",
        ".ttkkkkkkkkkkkkkktttdddddddddd..",
        ".ttkkkkkkkkkkkkkkkttddddddddddd.",
        ".ttkkkkkkkkkkkkkkkktddddddddddd.",
        "..tkkkkkkkkkkkkkkkkttdddddddddd.",
        "..ttkkkkkkkkkkkkkkkttddddddddddd",
        "..ttkkkkkkkkkkkkkkkktddddddddddd",
        "...tkkkkkkkkkkkkkkkkttdddddddddd",
        "...ttkkeeeekkkeeeekkttddddddddd.",
        "...ttkkkkkkkkkkkkkkkktdddddddd..",
        "....tkkkkkkkkkkkkkkkkttddddddd..",
        "....ttkkkkkkkkkkkkkkkttdddddd...",
        "....ttkkkkkkkkkkkkkkkktddddd....",
        ".....tkkkkkkkkkkkkkkkkttddd.....",
        ".....ttkkkkkkkkkkkkkkkttddd.....",
        ".....ttkkkkkkkkkkkkkkkttdd......",
        "......tttttttttttttttttttd......",
        ".......tttttttttttttttttdd......",
        "...........sssssssssssdddd......",
        "...........sssssssssssdddd......",
        "...........sssssssssssdddd......",
        "............ssssssssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd......."
      ],
      eyes: []
    },
    arms: { left: 5, right: 16, top: 28, waveGap: true },
    // Its head is taller and its eyes closer together than Biscuit's.
    fits: {
      side: { head: { dx: 0, dy: -6 }, face: { dx: -1, dy: -1, split: { at: 9, dx: -2 } }, neck: { dx: -1, dy: 2 }, hold: { dx: 0, dy: 1 } },
      front: { head: { dx: 0, dy: -6 }, face: { dx: 1, dy: -1, split: { at: 11, dx: -1 } }, neck: { dx: 0, dy: 2 }, hold: { dx: 0, dy: 0 } },
      sleep: { head: { dx: 0, dy: 19 }, face: { dx: 0, dy: 19 }, neck: { dx: 0, dy: 19 }, hold: { dx: 0, dy: 19 } }
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Mint", colours: { s: "#c6ead9", d: "#4fae8e", t: "#d3f0e3" } },
      { name: "Sunny", colours: { s: "#ffe28a", d: "#f0a93b", t: "#ffe9a6" } },
      { name: "Coral", colours: { s: "#ffc4b5", d: "#e0584f", t: "#ffd0c4" } }
    ]
  },
  fox: {
    id: "fox",
    name: "Fox",
    parts: {
      f: { name: "Fur", colour: "#f7935a" },
      c: { name: "Cream", colour: "#f8f4e1" },
      t: { name: "Tips", colour: "#8f6546" },
      e: { name: "Eyes", colour: "#010101" },
      n: { name: "Nose", colour: "#000000" }
    },
    eyePart: "e",
    eyeBack: "f",
    fur: "f",
    rest: {
      left: 0,
      top: 2,
      grid: [
        ".....t.........tt..............",
        ".....tt.......ttt..............",
        ".....ff.......ffff.............",
        "....ffff.....fffff.............",
        "....fcff.....ffcff.............",
        "....fccff...ffccff.............",
        "...fcccff...ffcccff............",
        "...fccccff.ffccccff............",
        "...ffffffffffffffff............",
        "...ffffffffffffffff............",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "fccccccnnccccccccfffffff.......",
        "cccccccnnccccccccfffffff.......",
        "ccccccccccccccccccffffff...cc..",
        "ccccccccccccccccccffffff..ccc..",
        "..cccccccccccccffffff....ccccc.",
        "..cccccccccccccffffff....ccccc.",
        ".......cccccccffffff....cccccc.",
        ".......cccccccffffff....ffffff.",
        ".....ffcccccccffffffff..fffffff",
        ".....ffcccccccffffffff..fffffff",
        ".....fccccccffffffffff.ffffffff",
        ".....fccccccffffffffff.ffffffff",
        ".....fccccffffffffffff.ffffffff",
        ".....fccccffffffffffff.ffffffff",
        ".....ffccfffffffffffff.ffffffff",
        ".....ffccfffffffffffff.ffffffff",
        ".....fffffffffffffffffffffffff.",
        ".....ffffffffffffffffffffffff..",
        "...ttttttfffffffttttttffffff...",
        "...ttttttfffffffttttttfffff...."
      ],
      eyes: [[2, 16], [11, 16]],
      face: { nose: 7, mouth: 22, cheeks: [[2, 21], [3, 21], [13, 21], [14, 21]] }
    },
    front: {
      left: -1,
      top: 2,
      grid: [
        ".....t............t.....",
        ".....tt..........tt.....",
        "....fff..........fff....",
        "....ffff........ffff....",
        "....fcff........ffcf....",
        "...ffccff......ffccff...",
        "...ffcccf......fcccff...",
        "...ffcccff....ffcccff...",
        "...ffccccff..ffccccff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeecccccceeeeffff.",
        ".ccccccccccnncccccccccc.",
        "cccccccccccnnccccccccccc",
        "cccccccccccccccccccccccc",
        "cccccccccccccccccccccccc",
        "...cccccccccccccccccc...",
        "...cccccccccccccccccc...",
        "......fffccccccfff......",
        "......fffccccccfff...cc.",
        ".....ffffccccccffff.cccc",
        ".....ffffccccccffff.cccc",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....fffffffffffffffffff",
        ".....fffffffffffffffffff",
        ".....tttttt..tttttt.....",
        ".....tttttt..tttttt....."
      ],
      eyes: [[4, 16], [14, 16]],
      face: { nose: 10, mouth: 22, cheeks: [[3, 21], [4, 21], [17, 21], [18, 21]] }
    },
    asleep: {
      left: 0,
      top: 16,
      grid: [
        ".....t.........tt....................",
        ".....tt.......ttt....................",
        ".....ff.......ffff...................",
        "....ffff.....fffff...................",
        "....fcff.....ffcff...................",
        "....fccff...ffccff...................",
        "...fcccff...ffcccff..................",
        "...fccccff.ffccccff..................",
        "...ffffffffffffffff..................",
        "...ffffffffffffffff..................",
        "..fffffffffffffffffff................",
        "..fffffffffffffffffff................",
        "..fffffffffffffffffffffffffffffff....",
        "..fffffffffffffffffffffffffffffff....",
        "ffffffffffffffffffffffffffffffffff...",
        "ffffffffffffffffffffffffffffffffff...",
        "ffeeeefffffeeeeffffffffffffffffffffff",
        "fffffffffffffffffffffffffffffffffffff",
        "fccccccnnccccccccffffffffffffffffffff",
        "cccccccnnccccccccffffffffffffffffffff",
        "cccccccccccccccccccffffffffffffffffff",
        "cccccccccccccccccccffffffffffffffffff",
        "..ttttttcccccccccccffffffffffffffffff",
        "..ttttttcccccccccccffffffffffffffffff"
      ],
      eyes: []
    },
    arms: { left: 4, right: 17, top: 28 },
    // Its head and eyes sit where Biscuit's do.
    fits: {
      side: { head: { dx: 0, dy: 0 }, face: { dx: 0, dy: 0 }, neck: { dx: 0, dy: 0 }, hold: { dx: 0, dy: 0 } },
      front: { head: { dx: 0, dy: 0 }, face: { dx: 0, dy: 0 }, neck: { dx: 0, dy: 0 }, hold: { dx: 0, dy: 0 } },
      sleep: { head: { dx: 0, dy: 19 }, face: { dx: 0, dy: 19 }, neck: { dx: 0, dy: 19 }, hold: { dx: 0, dy: 19 } }
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Arctic", colours: { f: "#dfe6ef", c: "#ffffff", t: "#8e9bb0" } },
      { name: "Golden", colours: { f: "#eda93a", c: "#fffbf2", t: "#5b3a24" } },
      { name: "Midnight", colours: { f: "#4f5fb8", c: "#f8f4e1", t: "#fee07b" } }
    ]
  },
  dino: {
    id: "dino",
    name: "Dino",
    parts: {
      b: { name: "Body", colour: "#7cc35b" },
      d: { name: "Nostrils", colour: "#4e9a44" },
      p: { name: "Plates", colour: "#f7935a" },
      e: { name: "Eyes", colour: "#000000" }
    },
    eyePart: "e",
    eyeBack: "b",
    fur: "b",
    rest: {
      left: 0,
      top: 5,
      grid: [
        ".......................ppp...........",
        ".......bbbbbbbbbbbbbbbbbpp...........",
        ".......bbbbbbbbbbbbbbbbbpp...........",
        ".....bbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbb...........",
        ".....beeeebbbbbeeeebbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp.........",
        "bdbbbdbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp......bbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp....ppbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......ppbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......bbbbb",
        ".....bbbbbbbbbbbbbbbbbbbbbb...ppbbbb.",
        "..........bbbbbbbbbbbbbbbbb...ppbbbb.",
        "..........bbbbbbbbbbbbbbbbb..bbbbbbb.",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".......bbbbbbbb....bbbbbbb...........",
        ".......bbbbbbbb....bbbbbbb..........."
      ],
      eyes: [[6, 11], [15, 11]]
    },
    front: {
      left: 1,
      top: 1,
      grid: [
        "........pppp...........",
        "........pppp...........",
        ".......pppppp..........",
        ".......pppppp..........",
        ".......pppppp..........",
        "...bbbbbbbbbbbbbb......",
        "...bbbbbbbbbbbbbb......",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbdbbbbbbdbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        ".bbbbbbbbbbbbbbbbbb....",
        ".bbbbbbbbbbbbbbbbbb....",
        "....bbbbbbbbbbbb.......",
        "....bbbbbbbbbbbb.......",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb..ppp",
        "..bbbbbbbbbbbbbbbb..ppp",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbb..bbbbbbb.....",
        "..bbbbbbb..bbbbbbb....."
      ],
      eyes: [[4, 10], [14, 10]]
    },
    asleep: {
      left: 0,
      top: 20,
      grid: [
        ".......................ppp...................",
        ".......bbbbbbbbbbbbbbbbbpp...................",
        ".......bbbbbbbbbbbbbbbbbpp...................",
        ".....bbbbbbbbbbbbbbbbbbbbb...................",
        ".....bbbbbbbbbbbbbbbbbbbbb...................",
        ".....bbbbbbbbbbbbbbbbbbbbppp.................",
        ".....bbbbbbbbbbbbbbbbbbbbpppp................",
        ".....bbbbbbbbbbbbbbbbbbbbpppp.ppp............",
        ".....beeeebbbbbeeeebbbbbbbppp.ppp............",
        ".....bbbbbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbpppbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbppp........",
        "bdbbbdbbbbbbbbbbbbbbbbbbbpppbbbbbbppp........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbppp........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbb....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbb.ppp",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbbbbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      ],
      eyes: []
    },
    arms: { left: 3, right: 18, top: 28 },
    // Box head higher than Biscuit's; in 3/4 it is further right too, the snout in front.
    fits: {
      side: { head: { dx: 4, dy: -6 }, face: { dx: 4, dy: -5 }, neck: { dx: 5, dy: 0 }, hold: { dx: 4, dy: 1 } },
      front: { head: { dx: 0, dy: -6 }, face: { dx: 0, dy: -6 }, neck: { dx: 0, dy: 0 }, hold: { dx: 0, dy: 0 } },
      sleep: { head: { dx: 0, dy: 19 }, face: { dx: 0, dy: 19 }, neck: { dx: 0, dy: 19 }, hold: { dx: 0, dy: 19 } }
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Sky", colours: { b: "#6fb6ea", d: "#3f80bf", p: "#ffe07b" } },
      { name: "Lava", colours: { b: "#e45f52", d: "#a8372f", p: "#ffd166" } },
      { name: "Sunny", colours: { b: "#f7cf4f", d: "#c79a1e", p: "#35b8a8" } }
    ]
  },
  dragon: {
    id: "dragon",
    name: "Dragon",
    parts: {
      b: { name: "Body", colour: "#7962ab" },
      d: { name: "Horns and spikes", colour: "#5c429a" },
      g: { name: "Wings and belly", colour: "#fee07b" },
      h: { name: "Belly stripes", colour: "#f5b543" },
      e: { name: "Eyes", colour: "#000000" }
    },
    eyePart: "e",
    eyeBack: "b",
    fur: "b",
    rest: {
      left: 0,
      top: 2,
      grid: [
        "........dd.........dd.................",
        "........dd.........dd.................",
        ".......dddd.......dddd................",
        ".......dddd.......dddd................",
        ".......bbbbbbbbbbbbbbbbb..............",
        ".......bbbbbbbbbbbbbbbbb..............",
        ".....bbbbbbbbbbbbbbbbbbbbb............",
        ".....bbbbbbbbbbbbbbbbbbbbb............",
        ".....bbbbbbbbbbbbbbbbbbbbbdd..........",
        ".....beeeebbbbbeeeebbbbbbbdd..........",
        ".....beeeebbbbbeeeebbbbbbbdd........bb",
        ".....beeeebbbbbeeeebbbbbbbdd.......bbg",
        ".....beeeebbbbbeeeebbbbbbbdd......bbgg",
        ".....bbbbbbbbbbbbbbbbbbbbbdd.....bbggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......bbgggg",
        "bdbbbdbbbbbbbbbbbbbbbbbbbb.....bbggggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbb..bbgggggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbb..bbggggbgg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb..bbggggbggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb.bbggggbgggb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb.",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb..",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb...",
        ".....bbbbbbbbbbbbbbbbbbbbgggbgggg..dd.",
        "..........bggggggbbbbbbbgggbbggb...dd.",
        "..........bhhhhhhbbbbbbb..........bbb.",
        ".........bbggggggbbbbbbbbb......ddbbb.",
        ".........bbggggggbbbbbbbbb......ddbbb.",
        ".........bbhhhhhhbbbbbbbbbb....bbbbbb.",
        ".........bbggggggbbbbbbbbbb..ddbbbbbb.",
        ".........bbggggggbbbbbbbbbb..ddbbbbb..",
        ".........bbhhhhhhbbbbbbbbbbbbbbbbbbb..",
        ".........bbggggggbbbbbbbbbbbbbbbbbbb..",
        ".........bbggggggbbbbbbbbbbbbbbbbbbb..",
        ".........bbhhhhhhbbbbbbbbbbbbbbbb.....",
        ".........bbbbbbbbbbbbbbbbbbbbbbbb.....",
        ".......bbbbbbbb....bbbbbbb............",
        ".......bbbbbbbb....bbbbbbb............"
      ],
      eyes: [[6, 11], [15, 11]]
    },
    front: {
      left: -9,
      top: 2,
      grid: [
        "..............dd........dd..............",
        "..............dd........dd..............",
        ".............dddd......dddd.............",
        ".............dddd......dddd.............",
        ".............bbbbbbbbbbbbbb.............",
        ".............bbbbbbbbbbbbbb.............",
        "..........bbbbbbbbbbbbbbbbbbbb..........",
        "..........bbbbbbbbbbbbbbbbbbbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "........bbbbbbbbbbbbbbbbbbbbbbbb........",
        "....b...bbbbbbbbbbbbbbbbbbbbbbbb...b....",
        "...bbb..bbbbbbbbbbbbbbbbbbbbbbbb...bb...",
        "..bbbgggbbbbbbbbbbbbbbbbbbbbbbbbgggbbb..",
        ".bbggggggbbbbbbbdbbbbbbdbbbbbbbggggggbb.",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggggbbbbbbbbbbbbbbbbbbgggggggggbb",
        "bbgggggggggbbbbbbbbbbbbbbbbbbgggggggggbb",
        "bbggggggggggg.bbbggggggbbb.gggggggggggbb",
        "bb..gg..ggggg.bbbhhhhhhbbb.ggggg..gg..bb",
        "........gg...bbbbggggggbbbb...gg........",
        ".............bbbbggggggbbbb.............",
        ".............bbbbhhhhhhbbbb.....dd......",
        ".............bbbbggggggbbbbbb...dd......",
        ".............bbbbggggggbbbbbb...bb......",
        ".............bbbbhhhhhhbbbbbbbbbbb......",
        ".............bbbbggggggbbbbbbbbbbb......",
        ".............bbbbggggggbbbbbbbbbbb......",
        ".............bbbbhhhhhhbbbbbbbbbbb......",
        ".............bbbbbbbbbbbbbbbbbbbbb......",
        ".............bbbbbb..bbbbbb.............",
        ".............bbbbbb..bbbbbb............."
      ],
      eyes: [[4, 10], [14, 10]]
    },
    asleep: {
      left: 0,
      top: 17,
      grid: [
        "........dd.........dd..........................",
        "........dd.........dd..........................",
        ".......dddd.......dddd.........................",
        ".......dddd.......dddd.........................",
        ".......bbbbbbbbbbbbbbbbb.......................",
        ".......bbbbbbbbbbbbbbbbb.......................",
        ".....bbbbbbbbbbbbbbbbbbbbb..bb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbbbgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....beeeebbbbbeeeebbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddbbbbbb.............",
        ".....bbbbbbbbbbbbbbbbbbbbbddbbbbbb.............",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.............",
        "bdbbbdbbbbbbbbbbbbbbbbbbbbbbbbbbbb..dd.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..dd.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb......",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbd.....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbd..ddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbgbbbbbbbbbbbbbbbbddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbggbbbbbbbbbbbbbbbbb.."
      ],
      eyes: []
    },
    arms: { left: 4, right: 17, top: 28 },
    // The same head as the dino's.
    fits: {
      side: { head: { dx: 4, dy: -6 }, face: { dx: 4, dy: -5 }, neck: { dx: 5, dy: 0 }, hold: { dx: 4, dy: 1 } },
      front: { head: { dx: 0, dy: -6 }, face: { dx: 0, dy: -6 }, neck: { dx: 0, dy: 0 }, hold: { dx: 0, dy: 0 } },
      sleep: { head: { dx: 0, dy: 19 }, face: { dx: 0, dy: 19 }, neck: { dx: 0, dy: 19 }, hold: { dx: 0, dy: 19 } }
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Emerald", colours: { b: "#4fae6b", d: "#2f7a47", g: "#fee07b", h: "#f5b543" } },
      { name: "Ruby", colours: { b: "#d9534f", d: "#9c2f2f", g: "#ffd27a", h: "#f0a33a" } },
      { name: "Ocean", colours: { b: "#3f8fd2", d: "#2a5f9e", g: "#9ff0dd", h: "#5cc9b5" } }
    ]
  }
};
var RABBIT_COLOURS = [
  { name: "Original", colours: {} },
  { name: "Cocoa", colours: { W: "#9c6d4c", O: "#f6c9a8", P: "#f17097" } },
  { name: "Storm", colours: { W: "#a9b2c3", O: "#f7945a", P: "#f17097" } },
  { name: "Blush", colours: { W: "#f5d7cf", O: "#c06866", P: "#c94f79" } }
];

// src/components/pets/petCatalog.ts
var PETS = [
  { id: "rabbit", name: "Biscuit the Rabbit" },
  { id: "robot", name: "Robot" },
  { id: "fox", name: "Fox" },
  { id: "dino", name: "Dino" },
  { id: "dragon", name: "Dragon" }
];
var DEFAULT_PET_ID = "rabbit";
var PET_IDS = PETS.map((p) => p.id);
var resolvePetId = (input) => input && PET_IDS.includes(input) ? input : DEFAULT_PET_ID;
var getPet = (id) => PETS.find((p) => p.id === resolvePetId(id)) ?? PETS[0];
var petNick = (id) => getPet(id).name.split(" ")[0];
var petColours = (id) => {
  const pet = resolvePetId(id);
  return pet === "rabbit" ? RABBIT_COLOURS : FRIENDS[pet].colours;
};
var resolvePetColour = (id, colour) => {
  const options = petColours(id);
  const i = options.findIndex((o) => o.name.toLowerCase() === (colour ?? "").toLowerCase());
  return i > 0 ? options[i].name.toLowerCase() : null;
};

// src/lib/childRow.ts
var childFromRow = (child) => {
  const petType = resolvePetId(child.pet_type);
  return {
    ...child,
    petType,
    pet_color: resolvePetColour(petType, child.pet_color),
    currentCoins: child.current_coins,
    petHappiness: child.pet_happiness,
    pet_outfit: normalizeOutfit(child.pet_outfit),
    display_mode: child.display_mode ?? null,
    rest_day_date: child.rest_day_date ?? null,
    rest_dates: child.rest_dates ?? [],
    wake_time: child.wake_time,
    breakfast_time: child.breakfast_time,
    school_start_time: child.school_start_time,
    lunch_time: child.lunch_time,
    school_end_time: child.school_end_time,
    dinner_time: child.dinner_time,
    bedtime: child.bedtime,
    school_schedule_overrides: child.school_schedule_overrides,
    breakfast_schedule_overrides: child.breakfast_schedule_overrides,
    lunch_schedule_overrides: child.lunch_schedule_overrides,
    dinner_schedule_overrides: child.dinner_schedule_overrides,
    bedtime_schedule_overrides: child.bedtime_schedule_overrides,
    wake_schedule_overrides: child.wake_schedule_overrides
  };
};

// src/lib/rewardStatus.ts
var isApprovedStatus = (s) => s === "approved" || s === "completed";

// src/utils/displayMode.ts
var suggestedDisplayMode = (age) => age != null && age < 7 ? "picture" : "detailed";
var displayModeFor = (child) => child?.display_mode ?? suggestedDisplayMode(child?.age);

// src/data/taskTemplates.ts
var TASK_TEMPLATES = [
  {
    keys: ["brush teeth", "teeth", "brush your teeth"],
    icon: "smile",
    duration: 5,
    steps: {
      young: ["Toothpaste on the brush", "Brush the top teeth", "Brush the bottom teeth", "Spit and rinse"],
      older: ["Brush for two minutes", "Floss", "Rinse and put the brush away"]
    }
  },
  {
    keys: ["get dressed", "dressed", "clothes on"],
    icon: "shirt",
    duration: 10,
    steps: {
      young: ["Pajamas off", "Put on underwear and socks", "Put on shirt and pants", "Pajamas in the basket"],
      older: ["Pick an outfit", "Get dressed", "Put pajamas away"]
    }
  },
  {
    keys: ["breakfast"],
    icon: "coffee",
    duration: 20,
    steps: {
      young: ["Wash hands", "Eat breakfast", "Plate to the sink"],
      older: ["Eat breakfast", "Clear your place", "Wipe the table if needed"]
    }
  },
  {
    keys: ["make bed", "make your bed"],
    icon: "bed",
    duration: 5,
    steps: {
      young: ["Pull up the blanket", "Put the pillow on top", "Stuffies on the bed"],
      older: ["Straighten the sheets", "Pull up the blanket", "Fluff the pillow"]
    }
  },
  {
    keys: ["pack bag", "backpack", "pack school bag", "get ready for school", "ready for school"],
    icon: "backpack",
    duration: 10,
    steps: {
      young: ["Lunchbox in the bag", "Water bottle in the bag", "Shoes on", "Jacket on"],
      older: ["Homework and books in the bag", "Lunch and water bottle", "Check what today needs (gym, library)", "Shoes and jacket on"]
    }
  },
  {
    keys: ["homework", "study", "studying"],
    icon: "pencil",
    duration: 30,
    steps: {
      young: ["Get your folder out", "Do one page", "Show a grown-up", "Folder back in the bag"],
      older: ["Check what is due", "Do the hardest part first", "Check your work", "Pack it for tomorrow"]
    }
  },
  {
    keys: ["reading", "read", "book", "story time"],
    icon: "book",
    duration: 20,
    steps: {
      young: ["Pick a book", "Read together", "Tell what happened"],
      older: ["Pick up where you left off", "Read for 20 minutes", "Note the page you reached"]
    }
  },
  {
    keys: ["bath", "bath time"],
    icon: "bath",
    duration: 20,
    steps: {
      young: ["Clothes in the basket", "Wash body", "Wash hair", "Dry off with a towel", "Pajamas on"],
      older: ["Wash up", "Wash hair", "Dry off and hang the towel", "Pajamas on"]
    }
  },
  {
    keys: ["shower"],
    icon: "shower",
    duration: 15,
    steps: {
      young: ["Clothes in the basket", "Wash body", "Wash hair", "Dry off", "Pajamas on"],
      older: ["Shower", "Hang up your towel", "Dirty clothes in the basket"]
    }
  },
  {
    keys: ["bedtime routine", "get ready for bed", "ready for bed", "wind down"],
    icon: "moon",
    duration: 30,
    steps: {
      young: ["Pajamas on", "Brush teeth", "Use the toilet", "Pick a story", "Lights out"],
      older: ["Pajamas on", "Brush teeth", "Pack for tomorrow", "Read in bed", "Lights out"]
    }
  },
  {
    keys: ["tidy", "clean room", "clean up", "tidy room", "pick up toys", "clean your room"],
    icon: "clean",
    duration: 15,
    steps: {
      young: ["Toys in the box", "Books on the shelf", "Clothes in the basket"],
      older: ["Clear the floor", "Put clothes away", "Clear your desk", "Take out any cups or plates"]
    }
  },
  {
    keys: ["feed the dog", "feed dog", "feed the cat", "feed cat", "feed pet", "feed the fish", "feed fish"],
    icon: "pet",
    duration: 5,
    steps: {
      young: ["Scoop the food", "Fill the water bowl", "Wash your hands"],
      older: ["Measure the food", "Fresh water", "Wash your hands"]
    }
  },
  {
    keys: ["walk the dog", "walk dog", "dog walk"],
    icon: "pet",
    duration: 20,
    steps: {
      young: ["Leash on", "Walk with a grown-up", "Water for the dog after"],
      older: ["Leash and bags", "Walk the loop", "Fresh water when you get back"]
    }
  },
  {
    keys: ["set the table", "set table"],
    icon: "utensils",
    duration: 5,
    steps: {
      young: ["Plates", "Forks and spoons", "Cups"],
      older: ["Plates and napkins", "Cutlery", "Glasses and water"]
    }
  },
  {
    keys: ["dishes", "unload dishwasher", "load dishwasher", "clear the table"],
    icon: "dishes",
    duration: 10,
    steps: {
      young: ["Carry your plate to the sink", "Scrape leftovers", "Wipe your spot"],
      older: ["Clear the table", "Load the dishwasher", "Wipe the table"]
    }
  },
  {
    keys: ["lunch"],
    icon: "sandwich",
    duration: 30,
    steps: {
      young: ["Wash hands", "Eat lunch", "Plate to the sink"],
      older: ["Wash hands", "Eat lunch", "Clear your place"]
    }
  },
  {
    keys: ["dinner", "supper"],
    icon: "utensils",
    duration: 45,
    steps: {
      young: ["Wash hands", "Eat dinner", "Plate to the sink"],
      older: ["Wash hands", "Eat dinner", "Clear your place", "Help tidy the kitchen"]
    }
  },
  {
    keys: ["snack"],
    icon: "cookie",
    duration: 15,
    steps: {
      young: ["Wash hands", "Eat your snack", "Wrapper in the bin"],
      older: ["Pick a snack", "Eat at the table", "Tidy up"]
    }
  },
  {
    keys: ["piano", "violin", "guitar", "music practice", "instrument"],
    icon: "music",
    duration: 20,
    steps: {
      young: ["Warm-up", "Play the new piece", "Play a favourite"],
      older: ["Scales or warm-up", "Work on the tricky part", "Play the whole piece", "Note what to practise next"]
    }
  },
  {
    keys: ["soccer", "football", "swim", "swimming", "gymnastics", "basketball", "karate", "sports", "soccer practice", "soccer game"],
    icon: "ball",
    event: true,
    prep: 15,
    duration: 60,
    steps: {
      young: ["Sports clothes on", "Water bottle", "Shoes on"],
      older: ["Pack your kit", "Water bottle and snack", "Be at the door on time"]
    }
  },
  {
    keys: ["tv", "screen time", "gaming", "video games", "games", "tablet time", "tablet", "ipad", "movie", "youtube", "minecraft", "roblox"],
    icon: "game",
    fun: true,
    duration: 30,
    steps: { young: [], older: [] }
  },
  {
    keys: ["laundry", "put clothes away", "fold clothes"],
    icon: "laundry",
    duration: 10,
    steps: {
      young: ["Socks together", "Shirts in the drawer", "Pants in the drawer"],
      older: ["Fold your clothes", "Put them away", "Basket back"]
    }
  },
  {
    keys: ["water plants", "plants"],
    icon: "plant",
    duration: 5,
    steps: {
      young: ["Fill the watering can", "Water each plant", "Put the can back"],
      older: ["Check which plants are dry", "Water them", "Put the can back"]
    }
  },
  {
    keys: ["wake up", "morning routine"],
    icon: "sunrise",
    duration: 15,
    steps: {
      young: ["Open the curtains", "Use the toilet", "Wash your face"],
      older: ["Get up with the alarm", "Use the toilet", "Wash your face", "Make your bed"]
    }
  },
  {
    keys: ["play time", "playtime", "free play", "play outside"],
    icon: "sparkles",
    fun: true,
    duration: 30,
    steps: { young: [], older: [] }
  },
  {
    keys: ["drawing", "art", "craft", "colouring", "coloring", "painting"],
    icon: "palette",
    duration: 30,
    steps: { young: [], older: [] }
  }
];
var templateForName = (name) => {
  const n = ` ${name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (n.trim().length < 2) return null;
  let best = null;
  for (const t of TASK_TEMPLATES) {
    for (const k of t.keys) {
      if (n.includes(` ${k} `) && (!best || k.length > best.len)) best = { t, len: k.length };
    }
  }
  return best?.t ?? null;
};

// src/utils/scheduleOverlap.ts
var timeToMinutes = (time) => {
  if (!time) return null;
  const match2 = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match2) return null;
  const h = Number(match2[1]);
  const m = Number(match2[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};
var minutesToTime = (mins) => {
  const clamped = Math.max(0, Math.round(mins));
  return `${String(Math.floor(clamped / 60) % 24).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};
var timedEntries = (tasks) => tasks.map((task) => ({ task, start: task.type === "floating" ? null : timeToMinutes(task.scheduled_time) })).filter((e) => e.start !== null).sort((a, b) => a.start - b.start);
var clampScheduleOverlaps = (tasks) => {
  const timed2 = timedEntries(tasks);
  const clampById = /* @__PURE__ */ new Map();
  for (let i = 0; i < timed2.length; i++) {
    const { task, start } = timed2[i];
    const duration = task.duration ?? 0;
    if (duration <= 0) continue;
    const next = timed2.slice(i + 1).find((e) => e.start > start);
    if (!next) continue;
    const gap = next.start - start;
    if (duration > gap) clampById.set(task.id, gap);
  }
  if (clampById.size === 0) return tasks;
  return tasks.map((task) => {
    const clamped = clampById.get(task.id);
    if (clamped === void 0) return task;
    return { ...task, duration: clamped, originalDuration: task.duration ?? void 0, clampedByNext: true };
  });
};

// node_modules/date-fns/toDate.mjs
function toDate(argument) {
  const argStr = Object.prototype.toString.call(argument);
  if (argument instanceof Date || typeof argument === "object" && argStr === "[object Date]") {
    return new argument.constructor(+argument);
  } else if (typeof argument === "number" || argStr === "[object Number]" || typeof argument === "string" || argStr === "[object String]") {
    return new Date(argument);
  } else {
    return /* @__PURE__ */ new Date(NaN);
  }
}

// node_modules/date-fns/constructFrom.mjs
function constructFrom(date, value) {
  if (date instanceof Date) {
    return new date.constructor(value);
  } else {
    return new Date(value);
  }
}

// node_modules/date-fns/addDays.mjs
function addDays(date, amount) {
  const _date = toDate(date);
  if (isNaN(amount)) return constructFrom(date, NaN);
  if (!amount) {
    return _date;
  }
  _date.setDate(_date.getDate() + amount);
  return _date;
}

// node_modules/date-fns/constants.mjs
var daysInYear = 365.2425;
var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
var minTime = -maxTime;
var millisecondsInWeek = 6048e5;
var millisecondsInDay = 864e5;
var secondsInHour = 3600;
var secondsInDay = secondsInHour * 24;
var secondsInWeek = secondsInDay * 7;
var secondsInYear = secondsInDay * daysInYear;
var secondsInMonth = secondsInYear / 12;
var secondsInQuarter = secondsInMonth * 3;

// node_modules/date-fns/_lib/defaultOptions.mjs
var defaultOptions = {};
function getDefaultOptions() {
  return defaultOptions;
}

// node_modules/date-fns/startOfWeek.mjs
function startOfWeek(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const _date = toDate(date);
  const day = _date.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  _date.setDate(_date.getDate() - diff);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/startOfISOWeek.mjs
function startOfISOWeek(date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

// node_modules/date-fns/getISOWeekYear.mjs
function getISOWeekYear(date) {
  const _date = toDate(date);
  const year = _date.getFullYear();
  const fourthOfJanuaryOfNextYear = constructFrom(date, 0);
  fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
  const fourthOfJanuaryOfThisYear = constructFrom(date, 0);
  fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// node_modules/date-fns/startOfDay.mjs
function startOfDay(date) {
  const _date = toDate(date);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.mjs
function getTimezoneOffsetInMilliseconds(date) {
  const _date = toDate(date);
  const utcDate = new Date(
    Date.UTC(
      _date.getFullYear(),
      _date.getMonth(),
      _date.getDate(),
      _date.getHours(),
      _date.getMinutes(),
      _date.getSeconds(),
      _date.getMilliseconds()
    )
  );
  utcDate.setUTCFullYear(_date.getFullYear());
  return +date - +utcDate;
}

// node_modules/date-fns/differenceInCalendarDays.mjs
function differenceInCalendarDays(dateLeft, dateRight) {
  const startOfDayLeft = startOfDay(dateLeft);
  const startOfDayRight = startOfDay(dateRight);
  const timestampLeft = +startOfDayLeft - getTimezoneOffsetInMilliseconds(startOfDayLeft);
  const timestampRight = +startOfDayRight - getTimezoneOffsetInMilliseconds(startOfDayRight);
  return Math.round((timestampLeft - timestampRight) / millisecondsInDay);
}

// node_modules/date-fns/startOfISOWeekYear.mjs
function startOfISOWeekYear(date) {
  const year = getISOWeekYear(date);
  const fourthOfJanuary = constructFrom(date, 0);
  fourthOfJanuary.setFullYear(year, 0, 4);
  fourthOfJanuary.setHours(0, 0, 0, 0);
  return startOfISOWeek(fourthOfJanuary);
}

// node_modules/date-fns/isDate.mjs
function isDate(value) {
  return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
}

// node_modules/date-fns/isValid.mjs
function isValid(date) {
  if (!isDate(date) && typeof date !== "number") {
    return false;
  }
  const _date = toDate(date);
  return !isNaN(Number(_date));
}

// node_modules/date-fns/startOfYear.mjs
function startOfYear(date) {
  const cleanDate = toDate(date);
  const _date = constructFrom(date, 0);
  _date.setFullYear(cleanDate.getFullYear(), 0, 1);
  _date.setHours(0, 0, 0, 0);
  return _date;
}

// node_modules/date-fns/locale/en-US/_lib/formatDistance.mjs
var formatDistanceLocale = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};
var formatDistance = (token, count, options) => {
  let result;
  const tokenValue = formatDistanceLocale[token];
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count.toString());
  }
  if (options?.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  return result;
};

// node_modules/date-fns/locale/_lib/buildFormatLongFn.mjs
function buildFormatLongFn(args) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : args.defaultWidth;
    const format2 = args.formats[width] || args.formats[args.defaultWidth];
    return format2;
  };
}

// node_modules/date-fns/locale/en-US/_lib/formatLong.mjs
var dateFormats = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y",
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};
var timeFormats = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};
var dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
var formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: "full"
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: "full"
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: "full"
  })
};

// node_modules/date-fns/locale/en-US/_lib/formatRelative.mjs
var formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};
var formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];

// node_modules/date-fns/locale/_lib/buildLocalizeFn.mjs
function buildLocalizeFn(args) {
  return (value, options) => {
    const context = options?.context ? String(options.context) : "standalone";
    let valuesArray;
    if (context === "formatting" && args.formattingValues) {
      const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      const width = options?.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      const defaultWidth = args.defaultWidth;
      const width = options?.width ? String(options.width) : args.defaultWidth;
      valuesArray = args.values[width] || args.values[defaultWidth];
    }
    const index = args.argumentCallback ? args.argumentCallback(value) : value;
    return valuesArray[index];
  };
}

// node_modules/date-fns/locale/en-US/_lib/localize.mjs
var eraValues = {
  narrow: ["B", "A"],
  abbreviated: ["BC", "AD"],
  wide: ["Before Christ", "Anno Domini"]
};
var quarterValues = {
  narrow: ["1", "2", "3", "4"],
  abbreviated: ["Q1", "Q2", "Q3", "Q4"],
  wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
};
var monthValues = {
  narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
  abbreviated: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  wide: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
};
var dayValues = {
  narrow: ["S", "M", "T", "W", "T", "F", "S"],
  short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  wide: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ]
};
var dayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  }
};
var formattingDayPeriodValues = {
  narrow: {
    am: "a",
    pm: "p",
    midnight: "mi",
    noon: "n",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  abbreviated: {
    am: "AM",
    pm: "PM",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  },
  wide: {
    am: "a.m.",
    pm: "p.m.",
    midnight: "midnight",
    noon: "noon",
    morning: "in the morning",
    afternoon: "in the afternoon",
    evening: "in the evening",
    night: "at night"
  }
};
var ordinalNumber = (dirtyNumber, _options) => {
  const number = Number(dirtyNumber);
  const rem100 = number % 100;
  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + "st";
      case 2:
        return number + "nd";
      case 3:
        return number + "rd";
    }
  }
  return number + "th";
};
var localize = {
  ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: "wide"
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: "wide",
    argumentCallback: (quarter) => quarter - 1
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: "wide"
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: "wide"
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: "wide",
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: "wide"
  })
};

// node_modules/date-fns/locale/_lib/buildMatchFn.mjs
function buildMatchFn(args) {
  return (string, options = {}) => {
    const width = options.width;
    const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    const matchResult = string.match(matchPattern);
    if (!matchResult) {
      return null;
    }
    const matchedString = matchResult[0];
    const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      findKey(parsePatterns, (pattern) => pattern.test(matchedString))
    );
    let value;
    value = args.valueCallback ? args.valueCallback(key) : key;
    value = options.valueCallback ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- I challange you to fix the type
      options.valueCallback(value)
    ) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}
function findKey(object, predicate) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
      return key;
    }
  }
  return void 0;
}
function findIndex(array, predicate) {
  for (let key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
  return void 0;
}

// node_modules/date-fns/locale/_lib/buildMatchPatternFn.mjs
function buildMatchPatternFn(args) {
  return (string, options = {}) => {
    const matchResult = string.match(args.matchPattern);
    if (!matchResult) return null;
    const matchedString = matchResult[0];
    const parseResult = string.match(args.parsePattern);
    if (!parseResult) return null;
    let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    const rest = string.slice(matchedString.length);
    return { value, rest };
  };
}

// node_modules/date-fns/locale/en-US/_lib/match.mjs
var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
var parseOrdinalNumberPattern = /\d+/i;
var matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
var parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
var matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
var parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
var matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
var parseMonthPatterns = {
  narrow: [
    /^j/i,
    /^f/i,
    /^m/i,
    /^a/i,
    /^m/i,
    /^j/i,
    /^j/i,
    /^a/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ],
  any: [
    /^ja/i,
    /^f/i,
    /^mar/i,
    /^ap/i,
    /^may/i,
    /^jun/i,
    /^jul/i,
    /^au/i,
    /^s/i,
    /^o/i,
    /^n/i,
    /^d/i
  ]
};
var matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
var parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
var matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
var parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
var match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: (value) => parseInt(value, 10)
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseEraPatterns,
    defaultParseWidth: "any"
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: "any",
    valueCallback: (index) => index + 1
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: "any"
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: "wide",
    parsePatterns: parseDayPatterns,
    defaultParseWidth: "any"
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: "any",
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: "any"
  })
};

// node_modules/date-fns/locale/en-US.mjs
var enUS = {
  code: "en-US",
  formatDistance,
  formatLong,
  formatRelative,
  localize,
  match,
  options: {
    weekStartsOn: 0,
    firstWeekContainsDate: 1
  }
};

// node_modules/date-fns/getDayOfYear.mjs
function getDayOfYear(date) {
  const _date = toDate(date);
  const diff = differenceInCalendarDays(_date, startOfYear(_date));
  const dayOfYear = diff + 1;
  return dayOfYear;
}

// node_modules/date-fns/getISOWeek.mjs
function getISOWeek(date) {
  const _date = toDate(date);
  const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// node_modules/date-fns/getWeekYear.mjs
function getWeekYear(date, options) {
  const _date = toDate(date);
  const year = _date.getFullYear();
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const firstWeekOfNextYear = constructFrom(date, 0);
  firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setHours(0, 0, 0, 0);
  const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
  const firstWeekOfThisYear = constructFrom(date, 0);
  firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setHours(0, 0, 0, 0);
  const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
  if (_date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (_date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// node_modules/date-fns/startOfWeekYear.mjs
function startOfWeekYear(date, options) {
  const defaultOptions2 = getDefaultOptions();
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const year = getWeekYear(date, options);
  const firstWeek = constructFrom(date, 0);
  firstWeek.setFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setHours(0, 0, 0, 0);
  const _date = startOfWeek(firstWeek, options);
  return _date;
}

// node_modules/date-fns/getWeek.mjs
function getWeek(date, options) {
  const _date = toDate(date);
  const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
  return Math.round(diff / millisecondsInWeek) + 1;
}

// node_modules/date-fns/_lib/addLeadingZeros.mjs
function addLeadingZeros(number, targetLength) {
  const sign = number < 0 ? "-" : "";
  const output = Math.abs(number).toString().padStart(targetLength, "0");
  return sign + output;
}

// node_modules/date-fns/_lib/format/lightFormatters.mjs
var lightFormatters = {
  // Year
  y(date, token) {
    const signedYear = date.getFullYear();
    const year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
  },
  // Month
  M(date, token) {
    const month = date.getMonth();
    return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d(date, token) {
    return addLeadingZeros(date.getDate(), token.length);
  },
  // AM or PM
  a(date, token) {
    const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return dayPeriodEnumValue.toUpperCase();
      case "aaa":
        return dayPeriodEnumValue;
      case "aaaaa":
        return dayPeriodEnumValue[0];
      case "aaaa":
      default:
        return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
    }
  },
  // Hour [1-12]
  h(date, token) {
    return addLeadingZeros(date.getHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H(date, token) {
    return addLeadingZeros(date.getHours(), token.length);
  },
  // Minute
  m(date, token) {
    return addLeadingZeros(date.getMinutes(), token.length);
  },
  // Second
  s(date, token) {
    return addLeadingZeros(date.getSeconds(), token.length);
  },
  // Fraction of second
  S(date, token) {
    const numberOfDigits = token.length;
    const milliseconds = date.getMilliseconds();
    const fractionalSeconds = Math.trunc(
      milliseconds * Math.pow(10, numberOfDigits - 3)
    );
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};

// node_modules/date-fns/_lib/format/formatters.mjs
var dayPeriodEnum = {
  am: "am",
  pm: "pm",
  midnight: "midnight",
  noon: "noon",
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night"
};
var formatters = {
  // Era
  G: function(date, token, localize2) {
    const era = date.getFullYear() > 0 ? 1 : 0;
    switch (token) {
      case "G":
      case "GG":
      case "GGG":
        return localize2.era(era, { width: "abbreviated" });
      case "GGGGG":
        return localize2.era(era, { width: "narrow" });
      case "GGGG":
      default:
        return localize2.era(era, { width: "wide" });
    }
  },
  // Year
  y: function(date, token, localize2) {
    if (token === "yo") {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize2.ordinalNumber(year, { unit: "year" });
    }
    return lightFormatters.y(date, token);
  },
  // Local week-numbering year
  Y: function(date, token, localize2, options) {
    const signedWeekYear = getWeekYear(date, options);
    const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
    if (token === "YY") {
      const twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    }
    if (token === "Yo") {
      return localize2.ordinalNumber(weekYear, { unit: "year" });
    }
    return addLeadingZeros(weekYear, token.length);
  },
  // ISO week-numbering year
  R: function(date, token) {
    const isoWeekYear = getISOWeekYear(date);
    return addLeadingZeros(isoWeekYear, token.length);
  },
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: function(date, token) {
    const year = date.getFullYear();
    return addLeadingZeros(year, token.length);
  },
  // Quarter
  Q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      case "Q":
        return String(quarter);
      case "QQ":
        return addLeadingZeros(quarter, 2);
      case "Qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      case "QQQ":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "formatting"
        });
      case "QQQQQ":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "formatting"
        });
      case "QQQQ":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone quarter
  q: function(date, token, localize2) {
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    switch (token) {
      case "q":
        return String(quarter);
      case "qq":
        return addLeadingZeros(quarter, 2);
      case "qo":
        return localize2.ordinalNumber(quarter, { unit: "quarter" });
      case "qqq":
        return localize2.quarter(quarter, {
          width: "abbreviated",
          context: "standalone"
        });
      case "qqqqq":
        return localize2.quarter(quarter, {
          width: "narrow",
          context: "standalone"
        });
      case "qqqq":
      default:
        return localize2.quarter(quarter, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // Month
  M: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "M":
      case "MM":
        return lightFormatters.M(date, token);
      case "Mo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      case "MMM":
        return localize2.month(month, {
          width: "abbreviated",
          context: "formatting"
        });
      case "MMMMM":
        return localize2.month(month, {
          width: "narrow",
          context: "formatting"
        });
      case "MMMM":
      default:
        return localize2.month(month, { width: "wide", context: "formatting" });
    }
  },
  // Stand-alone month
  L: function(date, token, localize2) {
    const month = date.getMonth();
    switch (token) {
      case "L":
        return String(month + 1);
      case "LL":
        return addLeadingZeros(month + 1, 2);
      case "Lo":
        return localize2.ordinalNumber(month + 1, { unit: "month" });
      case "LLL":
        return localize2.month(month, {
          width: "abbreviated",
          context: "standalone"
        });
      case "LLLLL":
        return localize2.month(month, {
          width: "narrow",
          context: "standalone"
        });
      case "LLLL":
      default:
        return localize2.month(month, { width: "wide", context: "standalone" });
    }
  },
  // Local week of year
  w: function(date, token, localize2, options) {
    const week = getWeek(date, options);
    if (token === "wo") {
      return localize2.ordinalNumber(week, { unit: "week" });
    }
    return addLeadingZeros(week, token.length);
  },
  // ISO week of year
  I: function(date, token, localize2) {
    const isoWeek = getISOWeek(date);
    if (token === "Io") {
      return localize2.ordinalNumber(isoWeek, { unit: "week" });
    }
    return addLeadingZeros(isoWeek, token.length);
  },
  // Day of the month
  d: function(date, token, localize2) {
    if (token === "do") {
      return localize2.ordinalNumber(date.getDate(), { unit: "date" });
    }
    return lightFormatters.d(date, token);
  },
  // Day of year
  D: function(date, token, localize2) {
    const dayOfYear = getDayOfYear(date);
    if (token === "Do") {
      return localize2.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
    }
    return addLeadingZeros(dayOfYear, token.length);
  },
  // Day of week
  E: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    switch (token) {
      case "E":
      case "EE":
      case "EEE":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "EEEEE":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "EEEEEE":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "EEEE":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Local day of week
  e: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      case "e":
        return String(localDayOfWeek);
      case "ee":
        return addLeadingZeros(localDayOfWeek, 2);
      case "eo":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "eee":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "eeeee":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "eeeeee":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "eeee":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Stand-alone local day of week
  c: function(date, token, localize2, options) {
    const dayOfWeek = date.getDay();
    const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
    switch (token) {
      case "c":
        return String(localDayOfWeek);
      case "cc":
        return addLeadingZeros(localDayOfWeek, token.length);
      case "co":
        return localize2.ordinalNumber(localDayOfWeek, { unit: "day" });
      case "ccc":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "standalone"
        });
      case "ccccc":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "standalone"
        });
      case "cccccc":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "standalone"
        });
      case "cccc":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "standalone"
        });
    }
  },
  // ISO day of week
  i: function(date, token, localize2) {
    const dayOfWeek = date.getDay();
    const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    switch (token) {
      case "i":
        return String(isoDayOfWeek);
      case "ii":
        return addLeadingZeros(isoDayOfWeek, token.length);
      case "io":
        return localize2.ordinalNumber(isoDayOfWeek, { unit: "day" });
      case "iii":
        return localize2.day(dayOfWeek, {
          width: "abbreviated",
          context: "formatting"
        });
      case "iiiii":
        return localize2.day(dayOfWeek, {
          width: "narrow",
          context: "formatting"
        });
      case "iiiiii":
        return localize2.day(dayOfWeek, {
          width: "short",
          context: "formatting"
        });
      case "iiii":
      default:
        return localize2.day(dayOfWeek, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM or PM
  a: function(date, token, localize2) {
    const hours = date.getHours();
    const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    switch (token) {
      case "a":
      case "aa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "aaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "aaaaa":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "aaaa":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // AM, PM, midnight, noon
  b: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
    }
    switch (token) {
      case "b":
      case "bb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "bbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        }).toLowerCase();
      case "bbbbb":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "bbbb":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // in the morning, in the afternoon, in the evening, at night
  B: function(date, token, localize2) {
    const hours = date.getHours();
    let dayPeriodEnumValue;
    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }
    switch (token) {
      case "B":
      case "BB":
      case "BBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "abbreviated",
          context: "formatting"
        });
      case "BBBBB":
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "narrow",
          context: "formatting"
        });
      case "BBBB":
      default:
        return localize2.dayPeriod(dayPeriodEnumValue, {
          width: "wide",
          context: "formatting"
        });
    }
  },
  // Hour [1-12]
  h: function(date, token, localize2) {
    if (token === "ho") {
      let hours = date.getHours() % 12;
      if (hours === 0) hours = 12;
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return lightFormatters.h(date, token);
  },
  // Hour [0-23]
  H: function(date, token, localize2) {
    if (token === "Ho") {
      return localize2.ordinalNumber(date.getHours(), { unit: "hour" });
    }
    return lightFormatters.H(date, token);
  },
  // Hour [0-11]
  K: function(date, token, localize2) {
    const hours = date.getHours() % 12;
    if (token === "Ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Hour [1-24]
  k: function(date, token, localize2) {
    let hours = date.getHours();
    if (hours === 0) hours = 24;
    if (token === "ko") {
      return localize2.ordinalNumber(hours, { unit: "hour" });
    }
    return addLeadingZeros(hours, token.length);
  },
  // Minute
  m: function(date, token, localize2) {
    if (token === "mo") {
      return localize2.ordinalNumber(date.getMinutes(), { unit: "minute" });
    }
    return lightFormatters.m(date, token);
  },
  // Second
  s: function(date, token, localize2) {
    if (token === "so") {
      return localize2.ordinalNumber(date.getSeconds(), { unit: "second" });
    }
    return lightFormatters.s(date, token);
  },
  // Fraction of second
  S: function(date, token) {
    return lightFormatters.S(date, token);
  },
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    if (timezoneOffset === 0) {
      return "Z";
    }
    switch (token) {
      case "X":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      case "XXXX":
      case "XX":
        return formatTimezone(timezoneOffset);
      case "XXXXX":
      case "XXX":
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "x":
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      case "xxxx":
      case "xx":
        return formatTimezone(timezoneOffset);
      case "xxxxx":
      case "xxx":
      default:
        return formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (GMT)
  O: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "O":
      case "OO":
      case "OOO":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      case "OOOO":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Timezone (specific non-location)
  z: function(date, token, _localize) {
    const timezoneOffset = date.getTimezoneOffset();
    switch (token) {
      case "z":
      case "zz":
      case "zzz":
        return "GMT" + formatTimezoneShort(timezoneOffset, ":");
      case "zzzz":
      default:
        return "GMT" + formatTimezone(timezoneOffset, ":");
    }
  },
  // Seconds timestamp
  t: function(date, token, _localize) {
    const timestamp = Math.trunc(date.getTime() / 1e3);
    return addLeadingZeros(timestamp, token.length);
  },
  // Milliseconds timestamp
  T: function(date, token, _localize) {
    const timestamp = date.getTime();
    return addLeadingZeros(timestamp, token.length);
  }
};
function formatTimezoneShort(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = Math.trunc(absOffset / 60);
  const minutes = absOffset % 60;
  if (minutes === 0) {
    return sign + String(hours);
  }
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}
function formatTimezoneWithOptionalMinutes(offset, delimiter) {
  if (offset % 60 === 0) {
    const sign = offset > 0 ? "-" : "+";
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }
  return formatTimezone(offset, delimiter);
}
function formatTimezone(offset, delimiter = "") {
  const sign = offset > 0 ? "-" : "+";
  const absOffset = Math.abs(offset);
  const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
  const minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}

// node_modules/date-fns/_lib/format/longFormatters.mjs
var dateLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "P":
      return formatLong2.date({ width: "short" });
    case "PP":
      return formatLong2.date({ width: "medium" });
    case "PPP":
      return formatLong2.date({ width: "long" });
    case "PPPP":
    default:
      return formatLong2.date({ width: "full" });
  }
};
var timeLongFormatter = (pattern, formatLong2) => {
  switch (pattern) {
    case "p":
      return formatLong2.time({ width: "short" });
    case "pp":
      return formatLong2.time({ width: "medium" });
    case "ppp":
      return formatLong2.time({ width: "long" });
    case "pppp":
    default:
      return formatLong2.time({ width: "full" });
  }
};
var dateTimeLongFormatter = (pattern, formatLong2) => {
  const matchResult = pattern.match(/(P+)(p+)?/) || [];
  const datePattern = matchResult[1];
  const timePattern = matchResult[2];
  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong2);
  }
  let dateTimeFormat;
  switch (datePattern) {
    case "P":
      dateTimeFormat = formatLong2.dateTime({ width: "short" });
      break;
    case "PP":
      dateTimeFormat = formatLong2.dateTime({ width: "medium" });
      break;
    case "PPP":
      dateTimeFormat = formatLong2.dateTime({ width: "long" });
      break;
    case "PPPP":
    default:
      dateTimeFormat = formatLong2.dateTime({ width: "full" });
      break;
  }
  return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong2)).replace("{{time}}", timeLongFormatter(timePattern, formatLong2));
};
var longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};

// node_modules/date-fns/_lib/protectedTokens.mjs
var dayOfYearTokenRE = /^D+$/;
var weekYearTokenRE = /^Y+$/;
var throwTokens = ["D", "DD", "YY", "YYYY"];
function isProtectedDayOfYearToken(token) {
  return dayOfYearTokenRE.test(token);
}
function isProtectedWeekYearToken(token) {
  return weekYearTokenRE.test(token);
}
function warnOrThrowProtectedError(token, format2, input) {
  const _message = message(token, format2, input);
  console.warn(_message);
  if (throwTokens.includes(token)) throw new RangeError(_message);
}
function message(token, format2, input) {
  const subject = token[0] === "Y" ? "years" : "days of the month";
  return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
}

// node_modules/date-fns/format.mjs
var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var escapedStringRegExp = /^'([^]*?)'?$/;
var doubleQuoteRegExp = /''/g;
var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
function format(date, formatStr, options) {
  const defaultOptions2 = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
  const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
  const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
  const originalDate = toDate(date);
  if (!isValid(originalDate)) {
    throw new RangeError("Invalid time value");
  }
  let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
    const firstCharacter = substring[0];
    if (firstCharacter === "p" || firstCharacter === "P") {
      const longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale.formatLong);
    }
    return substring;
  }).join("").match(formattingTokensRegExp).map((substring) => {
    if (substring === "''") {
      return { isToken: false, value: "'" };
    }
    const firstCharacter = substring[0];
    if (firstCharacter === "'") {
      return { isToken: false, value: cleanEscapedString(substring) };
    }
    if (formatters[firstCharacter]) {
      return { isToken: true, value: substring };
    }
    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError(
        "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
      );
    }
    return { isToken: false, value: substring };
  });
  if (locale.localize.preprocessor) {
    parts = locale.localize.preprocessor(originalDate, parts);
  }
  const formatterOptions = {
    firstWeekContainsDate,
    weekStartsOn,
    locale
  };
  return parts.map((part) => {
    if (!part.isToken) return part.value;
    const token = part.value;
    if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
      warnOrThrowProtectedError(token, formatStr, String(date));
    }
    const formatter = formatters[token[0]];
    return formatter(originalDate, token, locale.localize, formatterOptions);
  }).join("");
}
function cleanEscapedString(input) {
  const matched = input.match(escapedStringRegExp);
  if (!matched) {
    return input;
  }
  return matched[1].replace(doubleQuoteRegExp, "'");
}

// stub:@/integrations/supabase/client
var supabase = new Proxy({}, { get() {
  throw new Error("no browser supabase client on the server");
} });

// src/utils/systemTasks.ts
var systemTaskTemplates = [
  {
    name: "Wake Up",
    type: "scheduled",
    defaultTime: "07:00:00",
    defaultDuration: 15,
    defaultDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    description: "Get up and start the day",
    defaultSteps: ["Pee", "Brush teeth"]
  },
  {
    name: "Breakfast",
    type: "scheduled",
    defaultTime: "07:30:00",
    defaultDuration: 30,
    defaultDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    description: "Morning meal"
  },
  {
    name: "School",
    type: "scheduled",
    defaultTime: "08:30:00",
    defaultDuration: 420,
    // 7 hours
    defaultDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    description: "School day"
  },
  {
    name: "Lunch",
    type: "scheduled",
    defaultTime: "12:00:00",
    defaultDuration: 45,
    defaultDays: ["saturday", "sunday"],
    description: "Midday meal"
  },
  {
    name: "Dinner",
    type: "scheduled",
    defaultTime: "18:00:00",
    defaultDuration: 45,
    defaultDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    description: "Evening meal"
  },
  {
    name: "Bedtime",
    type: "scheduled",
    defaultTime: "20:00:00",
    defaultDuration: 60,
    defaultDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    description: "Sleep and rest time"
  }
];
var SYSTEM_TASK_NAMES = systemTaskTemplates.map((t) => t.name);
var isSystemTaskName = (name) => !!name && SYSTEM_TASK_NAMES.includes(name);
var missingSystemTaskRows = (childId, existingTasks) => {
  const existingTaskNames = existingTasks.map((task) => task.name);
  return systemTaskTemplates.filter((template) => !existingTaskNames.includes(template.name)).map((template, index) => ({
    child_id: childId,
    name: template.name,
    type: template.type,
    scheduled_time: template.defaultTime,
    duration: template.defaultDuration,
    coins: 0,
    is_recurring: true,
    recurring_days: template.defaultDays,
    description: template.description,
    ...template.defaultSteps ? { subtasks: template.defaultSteps.map((text) => ({ id: crypto.randomUUID(), text })) } : {},
    sort_order: existingTasks.length + index,
    is_active: true
  }));
};
var DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
var WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday"];
var schoolDaysOf = (child) => child.school_days?.length ? child.school_days : WEEKDAY_NAMES;
var nextDayName = (day) => DAY_NAMES[(DAY_NAMES.indexOf(day) + 1) % 7];
var nextDateString = (date) => format(addDays(/* @__PURE__ */ new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd");
var isDayOff = (child, dayOfWeek, date, holidays) => {
  if (!schoolDaysOf(child).includes(dayOfWeek)) return true;
  return !!date && !!holidays?.some((h) => h.is_no_school && date >= h.date && date <= (h.end_date || h.date));
};
var WEEKEND_KEYS = ["wake", "lunch", "dinner", "bedtime"];
var isWeekendKey = (key) => !!key && WEEKEND_KEYS.includes(key);
var usesWeekendTime = (child, key, dayOfWeek, date, holidays) => key === "bedtime" ? isDayOff(child, nextDayName(dayOfWeek), date ? nextDateString(date) : void 0, holidays) : isDayOff(child, dayOfWeek, date, holidays);
var breakfastGap = (child) => {
  const wake = timeToMinutes(child.wake_time);
  const breakfast = timeToMinutes(child.breakfast_time);
  if (wake == null || breakfast == null || breakfast < wake) return null;
  return breakfast - wake;
};
var systemTaskKey = (taskName) => {
  const n = taskName.toLowerCase();
  if (n === "wake up") return "wake";
  if (["school", "breakfast", "lunch", "dinner", "bedtime"].includes(n)) return n;
  return null;
};
var systemRowAddedOn = (child, taskName, date) => {
  const key = systemTaskKey(taskName);
  const byDate = child?.system_date_overrides;
  return !!(key && byDate?.[date]?.[key]?.time);
};
var getSystemTaskScheduleForDay = (child, taskName, dayOfWeek, dateString, holidays) => {
  const taskNameLower = taskName.toLowerCase();
  const scheduleMapping = {
    "school": {
      timeField: "school_start_time",
      durationField: "school_duration",
      overridesField: "school_schedule_overrides"
    },
    "wake up": {
      timeField: "wake_time",
      durationField: "wake_duration",
      overridesField: "wake_schedule_overrides"
    },
    "breakfast": {
      timeField: "breakfast_time",
      durationField: "breakfast_duration",
      overridesField: "breakfast_schedule_overrides"
    },
    "lunch": {
      timeField: "lunch_time",
      durationField: "lunch_duration",
      overridesField: "lunch_schedule_overrides"
    },
    "dinner": {
      timeField: "dinner_time",
      durationField: "dinner_duration",
      overridesField: "dinner_schedule_overrides"
    },
    "bedtime": {
      timeField: "bedtime",
      durationField: "bedtime_duration",
      overridesField: "bedtime_schedule_overrides"
    }
  };
  const mapping = scheduleMapping[taskNameLower];
  if (!mapping) {
    console.warn(`No schedule mapping found for task "${taskName}"`);
    return null;
  }
  if (dateString) {
    const sysDateOverrides = child.system_date_overrides;
    const key2 = systemTaskKey(taskName);
    const dateEntry = sysDateOverrides?.[dateString]?.[key2 ?? ""];
    if (dateEntry && dateEntry.time && dateEntry.duration !== void 0) {
      return { time: dateEntry.time, duration: dateEntry.duration };
    }
  }
  const defaultDuration = child[mapping.durationField];
  const usualDuration = defaultDuration ?? systemTaskTemplates.find((t) => t.name.toLowerCase() === taskNameLower)?.defaultDuration ?? 30;
  if (taskNameLower === "breakfast") {
    const gap = breakfastGap(child);
    const wake = gap == null ? null : getSystemTaskScheduleForDay(child, "Wake Up", dayOfWeek, dateString, holidays);
    const wakeMin = timeToMinutes(wake?.time);
    if (gap != null && wakeMin != null) return { time: minutesToTime(wakeMin + gap), duration: usualDuration };
  }
  const overrides = child[mapping.overridesField];
  if (overrides && overrides[dayOfWeek]) {
    return overrides[dayOfWeek];
  }
  const key = systemTaskKey(taskName);
  if (overrides?.weekend && isWeekendKey(key) && usesWeekendTime(child, key, dayOfWeek, dateString, holidays)) {
    return overrides.weekend;
  }
  const defaultTime = child[mapping.timeField];
  if (defaultTime) {
    return { time: defaultTime, duration: usualDuration };
  }
  return null;
};

// src/utils/dayTies.ts
var MEALS = ["Breakfast", "Lunch", "Dinner"];
var LAST_MINUTE = 24 * 60 - 1;
var BEDTIME_ROUTINE = TASK_TEMPLATES.find((t) => t.keys.includes("bedtime routine"));
var isBedtimeRoutine = (name) => !!BEDTIME_ROUTINE && templateForName(name) === BEDTIME_ROUTINE;
function tieDay(items, everyday) {
  const hidden = /* @__PURE__ */ new Set();
  const times = /* @__PURE__ */ new Map();
  const anchors = /* @__PURE__ */ new Map();
  const startOf = (item) => timeToMinutes(item.time);
  const events = items.flatMap((item) => {
    const start = item.isEvent ? startOf(item) : null;
    if (start == null) return [];
    return [{ id: item.id, from: start - Math.max(0, item.prepMinutes ?? 0), to: start + item.duration }];
  });
  for (const meal of items) {
    if (!MEALS.includes(meal.name)) continue;
    const start = startOf(meal);
    const event = start == null ? void 0 : events.find((e) => start >= e.from && start < e.to);
    if (!event) continue;
    hidden.add(meal.id);
    for (const item of items) if (item.afterTaskId === meal.id) anchors.set(item.id, event.id);
  }
  const canMove = (item) => !isSystemTaskName(item.name) && !item.isEvent && item.type !== "floating" && !!item.isRecurring && !item.movedToday && !item.afterTaskId && !item.beforeTaskId;
  const moveTo = (item, minute) => times.set(item.id, minutesToTime(Math.min(LAST_MINUTE, Math.max(0, minute))));
  const wakeItem = items.find((i) => i.name === "Wake Up");
  const everydayWake = timeToMinutes(everyday.wake_time);
  const dayWake = wakeItem ? startOf(wakeItem) : null;
  const breakfastStart = timeToMinutes(everyday.breakfast_time);
  if (everydayWake != null && dayWake != null && breakfastStart != null && dayWake !== everydayWake) {
    const morningEnd = breakfastStart + (everyday.breakfast_duration ?? 30);
    for (const item of items) {
      const base = timeToMinutes(item.baseTime);
      if (canMove(item) && base != null && base >= everydayWake && base <= morningEnd) {
        moveTo(item, base + dayWake - everydayWake);
      }
    }
  }
  const bedItem = items.find((i) => i.name === "Bedtime");
  const everydayBed = timeToMinutes(everyday.bedtime);
  const dayBed = bedItem ? startOf(bedItem) : null;
  if (!bedItem || everydayBed == null || dayBed == null) return { hidden, times, anchors };
  const dinnerStart = timeToMinutes(everyday.dinner_time);
  const dinnerEnd = dinnerStart == null ? everydayBed : dinnerStart + (everyday.dinner_duration ?? 45);
  const evening = items.flatMap((item) => {
    if (!canMove(item)) return [];
    const routine = isBedtimeRoutine(item.name);
    const own = timeToMinutes(item.baseTime);
    const base = own ?? (routine ? everydayBed - item.duration : null);
    if (base == null) return [];
    return routine || base >= dinnerEnd && base < everydayBed ? [{ item, base, hasTime: own != null }] : [];
  });
  const bedShift = dayBed - everydayBed;
  const eveningStart = Math.min(dayBed, ...evening.map((e) => e.base + bedShift));
  const lastEventEnd = Math.max(-1, ...events.map((e) => e.to));
  const push = Math.max(0, Math.min(lastEventEnd - eveningStart, LAST_MINUTE - dayBed));
  const notBefore = push > 0 ? Math.min(lastEventEnd, dayBed + push) : 0;
  evening.forEach(({ item, base, hasTime }) => {
    if (bedShift !== 0 || push > 0 || !hasTime) moveTo(item, Math.max(notBefore, base + bedShift + push));
  });
  if (push > 0) moveTo(bedItem, dayBed + push);
  return { hidden, times, anchors };
}

// src/utils/restDays.ts
var isRestDate = (child, date) => !!child && (!!child.rest_dates?.includes(date) || child.rest_day_date === date);

// src/utils/alarm.ts
var DAY_NAMES2 = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
var dayNameOf = (date) => DAY_NAMES2[(/* @__PURE__ */ new Date(`${date}T00:00:00`)).getDay()];
var nextDateOf = (date) => format(addDays(/* @__PURE__ */ new Date(`${date}T00:00:00`), 1), "yyyy-MM-dd");
var alarmDayKind = (child, date, holidays) => usesWeekendTime(child, "wake", dayNameOf(date), date, holidays) ? "weekends" : "weekdays";
var alarmOn = (child, date, holidays) => {
  if (isRestDate(child, date)) return false;
  return alarmDayKind(child, date, holidays) === "weekends" ? child.alarm_weekends !== false : child.alarm_weekdays !== false;
};
var alarmTestStamp = (at) => {
  if (!at) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};
var wakeOn = (child, date, holidays) => (getSystemTaskScheduleForDay(child, "Wake Up", dayNameOf(date), date, holidays)?.time ?? child.wake_time ?? "07:00").slice(0, 5);

// stub:./uiconPaths
var UICON_VIEWBOX = "";
var UICON_PATHS = {};

// stub:react/jsx-runtime
var jsx = () => null;
var Fragment = Symbol("Fragment");

// src/components/icons/UIcon.tsx
function uicon(name) {
  const Icon = (props) => /* @__PURE__ */ jsx(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: UICON_VIEWBOX,
      width: 24,
      height: 24,
      fill: "currentColor",
      "aria-hidden": "true",
      focusable: "false",
      ...props,
      children: /* @__PURE__ */ jsx("path", { d: UICON_PATHS[name] })
    }
  );
  Icon.displayName = `UIcon(${name})`;
  return Icon;
}

// src/utils/taskIcon.tsx
var ICON_OPTIONS = [
  // Morning and night
  { key: "sunrise", label: "Wake up", Icon: uicon("sunrise") },
  { key: "bed", label: "Make bed", Icon: uicon("bed") },
  { key: "moon", label: "Bedtime", Icon: uicon("moon-stars") },
  { key: "clock", label: "Time", Icon: uicon("clock") },
  // Food and drink
  { key: "coffee", label: "Breakfast", Icon: uicon("egg-fried") },
  { key: "sandwich", label: "Lunch", Icon: uicon("sandwich") },
  { key: "utensils", label: "Dinner", Icon: uicon("plate-utensils") },
  { key: "cookie", label: "Snack", Icon: uicon("cookie") },
  { key: "apple", label: "Fruit", Icon: uicon("apple-whole") },
  { key: "carrot", label: "Veggies", Icon: uicon("carrot") },
  { key: "droplet", label: "Water", Icon: uicon("glass-water-droplet") },
  // Washing up and getting dressed
  { key: "smile", label: "Teeth", Icon: uicon("toothbrush") },
  { key: "soap", label: "Wash hands", Icon: uicon("soap") },
  { key: "toilet", label: "Toilet", Icon: uicon("toilet") },
  { key: "bath", label: "Bath", Icon: uicon("bath") },
  { key: "shower", label: "Shower", Icon: uicon("shower") },
  { key: "shirt", label: "Get dressed", Icon: uicon("shirt") },
  { key: "shoes", label: "Shoes", Icon: uicon("shoe-prints") },
  // School and learning
  { key: "school", label: "School", Icon: uicon("school") },
  { key: "backpack", label: "Pack bag", Icon: uicon("backpack") },
  { key: "bus", label: "Bus", Icon: uicon("school-bus") },
  { key: "car", label: "Car", Icon: uicon("car-side") },
  { key: "pencil", label: "Homework", Icon: uicon("pencil") },
  { key: "book", label: "Reading", Icon: uicon("book-open-reader") },
  { key: "music", label: "Music", Icon: uicon("music-alt") },
  { key: "palette", label: "Art", Icon: uicon("palette") },
  // Moving and playing
  { key: "dumbbell", label: "Exercise", Icon: uicon("running") },
  { key: "ball", label: "Sports", Icon: uicon("football") },
  { key: "swim", label: "Swimming", Icon: uicon("swimmer") },
  { key: "bike", label: "Bike", Icon: uicon("bike") },
  { key: "outside", label: "Outside", Icon: uicon("tree") },
  { key: "yoga", label: "Calm down", Icon: uicon("meditation") },
  { key: "toys", label: "Toys", Icon: uicon("cubes") },
  { key: "game", label: "Games", Icon: uicon("gamepad") },
  { key: "tablet", label: "Screen time", Icon: uicon("tablet") },
  { key: "tv", label: "TV", Icon: uicon("tv-retro") },
  { key: "friends", label: "Friends", Icon: uicon("users") },
  // Chores
  { key: "clean", label: "Tidy up", Icon: uicon("broom") },
  { key: "dishes", label: "Dishes", Icon: uicon("sink") },
  { key: "laundry", label: "Laundry", Icon: uicon("washer") },
  { key: "trash", label: "Trash", Icon: uicon("trash") },
  { key: "plant", label: "Plants", Icon: uicon("seedling") },
  { key: "pet", label: "Dog", Icon: uicon("dog") },
  { key: "cat", label: "Cat", Icon: uicon("cat") },
  { key: "shopping", label: "Shopping", Icon: uicon("shopping-cart") },
  // Everything else
  { key: "medicine", label: "Medicine", Icon: uicon("medicine") },
  { key: "heart", label: "Heart", Icon: uicon("heart") },
  { key: "sparkles", label: "Fun", Icon: uicon("sparkles") },
  { key: "free", label: "Free time", Icon: uicon("kite") },
  { key: "star", label: "Star", Icon: uicon("star") }
];
var ICON_BY_KEY = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.key, o.Icon])
);
var RULES = [
  { keywords: ["wake", "morning", "get up", "rise"], key: "sunrise" },
  { keywords: ["make bed", "make the bed", "make your bed"], key: "bed" },
  { keywords: ["bed ", "beds ", "bedtime", "sleep", "nap", "goodnight", "good night", "night"], key: "moon" },
  { keywords: ["teeth", "tooth", "floss", "dentist"], key: "smile" },
  { keywords: ["clean", "tidy", "chore", "vacuum", "sweep", "dust", "room", "bedroom"], key: "clean" },
  { keywords: ["medicine", "vitamin", "pill", "doctor"], key: "medicine" },
  { keywords: ["breakfast", "cereal", "pancake"], key: "coffee" },
  { keywords: ["lunch"], key: "sandwich" },
  { keywords: ["dinner", "supper", "set the table", "set table"], key: "utensils" },
  { keywords: ["snack"], key: "cookie" },
  { keywords: ["veg", "carrot", "salad"], key: "carrot" },
  { keywords: ["fruit", "eat", "meal", "food"], key: "apple" },
  { keywords: ["dish", "clear the table", "sink"], key: "dishes" },
  { keywords: ["shop", "store", "grocer", "errand"], key: "shopping" },
  { keywords: ["hands", "hand wash", "soap", "wash face", "wash your face"], key: "soap" },
  { keywords: ["toilet", "potty"], key: "toilet" },
  { keywords: ["shower"], key: "shower" },
  { keywords: ["bath", "wash"], key: "bath" },
  { keywords: ["laundry", "fold", "washing"], key: "laundry" },
  { keywords: ["dress", "clothes", "outfit", "pajama", "pyjama", "uniform", "shirt"], key: "shirt" },
  { keywords: ["shoe", "sock", "boot"], key: "shoes" },
  { keywords: ["pack", "backpack", "bag "], key: "backpack" },
  { keywords: ["bus"], key: "bus" },
  { keywords: ["car ", "drive", "driving"], key: "car" },
  { keywords: ["school", "preschool", "class", "kindergarten"], key: "school" },
  { keywords: ["homework", "study", "write", "writing", "journal", "spelling", "math"], key: "pencil" },
  { keywords: ["read", "book", "story", "stories", "library"], key: "book" },
  { keywords: ["exercise", "workout", "gym", "run", "stretch", "dance", "ballet", "karate", "hike"], key: "dumbbell" },
  { keywords: ["swim", "pool"], key: "swim" },
  { keywords: ["soccer", "football", "basketball", "ball", "sport", "tennis", "hockey", "baseball"], key: "ball" },
  { keywords: ["bike", "ride", "scooter", "skate", "cycl"], key: "bike" },
  { keywords: ["music", "piano", "guitar", "violin", "drum", "instrument", "sing", "practi"], key: "music" },
  { keywords: ["draw", "paint", "art", "craft", "color", "colour"], key: "palette" },
  { keywords: ["yoga", "calm", "breath", "meditat", "quiet", "relax", "wind down"], key: "yoga" },
  { keywords: ["tv", "movie", "cartoon", "film"], key: "tv" },
  { keywords: ["tablet", "ipad", "screen", "youtube", "phone", "computer"], key: "tablet" },
  { keywords: ["video game", "gaming", "game", "minecraft", "roblox", "nintendo"], key: "game" },
  { keywords: ["plant", "garden", "flower", "seed"], key: "plant" },
  { keywords: ["water", "drink"], key: "droplet" },
  { keywords: ["trash", "garbage", "rubbish", "bin ", "recycl"], key: "trash" },
  { keywords: ["toy", "lego", "block", "puzzle", "build"], key: "toys" },
  { keywords: ["outside", "outdoor", "park", "playground", "nature"], key: "outside" },
  { keywords: ["friend", "playdate", "play date", "party", "visit", "family"], key: "friends" },
  { keywords: ["free time", "free play"], key: "free" },
  { keywords: ["fun", "playtime", "play time", "reward"], key: "sparkles" },
  { keywords: ["play"], key: "game" },
  { keywords: ["cat ", "cats ", "kitten"], key: "cat" },
  { keywords: ["pet", "dog", "puppy", "feed", "walk", "fish", "hamster", "rabbit", "bunny"], key: "pet" }
];
function taskIconKey(taskName, iconKey) {
  if (iconKey && ICON_BY_KEY[iconKey]) return iconKey;
  const name = ` ${(taskName || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const { keywords, key } of RULES) {
    if (keywords.some((k) => name.includes(` ${k}`))) return key;
  }
  return "star";
}

// src/lib/spinningWheel.ts
var MIN_WHEEL_OPTIONS = 2;
function normalizeWheelOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((o) => typeof o === "string");
}
function hasWheelOptions(options) {
  return (options?.length ?? 0) >= MIN_WHEEL_OPTIONS;
}
var STARTER_WHEEL_OPTIONS = ["Draw", "Lego", "Read", "Play outside", "Puzzle", "Dance"];
function wheelOptionsFor(value) {
  const own = normalizeWheelOptions(value);
  return hasWheelOptions(own) ? own : STARTER_WHEEL_OPTIONS;
}

// src/utils/pstDate.ts
var previewOffsetMs = 0;
var getPSTDate = () => new Date(new Date(Date.now() + previewOffsetMs).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
var getPSTDateString = () => {
  const d = getPSTDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
var getPSTDayName = () => {
  const d = getPSTDate();
  return d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
};
var toPSTDateString = (at) => {
  const d = new Date(new Date(at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// src/utils/liveDay.ts
var toMin = (hhmm3) => {
  if (!hhmm3) return Number.NaN;
  const [h, m] = hhmm3.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
var hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
var minuteOfDay = (iso) => {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return d.getHours() * 60 + d.getMinutes();
};
var isFixedRow = (t) => t.type === "scheduled" || !!t.is_event || isSystemTaskName(t.name);
var timed = (t) => !!t.scheduled_time && t.scheduled_time.toString().trim() !== "" && (t.duration ?? 0) > 0 && t.type !== "floating";
function startsByTask(starts) {
  const out = /* @__PURE__ */ new Map();
  [...starts].sort((a, b) => a.started_at.localeCompare(b.started_at)).forEach((s) => {
    if (!out.has(s.task_id)) out.set(s.task_id, { minute: minuteOfDay(s.started_at), kind: s.kind });
  });
  return out;
}
function applyNextNow(schedule, starts) {
  const rows = schedule.map((r) => ({ ...r }));
  const pulls = [...starts.entries()].filter(([, s]) => s.kind === "next_now").sort((a, b) => a[1].minute - b[1].minute);
  for (const [taskId, s] of pulls) {
    const idx = rows.findIndex((r) => r.id === taskId);
    if (idx < 0) continue;
    const row2 = rows[idx];
    if (!timed(row2) || isFixedRow(row2)) continue;
    const from = toMin(row2.scheduled_time);
    if (s.minute >= from) continue;
    let delta = from - s.minute;
    row2.scheduled_time = hhmm(s.minute);
    let prevEnd = s.minute + (row2.duration ?? 0);
    for (let j = idx + 1; j < rows.length; j++) {
      const r = rows[j];
      if (!timed(r)) continue;
      if (isFixedRow(r)) break;
      if (r.isCompleted) continue;
      if (starts.has(r.id)) break;
      const start = toMin(r.scheduled_time);
      const next = Math.max(start - delta, prevEnd);
      if (next >= start) break;
      r.scheduled_time = hhmm(next);
      delta = start - next;
      prevEnd = next + (r.duration ?? 0);
    }
    rows.sort((a, b) => {
      const ta = timed(a) ? toMin(a.scheduled_time) : Number.POSITIVE_INFINITY;
      const tb = timed(b) ? toMin(b.scheduled_time) : Number.POSITIVE_INFINITY;
      return ta - tb || (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }
  return rows;
}
var freeWindows = (grants, today) => grants.filter((g) => g.minutes > 0 && toPSTDateString(g.starts_at) === today).map((g) => {
  const start = minuteOfDay(g.starts_at);
  return { id: g.id, start, end: Math.min(24 * 60, start + g.minutes) };
}).sort((a, b) => a.start - b.start);
var staysPut = (t) => !!t.is_event || t.name === "School" || t.name === "Bedtime";
function applyFreeTime(schedule, windows) {
  if (!windows.length) return schedule;
  const rows = schedule.map((r) => ({ ...r }));
  const byStart = () => rows.filter((r) => timed(r)).sort((a, b) => toMin(a.scheduled_time) - toMin(b.scheduled_time));
  const bedtimeRow = rows.find((r) => r.name === "Bedtime" && timed(r));
  const bedtime = bedtimeRow ? toMin(bedtimeRow.scheduled_time) : 24 * 60;
  for (const w of windows) {
    const holds = byStart().filter((r) => isFixedRow(r) && toMin(r.scheduled_time) >= w.end || staysPut(r)).map((r) => ({ start: toMin(r.scheduled_time), end: toMin(r.scheduled_time) + (r.duration ?? 0) }));
    let prevEnd = w.end;
    const place = (r) => {
      const dur = r.duration ?? 0, whole = r.late_policy !== "shorten";
      let start = prevEnd;
      for (let moved = true; moved; ) {
        moved = false;
        for (const h of holds) {
          const inside = start >= h.start && start < h.end, runsInto = whole && start < h.start && start + dur > h.start;
          if ((inside || runsInto) && h.end < bedtime) {
            start = h.end;
            moved = true;
          }
        }
      }
      r.scheduled_time = hhmm(start);
      prevEnd = start + dur;
    };
    for (const r of byStart()) {
      if (r.isCompleted || staysPut(r)) continue;
      const start = toMin(r.scheduled_time), end = start + (r.duration ?? 0);
      if (end <= w.start) continue;
      if (start < w.start) {
        r.duration = end - w.start;
        place(r);
        continue;
      }
      if (start < w.end) {
        place(r);
        continue;
      }
      if (isFixedRow(r)) continue;
      if (start >= prevEnd) break;
      place(r);
    }
  }
  const sorted = rows.sort((a, b) => {
    const ta = timed(a) ? toMin(a.scheduled_time) : Number.POSITIVE_INFINITY;
    const tb = timed(b) ? toMin(b.scheduled_time) : Number.POSITIVE_INFINITY;
    return ta - tb || (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return clampScheduleOverlaps(sorted);
}

// src/lib/dayPlan.ts
var hhmm2 = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
var toMin2 = (t) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
var rewardIconFor = (name) => {
  const n = name.toLowerCase();
  if (/ice ?cream|gelato/.test(n)) return "icecream";
  if (/movie|film|cinema|cartoon|tv/.test(n)) return "film";
  if (/book|read|story|library/.test(n)) return "book";
  if (/game|minecraft|roblox|nintendo|screen|tablet/.test(n)) return "game";
  if (/park|outside|playground|zoo|trip|outing|pool|swim/.test(n)) return "outside";
  if (/pizza|dinner|treat|cake|cookie|sweet|candy|snack/.test(n)) return "cookie";
  if (/toy|lego|puzzle/.test(n)) return "toys";
  if (/friend|sleepover|playdate|party/.test(n)) return "friends";
  if (/bedtime|late|stay up/.test(n)) return "moon";
  if (/music|song|dance/.test(n)) return "music";
  return "gift";
};
var REWARD_COLORS = ["#F59A76", "#A89AF0", "#65CDAA", "#879BFF", "#EAB5DE", "#FAB047"];
var NOTE_BYTES = 120;
var clipNote = (text) => {
  const enc = new TextEncoder();
  const t = text.replace(/\s+/g, " ").trim();
  if (enc.encode(t).length <= NOTE_BYTES) return t;
  let out = "";
  for (const ch of t) {
    if (enc.encode(out + ch + "\u2026").length > NOTE_BYTES) break;
    out += ch;
  }
  const cut = out.lastIndexOf(" ");
  return `${(cut > out.length * 0.6 ? out.slice(0, cut) : out).replace(/[\s.,;:!?]+$/, "")}\u2026`;
};
function buildDayPlan({ child, schedule: planned, chores, completions, rewards, purchases, restDay, starts = [], notes = [], freeTime = [], holidays = [] }) {
  const today = getPSTDateString();
  const marks = startsByTask(starts);
  const windows = freeWindows(freeTime, today);
  const schedule = applyFreeTime(applyNextNow(planned, marks), windows);
  const doneAt = (taskId) => {
    const c = completions.find((x) => x.task_id === taskId && (x.date === today || toPSTDateString(x.completed_at) === today));
    if (!c) return void 0;
    const d = new Date(c.completed_at);
    const pst = new Date(d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    return hhmm2(pst.getHours() * 60 + pst.getMinutes());
  };
  const timed2 = schedule.filter((t) => t.type !== "floating" && t.scheduled_time && t.scheduled_time.toString().trim() !== "");
  const wakeRow = timed2.find((t) => t.name === "Wake Up");
  const wake = (wakeRow?.scheduled_time || child.wake_time || "07:00").slice(0, 5);
  const tasks = timed2.map((t) => {
    const start = toMin2(t.scheduled_time);
    const end = start + (t.duration ?? 30);
    const row2 = {
      id: t.id,
      title: t.name,
      icon: taskIconKey(t.name, t.icon),
      start: hhmm2(start),
      end: hhmm2(Math.min(end, 24 * 60))
    };
    if (t.subtasks?.length) row2.steps = t.subtasks.map((s) => ({ id: s.id, text: s.text }));
    if (t.is_important) row2.important = true;
    if (t.is_fun_time) row2.fun = true;
    if (t.type === "scheduled" && !t.is_event && !systemTaskKey(t.name)) row2.fixed = true;
    if (t.needs_start) row2.needs_start = true;
    const mark = marks.get(t.id);
    if (mark) row2.started_at = hhmm(mark.minute);
    row2.late = t.late_policy ?? (t.is_fun_time ? "skip" : "keep");
    if (t.min_duration) row2.min = t.min_duration;
    if (t.is_event) {
      row2.event = true;
      if (t.event_start) row2.event_start = t.event_start.slice(0, 5);
    } else if (t.event_start) row2.event_start = t.event_start.slice(0, 5);
    const sys = systemTaskKey(t.name);
    if (sys) row2.system = sys;
    if (isBedtimeRoutine(t.name)) row2.bedtime_routine = true;
    if (t.isCompleted) row2.done_at = doneAt(t.id) ?? hhmm2(start);
    return row2;
  });
  const latestAsk = (rewardId) => purchases.filter((p) => p.reward_id === rewardId).sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))[0];
  const requested = (rewardId) => {
    const latest = latestAsk(rewardId);
    if (!latest) return null;
    if (latest.status === "pending") return "waiting";
    if (toPSTDateString(latest.purchased_at) !== today) return null;
    if (isApprovedStatus(latest.status)) return "approved";
    if (latest.status === "denied") return "denied";
    return null;
  };
  const unseen = notes.filter((n) => !n.seen_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const starNote = unseen.find((n) => n.kind === "star");
  const deniedNote = (rewardId) => {
    const ask = latestAsk(rewardId);
    return ask ? unseen.find((n) => n.kind === "reward_denied" && n.purchase_id === ask.id) : void 0;
  };
  return {
    v: 1,
    date: today,
    child: {
      id: child.id,
      name: child.name,
      pet: petNick(child.petType),
      // The character and its colour (the device draws the ones it has; the rest show as Biscuit).
      character: child.petType,
      color: resolvePetColour(child.petType, child.pet_color) ?? "",
      picture: displayModeFor(child) === "picture",
      stars: child.currentCoins ?? 0,
      wake,
      alarm: !restDay && alarmOn(child, today, holidays),
      next_wake: wakeOn(child, nextDateOf(today), holidays),
      next_alarm: alarmOn(child, nextDateOf(today), holidays),
      alarm_test: alarmTestStamp(child.alarm_test_at),
      outfit: child.pet_outfit ?? {},
      ...starNote ? { star_note: clipNote(starNote.body), star_note_id: starNote.id, star_note_stars: starNote.stars ?? 1 } : {}
    },
    rest_day: restDay,
    tasks,
    ...windows.length ? { free_time: windows.map((w) => ({ id: w.id, start: hhmm2(w.start), end: hhmm2(w.end), minutes: w.end - w.start })) } : {},
    chores: chores.map((c) => ({
      id: c.id,
      title: c.name,
      icon: taskIconKey(c.name, c.icon),
      from: c.window_start ? c.window_start.slice(0, 5) : void 0,
      to: c.window_end ? c.window_end.slice(0, 5) : void 0,
      done: !!c.isCompleted
    })),
    rewards: rewards.filter((r) => r.is_active !== false).map((r, i) => {
      const state = requested(r.id);
      const note = state === "denied" ? deniedNote(r.id) : void 0;
      return {
        id: r.id,
        title: r.name,
        icon: rewardIconFor(r.name),
        color: REWARD_COLORS[i % REWARD_COLORS.length],
        cost: r.cost,
        state,
        ...note ? { note: clipNote(note.body), note_id: note.id } : {}
      };
    }),
    wheel: wheelOptionsFor(child.spinning_wheel_options)
  };
}

// src/utils/eventWindow.ts
var toMin3 = (hhmm3) => {
  const [h, m] = hhmm3.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};
var toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
var isSchoolRow = (task) => (task.name ?? "").trim().toLowerCase() === "school";
var prepMinutes = (task) => task.is_event || isSchoolRow(task) ? Math.max(0, task.prep_minutes ?? 0) : 0;
function withGetReadyTime(task, dayStartMin = 0) {
  if (!task.scheduled_time || task.event_start) return task;
  if (!task.is_event && !(isSchoolRow(task) && prepMinutes(task) > 0)) return task;
  const start = toMin3(task.scheduled_time);
  const blockStart = Math.min(start, Math.max(dayStartMin, start - prepMinutes(task)));
  return {
    ...task,
    event_start: task.scheduled_time.slice(0, 5),
    scheduled_time: toHHMM(blockStart),
    duration: (task.duration ?? 0) + (start - blockStart)
  };
}

// src/utils/dragSnap.ts
var EDGE_SNAP_MINUTES = 15;
var GRID_MINUTES = 5;
var DAY_END = 24 * 60;
var normalizeBlocks = (blocks, dayStart = 0, dayEnd = DAY_END) => {
  const sorted = blocks.filter((b) => b.end > b.start).map((b) => ({
    start: Math.max(dayStart, b.start),
    end: Math.min(dayEnd, b.end)
  })).filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ ...b });
    }
  }
  return merged;
};
var buildFreeGaps = (occupied, bounds = {}) => {
  const dayStart = bounds.dayStart ?? 0;
  const dayEnd = bounds.dayEnd ?? DAY_END;
  const blocks = normalizeBlocks(occupied, dayStart, dayEnd);
  const gaps = [];
  let cursor = dayStart;
  for (const b of blocks) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) gaps.push({ start: cursor, end: dayEnd });
  return gaps;
};
var resolveDropStart = (occupied, proposedStart, duration, bounds = {}) => {
  if (duration <= 0) duration = 5;
  const dayStart = bounds.dayStart ?? 0;
  const dayEnd = bounds.dayEnd ?? DAY_END;
  const gaps = buildFreeGaps(occupied, bounds).filter((g) => g.end - g.start >= duration);
  if (gaps.length === 0) return null;
  let best = null;
  for (const gap2 of gaps) {
    const lo = gap2.start;
    const hi = gap2.end - duration;
    const clamped2 = Math.min(hi, Math.max(lo, proposedStart));
    const dist = Math.abs(clamped2 - proposedStart);
    if (!best || dist < best.dist) best = { gap: gap2, clamped: clamped2, dist };
  }
  const { gap, clamped } = best;
  const snapToStart = gap.start > dayStart && clamped - gap.start <= EDGE_SNAP_MINUTES;
  const snapToEnd = gap.end < dayEnd && gap.end - (clamped + duration) <= EDGE_SNAP_MINUTES;
  let start;
  if (snapToStart && snapToEnd) {
    start = clamped - gap.start <= gap.end - (clamped + duration) ? gap.start : gap.end - duration;
  } else if (snapToStart) {
    start = gap.start;
  } else if (snapToEnd) {
    start = gap.end - duration;
  } else {
    start = Math.round(clamped / GRID_MINUTES) * GRID_MINUTES;
    start = Math.min(gap.end - duration, Math.max(gap.start, start));
  }
  return start;
};

// src/utils/afterAnchors.ts
var orderByAnchors = (tasks) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = [];
  const state = /* @__PURE__ */ new Map();
  const visit = (t) => {
    if (state.get(t.id) === "done") return;
    if (state.get(t.id) === "visiting") return;
    state.set(t.id, "visiting");
    const anchorId = t.after_task_id || t.before_task_id;
    const anchor = anchorId ? byId.get(anchorId) : void 0;
    if (anchor) visit(anchor);
    state.set(t.id, "done");
    out.push(t);
  };
  tasks.forEach(visit);
  return out;
};

// src/utils/repeatEnds.ts
var repeatEnded = (task, date) => !!task.repeat_until && date > task.repeat_until.slice(0, 10);

// src/utils/todaysSchedule.ts
function buildTodaysSchedule({ tasksWithCompletion, child, holidays, todaysHoliday }) {
  const currentDay = getPSTDayName();
  const todayStr = getPSTDateString();
  let todaysTasks = tasksWithCompletion.filter((task) => {
    if (task.is_active === false) return false;
    if (task.is_recurring && task.recurring_days) {
      if (task.excluded_dates?.includes(todayStr) || repeatEnded(task, todayStr)) return false;
      return task.recurring_days.includes(currentDay) || isSystemTaskName(task.name) && systemRowAddedOn(child, task.name, todayStr);
    }
    if (!task.is_recurring && task.task_date) {
      return task.task_date === todayStr;
    }
    if (!task.is_recurring && !task.task_date && task.created_at) {
      const createdDate = toPSTDateString(task.created_at);
      return createdDate === todayStr;
    }
    return false;
  });
  if (todaysHoliday) {
    todaysTasks = todaysTasks.filter((task) => !(todaysHoliday.is_no_school && task.name === "School"));
  }
  const systemTaskNames = ["Wake Up", "Breakfast", "School", "Lunch", "Dinner", "Bedtime"];
  const dayTimes = todaysTasks.map((task) => {
    if (child && systemTaskNames.includes(task.name)) {
      const daySpecificSchedule = getSystemTaskScheduleForDay(child, task.name, currentDay, todayStr, holidays);
      if (daySpecificSchedule) {
        return { ...task, scheduled_time: daySpecificSchedule.time, duration: daySpecificSchedule.duration, placementHint: void 0 };
      }
    }
    const dateOverride = task.date_overrides?.[todayStr];
    const weekdayOverride = task.schedule_overrides?.[currentDay];
    const override = dateOverride || weekdayOverride;
    const hintFor = (pinned) => !pinned && !task.after_task_id && !task.before_task_id ? dateOverride?.window_start || task.window_start || void 0 : void 0;
    if (dateOverride?.anytime) {
      return {
        ...task,
        type: task.type === "scheduled" ? "regular" : task.type,
        scheduled_time: void 0,
        placementHint: hintFor(null),
        duration: override.duration ?? task.duration
      };
    }
    if (override) {
      const pinned = override.scheduled_time || task.scheduled_time;
      return {
        ...task,
        scheduled_time: pinned,
        placementHint: hintFor(pinned),
        duration: override.duration ?? task.duration
      };
    }
    return { ...task, placementHint: hintFor(task.scheduled_time) };
  }).filter((task) => {
    const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== "" || !!task.placementHint;
    const isAnytime = task.type === "flexible" || task.type === "floating" || task.type === "regular";
    return hasTime || isAnytime;
  });
  const ties = tieDay(dayTimes.map((task) => ({
    id: task.id,
    name: task.name,
    type: task.type,
    time: task.scheduled_time || task.placementHint || null,
    duration: task.duration ?? 0,
    baseTime: todaysTasks.find((t) => t.id === task.id)?.scheduled_time || task.window_start || null,
    movedToday: !!(task.date_overrides?.[todayStr] || task.schedule_overrides?.[currentDay]),
    isRecurring: task.is_recurring,
    isEvent: task.is_event,
    prepMinutes: task.prep_minutes,
    afterTaskId: task.after_task_id,
    beforeTaskId: task.before_task_id
  })), child);
  const resolvedTasks = dayTimes.filter((task) => !ties.hidden.has(task.id)).map((task) => {
    const time = ties.times.get(task.id);
    const anchor = ties.anchors.get(task.id);
    if (!time && !anchor) return task;
    const moved = !time ? {} : task.scheduled_time ? { scheduled_time: time } : { placementHint: time };
    return { ...task, ...moved, ...anchor ? { after_task_id: anchor } : {} };
  });
  const wakeRow = resolvedTasks.find((t) => t.name === "Wake Up" && t.scheduled_time);
  const [ewh, ewm] = (wakeRow?.scheduled_time || child.wake_time || "07:00").slice(0, 5).split(":").map(Number);
  const tasksWithDaySpecificTimes = resolvedTasks.map((task) => withGetReadyTime(task, ewh * 60 + ewm));
  const occupied = tasksWithDaySpecificTimes.filter((t) => t.scheduled_time && t.scheduled_time.toString().trim() !== "").map((t) => {
    const [h, m] = t.scheduled_time.slice(0, 5).split(":").map(Number);
    const start = h * 60 + m;
    return { start, end: start + (t.duration ?? 30) };
  }).sort((a, b) => a.start - b.start);
  const dayBounds = (() => {
    const wakeTask = tasksWithDaySpecificTimes.find((t) => t.name === "Wake Up" && t.scheduled_time);
    const [wh, wm] = (wakeTask?.scheduled_time || child.wake_time || "07:00").slice(0, 5).split(":").map(Number);
    const dayStart = wh * 60 + wm;
    const bedtimeTask = tasksWithDaySpecificTimes.find(
      (t) => t.name === "Bedtime" && t.scheduled_time
    );
    const bedtimeStr = (bedtimeTask?.scheduled_time || child.bedtime || "").slice(0, 5);
    let dayEnd;
    if (bedtimeStr) {
      const [bh, bm] = bedtimeStr.split(":").map(Number);
      const end = bh * 60 + bm;
      if (end > dayStart) dayEnd = end;
    }
    return { dayStart, dayEnd };
  })();
  const findNextSlot = (duration) => {
    const start = resolveDropStart(occupied, dayBounds.dayStart, duration, dayBounds);
    if (start == null) return null;
    const h = Math.floor(start / 60);
    const m = start % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };
  const endsAt = /* @__PURE__ */ new Map();
  const startsAt = /* @__PURE__ */ new Map();
  tasksWithDaySpecificTimes.forEach((t) => {
    if (!t.scheduled_time || t.type === "floating") return;
    const [h, m] = t.scheduled_time.slice(0, 5).split(":").map(Number);
    endsAt.set(t.id, h * 60 + m + (t.duration ?? 0));
    startsAt.set(t.id, h * 60 + m);
  });
  const placedAt = /* @__PURE__ */ new Map();
  for (const task of orderByAnchors(tasksWithDaySpecificTimes)) {
    const hasTime = task.scheduled_time && task.scheduled_time.toString().trim() !== "";
    if (hasTime || task.type === "floating") continue;
    const duration = task.duration ?? 30;
    const anchorEnd = task.after_task_id ? endsAt.get(task.after_task_id) : void 0;
    const anchorStart = task.before_task_id ? startsAt.get(task.before_task_id) : void 0;
    const atMinute = (start) => start == null ? null : `${Math.floor(start / 60).toString().padStart(2, "0")}:${(start % 60).toString().padStart(2, "0")}`;
    let slot;
    if (anchorEnd != null) {
      slot = atMinute(resolveDropStart(occupied, anchorEnd, duration, dayBounds));
    } else if (anchorStart != null) {
      slot = atMinute(resolveDropStart(occupied, Math.max(dayBounds.dayStart, anchorStart - duration), duration, dayBounds));
    } else if (task.placementHint) {
      const [hh, hm] = task.placementHint.slice(0, 5).split(":").map(Number);
      const hint = hh * 60 + hm;
      const clamped = Math.max(dayBounds.dayStart, Math.min((dayBounds.dayEnd ?? 24 * 60) - duration, hint));
      slot = atMinute(resolveDropStart(occupied, hint, duration, dayBounds) ?? clamped);
    } else {
      slot = findNextSlot(duration);
    }
    if (!slot) continue;
    const [h, m] = slot.split(":").map(Number);
    occupied.push({ start: h * 60 + m, end: h * 60 + m + duration });
    occupied.sort((a, b) => a.start - b.start);
    endsAt.set(task.id, h * 60 + m + duration);
    startsAt.set(task.id, h * 60 + m);
    placedAt.set(task.id, slot);
  }
  const withAutoPlacement = tasksWithDaySpecificTimes.map((task) => placedAt.has(task.id) ? { ...task, scheduled_time: placedAt.get(task.id) } : task);
  const toMin4 = (hhmm3) => {
    if (!hhmm3) return Number.POSITIVE_INFINITY;
    const [h, m] = hhmm3.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };
  const sortedTasks = withAutoPlacement.sort((a, b) => {
    const ta = toMin4(a.scheduled_time);
    const tb = toMin4(b.scheduled_time);
    if (ta !== tb) return ta - tb;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const schoolTask = sortedTasks.find((t) => t.name.toLowerCase() === "school");
  let finalTasks = sortedTasks;
  if (schoolTask && schoolTask.scheduled_time && schoolTask.duration) {
    const schoolStart = schoolTask.scheduled_time.slice(0, 5);
    const [schoolHours, schoolMinutes] = schoolStart.split(":").map(Number);
    const schoolEndMinutes = schoolHours * 60 + schoolMinutes + schoolTask.duration;
    const schoolEnd = `${Math.floor(schoolEndMinutes / 60).toString().padStart(2, "0")}:${(schoolEndMinutes % 60).toString().padStart(2, "0")}`;
    finalTasks = sortedTasks.filter((task) => {
      if (task.name.toLowerCase() !== "lunch") return true;
      if (!task.scheduled_time) return true;
      const lunchTime = task.scheduled_time.slice(0, 5);
      return lunchTime < schoolStart || lunchTime >= schoolEnd;
    });
  }
  return clampScheduleOverlaps(finalTasks).map((task) => {
    const start = toMin4(task.scheduled_time);
    if (!Number.isFinite(start) || !task.duration || start + task.duration <= 24 * 60) return task;
    return { ...task, duration: 24 * 60 - start };
  });
}
function todaysChores(tasksWithCompletion) {
  const currentDay = getPSTDayName();
  const todayStr = getPSTDateString();
  return tasksWithCompletion.filter((task) => {
    if (task.type !== "floating") return false;
    if (!task.is_active) return false;
    if (task.is_recurring && task.recurring_days?.length) {
      return task.recurring_days.includes(currentDay) && !task.excluded_dates?.includes(todayStr) && !repeatEnded(task, todayStr);
    }
    if (task.task_date) return task.task_date === todayStr;
    if (task.created_at) {
      const createdDate = toPSTDateString(task.created_at);
      return createdDate === todayStr;
    }
    return false;
  });
}

// src/lib/devicePlan.ts
function devicePlan(rows) {
  const child = childFromRow(rows.child);
  const today = getPSTDateString();
  const tasksWithCompletion = rows.tasks.map((task) => ({
    ...task,
    isCompleted: rows.completions.some((c) => c.task_id === task.id)
  }));
  const todaysHoliday = rows.holidays.find((h) => today >= h.date && today <= (h.end_date || h.date));
  const schedule = buildTodaysSchedule({ tasksWithCompletion, child, holidays: rows.holidays, todaysHoliday });
  return buildDayPlan({
    child,
    schedule,
    chores: todaysChores(tasksWithCompletion),
    completions: rows.completions,
    rewards: rows.rewards.filter((r) => r.is_active).sort((a, b) => a.cost - b.cost),
    purchases: rows.purchases,
    restDay: isRestDate(child, today),
    starts: rows.sessions.filter((s) => toPSTDateString(s.started_at) === today),
    notes: rows.notes,
    freeTime: rows.freeTime ?? [],
    holidays: rows.holidays
  });
}
export {
  SYSTEM_TASK_NAMES,
  devicePlan,
  getPSTDateString,
  missingSystemTaskRows,
  normalizeOutfit,
  resolvePetColour,
  resolvePetId,
  toPSTDateString
};
export const PLAN_REV = "11545a3715";
