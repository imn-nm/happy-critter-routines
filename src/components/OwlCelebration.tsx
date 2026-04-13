import { useState, useEffect, useCallback } from 'react';
import owlSprite from '@/assets/owl_sprite.png';

interface OwlCelebrationProps {
  playing: boolean;
  onComplete?: () => void;
  size?: number; // px, defaults to 128
}

// Sprite sheet: 5 columns × 5 rows, 1280×1280 total
const COLS = 5;
const ROWS = 5;
const SHEET_W = 1280;
const SHEET_H = 1280;
const FRAME_W = SHEET_W / COLS;  // 256
const FRAME_H = SHEET_H / ROWS;  // 256

// Animation sequence: idle → wings spreading → flapping celebration → settle → idle
// Grid is 0-indexed: (row, col)
const CELEBRATION_FRAMES: [number, number][] = [
  [0, 0], // idle sitting
  [0, 1], // slight movement
  [0, 2], // looking up
  [1, 0], // wing starting to lift
  [1, 1], // wing out
  [1, 2], // wings spreading
  [1, 3], // wings wide open
  [1, 4], // wings fully spread
  [2, 0], // flapping up
  [2, 1], // flapping wide
  [2, 1], // hold flap (celebration peak)
  [2, 0], // flap back
  [2, 1], // flap again
  [2, 2], // settling
  [1, 4], // wings coming down
  [1, 3], // wings folding
  [0, 3], // settling back
  [0, 1], // almost idle
  [0, 0], // back to idle
];

const FRAME_DURATION_MS = 100; // 100ms per frame = ~1.9s total

const OwlCelebration = ({ playing, onComplete, size = 128 }: OwlCelebrationProps) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = useCallback(() => {
    setCurrentFrame(0);
    setIsAnimating(true);
  }, []);

  // Start when playing becomes true
  useEffect(() => {
    if (playing && !isAnimating) {
      startAnimation();
    }
  }, [playing, isAnimating, startAnimation]);

  // Step through frames
  useEffect(() => {
    if (!isAnimating) return;

    if (currentFrame >= CELEBRATION_FRAMES.length - 1) {
      setIsAnimating(false);
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setCurrentFrame(prev => prev + 1);
    }, FRAME_DURATION_MS);

    return () => clearTimeout(timer);
  }, [isAnimating, currentFrame, onComplete]);

  const [row, col] = CELEBRATION_FRAMES[currentFrame] || [0, 0];
  const bgX = -(col * size);
  const bgY = -(row * size);
  const bgWidth = COLS * size;
  const bgHeight = ROWS * size;

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${owlSprite})`,
        backgroundPosition: `${bgX}px ${bgY}px`,
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'auto',
      }}
      className="mx-auto"
    />
  );
};

export default OwlCelebration;
