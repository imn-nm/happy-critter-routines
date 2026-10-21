// The MyToki handheld's server (device/platform/esp32s3: CONFIG_MYTOKI_DAY_URL and _EVENTS_URL are
// both this function). The handheld sends its own token (Authorization: Bearer), tied to one child
// in mytoki_devices, so the gateway's JWT check is off for this function and it checks the token.
//   GET   the child's day plan (device/docs/day-plan.md), built from the same rows and the same
//         code as the Circle in the browser: plan.js is src/lib/devicePlan.ts, bundled by
//         `npm run device:function`.
//   POST  one thing the child did on the handheld, saved as the browser's ChildCircleView saves it.
//         The handheld retries anything but a 2xx, oldest first, so what can never be saved (a task
//         that isn't this child's) is answered 200 "ignored" rather than blocking the rest.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  devicePlan,
  getPSTDateString,
  missingSystemTaskRows,
  normalizeOutfit,
  resolvePetColour,
  resolvePetId,
  SYSTEM_TASK_NAMES,
} from "./plan.js";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// Browsers may ask too (the simulator page, a grown-up checking a handheld): only a handheld's
// token gets an answer, so any origin may ask.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** The handheld behind the request's token, or null. */
async function deviceFor(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S{20,})$/i)?.[1];
  if (!token) return null;
  const { data, error } = await db.from("mytoki_devices").select("id, child_id").eq("token_hash", await sha256(token)).maybeSingle();
  if (error) throw error;
  return data as { id: string; child_id: string } | null;
}

const must = <T>({ data, error }: { data: T; error: unknown }) => {
  if (error) throw error;
  return data;
};

/* ------------------------------------------------------------------ GET: the day plan */
async function dayPlan(childId: string) {
  // The built-in rows first, as the child's screen does on opening (ensureSystemTasksExist).
  const builtins = must(await db.from("tasks").select("name").eq("child_id", childId).in("name", SYSTEM_TASK_NAMES)) ?? [];
  for (const row of missingSystemTaskRows(childId, builtins)) {
    const { error } = await db.from("tasks").insert(row);
    if (error && error.code !== "23505") throw error; // 23505: another screen made it first
  }
  // What the browser's hooks load (useChildren, useTasks, useRewards, useTaskSessions, useHolidays,
  // useUnseenParentNotes, useFreeTimeGrants).
  const today = getPSTDateString();
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const [child, tasks, completions, rewards, purchases, sessions, holidays, notes, freeTime] = await Promise.all([
    db.from("children").select("*").eq("id", childId).single(),
    db.from("tasks").select("*").eq("child_id", childId).order("sort_order", { ascending: true }),
    db.from("task_completions").select("*").eq("child_id", childId).eq("date", today),
    db.from("rewards").select("*").eq("child_id", childId).order("cost", { ascending: true }),
    db.from("reward_purchases").select("*").eq("child_id", childId).order("purchased_at", { ascending: false }),
    db.from("task_sessions").select("*").eq("child_id", childId).gte("started_at", since).order("started_at", { ascending: true }),
    db.from("holidays").select("*").eq("child_id", childId).order("date", { ascending: true }),
    db.from("parent_notes").select("*").eq("child_id", childId).is("seen_at", null).order("created_at", { ascending: true }).limit(20),
    db.from("free_time_grants").select("id, minutes, starts_at").eq("child_id", childId).gte("starts_at", since).order("starts_at", { ascending: true }),
  ]);
  return devicePlan({
    child: must(child),
    tasks: must(tasks) ?? [],
    completions: must(completions) ?? [],
    rewards: must(rewards) ?? [],
    purchases: must(purchases) ?? [],
    sessions: must(sessions) ?? [],
    holidays: must(holidays) ?? [],
    notes: must(notes) ?? [],
    freeTime: must(freeTime) ?? [],
  });
}

/* ------------------------------------------------------------------ POST: what the child did */
interface DeviceEvent {
  type: string;
  child_id?: string;
  task_id?: string;
  reward_id?: string;
  note_id?: string;
  date?: string;
  at?: string;
  value?: number;
  outfit?: Record<string, string | null>;
  pet_type?: string;
  pet_color?: string;
}

/** Pacific "YYYY-MM-DD" + "HH:MM" as an ISO timestamp (what the handheld did offline keeps its
 * time), or undefined to let the database stamp it now. */
function pacificIso(date?: string, at?: string) {
  if (!date || !at || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(at)) return undefined;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = at.split(":").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offset = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offset(wall);
  t = wall - offset(t); // once more, for a time near the clocks changing
  const iso = new Date(t).toISOString();
  return t > Date.now() + 5 * 60 * 1000 ? undefined : iso; // a handheld clock in the future: use now
}

/** Is this row this child's? */
const owned = async (table: "tasks" | "rewards" | "parent_notes", id: string | undefined, childId: string) => {
  if (!id) return null;
  return must(await db.from(table).select("*").eq("id", id).eq("child_id", childId).maybeSingle());
};

const ignored = (why: string) => ({ ignored: why });

async function save(childId: string, ev: DeviceEvent) {
  if (ev.child_id && ev.child_id !== childId) return ignored("another child");
  const at = pacificIso(ev.date, ev.at);
  switch (ev.type) {
    case "task_done":
    case "chore_done": {
      if (!(await owned("tasks", ev.task_id, childId))) return ignored("not this child's task");
      const { error } = await db.from("task_completions").insert({
        child_id: childId,
        task_id: ev.task_id,
        coins_earned: 0,
        duration_spent: ev.type === "task_done" ? Math.round((ev.value ?? 0) / 60) : 0,
        date: ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : getPSTDateString(),
        ...(at ? { completed_at: at } : {}),
      });
      if (error && error.code !== "23505") throw error; // 23505: already done today
      if (ev.type === "task_done") {
        // as the Circle does: Biscuit cheers up, and the task's running timer stops
        const child = must(await db.from("children").select("pet_happiness").eq("id", childId).single());
        if ((child?.pet_happiness ?? 0) < 70) must(await db.from("children").update({ pet_happiness: 70 }).eq("id", childId));
        const running = must(await db.from("task_sessions").select("id, started_at").eq("child_id", childId).eq("task_id", ev.task_id!).eq("is_active", true)) ?? [];
        for (const s of running) {
          const seconds = Math.max(0, Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000));
          must(await db.from("task_sessions").update({ is_active: false, ended_at: new Date().toISOString(), total_duration: seconds }).eq("id", s.id));
        }
      }
      return { saved: ev.type };
    }
    case "chore_undo": {
      // a chore checked by mistake on the handheld: today's completion goes, unless a grown-up
      // has already given stars for it (taking those back is the parent's Undo)
      if (!(await owned("tasks", ev.task_id, childId))) return ignored("not this child's task");
      const date = ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : getPSTDateString();
      const rows = must(await db.from("task_completions").select("id, coins_earned").eq("child_id", childId).eq("task_id", ev.task_id!).eq("date", date)) ?? [];
      if (rows.some((r) => (r.coins_earned ?? 0) > 0)) return ignored("stars given");
      for (const r of rows) must(await db.from("task_completions").delete().eq("id", r.id));
      return { saved: ev.type };
    }
    case "task_start":
    case "next_now": {
      if (!(await owned("tasks", ev.task_id, childId))) return ignored("not this child's task");
      must(await db.from("task_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("child_id", childId).eq("is_active", true));
      must(await db.from("task_sessions").insert({
        child_id: childId,
        task_id: ev.task_id,
        kind: ev.type === "task_start" ? "start" : "next_now",
        ...(at ? { started_at: at } : {}),
      }));
      return { saved: ev.type };
    }
    case "reward_request": {
      const reward = await owned("rewards", ev.reward_id, childId);
      if (!reward) return ignored("not this child's reward");
      // the handheld may send it again after a lost answer: one waiting ask per reward
      const latest = must(await db.from("reward_purchases").select("status").eq("child_id", childId).eq("reward_id", reward.id).order("purchased_at", { ascending: false }).limit(1).maybeSingle());
      if (latest?.status === "pending") return ignored("already waiting");
      must(await db.from("reward_purchases").insert({ child_id: childId, reward_id: reward.id, coins_spent: reward.cost, status: "pending" }));
      return { saved: ev.type };
    }
    case "note_seen": {
      const note = await owned("parent_notes", ev.note_id, childId);
      if (!note) return ignored("not this child's note");
      // markParentNoteSeen: a star note clears the older star notes with it
      let q = db.from("parent_notes").update({ seen_at: new Date().toISOString() }).eq("child_id", childId).is("seen_at", null);
      q = note.kind === "star" ? q.eq("kind", "star").lte("created_at", note.created_at) : q.eq("id", note.id);
      must(await q);
      return { saved: ev.type };
    }
    case "outfit": {
      if (!ev.outfit || typeof ev.outfit !== "object") return ignored("no outfit");
      must(await db.from("children").update({ pet_outfit: normalizeOutfit(ev.outfit) }).eq("id", childId));
      return { saved: ev.type };
    }
    case "character": {
      if (!ev.pet_type) return ignored("no character");
      const petType = resolvePetId(ev.pet_type);
      must(await db.from("children").update({ pet_type: petType, pet_color: resolvePetColour(petType, ev.pet_color) }).eq("id", childId));
      return { saved: ev.type };
    }
    default:
      return ignored(`unknown type ${ev.type}`);
  }
}

/* ------------------------------------------------------------------ the door */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const device = await deviceFor(req);
    if (!device) return reply(401, { error: "unknown handheld: connect it in the child's settings" });
    await db.from("mytoki_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    if (req.method === "GET") return reply(200, await dayPlan(device.child_id));
    if (req.method === "POST") {
      let ev: DeviceEvent;
      try { ev = await req.json(); } catch { return reply(200, ignored("not JSON")); }
      return reply(200, await save(device.child_id, ev));
    }
    return reply(405, { error: "GET or POST" });
  } catch (e) {
    console.error("mytoki-device", e);
    return reply(500, { error: "try again" }); // the handheld retries
  }
});
