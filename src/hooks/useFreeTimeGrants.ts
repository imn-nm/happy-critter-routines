/**
 * Free time a grown-up gives a child "right now" (free_time_grants). The child's day makes room
 * for it on every screen and the handheld (utils/liveDay applyFreeTime): the task that was on
 * pauses and carries on after it, and the tasks behind move later.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { freeWindows, type FreeTimeGrant } from "@/utils/liveDay";
import { getPSTDateString } from "@/utils/pstDate";

/** Kept up to date this often while the page is on screen (and at once when it comes back), so a
 * parent's gift reaches the child's screen without a reload; a hidden tab doesn't ask. */
const REFRESH_MS = 60 * 1000;

export const useFreeTimeGrants = (childId?: string) => {
  const [grants, setGrants] = useState<FreeTimeGrant[]>([]);

  const load = useCallback(async () => {
    if (!childId) return;
    const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("free_time_grants")
      .select("id, minutes, starts_at")
      .eq("child_id", childId)
      .gte("starts_at", since)
      .order("starts_at", { ascending: true });
    if (error) { console.error("free time:", error); return; }
    setGrants((data as FreeTimeGrant[]) ?? []);
  }, [childId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [load]);

  /** Free time starting now. */
  const give = async (minutes: number) => {
    if (!childId) return;
    const { error } = await supabase.from("free_time_grants").insert({ child_id: childId, minutes: Math.round(minutes) });
    if (error) throw error;
    await load();
  };

  /** Ends it now: cut to what has run (taken back altogether in its first minute). */
  const stop = async (id: string) => {
    const g = grants.find(x => x.id === id);
    if (!g) return;
    const ran = Math.floor((Date.now() - new Date(g.starts_at).getTime()) / 60000);
    const { error } = ran < 1
      ? await supabase.from("free_time_grants").delete().eq("id", id)
      : await supabase.from("free_time_grants").update({ minutes: ran }).eq("id", id);
    if (error) throw error;
    await load();
  };

  /** The free time running right now, if any ("HH:MM" windows are minutes of the day). */
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const active = freeWindows(grants, getPSTDateString()).find(w => nowMin >= w.start && nowMin < w.end) ?? null;

  return { grants, give, stop, active, reload: load };
};
