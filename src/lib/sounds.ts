/**
 * Short synthesized cues for the child screen. No audio files: every cue is a
 * few sine notes from the Web Audio API, so they load instantly and sound the
 * same on the web test app and the eventual device.
 *
 * Browsers only allow audio after a user gesture, so `unlockSounds()` is wired
 * to the first pointer event on the child page. Enablement is a per-device
 * setting in localStorage; the parent toggles it in Settings on that device.
 */

const STORAGE_KEY = "petpals:sounds";

export const soundsEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundsEnabled = (on: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
};

let ctx: AudioContext | null = null;

// How loud, as a share of the cues as written (1). The MyToki Circle sets it from its sound slider.
let level = 1;
export const setSoundLevel = (k: number) => { level = Math.max(0, k); };

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
};

/** Call from a user gesture so later cues are allowed to play. */
export const unlockSounds = () => {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
};

interface Note {
  /** Hz */
  f: number;
  /** seconds from cue start */
  at: number;
  /** seconds */
  len: number;
  gain?: number;
}

// Children side by side often reach the same moment together (Dinner for
// everyone): the same cue from two screens at once plays once.
const lastPlayed = new Map<string, number>();

const play = (notes: Note[], type: OscillatorType = "sine") => {
  if (!soundsEnabled() || level <= 0) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const cue = `${type}:${notes.map(n => n.f).join(",")}`;
  if (Date.now() - (lastPlayed.get(cue) ?? 0) < 1000) return;
  lastPlayed.set(cue, Date.now());
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = n.f;
    const peak = (n.gain ?? 0.12) * level;
    g.gain.setValueAtTime(0.0001, now + n.at);
    g.gain.exponentialRampToValueAtTime(peak, now + n.at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.len);
    osc.connect(g).connect(c.destination);
    osc.start(now + n.at);
    osc.stop(now + n.at + n.len + 0.05);
  }
};

// Pentatonic-ish so nothing clashes: C5 E5 G5 C6.
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A4 = 440, G4 = 392;

export const sounds = {
  /** A new activity is starting. Two rising notes. */
  start: () => play([{ f: C5, at: 0, len: 0.18 }, { f: E5, at: 0.16, len: 0.28 }]),
  /** An important task or chore was done. Rising triad. */
  done: () => play([
    { f: C5, at: 0, len: 0.16 }, { f: E5, at: 0.12, len: 0.16 }, { f: G5, at: 0.24, len: 0.32 },
  ]),
  /** An important task ran out of time. Soft, not alarming. */
  stillToDo: () => play([{ f: G4, at: 0, len: 0.3, gain: 0.08 }, { f: A4, at: 0.3, len: 0.4, gain: 0.08 }]),
  /** A grown-up said yes to a reward. Little fanfare. */
  approved: () => play([
    { f: C5, at: 0, len: 0.14 }, { f: E5, at: 0.1, len: 0.14 }, { f: G5, at: 0.2, len: 0.14 },
    { f: C6, at: 0.32, len: 0.5, gain: 0.14 },
  ]),
  /** Five minutes until the next thing. A gentle "heads up", two notes. */
  soon: () => play([{ f: A4, at: 0, len: 0.22, gain: 0.08 }, { f: E5, at: 0.2, len: 0.36, gain: 0.08 }]),
  /**
   * MyToki's morning alarm (the web Circle): C5 E5 G5 E5 like a music box. The device loops it every
   * 2 s while it rings, quiet at first (step 0), then a little louder (1), then full (2).
   */
  alarm: (step: 0 | 1 | 2 = 2) => {
    const gain = [0.035, 0.055, 0.08][step];
    play([C5, E5, G5, E5].map((f, i) => ({ f, at: i * 0.22, len: 0.6, gain })));
  },
  /** Bedtime. Two descending notes, quiet. */
  bedtime: () => play([{ f: E5, at: 0, len: 0.5, gain: 0.07 }, { f: C5, at: 0.5, len: 0.8, gain: 0.06 }]),
};

/** The same notes with no "played a moment ago" check: a game's little sounds repeat quickly. */
const playNow = (notes: Note[], type: OscillatorType = "sine") => {
  if (!soundsEnabled() || level <= 0) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = n.f;
    g.gain.setValueAtTime(0.0001, now + n.at);
    g.gain.exponentialRampToValueAtTime((n.gain ?? 0.04) * level, now + n.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.len);
    osc.connect(g).connect(c.destination);
    osc.start(now + n.at);
    osc.stop(now + n.at + n.len + 0.05);
  }
};

/** MyToki's game sounds (the web Circle): short and quiet, under the chimes. */
export const gameSounds = {
  pop: () => playNow([{ f: 1568, at: 0, len: 0.06 }, { f: 2093, at: 0.03, len: 0.07, gain: 0.03 }]),
  eat: () => playNow([{ f: 988, at: 0, len: 0.06 }, { f: 1319, at: 0.05, len: 0.09, gain: 0.035 }]),
  bounce: () => playNow([{ f: 440, at: 0, len: 0.07, gain: 0.05 }]),
  flip: () => playNow([{ f: 1760, at: 0, len: 0.04, gain: 0.025 }], "triangle"),
  miss: () => playNow([{ f: C5, at: 0, len: 0.12, gain: 0.045 }, { f: G4, at: 0.1, len: 0.18, gain: 0.045 }]),
  win: () => playNow([{ f: E5, at: 0, len: 0.12, gain: 0.055 }, { f: G5, at: 0.1, len: 0.12, gain: 0.055 }, { f: C6, at: 0.2, len: 0.3, gain: 0.055 }]),
  lose: () => playNow([{ f: E5, at: 0, len: 0.16, gain: 0.05 }, { f: C5, at: 0.14, len: 0.16, gain: 0.05 }, { f: G4, at: 0.28, len: 0.32, gain: 0.05 }]),
  power: () => playNow([784, 988, 1175, 1568].map((f, i) => ({ f, at: i * 0.07, len: i === 3 ? 0.2 : 0.09, gain: 0.045 }))),
};
