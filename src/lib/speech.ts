import { soundsEnabled } from "@/lib/sounds";

/**
 * Spoken prompts for Picture view ("Time for Bath!"), using the browser's
 * own voice. They follow the same per-device sound switch as the chimes. A
 * tap on the speaker replaces whatever is being said; a scheduled prompt
 * waits its turn, so with children side by side one child's prompt doesn't
 * cut off another's, and the same words from two screens are said once.
 */

let lastSaid = { text: "", at: 0 };

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** A friendly English voice when the device has one. */
const pickVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /en[-_](US|GB)/i.test(v.lang) && /samantha|female|google us english|aria|jenny/i.test(v.name)) ??
    voices.find(v => /^en/i.test(v.lang)) ??
    null
  );
};

export const speak = (text: string, opts: { force?: boolean } = {}) => {
  // `force`: the child tapped the speaker button, so they asked to hear it.
  if (!canSpeak() || (!opts.force && !soundsEnabled())) return;
  const now = Date.now();
  if (!opts.force && text === lastSaid.text && now - lastSaid.at < 5000) return;
  lastSaid = { text, at: now };
  try {
    if (opts.force) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 0.92;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech unavailable: the words are on screen anyway */
  }
};
