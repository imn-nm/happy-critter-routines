import { FLOOR, MID, anchor, sleepSpot } from "./rig";
import {
  C, back, bubble, bump, butterfly, clamp, confetti, faded, heart, inn, io, key, leaf, lerp, out, pop, poof,
  puffs, seg, spring, starPop, zed,
} from "./props";
import { bez, blink, faceYou, hop, once, pose, type MotionClip } from "./kit";

/*
 * The rabbit being itself: resting, greeting, cheering, noticing things,
 * falling asleep and chasing a leaf. Quirks on purpose: it hiccups and is
 * embarrassed, and wiggles before hopping after a leaf.
 */

// ---------- Idle: twelve seconds of small life ----------
export const Idle: MotionClip = {
  intro: 0, loop: 12, outro: 0,
  at: (_ph, t) => {
    const p = pose();
    blink(p, t, 0.8, 4.4, 9.4, 9.78);
    // One ear flops and springs back.
    p.earL = key(t, [[2, 0], [2.14, -0.4, out], [2.34, 0.1], [2.5, -0.04], [2.64, 0]]);
    // A look at you.
    const look = key(t, [[3.6, 0], [3.85, 1, out], [5, 1], [5.25, 0]]);
    p.eyes.x = look;
    p.head.rot = 0.05 * look;
    // A sniff.
    p.sniff = Math.abs(Math.sin((t - 5.8) * 14)) * bump(t, 5.8, 6.7);
    // A hiccup, and the embarrassment after it.
    const hic = bump(t, 7.2, 7.5);
    p.y -= 2.2 * hic;
    p.sy *= 1 + 0.07 * hic;
    if (t > 7.2 && t < 7.75) p.mouth = "o";
    p.earS = 1 + 0.1 * key(t, [[7.2, 0], [7.3, 1, out], [7.9, 1], [8.3, 0]]);
    p.eyes.x += key(t, [[7.7, 0], [7.9, -1], [8.2, -1], [8.4, 1], [8.7, 1], [8.9, 0]]);
    p.blush = key(t, [[7.5, 0], [7.8, 1], [8.8, 1], [9.4, 0]]);
    // A happy tail and a shift of weight.
    const wag = bump(t, 10.1, 11.5);
    p.tail = 0.35 * Math.sin(t * 16) * wag;
    p.lean = 0.02 * Math.sin(t * 8) * wag;
    return { pose: p };
  },
};

// ---------- Wave: turns to the child and waves. Only the arm moves ----------
export const Wave = once(3.5, t => {
  const p = pose();
  faceYou(p, t, 0.25, 2.8);
  const up = key(t, [[0.6, 0], [0.9, 1, back], [2.45, 1], [2.7, 0]]);
  // One arm, tilting between half and fully raised. The other stays tucked in.
  p.armL = { len: clamp(up), rot: clamp(up) * (0.75 + 0.25 * Math.sin((t - 0.9) * 13)) };
  if (up > 0.2) p.mouth = t > 1.2 && t < 2.2 ? "yay" : "smile";
  p.eyes.happy = t > 1.2 && t < 2.2;
  p.blush = clamp(up);
  blink(p, t, 2.5, 3.1);
  return { pose: p };
});

// ---------- Celebrate: two big jumps with ears flying, confetti, and a bounce on the spot ----------
export const Celebrate = once(4.4, t => {
  const p = pose();
  faceYou(p, t, 0.2, 3.8);
  hop(p, t, 0.62, 0.95, 12);
  hop(p, t, 1.6, 0.7, 7);
  const party = seg(t, 0.6, 0.8) * (1 - seg(t, 3.5, 3.75));
  const dance = key(t, [[2.3, 0], [2.5, 1], [3.3, 1], [3.5, 0]]);
  const beat = Math.sin((t - 2.3) * 12);
  // The little dance stays on the spot: a bounce on each beat, no side to side.
  p.y -= 1.2 * Math.abs(beat) * dance;
  // Arms as in the pixel clip: straight out in the T pose through the jumps,
  // then both flicking up a cell together at the end.
  const flap = 0.25 * (0.5 + 0.5 * Math.sin((t - 2.3) * 19)) * dance;
  p.armL = { len: party, rot: flap };
  p.armR = { len: party, rot: flap };
  // At the top of the first jump the ears go flat out and flutter.
  const apex = bump(t, 0.9, 1.4);
  p.earL -= 0.3 * apex;
  p.earR += 0.3 * apex;
  if (party > 0.5) { p.mouth = "yay"; p.eyes.happy = true; }
  p.blush = party;
  blink(p, t, 4.05);
  return {
    pose: p,
    // The confetti falls behind, so it never covers the face.
    back: g => {
      confetti(g, t - 0.8, MID - 13, 50, 18, 1, 1.25);
      confetti(g, t - 0.8, MID + 13, 50, 18, 2, 1.25);
      confetti(g, t - 1.78, MID - 9, 48, 12, 3, 1.3);
      confetti(g, t - 1.78, MID + 9, 48, 12, 4, 1.3);
    },
    front: g => {
      starPop(g, t - 2.5, MID - 16, 24, 1);
      starPop(g, t - 2.9, MID + 16, 22, 2);
    },
  };
});

// ---------- Encourage: two arm pumps and a heart sent your way ----------
export const Encourage = once(3.5, t => {
  const p = pose();
  faceYou(p, t, 0.2, 2.95);
  const on = key(t, [[0.55, 0], [0.75, 1, back], [2.6, 1], [2.85, 0]]);
  const pump = t > 0.75 && t < 2.15 ? Math.max(0, Math.sin(((t - 0.75) * Math.PI * 2) / 0.7)) : 0;
  p.armL = { len: clamp(on, 0, 1.1), rot: 0.2 + 0.9 * pump };
  p.armR = { len: clamp(on, 0, 1.1), rot: 0.2 + 0.9 * pump };
  p.y -= 1.8 * pump;
  p.sy *= 1 + 0.04 * pump;
  p.head.y -= 0.6 * pump;
  if (on > 0.3) { p.mouth = pump > 0.3 ? "yay" : "smile"; p.eyes.happy = true; }
  p.blush = clamp(on);
  blink(p, t, 3.2);
  return {
    pose: p,
    front: g => {
      const grow = back(seg(t, 1.0, 1.3));
      const rise = io(seg(t, 1.25, 2.9));
      const hx = lerp(MID, MID + 15, out(seg(t, 1.0, 1.7))) + 1.5 * Math.sin(t * 5) * rise;
      const hy = 44 - 26 * rise;
      faded(g, 1 - seg(t, 2.5, 2.9), () => {
        heart(g, hx, hy, 1.7 * grow * (1 + 0.12 * Math.sin(t * 12)), C.coral);
        heart(g, hx - 5, hy + 6, 0.8 * back(seg(t, 1.4, 1.7)), C.pink);
        heart(g, hx + 4, hy + 9, 0.6 * back(seg(t, 1.7, 2.0)), C.pink);
      });
    },
  };
});

// ---------- Curious: ears up, watches a butterfly go by overhead, sniffs, is pleased ----------
// The pixel clip's routine, beat for beat, with the new butterfly.
export const Curious = once(3.7, t => {
  const p = pose();
  // Ears prick up, then the eyes go up to it.
  p.earS = 1 + 0.09 * seg(t, 0.33, 0.45) * (1 - seg(t, 1.33, 1.45));
  p.eyes.y = -seg(t, 0.67, 0.8) * (1 - seg(t, 1.33, 1.45));
  // A good long sniff.
  if (t > 1.33 && t < 2.33) p.sniff = Math.max(0, Math.sin((t - 1.33) * Math.PI * 6));
  // Pleased, a blink, and back to rest.
  if (t >= 2.33 && t < 2.67) p.eyes.happy = true;
  p.blush = seg(t, 2.33, 2.4) * (1 - seg(t, 2.67, 2.8));
  blink(p, t, 2.67);
  return {
    pose: p,
    front: g => {
      const u = (t - 0.33) / 2.34;
      if (u <= 0 || u >= 1) return;
      butterfly(g, -6 + 86 * u, 5 + 3 * Math.sin(t * 9.6), Math.abs(Math.sin(t * 19)), 0.12 * Math.sin(t * 9.6));
    },
  };
});

// ---------- Sleepy: a yawn, two nods, a flop, a nose bubble; then a stretch awake ----------
const sleepIntro = (t: number) => {
  const p = pose();
  const yawn = Math.sqrt(bump(t, 0.3, 1.5));
  if (t > 0.3 && t < 1.5) p.mouth = yawn > 0.6 ? "yawn" : "o";
  p.eyes.open = key(t, [[0, 1], [0.4, 0.12], [1.4, 0.12], [1.65, 0.5], [2.3, 0.25], [2.42, 1, out], [2.7, 0.5], [3.3, 0.1]]);
  p.head.y = key(t, [[0.3, 0], [0.8, -1.2], [1.4, 0], [1.7, 0.3], [2.3, 3.2, inn], [2.42, -0.4, out], [2.6, 0], [3.3, 3, inn]]);
  p.head.rot = key(t, [[0.3, 0], [0.8, 0.1], [1.4, 0], [2.3, -0.12, inn], [2.42, 0.03, out], [2.6, 0], [3.3, -0.1, inn]]);
  p.earS = 1 + 0.1 * yawn;
  p.sy *= 1 + 0.04 * yawn;
  if (t < 3.55) {
    const flop = inn(seg(t, 3.3, 3.55));
    p.sy *= 1 - 0.38 * flop; p.sx *= 1 + 0.16 * flop;
  } else {
    p.view = "sleep";
    p.eyes.open = 0;
    const s = spring(seg(t, 3.55, 4.1));
    p.sy = lerp(0.7, 1, s); p.sx = lerp(1.12, 1, s);
  }
  return { pose: p, front: (g: CanvasRenderingContext2D) => puffs(g, t - 3.55, MID, 18) };
};
const SNOOZE = 4.8;
const sleepLoop = (t: number) => {
  const p = pose();
  p.view = "sleep";
  p.eyes.open = 0;
  const r = 3.6 * Math.pow(seg(t, 0.4, 3.6), 0.8) * (t < 3.6 ? 1 : 0);
  p.earL = 1.3 * bump(t, 3.6, 3.95);
  return {
    pose: p,
    front: (g: CanvasRenderingContext2D) => {
      // Where this character's nose and head are when it sleeps (the robot dozes standing).
      const [nx, ny] = sleepSpot(27.6, 48.2);
      const [zx, zy] = sleepSpot(41, 31);
      const bx = nx - r * 0.85, by = ny - r * 0.35 + 0.3 * Math.sin(t * 3);
      bubble(g, bx, by, r * (1 + 0.04 * Math.sin(t * 7)));
      pop(g, nx - 3.06, ny - 1.2, 3.6, seg(t, 3.6, 3.9));
      for (let i = 0; i < 3; i++) {
        const a = (t / SNOOZE + i / 3) % 1;
        faded(g, Math.sin(Math.PI * a) ** 0.6, () =>
          zed(g, zx + 10 * a + 1.2 * Math.sin(a * 7 + i), zy - 17 * a, 0.9 + 1.4 * a, C.lav));
      }
    },
  };
};
const sleepOutro = (t: number) => {
  const p = pose();
  if (t < 1) {
    p.view = "sleep";
    p.eyes.open = key(t, [[0, 0], [0.3, 0.45], [0.6, 0.45], [0.75, 1]]);
    p.earL = 1.2 * bump(t, 0.25, 0.5);
    p.sy = 1 - 0.2 * inn(seg(t, 0.85, 1));
    return { pose: p };
  }
  const up = spring(seg(t, 1, 1.5));
  p.sy = lerp(1.2, 1, up);
  p.sx = lerp(0.9, 1, up);
  p.y = -3 * bump(t, 1, 1.35);
  // A long stretch and a yawn, then a shake.
  const stretch = bump(t, 1.35, 2.3);
  p.sy *= 1 + 0.08 * stretch;
  p.earS = 1 + 0.12 * stretch;
  p.head.rot = 0.1 * stretch;
  if (t > 1.4 && t < 2.25) { p.mouth = stretch > 0.6 ? "yawn" : "o"; p.eyes.open = 0.12; }
  const shake = bump(t, 2.3, 2.75);
  p.x = 1.2 * Math.sin((t - 2.3) * 40) * shake;
  p.earL = 0.15 * Math.sin((t - 2.3) * 40) * shake;
  p.earR = 0.15 * Math.sin((t - 2.3) * 40) * shake;
  blink(p, t, 2.8);
  return { pose: p };
};
export const Sleepy: MotionClip = {
  intro: 4.1, loop: SNOOZE, outro: 3,
  // Night while it sleeps; the room goes from dawn to morning as it wakes.
  at: (ph, t) => (ph === "intro" ? { ...sleepIntro(t), light: 0 } : ph === "loop" ? { ...sleepLoop(t), light: 0 } : { ...sleepOutro(t), light: seg(t, 0.1, 2.2) }),
};

// ---------- LeafChase: a leaf lands on an ear, gets shaken off, and is hopped after ----------
const EAR_AT = [30.6, 13.6] as const;
const LEAF_REST = [12, FLOOR - 1.4] as const;
export const LeafChase = once(9.2, t => {
  const p = pose();
  // Watching it fall, then looking up at its own ear.
  p.earS = 1 + 0.1 * seg(t, 0.2, 0.5) * (1 - seg(t, 2, 2.1));
  const up = seg(t, 0.2, 0.6) * (1 - seg(t, 3.3, 3.4));
  p.eyes.y = -up;
  p.eyes.x = -0.6 * seg(t, 2, 2.2) * (1 - seg(t, 3.3, 3.4));
  const flick = bump(t, 2.5, 2.75) + bump(t, 2.9, 3.15);
  p.earL = -0.32 * flick;
  // Shake it off and watch it drop.
  p.head.rot = 0.14 * Math.sin((t - 3.3) * 28) * bump(t, 3.3, 3.75);
  if (t >= 3.4 && t < 5.15) { p.eyes.x = -1; p.eyes.y = lerp(-1, 1, seg(t, 3.5, 4.3)); }
  // The wiggle before the pounce.
  const crouch = io(seg(t, 4.35, 4.6)) * (1 - seg(t, 5.13, 5.16));
  p.sy *= 1 - 0.16 * crouch; p.sx *= 1 + 0.1 * crouch;
  p.lean = -0.06 * crouch;
  p.tail = 0.5 * Math.sin(t * 30) * crouch;
  p.x = 0.7 * Math.sin(t * 30) * crouch;
  // Two small hops over to it, low to the ground. No big jump.
  if (t >= 5.15 && t < 7.4) p.x = -13 * seg(t, 5.15, 5.7);
  hop(p, t, 5.13, 0.3, 2.4);
  hop(p, t, 5.42, 0.3, 2.4);
  // It's gone. Ears down for a moment, then never mind.
  if (t >= 5.9 && t < 7.2) { p.eyes.x = -1; p.eyes.y = -1; p.mouth = t < 6.6 ? "o" : "smile"; }
  const droop = seg(t, 6.0, 6.2) * (1 - seg(t, 6.8, 7));
  p.earL -= 0.28 * droop; p.earR += 0.28 * droop;
  // Turn round, two hops home, turn back.
  if (t >= 7.2) {
    // It faces the other way from the top of a small hop, without ever going thin.
    const a = seg(t, 7.2, 7.44), b = seg(t, 8.6, 8.84);
    const hopRound = Math.sin(Math.PI * a) + Math.sin(Math.PI * b);
    p.turn = (a < 0.5 || b >= 0.5 ? 1 : -1) * (1 - 0.14 * hopRound);
    p.y -= 2.4 * hopRound;
    p.x = -13 + 13 * seg(t, 7.44, 8.6);
    hop(p, t, 7.44, 0.58, 3.6);
    hop(p, t, 8.02, 0.58, 3.6);
  }
  blink(p, t, 8.95);
  return {
    pose: p,
    front: g => {
      const [ax, ay] = anchor("tip");
      const EAR_TIP = [EAR_AT[0] + ax, EAR_AT[1] + ay] as const;
      let x: number, y: number, rot: number;
      if (t < 2) {
        const u = t / 2;
        x = EAR_TIP[0] + 10 * Math.sin(u * 7) * (1 - u);
        y = lerp(-5, EAR_TIP[1], u);
        rot = 0.7 * Math.cos(u * 7) * (1 - u);
      } else if (t < 3.34) {
        x = EAR_TIP[0] - 1.6 * flick; y = EAR_TIP[1] - 1.4 * flick; rot = -0.3 * flick;
      } else if (t < 4.3) {
        const u = seg(t, 3.34, 4.3);
        x = lerp(EAR_TIP[0], LEAF_REST[0], io(u)) + 3 * Math.sin(u * 9) * (1 - u);
        y = bez(EAR_TIP[1], EAR_TIP[1] - 8, LEAF_REST[1], u);
        rot = 1.2 * Math.sin(u * 9) * (1 - u);
      } else if (t < 5.66) {
        [x, y] = LEAF_REST; rot = 0;
      } else {
        const u = seg(t, 5.66, 7.2);
        x = LEAF_REST[0] - 22 * u + 3 * Math.sin(u * 10);
        y = LEAF_REST[1] - 50 * out(u);
        rot = u * 9;
      }
      leaf(g, x, y, rot);
      puffs(g, t - 5.7, MID - 13, 13);
    },
  };
});
