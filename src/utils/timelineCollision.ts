import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core';

// Expanded gap slots must win over their containing row. Never select the
// moving card itself, which otherwise masks nearby drop targets.
export const timelineCollisionDetection: CollisionDetection = (args) => {
  const candidates = {
    ...args,
    droppableContainers: args.droppableContainers.filter(c => c.id !== args.active.id),
  };
  const hits = pointerWithin(candidates);
  const ticks = hits.filter(hit => String(hit.id).startsWith('tick-'));
  return ticks.length ? ticks : hits.length ? hits : closestCenter(candidates);
};
