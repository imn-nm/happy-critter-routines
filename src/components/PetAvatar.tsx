import { cn } from "@/lib/utils";
import owlAvatar from "@/assets/owl-avatar.png";
import foxAvatar from "@/assets/fox-avatar.png";
import penguinAvatar from "@/assets/penguin-avatar.png";

// Fox emotion images
import foxVeryHappy from "@/assets/fox_veryhappy.png";
import foxHappy from "@/assets/fox_happy.png";
import foxSad from "@/assets/fox_sad.png";

// Red Panda emotion images
import pandaVeryHappy from "@/assets/panda_veryhappy.png";
import pandaHappy from "@/assets/panda_happy.png";
import pandaSad from "@/assets/panda_sad.png";

export type PetType = "fox" | "panda" | "owl" | "penguin";
export type PetEmotion = "happy" | "playful" | "neutral" | "sad" | "concerned" | "sleepy" | "excited";

interface PetAvatarProps {
  petType: PetType;
  happiness: number; // 0-100
  emotion?: PetEmotion;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  completedTasks?: number;
  totalTasks?: number;
}

const PetAvatar = ({ petType, happiness, emotion, size = "md", className, completedTasks = 0, totalTasks = 0 }: PetAvatarProps) => {
  // Emotion/image selection is based on explicit emotion or happiness now.

  const getEmotionBasedImage = () => {
    // Prefer explicit emotion or happiness for expressive pets
    if (petType === 'fox' || petType === 'panda') {
      type Level = 'very' | 'happy' | 'sad';
      let level: Level;

      if (emotion) {
        switch (emotion) {
          case 'playful':
          case 'excited':
            level = 'very';
            break;
          case 'happy':
          case 'neutral':
          case 'sleepy':
            level = 'happy';
            break;
          case 'concerned':
          case 'sad':
            level = 'sad';
            break;
          default:
            level = happiness >= 80 ? 'very' : happiness >= 50 ? 'happy' : 'sad';
        }
      } else {
        // Fall back to happiness if no explicit emotion
        level = happiness >= 80 ? 'very' : happiness >= 50 ? 'happy' : 'sad';
      }

      if (petType === 'fox') {
        if (level === 'very') return foxVeryHappy;
        if (level === 'happy') return foxHappy;
        return foxSad;
      }

      // petType === 'panda'
      if (level === 'very') return pandaVeryHappy;
      if (level === 'happy') return pandaHappy;
      return pandaSad;
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

    // If emotion is explicitly set, use it
    if (emotion) {
      switch (emotion) {
        case "playful": return "😄";
        case "happy": return "😊";
        case "excited": return "🤗";
        case "neutral": return "😐";
        case "concerned": return "😟";
        case "sad": return "😢";
        case "sleepy": return "😴";
        default: return "😊";
      }
    }

    // Fallback to happiness-based emotions
    if (happiness >= 80) return "😊";
    if (happiness >= 60) return "🙂";
    if (happiness >= 40) return "😐";
    if (happiness >= 20) return "😞";
    return "😢";
  };

  const getEmotionColor = () => {
    // If emotion is explicitly set, use emotion-based colors
    if (emotion) {
      switch (emotion) {
        case "playful": return "#8B5CF6"; // purple-500
        case "happy": return "#10B981"; // emerald-500
        case "excited": return "#F59E0B"; // amber-500
        case "neutral": return "#6B7280"; // gray-500
        case "concerned": return "#F59E0B"; // amber-500
        case "sad": return "#EF4444"; // red-500
        case "sleepy": return "#6366F1"; // indigo-500
        default: return "#10B981"; // emerald-500
      }
    }
    
    // Fallback to happiness-based colors
    if (happiness >= 80) return "#10B981"; // emerald-500
    if (happiness >= 60) return "#F59E0B"; // amber-500
    if (happiness >= 40) return "#EF4444"; // red-500
    return "#DC2626"; // red-600
  };

  return (
    <div className={cn("relative", className)}>
      <div 
        className={cn(
          "rounded-full bg-white shadow-lg border-4 overflow-hidden transition-all duration-300",
          sizeClasses[size]
        )}
        style={{ borderColor: getEmotionColor() }}
      >
        <img
          src={getEmotionBasedImage()}
          alt={`${petType} pet`}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Emotion indicator - only for non-Fox/Panda pets */}
      {shouldShowEmojiIndicator() && (
        <div className="absolute -top-1 -right-1 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md text-sm">
          {getEmotionIndicator()}
        </div>
      )}
      
      {/* Happiness bar */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${happiness}%`,
            backgroundColor: getEmotionColor(),
          }}
        />
      </div>
    </div>
  );
};

export default PetAvatar;