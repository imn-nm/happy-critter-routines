import { useEffect, useRef, useState } from "react";
import { Heart, Hand, Carrot, BookOpen, Gamepad2, Sparkles, Star, Lock, Flower2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CritterPet from "@/components/critters/CritterPet";
import { petNick } from "./petCatalog";
import type { ClipName, PetActivity } from "./spriteClips";

type Memory = { day: string; text: string };
type Collection = { days: Record<string, number>; accessory: string; toy: PetActivity; memories: Memory[] };
const fresh = (): Collection => ({ days: {}, accessory: "none", toy: "reading", memories: [] });
const accessories = [
  { id: "none", name: "Just Biscuit", goal: 0, icon: Heart },
  { id: "star", name: "Star charm", goal: 1, icon: Star },
  { id: "flower", name: "Flower charm", goal: 3, icon: Flower2 },
  { id: "sparkles", name: "Sparkle charm", goal: 5, icon: Sparkles },
];

/** A device-local collection. Task counts are daily high-water marks, never currency. */
export default function PetClub({ childId, petType, day, completed }: {
  childId: string; petType: string; day: string; completed: number;
}) {
  const storageKey = `petpals:club:v1:${childId}`;
  const [collection, setCollection] = useState<Collection>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (!saved || !saved.days || !Array.isArray(saved.memories)) return fresh();
      return {
        days: Object.fromEntries(Object.entries(saved.days).filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isInteger(value) && Number(value) >= 0).map(([key, value]) => [key, Number(value)])),
        accessory: accessories.some(a => a.id === saved.accessory) ? saved.accessory : "none",
        toy: saved.toy === "gaming" ? "gaming" : "reading",
        memories: saved.memories.filter((m: Memory) => typeof m?.day === "string" && typeof m?.text === "string").slice(-60),
      };
    } catch { return fresh(); }
  });
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const [moment, setMoment] = useState<{ clip: ClipName; text: string; id: number } | null>(null);
  const lastAction = useRef(0);
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();
  const total = Object.values(collection.days).reduce((sum, count) => sum + count, 0);
  const nick = petNick(petType);

  useEffect(() => {
    setCollection(previous => completed > (previous.days[day] ?? 0)
      ? { ...previous, days: { ...previous.days, [day]: completed } } : previous);
  }, [completed, day]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(collection)); setSaved(true); }
    catch { setSaved(false); }
  }, [collection, storageKey]);
  useEffect(() => {
    if (!moment) return;
    const timer = window.setTimeout(() => setMoment(null), 6500);
    return () => window.clearTimeout(timer);
  }, [moment]);

  const remember = (text: string) => setCollection(previous => {
    if (previous.memories.some(m => m.day === day && m.text === text)) return previous;
    return { ...previous, memories: [...previous.memories, { day, text }].slice(-60) };
  });
  const react = (clip: ClipName, text: string, memory: string) => {
    const now = Date.now();
    if (now - lastAction.current < 2000) return;
    lastAction.current = now;
    setMoment({ clip, text, id: now });
    remember(memory);
  };
  useEffect(() => {
    if (!open || reduced) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible" || Date.now() - lastAction.current < 8000) return;
      setMoment({ clip: "Celebrate", text: "Surprise! A happy dance!", id: Date.now() });
      setCollection(previous => previous.memories.some(m => m.day === day && m.text === "Biscuit surprised us with a happy dance.")
        ? previous : { ...previous, memories: [...previous.memories, { day, text: "Biscuit surprised us with a happy dance." }].slice(-60) });
    }, 45000 + Math.random() * 45000);
    return () => window.clearTimeout(timer);
  }, [open, reduced, day]);
  const equipped = accessories.find(a => a.id === collection.accessory && total >= a.goal) ?? accessories[0];
  const Charm = equipped.icon;
  const buttonClass = "min-h-11 rounded-xl border border-iris-300/25 bg-iris-500/10 px-3 py-2 text-sm text-fog-50 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-iris-300 disabled:opacity-50";

  return <>
    <Button variant="secondary" className="w-full mt-3" onClick={() => setOpen(true)}><Heart className="mr-2 h-4 w-4" />Time with {nick}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[90dvh]">
        <DialogTitle>Time with {nick}</DialogTitle>
        <DialogDescription>A little play, a little love. Your collection grows as you finish tasks.</DialogDescription>
        <div className="relative rounded-3xl bg-iris-500/10 px-4 pt-8 pb-3">
          <div onPointerDown={event => { stroke.current = { x: event.clientX, y: event.clientY }; }}
            onPointerUp={event => {
              const start = stroke.current;
              stroke.current = null;
              if (start && Math.abs(event.clientX - start.x) > 35 && Math.abs(event.clientY - start.y) < 45)
                react("Encourage", "That feels lovely!", "We shared a cozy cuddle.");
            }} onPointerCancel={() => { stroke.current = null; }}>
            <CritterPet petType={petType} size={150} mood="happy" activity={collection.toy} interactive
              prompt={moment?.text} reaction={moment?.clip} reactionKey={moment?.id} />
          </div>
          {equipped.id !== "none" && <div className="absolute bottom-3 right-4 flex items-center gap-1 text-xs text-amber-200" aria-label={`Equipped: ${equipped.name}`}><Charm className="h-5 w-5" />{equipped.name}</div>}
          {moment?.clip === "Encourage" && <motion.div key={moment.id} aria-hidden className="absolute left-6 top-12 text-pink-300"
            initial={{ opacity: 0 }} animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 0], y: [0, -20, -35] }} transition={{ duration: reduced ? 0 : 2 }}><Heart className="h-7 w-7 fill-current" /></motion.div>}
        </div>
        <p className="text-xs text-fog-300 text-center">Stroke sideways over {nick}, or use Cuddle.</p>
        <div className="grid grid-cols-3 gap-2">
          <button className={buttonClass} onClick={() => react("Encourage", "That feels lovely!", "We shared a cozy cuddle.")}><Heart className="h-4 w-4" />Cuddle</button>
          <button className={buttonClass} onClick={() => react("Wave", "High five!", "We shared a high five.")}><Hand className="h-4 w-4" />High five</button>
          <button className={buttonClass} onClick={() => react("Eating", "Yum! Thank you!", "We enjoyed a carrot snack.")}><Carrot className="h-4 w-4" />Snack</button>
        </div>
        <p className="text-xs text-fog-300">Snacks are free. {nick} is always happy to see you.</p>
        <h3 className="font-medium text-fog-50">Choose a toy</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className={buttonClass} aria-pressed={collection.toy === "reading"} onClick={() => { setCollection(p => ({ ...p, toy: "reading" })); remember("We read a story together."); }}><BookOpen className="h-4 w-4" />{collection.toy === "reading" ? "✓ " : ""}Storybook</button>
          <button className={buttonClass} disabled={total < 2} aria-pressed={collection.toy === "gaming"} onClick={() => { setCollection(p => ({ ...p, toy: "gaming" })); remember("We played a game together."); }}><Gamepad2 className="h-4 w-4" />{total < 2 ? "2 tasks to unlock" : `${collection.toy === "gaming" ? "✓ " : ""}Game console`}</button>
        </div>
        <h3 className="font-medium text-fog-50">Pet charms · {total} tasks celebrated</h3>
        <p className="text-xs text-fog-300">Charms decorate this cozy corner. Once unlocked, they stay yours.</p>
        <div className="grid grid-cols-2 gap-2">{accessories.map(item => {
          const Icon = total < item.goal ? Lock : item.icon;
          return <button key={item.id} className={buttonClass} disabled={total < item.goal} aria-pressed={equipped.id === item.id}
            onClick={() => { setCollection(p => ({ ...p, accessory: item.id })); if (item.id !== "none") remember(`We chose the ${item.name.toLowerCase()}.`); }}>
            <Icon className="h-4 w-4 shrink-0" />{total < item.goal ? `${item.name} · ${item.goal} tasks` : `${equipped.id === item.id ? "✓ " : ""}${item.name}`}
          </button>;
        })}</div>
        <button className={buttonClass} disabled={total < 4}
          onClick={() => react("Celebrate", "Our victory dance!", "We celebrated with our victory dance.")}>
          <Sparkles className="h-4 w-4" />{total < 4 ? "Victory dance · 4 tasks to unlock" : "Do our victory dance"}
        </button>
        <h3 className="font-medium text-fog-50">Our journal</h3>
        <p className="text-sm text-fog-200">Today we finished {collection.days[day] ?? 0} {(collection.days[day] ?? 0) === 1 ? "task" : "tasks"} together.</p>
        {collection.memories.length ? <ul className="space-y-2 text-sm text-fog-200">{collection.memories.slice(-8).reverse().map(m => <li key={`${m.day}:${m.text}`}><span className="text-xs text-iris-300">{m.day === day ? "Today" : m.day}</span> · {m.text}</li>)}</ul> : <p className="text-sm text-fog-300">Share a cuddle to start your journal.</p>}
        <p role="status" className="text-xs text-fog-300">{saved ? "Collection and memories saved on this device. Task progress is counted from visits on this device." : "Storage is unavailable. Your collection will last for this visit."}</p>
      </DialogContent>
    </Dialog>
  </>;
}
