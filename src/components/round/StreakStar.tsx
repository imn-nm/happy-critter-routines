/**
 * One star bead of a streak, as the child sees it on the round screen and
 * the parent sees it on the check-in card. Piko colours (brand book): Star
 * Amber for a star from a grown-up, surface navy for one still to come,
 * lavender for the one they're going for next. Every bead gets the brand's
 * little shine at the top left.
 */
/** "prize": the big star at the end of the row, still to be won. */
export type StreakStarState = "empty" | "next" | "filled" | "prize";

// Piko palette (tokens.css / brand book).
export const PIKO = {
  navy: "#20294a",
  deep: "#181e36",
  abyss: "#0e1221",
  surface: "#2c3558",
  raised: "#3c4770",
  text: "#f5f3ff",
  muted: "#bdb5f5",
  cream: "#f9f5e1",
  lime: "#dcef70",
  amber: "#fab047",
  lavender: "#a89af0",
  mint: "#65cdaa",
} as const;

// A five-point star in a 24-unit box. Drawn with a round-joined stroke in the
// fill colour, which softens the points into a bead-like star.
const STAR_POINTS = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 9.6 : 4.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12.9 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

const StreakStar = ({ state, className }: { state: StreakStarState; className?: string }) => {
  const fill = state === "filled" ? PIKO.amber : state === "next" ? PIKO.navy : state === "prize" ? PIKO.raised : PIKO.surface;
  const stroke = state === "filled" ? PIKO.amber : state === "next" ? PIKO.lavender : state === "prize" ? PIKO.raised : PIKO.surface;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <polygon
        points={STAR_POINTS}
        fill={fill}
        stroke={stroke}
        strokeWidth={state === "next" ? 2.2 : 3.2}
        strokeLinejoin="round"
      />
      {state === "filled" && <circle cx="9.3" cy="9.6" r="1.5" fill="#fff" opacity={0.6} />}
    </svg>
  );
};

export default StreakStar;
