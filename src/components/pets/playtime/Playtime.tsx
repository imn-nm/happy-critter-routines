import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Timer, X } from "lucide-react";
import CritterPet from "@/components/critters/CritterPet";
import { useMotionPrefs } from "@/lib/motion";
import { petNick } from "../petCatalog";
import { Pix } from "../pixel/pix";
import { ACCESSORIES, type PetOutfit } from "../pixel/accessories";
import PixelIcon from "./PixelIcon";
import DressUp from "./DressUp";
import BathTime from "./BathTime";
import CarrotCatch from "./CarrotCatch";

interface PlaytimeProps {
  childId: string;
  petType: string;
  /** Seconds of free time left; Playtime closes on its own at zero. */
  secondsLeft: number;
  onClose: () => void;
  outfit: PetOutfit | null;
  onOutfitChange: (outfit: PetOutfit | null) => void;
  /** Picture view (pre-readers): icons instead of words; the words stay for screen readers. */
  picture?: boolean;
}

type Mode = "menu" | "dress" | "bath" | "catch";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const DUCK = [".YYY...", "YYkYOO.", ".YYY...", "YYYYYYY", "YYYYYYy", ".yyyyy."];
const CARROT = ["G.g.G", ".GgG.", ".OOO.", ".OOo.", ".OOo.", "..Oo.", "..O.."];

/**
 * Free-time play with the rabbit. Opens from the free-time pet and closes
 * itself when free time ends. Nothing here pays stars and nothing can be
 * failed: it's just for fun, and the outfit picked in dress-up follows the
 * rabbit everywhere it appears.
 */
const Playtime = ({ childId, petType, secondsLeft, onClose, outfit, onOutfitChange, picture }: PlaytimeProps) => {
  const { t } = useMotionPrefs();
  const nick = petNick(petType);
  const [mode, setMode] = useState<Mode>("menu");

  // Free time is over: leave so the next task takes the stage.
  useEffect(() => {
    if (secondsLeft <= 0) onClose();
  }, [secondsLeft, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode === "menu") onClose();
      else setMode("menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const icons = useMemo(() => {
    const hat = new Pix();
    ACCESSORIES.hat.draw(hat, "front");
    return { hat, duck: new Pix().stamp(DUCK), carrot: new Pix().stamp(CARROT) };
  }, []);

  const activities: { id: Exclude<Mode, "menu">; label: string; pix: Pix }[] = [
    { id: "dress", label: "Dress up", pix: icons.hat },
    { id: "bath", label: "Bath time", pix: icons.duck },
    { id: "catch", label: "Carrot catch", pix: icons.carrot },
  ];
  const title = mode === "dress" ? "Dress up" : mode === "bath" ? "Bath time" : mode === "catch" ? "Carrot catch" : `Play with ${nick}`;
  const current = activities.find(a => a.id === mode);

  return (
    <motion.div
      className="fixed inset-0 z-[75] flex flex-col overflow-y-auto"
      style={{ background: "radial-gradient(120% 80% at 50% 110%, #3b2a72 0%, #1a0f3a 55%, #08011a 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={t({ duration: 0.25 })}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Top bar: a way back and how long free time lasts. */}
      <div className="flex items-center justify-between px-sp-3 pt-sp-4">
        <button
          type="button"
          onClick={() => (mode === "menu" ? onClose() : setMode("menu"))}
          aria-label={mode === "menu" ? "Back to my day" : "Back to Playtime"}
          className={picture
            ? "flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-fog-50 hover:bg-white/10"
            : "flex h-11 w-11 items-center justify-center rounded-full text-fog-50 hover:bg-white/10"}
        >
          {/* Picture view: X leaves Playtime, the arrow goes back to the games. */}
          {picture ? (
            mode === "menu" ? <X className="h-7 w-7" aria-hidden /> : <ArrowLeft className="h-7 w-7" aria-hidden />
          ) : (
            <ArrowLeft className="h-5 w-5" />
          )}
        </button>
        {picture ? (
          <span className="flex items-center gap-2 text-18 tabular-nums text-fog-200">
            <Timer className="h-6 w-6" aria-hidden />
            <span className="sr-only">Free time</span>
            {fmt(secondsLeft)}
          </span>
        ) : (
          <span className="text-14 tabular-nums text-fog-200">Free time · {fmt(secondsLeft)}</span>
        )}
        <span className={picture ? "w-12" : "w-11"} />
      </div>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-sp-4 pb-[max(var(--sp-8),calc(env(safe-area-inset-bottom)+var(--sp-4)))] pt-sp-2">
        {picture ? (
          // The game's own picture stands in for its name; the menu needs no heading.
          <h2 className={current ? "mb-sp-3 flex justify-center" : "flex justify-center"}>
            {current && <PixelIcon pix={current.pix} scale={4} />}
            <span className="sr-only">{title}</span>
          </h2>
        ) : (
          <h2 className="mb-sp-3 text-center text-20 font-semibold text-fog-50">{title}</h2>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={t({ duration: 0.18 })}
          >
            {mode === "menu" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-sp-6">
                <CritterPet petType={petType} outfit={outfit} mood="happy" size={192} interactive picture={picture} prompt={picture ? null : "Let's play!"} />
                <div className="grid w-full grid-cols-3 gap-sp-3">
                  {activities.map(a =>
                    picture ? (
                      // Picture tiles: one big drawing per game, the name only for screen readers.
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setMode(a.id)}
                        aria-label={a.label}
                        className="flex min-h-[128px] items-center justify-center rounded-[22px] border border-iris-400/30 bg-[#271447] p-3 shadow-sh-md hover:bg-[#31195a]"
                      >
                        <PixelIcon pix={a.pix} scale={7} />
                      </button>
                    ) : (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setMode(a.id)}
                        className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[22px] border border-iris-400/30 bg-[#271447] px-2 py-3 text-14 font-semibold text-fog-50 shadow-sh-md hover:bg-[#31195a]"
                      >
                        <PixelIcon pix={a.pix} scale={4} />
                        {a.label}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
            {mode === "dress" && <DressUp outfit={outfit} onChange={onOutfitChange} nick={nick} picture={picture} />}
            {mode === "bath" && <BathTime nick={nick} picture={picture} />}
            {mode === "catch" && <CarrotCatch childId={childId} outfit={outfit} nick={nick} picture={picture} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Playtime;
