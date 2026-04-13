import { cn } from "@/lib/utils";
import SvgPet from "./SvgPet";
import owlAvatar from "@/assets/owl.png";
import foxAvatar from "@/assets/fox-avatar.png";
import penguinAvatar from "@/assets/penguin-avatar.png";

// Fox emotion images
import foxVeryHappy from "@/assets/fox_veryhappy.png";
import foxHappy from "@/assets/fox_happy.png";
// Red Panda emotion images
import pandaVeryHappy from "@/assets/panda_veryhappy.png";
import pandaHappy from "@/assets/panda_happy.png";

export type PetType = "fox" | "panda" | "owl" | "penguin";
export type PetEmotion = "encouraging" | "happy" | "excited" | "resting";

interface PetAvatarProps {
  petType: PetType;
  happiness: number; // 0-100
  emotion?: PetEmotion;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  completedTasks?: number;
  totalTasks?: number;
  useSvg?: boolean;
}

const PetAvatar = ({ petType, happiness, emotion, size = "md", className, completedTasks = 0, totalTasks = 0, useSvg = true }: PetAvatarProps) => {
  // Emotion/image selection is based on explicit emotion or happiness now.

  const getEmotionBasedImage = () => {
    if (petType === 'fox' || petType === 'panda') {
      type Level = 'very' | 'happy';
      let level: Level;

      if (emotion) {
        switch (emotion) {
          case 'excited':
            level = 'very';
            break;
          case 'encouraging':
          case 'happy':
          case 'resting':
          default:
            level = 'happy';
        }
      } else {
        level = happiness >= 80 ? 'very' : 'happy';
      }

      if (petType === 'fox') {
        return level === 'very' ? foxVeryHappy : foxHappy;
      }
      // panda
      return level === 'very' ? pandaVeryHappy : pandaHappy;
    }

    // Fallback for owl and penguin - use static avatars
    if (petType === 'owl') return owlAvatar;
    if (petType === 'penguin') return penguinAvatar;

    return foxHappy;
  };

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
    xl: "w-48 h-48",
  };

  // For Fox and Red Panda, emotion is shown through the image itself
  // No emoji indicators needed since both pets use emotion-based images
  const shouldShowEmojiIndicator = () => {
    return false; // Never show emoji indicators
  };

  const getEmotionIndicator = () => {
    if (!shouldShowEmojiIndicator()) return null;

    if (emotion) {
      switch (emotion) {
        case "encouraging": return "💪";
        case "happy": return "😊";
        case "excited": return "🤗";
        case "resting": return "😴";
        default: return "😊";
      }
    }

    if (happiness >= 80) return "😊";
    if (happiness >= 60) return "🙂";
    return "💪";
  };

  const getEmotionColor = () => {
    if (emotion) {
      switch (emotion) {
        case "encouraging": return "#F59E0B"; // amber
        case "happy": return "#10B981"; // green
        case "excited": return "#8B5CF6"; // purple
        case "resting": return "#6366F1"; // indigo
        default: return "#10B981";
      }
    }

    if (happiness >= 80) return "#10B981";
    if (happiness >= 60) return "#F59E0B";
    return "#F59E0B";
  };

  // Map emotion to SvgPet mood
  const getSvgMood = (): "idle" | "happy" | "excited" | "sleep" => {
    switch (emotion) {
      case "excited": return "excited";
      case "happy": return "happy";
      case "resting": return "sleep";
      case "encouraging":
      default: return "idle";
    }
  };

  const svgSizeMap = { sm: 48, md: 80, lg: 128, xl: 192 };
  const shouldUseSvg = useSvg && (petType === 'fox' || petType === 'panda');

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "transition-all duration-300 flex items-center justify-center",
          shouldUseSvg
            ? sizeClasses[size]
            : cn("shadow-lg overflow-hidden", sizeClasses[size])
        )}
      >
        {shouldUseSvg ? (
          <SvgPet petType={petType as "fox" | "panda"} mood={getSvgMood()} size={svgSizeMap[size]} />
        ) : (
          <img
            src={getEmotionBasedImage()}
            alt={`${petType} pet`}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* Emotion indicator - only for non-Fox/Panda pets */}
      {shouldShowEmojiIndicator() && (
        <div className="absolute -top-1 -right-1 glass-strong rounded-full w-8 h-8 flex items-center justify-center shadow-md text-sm">
          {getEmotionIndicator()}
        </div>
      )}
      
      {/* Happiness bar - removed, no longer needed */}
    </div>
  );
};

export default PetAvatar;