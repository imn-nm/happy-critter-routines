/** A reward request a grown-up said yes to ('completed' is the older name for it). Kept apart from
 * useRewards so the day plan can use it on the server too (src/lib/devicePlan.ts). */
export const isApprovedStatus = (s: string) => s === 'approved' || s === 'completed';
