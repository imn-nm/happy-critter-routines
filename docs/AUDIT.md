# App audit — corner cases and UX (2026-09-25)

Merged from two reviews (Claude Code and Codex) of the whole app, parent and
child sides. Ranked by harm: data loss and wrong star counts first, then the
always-on child screen, then parent tools, then polish. Tick items as they
land. `C` = found by Claude, `X` = found by Codex, `CX` = both.

## 1. Fix first — data loss, star counts, security

- [x] **Tasks named like built-in rows get deleted.** A task named Wake Up,
  Breakfast, Lunch, Dinner, School or Bedtime is treated as the built-in row,
  and every child-screen load deletes all but one copy (with its completions).
  `src/utils/systemTasks.ts` `cleanupDuplicateSystemTasks`. (C)
- [x] **Built-in rows open the full task form**, but saving keeps only time,
  days and length; rename/stars/type are silently lost. (C)
- [x] **Reward approval isn't atomic.** Status flips to approved, then stars
  are deducted in a second request; if that fails the reward is approved
  unpaid and retry says "already handled". No balance check (the balance
  function floors at 0, so a short balance is silently under-charged). Same
  for parent Redeem. `src/hooks/useRewards.ts`. (CX)
- [x] **Undo and Give ★ race.** Undo deletes the completion and subtracts stars
  read from the screen's copy; two parents can take stars back twice, or none.
  `/tasks` Undo never takes stars back. (C)
- [x] **Duplicate "done" rows.** No unique constraint on
  `task_completions (task_id, date)`; double taps and parent+child at once
  insert twice (8 duplicate rows exist today). (C)
- [x] **Household rules too loose.** Any signed-in user can insert themselves
  into any household by id; any member can remove any other, including the
  owner. (C)
- [x] **Two households per parent.** Membership lookups use `.limit(1)` with no
  order; a failed household lookup creates a second household client-side;
  an invitee who added a child first keeps their own household. (C)
- [x] **Sign-out on the phone signs out the child's device** (global scope,
  no confirm). (C)
- [x] **Children can reach parent mode.** "Grown-ups" and "Child not found →
  Back" open the parent dashboard; parent routes don't enforce the PIN,
  including browser Back and direct links. PIN is plain text. (CX)
- [x] **Dev auto-login isn't limited to dev builds** (`VITE_DEV_AUTOLOGIN`
  only); a locally built `dist` signs visitors into the test account. (C)

## 2. The always-on child screen

- [x] **Night shows "Free Time".** Before wake-up the screen offers a multi-hour
  free-time countdown, the wheel, Playtime and chores. Needs a sleeping state. (C)
- [x] **Playtime reopens by itself** at the next free-time window (`playOpen`
  never reset when the next task takes over). (C)
- [x] **Checklist ticks carry past midnight** on a screen that never reloads. (C)
- [x] **Never catches up after a network drop** — refetch only on tab
  visibility, which an always-on screen never triggers. (C)
- [x] **Offline at startup → permanent "Child not found"**; the name picker
  shows "No children profiles yet" and suggests setup. Needs a
  "couldn't load — try again" state. (CX)
- [x] **Celebrates before the save lands.** Offline "I'm done" plays the
  celebration, then a red adult error, then the task comes back. Show
  saving / done / tap to retry. (CX)
- [x] **Adult error toasts on the child screen** ("Failed to purchase reward",
  "Failed to update child"). (C)
- [x] **Double-tapping a chore** records it twice and replays the sound. (C)
- [x] **No undo for an accidental chore tap** on the child side (safe: stars only
  come from parents). (X)
- [x] **Per-day wake times ignored** for the sleepy / free-time logic. (C)
- [x] **Rest day hides the reward loop** — no star chip, shop, approval
  celebration or chores. (C)
- [x] **Chores disappear** in the "Next up" and "All done" states; a day with no
  timed tasks says "All done for today!" from the morning. (C)
- [x] **Free time eaten by the worm** drops to a bare list with no pet. (C)
- [x] **Bedtime after midnight / tasks past midnight** — decided: the day
  starts fresh at midnight. The child screen cuts anything off at midnight;
  the task form refuses times that run past it and a Bedtime after midnight.
  The still-to-do chime no longer plays with the bedtime one. (C)
- [x] **Shop numbers** — header shows all stars while cards subtract pending asks;
  a pending ask for a removed reward holds stars invisibly; evening denials
  show next day (UTC vs Pacific); parent Redeem never celebrates. (C)
- [x] **Removing a reward hides past purchases** from the "Mine" shelf. (CX)
- [x] **Free time choices** — decided: free time opens on Biscuit; with more
  than 10 minutes left the child can pick "Spin the wheel" instead. Five
  minutes before the next task Biscuit says "Time to get ready", on top of
  the wheel or Playtime. (X)
- [x] Small: the tiny "Show pet instead" link, the no-school filter dropping
  anything containing "school", the dead realtime channel. Two tasks can no
  longer start at the same time (decided: never allowed; every save path
  checks, see `src/utils/startClash.ts`). (C)

## 3. Parent scheduling

- [x] **"Only this date" edits** — the prompt disables "Only on…" when the edit
  changes the name, stars, how it works, icon, checklist or days, and says
  why; "All days" after a one-day change keeps the base time unless the time
  was actually changed. (C)
- [x] **School schedule** — unticking a day now removes School that day (the
  School row's days follow the editor); only days that differ from the usual
  time keep their own time; school days can be as short as 15 minutes. (C)
- [x] **Planner delete** — a real dialog: "Only on <day>" / "Every day" /
  Cancel for repeating tasks, a confirm for one-offs, and built-in rows can
  only be skipped for a day. (C)
- [x] **"Also add to" another child drops the date** (lands on today). (C)
- [x] **Chore tiles stack** — chores whose windows overlap now share the space
  instead of sitting on top of each other. (C)
- [x] **Can't give stars for Normal tasks** — "Mark done" shows for any task
  with stars once its time has come, so Give ★ is reachable. (C)
- [x] **Drag moves every day** — a repeating task moves on that day only, with
  an "Every day" button in the toast. Skipped days show under "Skipped this
  day" in the Planner with Restore. (C)
- [x] **Suggested time ignores the chosen day** — only that day's tasks count,
  between its wake-up and bedtime; no more "24:xx". (C)
- [x] **Only one rest day per child** — now any number of dates
  (`children.rest_dates`); the "moves from…" behaviour is gone. (CX)
- [x] **Holiday form remembers the previous holiday** — resets every time it
  opens. (C)
- [x] **Missing checks** — chore window must end after it starts; setup times
  must run wake-up → meals → bedtime; stars capped at 20 per task; nothing
  runs past midnight; no two tasks start at the same time. (CX)
- [x] **Calendar looks connected when sync fails** — Settings shows when this
  device last synced, or that the last sync failed with a Reconnect button.
  Automatic syncs now record failures (they were swallowed). A server-side
  record would cover every device. (CX)

## 4. Parent account, rewards, alerts

- [x] **Invitee who already has children** — decided: offer to bring them.
  The join screen lists children the invitee set up on their own and offers
  "Join and bring Maya" / "Join without Maya" (if Maya is already in that
  family) / "Not now". Bringing moves the children (with their tasks, stars,
  rewards) and removes the empty old family; without, nothing is deleted.
  (follow-up from section 1)
- [x] **Parent PIN is stored in plain text** — now a bcrypt hash in
  `household_pins`, which no client can read; set and checked by
  `set_parent_pin` / `verify_parent_pin`; `households.has_parent_pin` for the
  UI. Five wrong tries pause the lock for 30 seconds. (follow-up)
- [x] **Invites** — the link shows "Join <family>?" first (or "You're already
  in", "expired", "already used"); an invite sent to an email only works for
  that account; invites can be cancelled; the owner can remove a co-parent and
  anyone can leave; email sign-up from an invite comes back to it; joining
  lands on the parent side. (C)
- [x] **Password-reset form never closes** — the "set a new password" state is
  shared app-wide now. (C)
- [x] **Deleting a reward leaves pending requests stuck** holding stars. (C)
- [x] **Missed-important alerts** — can be dismissed for the day (per
  device); no longer skip newly overdue tasks after a Give ★; not on rest
  days. (C)
- [x] **Empty dashboard dead end** — Settings (household, PIN, sign out) is
  reachable with no children; load errors show "We couldn't load your
  family". (C)
- [x] **Connect Google Calendar may switch accounts** — mitigated: if Google
  signs in a different account, it's signed out with an explanation. The real
  fix is `linkIdentity`, which needs manual identity linking enabled in
  Supabase Auth settings. (C)
- [x] **Deleting a child from its page** now returns to the family dashboard. (C)
- [x] **Profile edit form keeps stale data** — refreshes every time it opens
  and saves only the fields you changed; times must run in order. (C)
- [x] **Dashboard Now/Next** — uses today's real times (one-day changes,
  skipped days, built-in rows) in Pacific time and says "Rest day"; "Pack
  lunch" shows in upcoming. (C)

## 5. Consistency and polish

- [ ] **Words** — onboarding: Daily routine / Must finish / Chores / nice to
  have; form: Task|Chore, Normal / Must finish / Free time (hidden under More
  options). Product name: PetPals / Happy Critter Routines / Taskie. (CX)
- [ ] **Timezone fixed to Los Angeles** — show the family's timezone; decide
  what happens when travelling. (X)
- [ ] **Errors titled "Conflict"** for any save failure. (C)
- [ ] **No star ledger** — manual ± not recorded; deleting a task erases its
  star history; Reports can't reconcile. (C)
- [ ] **Service worker** caches Supabase GETs and force-reloads the child screen
  after deploys. (C)
- [ ] **Small tap targets** — invite copy buttons, 32px edit buttons. (C)

## Hygiene still open (from 2026-09-09)

- [ ] Old service-role key in git history (old project) — rotate or delete it.
- [x] `types.ts` regenerated from the live database (all tables and functions).
- [x] `adjust_child_coins` checked into `supabase/migrations`.
- [ ] Base tables (children, tasks, rewards…) still missing from
  `supabase/migrations`.
- [ ] Almost no tests.
