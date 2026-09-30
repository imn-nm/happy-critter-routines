/**
 * One star of a streak, drawn the way the round display's Figma draws stars
 * (Circle Display, row 09): lime for a star a grown-up gave, a lavender
 * outline for the one they're going for next, a quiet outline for the rest,
 * and a navy star with a lime rim for the big one still to win.
 */
export type StreakStarState = "empty" | "next" | "filled" | "prize";

// The round display's colours (Focus — Navy & Play variables in Figma).
export const ROUND = {
  black: "#000000",
  bg: "#20294a",
  sheet: "#181e36",
  sunken: "#0e1221",
  surface: "#2c3558",
  raised: "#3c4770",
  text: "#f5f3ff",
  muted: "#bdb5f5",
  lime: "#dcef70",
  lavender: "#a89af0",
  iris: "#879bff",
} as const;

// A five-point star in a 24-unit box, softened by a round-joined stroke.
const STAR_POINTS = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9.6 : 4.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12.9 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

const STYLE: Record<StreakStarState, { fill: string; stroke: string; width: number }> = {
  filled: { fill: ROUND.lime, stroke: ROUND.lime, width: 2.6 },
  next: { fill: "none", stroke: ROUND.lavender, width: 1.8 },
  empty: { fill: "none", stroke: ROUND.raised, width: 1.8 },
  // A lime rim so the big star reads on the dark rows before it's won.
  prize: { fill: ROUND.raised, stroke: ROUND.lime, width: 1.6 },
};

const StreakStar = ({ state, className }: { state: StreakStarState; className?: string }) => {
  const s = STYLE[state];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <polygon points={STAR_POINTS} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} strokeLinejoin="round" />
    </svg>
  );
};

export default StreakStar;
