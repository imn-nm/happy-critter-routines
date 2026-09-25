import { soundsEnabled } from "@/lib/sounds";

/**
 * Spoken prompts for Picture view ("Time for Bath!"), using the browser's
 * own voice. They follow the same per-device sound switch as the chimes, and
 * a new prompt replaces one still being spoken rather than queueing behind it.
 */

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
  try {
    window.speechSynthesis.cancel();
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
