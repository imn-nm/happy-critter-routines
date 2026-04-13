import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import SvgPet from "./SvgPet";

interface PlayModeProps {
  petType: "fox" | "panda";
  remainingSeconds: number;
  onTimeUp: () => void;
}

const foxTreats = ["🍗", "🫐", "🍯"];
const pandaTreats = ["🎋", "🍎", "🥕"];

const PlayMode = ({ petType, remainingSeconds: initialSeconds, onTimeUp }: PlayModeProps) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [mood, setMood] = useState<"idle" | "happy" | "excited" | "eating" | "trick">("happy");
  const [happiness, setHappiness] = useState(50);
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);
  const [treatIndex, setTreatIndex] = useState(0);

  const treats = petType === "fox" ? foxTreats : pandaTreats;

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) {
      onTimeUp();
      return;
    }
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds, onTimeUp]);

  const showFloating = (emoji: string) => {
    const id = Date.now();
    setFloatingEmoji({ emoji, id });
    setTimeout(() => setFloatingEmoji(null), 1200);
  };

  const bumpHappiness = () => {
    setHappiness(prev => Math.min(100, prev + 8));
  };

  const handleFeed = () => {
    setMood("eating");
    showFloating(treats[treatIndex]);
    setTreatIndex((treatIndex + 1) % treats.length);
    bumpHappiness();
    setTimeout(() => setMood("happy"), 1500);
  };

  const handleTrick = () => {
    setMood("trick");
    showFloating("✨");
    bumpHappiness();
    setTimeout(() => setMood("excited"), 1000);
    setTimeout(() => setMood("happy"), 2500);
  };

  const handlePet = () => {
    setMood("excited");
    showFloating("💕");
    bumpHappiness();
    setTimeout(() => setMood("happy"), 1500);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg, hsl(230 35% 12%), hsl(260 40% 16%))" }}>

      {/* Exit button */}
      <button
        onClick={onTimeUp}
        className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10 transition-colors"
        aria-label="Exit play mode"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Timer in corner */}
      <div className="absolute top-4 right-4 glass rounded-full px-4 py-2">
        <span className="text-sm font-bold text-foreground">{formatTime(seconds)}</span>
        <span className="text-xs text-muted-foreground ml-1">play time</span>
      </div>

      {/* Floating emoji */}
      {floatingEmoji && (
        <div
          key={floatingEmoji.id}
          className="absolute text-4xl pointer-events-none"
          style={{
            top: "30%",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "float-up 1.2s ease-out forwards",
          }}
        >
          {floatingEmoji.emoji}
        </div>
      )}

      {/* Pet */}
      <div className="mb-8">
        <SvgPet petType={petType} mood={mood} size={220} />
      </div>

      {/* Happiness bar */}
      <div className="w-48 mb-8">
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${happiness}%`, background: "linear-gradient(90deg, #F59E0B, #10B981)" }}
          />
        </div>
        <p className="text-xs text-center text-muted-foreground mt-1">Happiness</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleFeed}
          className="rounded-full px-6 py-3 text-lg font-medium"
          style={{ background: "hsl(30 80% 65%)", color: "white" }}
        >
          {treats[treatIndex]} Feed
        </Button>
        <Button
          onClick={handleTrick}
          className="rounded-full px-6 py-3 text-lg font-medium"
          style={{ background: "hsl(270 60% 65%)", color: "white" }}
        >
          ✨ Trick
        </Button>
        <Button
          onClick={handlePet}
          className="rounded-full px-6 py-3 text-lg font-medium"
          style={{ background: "hsl(340 60% 65%)", color: "white" }}
        >
          💕 Pet
        </Button>
      </div>

      <style>{`
        @keyframes float-up {
          0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-80px) scale(1.5); }
        }
      `}</style>
    </div>
  );
};

export default PlayMode;
