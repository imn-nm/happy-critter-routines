import { useEffect, useId } from "react";
import { useReducedMotion } from "framer-motion";
import SpritePet from "./SpritePet";
import "./timerRabbitScene.css";

export type TimerRoutine = "leaf-chase" | "trip-recover";
export const TIMER_ROUTINE_MS = 10000;

/** A 293-unit stage shares the timer's coordinates, including its rim. */
export default function TimerRabbitScene({ routine, onComplete }: {
  routine: TimerRoutine;
  onComplete?: () => void;
}) {
  const reduced = useReducedMotion();
  const id = useId();
  useEffect(() => {
    const timeout = window.setTimeout(() => onComplete?.(), reduced ? 0 : TIMER_ROUTINE_MS);
    return () => window.clearTimeout(timeout);
  }, [onComplete, reduced]);

  return <svg viewBox="0 0 293 293" className={`absolute inset-0 h-full w-full timer-rabbit ${routine}`}
    role="img" aria-label={routine === "leaf-chase" ? "Biscuit watches a leaf, crouches, hops after it, then settles beside it" : "Biscuit trips, catches the rim, checks both ways, and acts casual"}>
    <defs><clipPath id={id}><circle cx="146.5" cy="146.5" r="145" /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      {routine === "leaf-chase" ? <foreignObject x="31" y="62.5" width="231" height="168">
        <SpritePet clip="LeafChase" size={168} label="Biscuit chasing a leaf" />
      </foreignObject> : <g className="rabbit-travel">
        <g className="rabbit-turn">
          <foreignObject x="31" y="62.5" width="231" height="168">
            <SpritePet clip="Idle" size={168} label="Biscuit" />
          </foreignObject>
        </g>
      </g>}
      <g className="rabbit-dust" fill="#c7b6db" aria-hidden="true">
        <rect x="173" y="262" width="4" height="4" /><rect x="184" y="255" width="3" height="3" /><rect x="191" y="265" width="5" height="3" />
      </g>
    </g>
    {/* Paws are above the stroke; the body stays behind the circular frame. */}
    {routine === "trip-recover" && <g className="rabbit-grip" aria-hidden="true" fill="#f8f7e3" stroke="#f8f7e3" strokeWidth="2" shapeRendering="crispEdges">
      <path d="M121 276v9h-4v7h14v-16M158 276v9h-4v7h14v-16" />
      <path d="M121 288v3m5-3v3m32-3v3m5-3v3" stroke="#cfadad" />
    </g>}
  </svg>;
}
