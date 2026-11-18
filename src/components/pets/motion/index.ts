import type { ClipName } from "../spriteClips";
import type { MotionClip } from "./kit";
import { Celebrate, Curious, Encourage, Idle, LeafChase, Sleepy, Wave } from "./social";
import * as A from "./activities";

/** Every clip the pixel rabbit has, redrawn with smooth motion. */
export const MOTION_CLIPS: Record<ClipName, MotionClip> = {
  Idle, LeafChase, Celebrate, Encourage, Wave, Curious, Sleepy,
  Eating: A.Eating, Reading: A.Reading, Gaming: A.Gaming, BrushingTeeth: A.BrushingTeeth, Soccer: A.Soccer,
  Drawing: A.Drawing, Bubbles: A.Bubbles, Homework: A.Homework, WashHands: A.WashHands, Shower: A.Shower,
  Tidy: A.Tidy, GetDressed: A.GetDressed, WakeUp: A.WakeUp, Piano: A.Piano, Basketball: A.Basketball,
  Outside: LeafChase,
};

export { sample, sceneAt, type MotionClip } from "./kit";
export { drawScene, STAGE, FLOOR } from "./rig";

import { CLIP_SCENE, type SceneName } from "../pixel/scenes";
/** The room each clip happens in: the same places as the pixel clips, the den for anything without its own. */
export const roomFor = (clip: ClipName): SceneName => CLIP_SCENE[clip] ?? "den";
export { drawRoom } from "./rooms";
