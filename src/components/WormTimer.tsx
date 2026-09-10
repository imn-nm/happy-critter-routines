import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionPrefs } from "@/lib/motion";
import "./WormTimer.css";

interface WormTimerProps { progress: number; icon?: ReactNode; className?: string }
const FUR = '#F9F5E1', CORAL = '#F1945A', INK = '#010101', MINT = '#509797';
const controller = ['..XXXXXX..','XXXXXXXXXX','XX.XXXX.XX','X...XXXX.X','XX.XXX.XXX','XXX....XXX','XX......XX'];

/** All artwork is made of equal square cells. Consumption follows the mouth,
 * while the optional-task marker stays fixed in place. */
export default function WormTimer({ progress, icon, className }: WormTimerProps) {
  const { reduce } = useMotionPrefs();
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(100);
  const target = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const [shown, setShown] = useState(target);
  const last = useRef(target);
  const [chompFrame, setChompFrame] = useState(0);
  const chewing = shown > 0 && shown < .9999;
  useEffect(() => {
    if (reduce || !chewing) { setChompFrame(0); return; }
    const timer = window.setInterval(() => setChompFrame(frame => (frame + 1) % 8), 100);
    return () => window.clearInterval(timer);
  }, [reduce, chewing]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setColumns(Math.max(28, Math.floor(entry.contentRect.width / 4))));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (reduce) { last.current = target; setShown(target); return; }
    const from = last.current, start = performance.now(); let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      last.current = from + (target - from) * (1 - (1 - t) ** 3);
      setShown(last.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [target, reduce]);
  const taskLeft = columns - 18, taskRight = columns - 4;
  const bite = Math.max(0, (shown - .85) / .15);
  const mouth = Math.round(shown < .85 ? 12 + (taskLeft - 12) * shown / .85 : taskLeft + 14 * bite);
  const full = shown >= .9999;
  const cells: ReactNode[] = [];
  const cell = (x: number, y: number, color: string, key: string) => cells.push(<rect key={key} x={x} y={y} width="1" height="1" fill={color} />);
  // Thin mint track; exactly the same grid as the rabbit.
  for (let x = 1; x < taskRight; x++) for (let y = 10; y < 12; y++) cell(x,y,MINT,`t${x},${y}`);
  // The task never moves, scales, rotates, or fades. Columns disappear only
  // when the leading mouth reaches them, creating actual visual occlusion.
  for (let x = taskLeft; x < taskRight; x++) for (let y = 4; y < 18; y++) {
    const dx = x-taskLeft, dy=y-4;
    if ((dx < 2 || dx > 11) && (dy < 2 || dy > 11)) continue;
    if (bite > 0 && x < mouth) continue;
    cell(x,y,MINT,`b${x},${y}`);
    if (!icon && controller[dy-3]?.[dx-2] === 'X') cell(x,y,FUR,`i${x},${y}`);
  }
  // One simple solid body, stepped tail, compact head and one square eye.
  for(let x=1;x<mouth-3;x++) for(let y=8;y<15;y++) {
    if(x===1 && (y===8 || y===14)) continue;
    cell(x,y,CORAL,`w${x},${y}`);
  }
  // Discrete square-grid poses: closed, opening, wide, then closing.
  // Time drives the jaw so it still chomps between slow timer updates.
  const jaw = [0, 1, 2, 3, 4, 3, 2, 1][chompFrame];
  const opening = full || reduce ? 0 : jaw + (bite > 0 && jaw > 0 ? 1 : 0);
  for(let x=mouth-8;x<mouth+3;x++) for(let y=3;y<18;y++) {
    const dx=x-(mouth-8);
    if((dx<2 || dx>8) && (y<5 || y>15)) continue;
    if(opening > 0 && x>=mouth-3 && Math.abs(y-11)<Math.min(opening, x-mouth+4)) continue;
    cell(x,y,CORAL,`h${x},${y}`);
  }
  for(let x=mouth-3;x<mouth-1;x++) for(let y=5;y<7;y++) cell(x,y,INK,`e${x},${y}`);
  if(full) for(let x=mouth-2;x<mouth+1;x++) cell(x,11,INK,`s${x}`);
  return <div ref={root} className={cn('pixel-worm',className)} role="progressbar" aria-label="Optional task time used"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(target*100)}>
    <div style={{position:'relative',width:columns*4,height:84,maxWidth:'100%'}}>
      <svg width={columns*4} height="84" viewBox={`0 0 ${columns} 21`} aria-hidden shapeRendering="crispEdges">{cells}</svg>
      {icon && <div aria-hidden className="pixel-worm-custom-icon" style={{left:taskLeft*4,clipPath:`inset(0 0 0 ${Math.max(0,mouth-taskLeft)*4}px)`}}>{icon}</div>}
    </div>
  </div>;
}
