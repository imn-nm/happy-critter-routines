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

const play = (notes: Note[], type: OscillatorType = "sine") => {
  if (!soundsEnabled()) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = n.f;
    const peak = n.gain ?? 0.12;
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
  /** Bedtime. Two descending notes, quiet. */
  bedtime: () => play([{ f: E5, at: 0, len: 0.5, gain: 0.07 }, { f: C5, at: 0.5, len: 0.8, gain: 0.06 }]),
};
