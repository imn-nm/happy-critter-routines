import { cn } from "@/lib/utils";

type PetMood = "idle" | "happy" | "excited" | "eating" | "trick" | "sleep";

interface SvgPetProps {
  petType: "fox" | "panda";
  mood?: PetMood;
  size?: number;
  className?: string;
}

const SvgPet = ({ petType, mood = "idle", size = 200, className }: SvgPetProps) => {
  const isFox = petType === "fox";

  const getMoodAnimations = () => {
    switch (mood) {
      case "happy": return "svg-pet-bounce";
      case "excited": return "svg-pet-bounce svg-pet-wag-fast";
      case "eating": return "svg-pet-nom";
      case "trick": return "svg-pet-spin";
      case "sleep": return "svg-pet-breathe";
      default: return "svg-pet-breathe";
    }
  };

  if (isFox) {
    return (
      <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
        <style>{`
          @keyframes svg-blink {
            0%, 90%, 100% { opacity: 1; }
            95% { opacity: 0; transform: scaleY(0.1); }
          }
          @keyframes svg-wag {
            0%, 100% { transform: rotate(-10deg); }
            50% { transform: rotate(15deg); }
          }
          @keyframes svg-wag-fast {
            0%, 100% { transform: rotate(-15deg); }
            50% { transform: rotate(20deg); }
          }
          @keyframes svg-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes svg-breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }
          @keyframes svg-nom {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.95); }
          }
          @keyframes svg-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes svg-zzz {
            0%, 100% { opacity: 0; transform: translateY(0) scale(0.8); }
            50% { opacity: 1; transform: translateY(-15px) scale(1); }
          }
          .svg-pet-blink { animation: svg-blink 4s infinite; transform-origin: center; }
          .svg-pet-tail { animation: svg-wag 1.5s ease-in-out infinite; transform-origin: 80% 75%; }
          .svg-pet-tail-fast { animation: svg-wag-fast 0.6s ease-in-out infinite; transform-origin: 80% 75%; }
          .svg-pet-bounce { animation: svg-bounce 1s ease-in-out infinite; }
          .svg-pet-breathe { animation: svg-breathe 3s ease-in-out infinite; }
          .svg-pet-nom { animation: svg-nom 0.5s ease-in-out infinite; }
          .svg-pet-spin { animation: svg-spin 1s ease-in-out; }
          .svg-pet-zzz { animation: svg-zzz 2s ease-in-out infinite; }
          .svg-pet-wag-fast .svg-pet-tail { animation: svg-wag-fast 0.6s ease-in-out infinite; transform-origin: 80% 75%; }
        `}</style>
        <svg
          viewBox="0 0 200 200"
          className={getMoodAnimations()}
          style={{ width: "100%", height: "100%", transformOrigin: "center bottom" }}
        >
          {/* === CUTE KAWAII FOX === */}

          {/* Tail — big fluffy with white tip */}
          <g className={mood === "excited" ? "svg-pet-tail-fast" : "svg-pet-tail"}>
            <path d="M130 140 Q170 100 165 130 Q162 155 145 158 Q135 155 130 145Z" fill="#E8791D" />
            <path d="M158 120 Q165 130 160 145 Q155 155 148 155 Q152 140 155 125Z" fill="#FFFFFF" />
          </g>

          {/* Body */}
          <ellipse cx="100" cy="148" rx="38" ry="32" fill="#E8791D" />

          {/* White belly */}
          <ellipse cx="100" cy="155" rx="26" ry="22" fill="#FFFFFF" />

          {/* Front paws */}
          <ellipse cx="78" cy="172" rx="10" ry="7" fill="#3D2315" />
          <ellipse cx="122" cy="172" rx="10" ry="7" fill="#3D2315" />

          {/* Head — large round */}
          <circle cx="100" cy="88" r="42" fill="#E8791D" />

          {/* Cheek fur patches — lighter orange */}
          <ellipse cx="68" cy="100" rx="12" ry="10" fill="#F5A04A" />
          <ellipse cx="132" cy="100" rx="12" ry="10" fill="#F5A04A" />

          {/* White face mask */}
          <path d="M72 90 Q100 80 128 90 Q130 110 100 125 Q70 110 72 90Z" fill="#FFFFFF" />

          {/* Ears — tall triangular */}
          <polygon points="68,58 52,22 88,50" fill="#E8791D" />
          <polygon points="132,58 148,22 112,50" fill="#E8791D" />
          {/* Inner ears */}
          <polygon points="70,54 58,30 84,50" fill="#F5D0B0" />
          <polygon points="130,54 142,30 116,50" fill="#F5D0B0" />

          {/* Dark ear tips */}
          <polygon points="52,22 58,30 55,28" fill="#3D2315" />
          <polygon points="148,22 142,30 145,28" fill="#3D2315" />

          {/* Eyes */}
          {mood === "sleep" ? (
            <g className="svg-pet-eyes">
              <path d="M82 92 Q87 87 92 92" stroke="#3D2315" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M108 92 Q113 87 118 92" stroke="#3D2315" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          ) : mood === "excited" ? (
            <g className="svg-pet-eyes">
              <text x="80" y="97" fontSize="15" fill="#3D2315">★</text>
              <text x="108" y="97" fontSize="15" fill="#3D2315">★</text>
            </g>
          ) : mood === "happy" || mood === "eating" ? (
            /* Happy closed-eye smile (like reference image pose 2) */
            <g className="svg-pet-eyes">
              <path d="M82 90 Q87 85 92 90" stroke="#3D2315" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M108 90 Q113 85 118 90" stroke="#3D2315" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          ) : (
            /* Normal open eyes — big round cute */
            <g className="svg-pet-eyes svg-pet-blink">
              <circle cx="87" cy="90" r="6.5" fill="#3D2315" />
              <circle cx="113" cy="90" r="6.5" fill="#3D2315" />
              <circle cx="89.5" cy="87.5" r="2.5" fill="white" />
              <circle cx="115.5" cy="87.5" r="2.5" fill="white" />
              <circle cx="86" cy="91" r="1" fill="white" opacity="0.5" />
              <circle cx="112" cy="91" r="1" fill="white" opacity="0.5" />
            </g>
          )}

          {/* Nose — small rounded triangle */}
          <ellipse cx="100" cy="102" rx="4.5" ry="3.5" fill="#3D2315" />

          {/* Mouth */}
          {mood === "sleep" ? (
            <ellipse cx="100" cy="108" rx="3" ry="1.5" fill="#3D2315" opacity="0.4" />
          ) : mood === "excited" || mood === "happy" ? (
            <path d="M92 106 Q100 116 108 106" stroke="#3D2315" strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : mood === "eating" ? (
            <ellipse cx="100" cy="110" rx="5" ry="4" fill="#3D2315" opacity="0.6" />
          ) : (
            <path d="M95 106 Q100 112 105 106" stroke="#3D2315" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          )}

          {/* Blush marks */}
          <ellipse cx="74" cy="98" rx="6" ry="3" fill="#F5A04A" opacity="0.5" />
          <ellipse cx="126" cy="98" rx="6" ry="3" fill="#F5A04A" opacity="0.5" />

          {/* Sleep zzz */}
          {mood === "sleep" && (
            <g>
              <text x="140" y="65" fontSize="16" fill="#6366F1" opacity="0.7" className="svg-pet-zzz">z</text>
              <text x="150" y="50" fontSize="12" fill="#6366F1" opacity="0.5" className="svg-pet-zzz" style={{ animationDelay: "0.5s" }}>z</text>
              <text x="158" y="38" fontSize="10" fill="#6366F1" opacity="0.3" className="svg-pet-zzz" style={{ animationDelay: "1s" }}>z</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // === PANDA ===
  const bodyColor = "#2D2D2D";
  const bellyColor = "#FFFFFF";
  const earInner = "#E8A0BF";
  const noseColor = "#2D2D2D";

  const getMouth = () => {
    if (mood === "sleep") {
      return <ellipse cx="100" cy="120" rx="4" ry="2" fill={noseColor} opacity="0.5" />;
    }
    if (mood === "excited" || mood === "happy") {
      return <path d="M90 118 Q100 130 110 118" stroke={noseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    }
    if (mood === "eating") {
      return <ellipse cx="100" cy="122" rx="6" ry="5" fill={noseColor} opacity="0.7" />;
    }
    return <path d="M93 118 Q100 125 107 118" stroke={noseColor} strokeWidth="2" fill="none" strokeLinecap="round" />;
  };

  const getEyes = () => {
    if (mood === "sleep") {
      return (
        <g className="svg-pet-eyes">
          <path d="M82 105 Q87 100 92 105" stroke={noseColor} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M108 105 Q113 100 118 105" stroke={noseColor} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    if (mood === "excited") {
      return (
        <g className="svg-pet-eyes">
          <text x="82" y="110" fontSize="14" fill={noseColor}>★</text>
          <text x="108" y="110" fontSize="14" fill={noseColor}>★</text>
        </g>
      );
    }
    return (
      <g className="svg-pet-eyes svg-pet-blink">
        <circle cx="87" cy="105" r="5" fill={noseColor} />
        <circle cx="113" cy="105" r="5" fill={noseColor} />
        <circle cx="89" cy="103" r="1.5" fill="white" />
        <circle cx="115" cy="103" r="1.5" fill="white" />
      </g>
    );
  };

  return (
    <div className={cn("inline-block", className)} style={{ width: size, height: size }}>
      <style>{`
        @keyframes svg-blink {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0; transform: scaleY(0.1); }
        }
        @keyframes svg-wag {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(15deg); }
        }
        @keyframes svg-wag-fast {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(20deg); }
        }
        @keyframes svg-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes svg-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes svg-nom {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.95); }
        }
        @keyframes svg-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes svg-zzz {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.8); }
          50% { opacity: 1; transform: translateY(-15px) scale(1); }
        }
        .svg-pet-blink { animation: svg-blink 4s infinite; transform-origin: center; }
        .svg-pet-tail { animation: svg-wag 1.5s ease-in-out infinite; transform-origin: 75% 85%; }
        .svg-pet-tail-fast { animation: svg-wag-fast 0.6s ease-in-out infinite; transform-origin: 75% 85%; }
        .svg-pet-bounce { animation: svg-bounce 1s ease-in-out infinite; }
        .svg-pet-breathe { animation: svg-breathe 3s ease-in-out infinite; }
        .svg-pet-nom { animation: svg-nom 0.5s ease-in-out infinite; }
        .svg-pet-spin { animation: svg-spin 1s ease-in-out; }
        .svg-pet-zzz { animation: svg-zzz 2s ease-in-out infinite; }
        .svg-pet-wag-fast .svg-pet-tail { animation: svg-wag-fast 0.6s ease-in-out infinite; transform-origin: 75% 85%; }
      `}</style>
      <svg
        viewBox="0 0 200 200"
        className={getMoodAnimations()}
        style={{ width: "100%", height: "100%", transformOrigin: "center bottom" }}
      >
        {/* Tail */}
        <g className={mood === "excited" ? "svg-pet-tail-fast" : "svg-pet-tail"}>
          <circle cx="140" cy="150" r="10" fill={bodyColor} />
        </g>

        {/* Body */}
        <ellipse cx="100" cy="145" rx="40" ry="35" fill={bodyColor} />
        <ellipse cx="100" cy="150" rx="30" ry="25" fill={bellyColor} />

        {/* Head */}
        <circle cx="100" cy="95" r="38" fill={bodyColor} />
        <ellipse cx="100" cy="105" rx="28" ry="22" fill={bellyColor} />

        {/* Ears */}
        <circle cx="70" cy="65" r="14" fill={bodyColor} />
        <circle cx="70" cy="65" r="8" fill={earInner} />
        <circle cx="130" cy="65" r="14" fill={bodyColor} />
        <circle cx="130" cy="65" r="8" fill={earInner} />

        {/* Panda eye patches */}
        <ellipse cx="87" cy="105" rx="12" ry="10" fill={bodyColor} opacity="0.8" />
        <ellipse cx="113" cy="105" rx="12" ry="10" fill={bodyColor} opacity="0.8" />

        {/* Eyes */}
        {getEyes()}

        {/* Nose */}
        <ellipse cx="100" cy="113" rx="5" ry="3.5" fill={noseColor} />

        {/* Mouth */}
        {getMouth()}

        {/* Feet */}
        <ellipse cx="80" cy="178" rx="12" ry="6" fill={bodyColor} />
        <ellipse cx="120" cy="178" rx="12" ry="6" fill={bodyColor} />

        {/* Sleep zzz */}
        {mood === "sleep" && (
          <g>
            <text x="135" y="75" fontSize="16" fill="#6366F1" opacity="0.7" className="svg-pet-zzz">z</text>
            <text x="145" y="60" fontSize="12" fill="#6366F1" opacity="0.5" className="svg-pet-zzz" style={{ animationDelay: "0.5s" }}>z</text>
            <text x="155" y="48" fontSize="10" fill="#6366F1" opacity="0.3" className="svg-pet-zzz" style={{ animationDelay: "1s" }}>z</text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default SvgPet;
